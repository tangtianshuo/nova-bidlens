import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import type { DocumentAst } from '@bidlens/shared';
import type {
  AnalysisProjectDetail, AnalysisProjectSummary, CreateRiskProjectRequest, RiskFinding,
  RiskProgress, RiskSubmission, RiskLevel, ProjectStatus, AnalysisPhase, TenderBaseline,
  SubmissionState, AuditEvent, AnalysisCheckpoint, DetectorRun, Evidence,
  ExportRiskReportRequest, ExportRiskReportResponse, FilePairAssessment,
} from '@bidlens/shared';
import { parseDocumentFile, type ParserServiceOptions, isMinerUAvailable } from './parser-service.js';
import { validateFile } from './file-validator.js';
import { generateMarkdownReport, generateHtmlReport, computeReportHash } from './report-generator.js';
import { EngineManager, toEngineDocumentAst, type RiskAnalyzeRequest, type RiskProgressNotification } from './engine-manager.js';
import {
  createProjectRepository,
  createSubmissionRepository,
  createDocumentVersionRepository,
  createFindingRepository,
  createEvidenceRepository,
  createReviewDecisionRepository,
  createCheckpointRepository,
  createAuditEventRepository,
  createExportedReportRepository,
  createFilePairAssessmentRepository,
  createTenderBaselineRepository,
  createDetectorRunRepository,
  createProjectRiskAssessmentRepository,
} from '../db/repositories.js';
import { decrypt, encrypt } from '../db/crypto.js';
import { log } from '../logger';

// ── phase order for checkpoint/resume ──

const PHASE_ORDER: AnalysisPhase[] = [
  'validating', 'parsing', 'extracting-nodes', 'extracting-entities',
  'filtering-tender-content', 'recalling-candidates',
  'detecting', 'aggregating', 'persisting', 'completed',
];

// ── runtime-only state (not persisted) ──

interface ActiveRun {
  abort: AbortController;
  startedAt: number;
}

/** Repository-backed risk review service. Active runs are in-memory; everything else is DB. */
export class RiskReviewService {
  private readonly activeRuns = new Map<string, ActiveRun>();

  private readonly projectRepo;
  private readonly submissionRepo;
  private readonly documentVersionRepo;
  private readonly findingRepo;
  private readonly evidenceRepo;
  private readonly reviewDecisionRepo;
  private readonly checkpointRepo;
  private readonly auditEventRepo;
  private readonly exportReportRepo;
  private readonly filePairAssessmentRepo;
  private readonly tenderBaselineRepo;
  private readonly detectorRunRepo;
  private readonly projectRiskAssessmentRepo;

  constructor(
    private readonly window: BrowserWindow,
    db: Database.Database,
    private readonly encryptionKey: Buffer,
    private readonly engineManager: EngineManager,
  ) {
    this.projectRepo = createProjectRepository(db);
    this.submissionRepo = createSubmissionRepository(db);
    this.documentVersionRepo = createDocumentVersionRepository(db);
    this.findingRepo = createFindingRepository(db);
    this.evidenceRepo = createEvidenceRepository(db);
    this.reviewDecisionRepo = createReviewDecisionRepository(db);
    this.checkpointRepo = createCheckpointRepository(db);
    this.auditEventRepo = createAuditEventRepository(db);
    this.exportReportRepo = createExportedReportRepository(db);
    this.filePairAssessmentRepo = createFilePairAssessmentRepository(db);
    this.tenderBaselineRepo = createTenderBaselineRepository(db);
    this.detectorRunRepo = createDetectorRunRepository(db);
    this.projectRiskAssessmentRepo = createProjectRiskAssessmentRepository(db);
  }

  // ── public API ──

  listProjects(filters?: { status?: ProjectStatus; limit?: number; offset?: number }): AnalysisProjectSummary[] {
    const rows = this.projectRepo.list(filters);
    return rows.map((row) => {
      const submissions = this.submissionRepo.getByProject(row.id);
      const findings = this.findingRepo.getByProject(row.id);
      const level = this.deriveRiskLevel(findings);
      const hasBaseline = Boolean(this.tenderBaselineRepo.getByProject(row.id));
      const elapsedMs = row.status === 'running' && this.activeRuns.has(row.id)
        ? Date.now() - this.activeRuns.get(row.id)!.startedAt
        : row.elapsed_ms;
      return {
        id: row.id, name: row.name, createdAt: row.created_at, status: row.status as ProjectStatus,
        submissionCount: submissions.length, riskLevel: level,
        preset: row.preset as AnalysisProjectSummary['preset'],
        hasBaseline, elapsedMs,
      };
    });
  }

  getProject(projectId: string): AnalysisProjectDetail {
    const row = this.projectRepo.getById(projectId);
    if (!row) throw new Error(`风险审查项目不存在: ${projectId}`);
    return this.reconstructDetail(row);
  }

  async createProject(request: CreateRiskProjectRequest): Promise<{ projectId: string }> {
    log.info('[Risk] createProject — name:', request.name, 'submissions:', request.submissions.length, 'hasBaseline:', Boolean(request.baseline));
    if (request.submissions.length < 2 || request.submissions.length > 8) throw new Error('投标文件数量必须为 2-8 个');

    const projectId = this.projectRepo.create({
      name: request.name.trim(),
      preset: request.preset,
      modelVersion: 'rust-engine',
      ruleVersion: '1.0.0',
      parserVersion: '',
      matcherVersion: 'lexical-1.0.0',
    });

    // create submission rows
    const submissionIds: string[] = [];
    for (const file of request.submissions) {
      const id = this.submissionRepo.create({
        projectId, fileName: path.basename(file.path),
        fileFormat: path.extname(file.path).slice(1).toLowerCase() as 'docx' | 'pdf' | 'nzbtf',
        fileSizeBytes: 0, sha256: '', filePath: file.path, encryptionKey: this.encryptionKey,
      });
      submissionIds.push(id);
    }

    // update project warnings
    const warnings = [
      ...(!request.baseline ? ['未提供招标基线，公共内容可能产生误报'] : []),
      '本地语义模型尚未接入，当前使用可解释词法检测',
    ];
    this.projectRepo.updateStatus(projectId, 'draft');
    // store degradation via audit event
    this.auditEventRepo.append({ projectId, eventType: 'project-created', payload: { warnings, degradationReason: 'embedding_unavailable', submissions: request.submissions.map(s => ({ path: s.path })), submissionCount: request.submissions.length, hasBaseline: Boolean(request.baseline), baseline: request.baseline ? { path: request.baseline.path } : undefined } });

    const abort = new AbortController();
    this.activeRuns.set(projectId, { abort, startedAt: Date.now() });
    log.info('[Risk] Starting analysis pipeline for project:', projectId);
    void this.run(projectId, request, abort);
    return { projectId };
  }

  cancel(projectId: string) {
    log.info('[Risk] cancel — projectId:', projectId);
    const run = this.activeRuns.get(projectId);
    if (!run) {
      const row = this.projectRepo.getById(projectId);
      if (!row || ['ready', 'failed', 'partial', 'interrupted'].includes(row.status)) return { projectId, cancelled: false };
      return { projectId, cancelled: false };
    }
    run.abort.abort();
    this.projectRepo.updateStatus(projectId, 'interrupted');
    this.auditEventRepo.append({ projectId, eventType: 'analysis-cancelled' });
    this.emitProgress(projectId, 'interrupted', null, '已取消');
    return { projectId, cancelled: true };
  }

  resumeRiskProject(projectId: string): { projectId: string } {
    log.info('[Risk] resumeRiskProject — projectId:', projectId);
    const row = this.projectRepo.getById(projectId);
    if (!row) throw new Error(`风险审查项目不存在: ${projectId}`);
    if (!['interrupted', 'failed'].includes(row.status)) throw new Error(`项目状态不可恢复: ${row.status}`);

    const checkpoint = this.checkpointRepo.getLatest(projectId);
    const resumePhase = checkpoint ? checkpoint.phase as AnalysisPhase : 'validating';

    // Find the request from audit event to reconstruct submission paths
    const createdEvent = this.auditEventRepo.getByProject(projectId, 'project-created');
    const payload = createdEvent[0] ? JSON.parse(createdEvent[0].payload_json) as Record<string, unknown> : undefined;
    if (!payload?.submissions) throw new Error('无法恢复：缺少提交信息');

    const submissions = payload.submissions as { path: string }[];
    const hasBaseline = Boolean(payload.hasBaseline);
    const baseline = payload.baseline as { path: string } | undefined;

    const request: CreateRiskProjectRequest = {
      name: row.name,
      submissions: submissions.map((s) => ({ path: s.path })),
      baseline: baseline ? { path: baseline.path } : undefined,
      preset: row.preset as CreateRiskProjectRequest['preset'],
    };

    const abort = new AbortController();
    this.activeRuns.set(projectId, { abort, startedAt: Date.now() });
    this.auditEventRepo.append({ projectId, eventType: 'analysis-recovered', payload: { resumePhase } });
    void this.run(projectId, request, abort, resumePhase);
    return { projectId };
  }

  retryRiskSubmission(projectId: string, submissionId: string): { projectId: string } {
    const row = this.projectRepo.getById(projectId);
    if (!row) throw new Error(`风险审查项目不存在: ${projectId}`);
    this.submissionRepo.updateStatus(submissionId, 'pending');
    this.projectRepo.updateStatus(projectId, 'running');
    this.auditEventRepo.append({ projectId, eventType: 'file-replaced', payload: { submissionId } });
    // Re-trigger full analysis since findings are pairwise
    const request: CreateRiskProjectRequest = {
      name: row.name,
      submissions: this.submissionRepo.getByProject(projectId).map(s => ({ path: '', name: s.file_name })),
      preset: row.preset as CreateRiskProjectRequest['preset'],
    };
    const abort = new AbortController();
    this.activeRuns.set(projectId, { abort, startedAt: Date.now() });
    void this.run(projectId, request, abort);
    return { projectId };
  }

  acceptPartial(projectId: string): { projectId: string } {
    const row = this.projectRepo.getById(projectId);
    if (!row) throw new Error(`风险审查项目不存在: ${projectId}`);
    this.projectRepo.updateStatus(projectId, 'partial');
    this.auditEventRepo.append({ projectId, eventType: 'partial-accepted' });
    return { projectId };
  }

  reanalyzeProject(projectId: string): { projectId: string } {
    log.info('[Risk] reanalyzeProject — projectId:', projectId);
    const row = this.projectRepo.getById(projectId);
    if (!row) throw new Error(`风险审查项目不存在: ${projectId}`);
    if (row.status === 'running') throw new Error('项目正在分析中');

    // Reconstruct request from audit event
    const createdEvent = this.auditEventRepo.getByProject(projectId, 'project-created');
    const payload = createdEvent[0] ? JSON.parse(createdEvent[0].payload_json) as Record<string, unknown> : undefined;
    if (!payload?.submissions) throw new Error('无法重新分析：缺少提交信息');

    const submissions = payload.submissions as { path: string }[];
    const hasBaseline = Boolean(payload.hasBaseline);
    const baseline = payload.baseline as { path: string } | undefined;

    const request: CreateRiskProjectRequest = {
      name: row.name,
      submissions: submissions.map((s) => ({ path: s.path })),
      baseline: baseline ? { path: baseline.path } : undefined,
      preset: row.preset as CreateRiskProjectRequest['preset'],
    };

    // Clear old results
    this.findingRepo.deleteByProject(projectId);
    this.detectorRunRepo.deleteByProject(projectId);
    this.filePairAssessmentRepo.deleteByProject(projectId);
    this.projectRiskAssessmentRepo.deleteByProject(projectId);
    this.checkpointRepo.deleteByProject(projectId);

    // Reset project status
    this.projectRepo.updateStatus(projectId, 'draft');
    this.projectRepo.updateElapsed(projectId, 0);

    // Reset submission statuses
    const submissionRows = this.submissionRepo.getByProject(projectId);
    for (const sub of submissionRows) {
      this.submissionRepo.updateStatus(sub.id, 'pending');
    }

    this.auditEventRepo.append({ projectId, eventType: 'analysis-reanalyzed' });

    const abort = new AbortController();
    this.activeRuns.set(projectId, { abort, startedAt: Date.now() });
    void this.run(projectId, request, abort);
    return { projectId };
  }

  deleteProject(projectId: string): { deleted: boolean } {
    const row = this.projectRepo.getById(projectId);
    if (!row) return { deleted: false };
    this.activeRuns.get(projectId)?.abort.abort();
    this.activeRuns.delete(projectId);
    // CASCADE handles all child tables
    this.projectRepo.delete(projectId);
    return { deleted: true };
  }

  saveRiskFindingReview(request: { projectId: string; findingId: string; status?: string; important?: boolean; note?: string }): RiskFinding {
    const findingRow = this.findingRepo.getByProject(request.projectId).find((f) => f.id === request.findingId);
    if (!findingRow) throw new Error('风险发现项不存在');

    const status = (request.status && ['pending', 'confirmed', 'ignored'].includes(request.status))
      ? request.status as RiskFinding['reviewStatus']
      : findingRow.review_status as RiskFinding['reviewStatus'];
    const important = typeof request.important === 'boolean' ? request.important : Boolean(findingRow.important);
    const note = request.note ?? '';

    this.findingRepo.updateReview(request.findingId, status, important, note, this.encryptionKey);
    this.reviewDecisionRepo.upsert({
      projectId: request.projectId, findingId: request.findingId,
      status, important, note, encryptionKey: this.encryptionKey,
    });
    this.auditEventRepo.append({ projectId: request.projectId, eventType: 'review-changed', payload: { findingId: request.findingId, status, important } });

    // reconstruct and return the updated finding
    const evidenceRows = this.evidenceRepo.getByFinding(request.findingId, this.encryptionKey);
    return this.rowToFinding(findingRow, evidenceRows);
  }

  getAuditEvents(projectId: string): AuditEvent[] {
    const rows = this.auditEventRepo.getByProject(projectId);
    return rows.map((r) => ({
      id: r.id, projectId: r.project_id,
      eventType: r.event_type as AuditEvent['eventType'],
      payload: JSON.parse(r.payload_json),
      createdAt: r.created_at,
    }));
  }

  getPdfFile(projectId: string, submissionId: string): { filePath: string } | null {
    const submissionRows = this.submissionRepo.getByProject(projectId);
    const sub = submissionRows.find(s => s.id === submissionId);
    if (!sub || !sub.file_path_encrypted) return null;
    const filePath = decrypt(sub.file_path_encrypted, this.encryptionKey);
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) return null;
    return { filePath: resolvedPath };
  }

  async exportRiskReport(request: ExportRiskReportRequest, savePath: string): Promise<ExportRiskReportResponse> {
    const detail = this.getProject(request.projectId);

    if (request.format === 'pdf') {
      const html = generateHtmlReport(detail, request.scope);
      await this.generatePdfFromHtml(html, savePath);
      const resultHash = computeReportHash(html);
      this.exportReportRepo.create({
        projectId: request.projectId, format: request.format,
        scope: request.scope, resultHash, filePath: savePath, encryptionKey: this.encryptionKey,
      });
      this.auditEventRepo.append({ projectId: request.projectId, eventType: 'report-exported', payload: { format: request.format, scope: request.scope } });
      return { filePath: savePath, resultHash };
    }

    const content = request.format === 'html'
      ? generateHtmlReport(detail, request.scope)
      : generateMarkdownReport(detail, request.scope);
    const resultHash = computeReportHash(content);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(savePath, content, 'utf-8');

    this.exportReportRepo.create({
      projectId: request.projectId, format: request.format,
      scope: request.scope, resultHash, filePath: savePath, encryptionKey: this.encryptionKey,
    });
    this.auditEventRepo.append({ projectId: request.projectId, eventType: 'report-exported', payload: { format: request.format, scope: request.scope } });
    return { filePath: savePath, resultHash };
  }

  private async generatePdfFromHtml(htmlContent: string, savePath: string): Promise<void> {
    const { BrowserWindow } = await import('electron');
    const { writeFile, unlink } = await import('node:fs/promises');
    const os = await import('node:os');

    const tmpFile = path.join(os.tmpdir(), `bidlens-report-${Date.now()}.html`);
    await writeFile(tmpFile, htmlContent, 'utf-8');

    const pdfWindow = new BrowserWindow({ show: false });
    try {
      await pdfWindow.loadFile(tmpFile);
      const pdfData = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });
      await writeFile(savePath, Buffer.from(pdfData));
    } finally {
      pdfWindow.close();
      await unlink(tmpFile).catch(() => {});
    }
  }

  // ── analysis pipeline ──

  private async run(projectId: string, request: CreateRiskProjectRequest, abort: AbortController, startPhase?: AnalysisPhase) {
    const started = this.activeRuns.get(projectId)?.startedAt ?? Date.now();
    const startIdx = startPhase ? PHASE_ORDER.indexOf(startPhase) : 0;
    log.info('[Risk] Pipeline started — projectId:', projectId, 'startPhase:', startPhase ?? 'validating');

    try {
      this.projectRepo.updateStatus(projectId, 'running', PHASE_ORDER[startIdx] ?? 'validating');
      this.emitProgress(projectId, 'running', PHASE_ORDER[startIdx] ?? 'validating', '正在验证文件...');

      const inputs = [...request.submissions, ...(request.baseline ? [request.baseline] : [])];

      // ── validating ──
      if (startIdx <= 0) {
        this.setPhase(projectId, 'validating');
        const mineruAvailable = isMinerUAvailable();
        const validations = await Promise.all(inputs.map((file) => validateFile(file.path, { mineruAvailable })));
        const problems = validations
          .map((v, i) => ({ v, name: inputs[i].path.split(/[/\\]/).pop() }))
          .filter(({ v }) => !v.supported || v.error);
        if (problems.length > 0) {
          const details = problems.map(({ v, name }) => {
            if (v.error) return `${name}: ${v.error.message}`;
            if (!v.supported) return `${name}: 不支持的文件格式 (.${v.extension})`;
            return name;
          }).join('；');
          throw new Error(`存在不可解析或不支持的文件：${details}。支持的格式：DOCX、PDF、NZBTF`);
        }
        this.checkCancelled(abort, projectId);
      }

      // ── parsing ──
      let parsed: DocumentAst[];
      if (startIdx <= 1) {
        this.setPhase(projectId, 'parsing');
        this.emitProgress(projectId, 'running', 'parsing', '正在解析投标文件...', 0, inputs.length);
        parsed = [];
        for (let i = 0; i < inputs.length; i++) {
          const fileIndex = i;
          const onProgress = (stageLabel: string) => {
            this.emitProgress(projectId, 'running', 'parsing', stageLabel, fileIndex + 1, inputs.length);
          };
          const result = await parseDocumentFile(inputs[i].path, { signal: abort.signal, onProgress } satisfies ParserServiceOptions);
          if (!result.success || !result.ast) throw new Error(result.error?.message ?? '文档解析失败');
          parsed.push(result.ast);
          // Cache AST to document_versions for resume
          this.cacheDocumentAst(result.ast);
          this.emitProgress(projectId, 'running', 'parsing', `已解析 ${i + 1}/${inputs.length}`, i + 1, inputs.length);
          this.checkCancelled(abort, projectId);
        }
      } else {
        // Resuming past parsing — try cached ASTs first, re-parse on miss
        const submissionRowsForCache = this.submissionRepo.getByProject(projectId);
        parsed = [];
        for (let i = 0; i < inputs.length; i++) {
          const cachedHash = submissionRowsForCache[i]?.sha256;
          const cached = cachedHash ? this.loadCachedAstByHash(cachedHash) : null;
          if (cached) {
            parsed.push(cached);
          } else {
            const fileIndex = i;
            const onProgress = (stageLabel: string) => {
              this.emitProgress(projectId, 'running', 'parsing', stageLabel, fileIndex + 1, inputs.length);
            };
            const result = await parseDocumentFile(inputs[i].path, { signal: abort.signal, onProgress } satisfies ParserServiceOptions);
            if (!result.success || !result.ast) throw new Error(result.error?.message ?? '文档解析失败');
            parsed.push(result.ast);
            this.cacheDocumentAst(result.ast);
          }
        }
      }

      // update project parserVersion from actual parser used
      if (parsed.length > 0 && parsed[0].parserVersion) {
        this.projectRepo.updateParserVersion(projectId, parsed[0].parserVersion);
      }

      // update submission statuses to 'extracted'
      const submissionRows = this.submissionRepo.getByProject(projectId);
      for (const sub of submissionRows) {
        this.submissionRepo.updateStatus(sub.id, 'extracted');
      }

      // ── Call Rust engine for the real analysis pipeline ──
      const submissions = toSubmissions(submissionRows, parsed.slice(0, request.submissions.length), inputs);
      const submissionAsts = parsed.slice(0, request.submissions.length);

      let findings: RiskFinding[];
      let filePairResults: Array<{
        submissionAId: string; submissionBId: string;
        directionalCoverageAB: number; directionalCoverageBA: number;
        symmetricSimilarity: number; riskLevel: RiskLevel;
        topFindingIds: string[]; findingCount: { high: number; medium: number; low: number };
        ruleVersion: string; analysisStatus: string;
      }> = [];
      let projectRisk: {
        level: RiskLevel; rawRuleScore: number; topContributingFindingIds: string[];
        highValueFindingCount: number; involvedSubmissionCount: number;
        strongEntityHitCount: number; tenderDiscountApplied: boolean; incompleteReason: string | null;
      } | null = null;
      let detectorRunResults: Array<{
        detectorType: string; status: string; candidateCount: number;
        hitCount: number; elapsedMs: number; errorMessage: string | null;
      }> = [];

      if (this.engineManager) {
        // ── Real pipeline: send ASTs to Rust engine ──
        this.setPhase(projectId, 'extracting-nodes');
        this.emitProgress(projectId, 'running', 'extracting-nodes', '正在调用分析引擎...');

        const baselineAst = request.baseline ? parsed[parsed.length - 1] : null;

        // Checkpoint resume: skip detectors that already completed
        const existingDetectorRuns = this.detectorRunRepo.getByProject(projectId);
        const completedDetectorTypes = existingDetectorRuns
          .filter(dr => dr.status === 'completed')
          .map(dr => dr.detector_type);

        const analyzeRequest: RiskAnalyzeRequest = {
          projectId,
          submissions: submissionAsts.map((ast, i) => ({
            submissionId: submissions[i].id,
            fileHash: submissions[i].sha256 || '0'.repeat(64),
            ast: toEngineDocumentAst(ast),
          })),
          baseline: baselineAst ? {
            submissionId: submissions[request.submissions.length]?.id ?? 'baseline',
            normalizedParagraphs: baselineAst.blocks
              .filter((b): b is import('@bidlens/shared').ParagraphNode => b.type === 'paragraph')
              .map(b => b.text),
          } : null,
          preset: (request.preset ?? 'standard') as 'strict' | 'standard' | 'loose',
          skipDetectors: completedDetectorTypes,
        };

        const rawResult = await this.engineManager.riskAnalyzeWithAst(
          analyzeRequest,
          abort.signal,
          (progress: RiskProgressNotification) => {
            if (progress.phase) {
              this.setPhase(projectId, progress.phase as AnalysisPhase);
            }
            this.emitProgress(projectId, 'running', progress.phase as AnalysisPhase, progress.stageLabel, progress.current, progress.total);
          },
        );

        // Defensive: validate engine response structure before accessing fields
        if (!rawResult || typeof rawResult !== 'object') {
          log.error('[Risk] Engine returned non-object result:', rawResult);
          throw new Error(`引擎返回无效结果: ${JSON.stringify(rawResult)}`);
        }
        const result = rawResult as Record<string, unknown>;
        if (!Array.isArray(result.findings)) {
          log.error('[Risk] Engine result missing findings array. Keys:', Object.keys(result));
          throw new Error(`引擎结果缺少 findings 字段。实际字段: ${Object.keys(result).join(', ')}`);
        }
        if (!Array.isArray(result.filePairAssessments)) {
          log.error('[Risk] Engine result missing filePairAssessments array. Keys:', Object.keys(result));
          throw new Error(`引擎结果缺少 filePairAssessments 字段。实际字段: ${Object.keys(result).join(', ')}`);
        }
        if (!result.projectRisk || typeof result.projectRisk !== 'object') {
          log.error('[Risk] Engine result missing projectRisk object. Keys:', Object.keys(result));
          throw new Error(`引擎结果缺少 projectRisk 字段。实际字段: ${Object.keys(result).join(', ')}`);
        }

        const typedResult = result as unknown as {
          findings: Array<{
            id: string; detectorType: string; riskLevel: string;
            involvedSubmissionIds: string[]; symmetricSimilarity: number;
            directionalCoverage: Array<{ fromId: string; toId: string; coverage: number }>;
            confidenceScore: number; scoreBreakdown: Record<string, unknown>;
            ruleVersion: string; evidence: Array<{
              id: string; detectorType: string; matchBasis: string; similarityScore: number;
              sourceSubmissionId: string; sourceNodeId: string;
              sourceOriginalText: string; sourceNormalizedText: string;
              sourceSectionPath: string[]; sourcePageRange: [number, number] | null;
              sourceTableLocation: Record<string, unknown> | null;
              targetSubmissionId: string; targetNodeId: string;
              targetOriginalText: string; targetNormalizedText: string;
              targetSectionPath: string[]; targetPageRange: [number, number] | null;
              targetTableLocation: Record<string, unknown> | null;
              contextBefore: string; contextAfter: string;
              tenderFiltered: boolean; tenderFilterReason: string | null; ruleVersion: string;
            }>;
          }>;
          filePairAssessments: Array<{
            submissionAId: string; submissionBId: string;
            directionalCoverageAB: number; directionalCoverageBA: number;
            symmetricSimilarity: number; riskLevel: string;
            topFindingIds: string[]; findingCount: { high: number; medium: number; low: number };
            ruleVersion: string; analysisStatus: string;
          }>;
          projectRisk: {
            level: string; rawRuleScore: number; topContributingFindingIds: string[];
            highValueFindingCount: number; involvedSubmissionCount: number;
            strongEntityHitCount: number; tenderDiscountApplied: boolean; incompleteReason: string | null;
          };
          detectorRuns: Array<{
            detectorType: string; status: string; candidateCount: number;
            hitCount: number; elapsedMs: number; errorMessage: string | null;
          }>;
        };

        // Map Rust findings to shared RiskFinding type
        findings = typedResult.findings.map(f => ({
          id: f.id, detectorType: f.detectorType as RiskFinding['detectorType'],
          riskLevel: f.riskLevel as RiskLevel,
          involvedSubmissionIds: f.involvedSubmissionIds,
          evidence: (f.evidence ?? []).map(ev => ({
            id: ev.id, detectorType: ev.detectorType as Evidence['detectorType'],
            matchBasis: ev.matchBasis as Evidence['matchBasis'],
            similarityScore: ev.similarityScore,
            sourceSubmissionId: ev.sourceSubmissionId, sourceNodeId: ev.sourceNodeId,
            sourceOriginalText: ev.sourceOriginalText, sourceNormalizedText: ev.sourceNormalizedText,
            sourceSectionPath: ev.sourceSectionPath, sourcePageRange: ev.sourcePageRange,
            sourceTableLocation: ev.sourceTableLocation as Evidence['sourceTableLocation'],
            targetSubmissionId: ev.targetSubmissionId, targetNodeId: ev.targetNodeId,
            targetOriginalText: ev.targetOriginalText, targetNormalizedText: ev.targetNormalizedText,
            targetSectionPath: ev.targetSectionPath, targetPageRange: ev.targetPageRange,
            targetTableLocation: ev.targetTableLocation as Evidence['targetTableLocation'],
            contextBefore: ev.contextBefore, contextAfter: ev.contextAfter,
            tenderFiltered: ev.tenderFiltered, tenderFilterReason: ev.tenderFilterReason,
            ruleVersion: ev.ruleVersion,
          })),
          symmetricSimilarity: f.symmetricSimilarity ?? 0,
          directionalCoverage: f.directionalCoverage ?? [],
          confidenceScore: f.confidenceScore ?? 0,
          scoreBreakdown: (f.scoreBreakdown ?? {}) as unknown as RiskFinding['scoreBreakdown'],
          ruleVersion: f.ruleVersion ?? '1.0',
          reviewStatus: 'pending', important: false, reviewNote: '', reviewedAt: null,
        }));

        filePairResults = typedResult.filePairAssessments.map(fp => ({
          submissionAId: fp.submissionAId, submissionBId: fp.submissionBId,
          directionalCoverageAB: fp.directionalCoverageAB ?? 0, directionalCoverageBA: fp.directionalCoverageBA ?? 0,
          symmetricSimilarity: fp.symmetricSimilarity ?? 0, riskLevel: (fp.riskLevel ?? 'low') as RiskLevel,
          topFindingIds: fp.topFindingIds ?? [], findingCount: fp.findingCount ?? { high: 0, medium: 0, low: 0 },
          ruleVersion: fp.ruleVersion ?? '1.0', analysisStatus: fp.analysisStatus ?? 'complete',
        }));

        const pr = typedResult.projectRisk;
        projectRisk = {
          level: pr.level as RiskLevel,
          rawRuleScore: pr.rawRuleScore,
          topContributingFindingIds: pr.topContributingFindingIds ?? [],
          highValueFindingCount: pr.highValueFindingCount ?? 0,
          involvedSubmissionCount: pr.involvedSubmissionCount ?? 0,
          strongEntityHitCount: pr.strongEntityHitCount ?? 0,
          tenderDiscountApplied: pr.tenderDiscountApplied ?? false,
          incompleteReason: pr.incompleteReason ?? null,
        };

        detectorRunResults = Array.isArray(typedResult.detectorRuns) ? typedResult.detectorRuns : [];

        // Persist detector runs
        for (const dr of detectorRunResults) {
          this.detectorRunRepo.create({
            projectId, detectorType: dr.detectorType, status: dr.status,
            candidateCount: dr.candidateCount, hitCount: dr.hitCount,
            elapsedMs: dr.elapsedMs, errorMessage: dr.errorMessage ?? undefined,
            ruleVersion: '0.3.0',
          });
        }
      } else {
        throw new Error('分析引擎不可用');
      }

      // ── aggregating ──
      this.setPhase(projectId, 'aggregating');
      this.emitProgress(projectId, 'running', 'aggregating', '正在汇总风险...');

      // persist findings to DB
      for (const finding of findings) {
        const findingId = this.findingRepo.create({
          projectId, detectorType: finding.detectorType, riskLevel: finding.riskLevel,
          involvedSubmissionIds: finding.involvedSubmissionIds,
          symmetricSimilarity: finding.symmetricSimilarity,
          directionalCoverage: finding.directionalCoverage,
          confidenceScore: finding.confidenceScore,
          scoreBreakdown: finding.scoreBreakdown as unknown as Record<string, unknown>, ruleVersion: finding.ruleVersion,
          encryptionKey: this.encryptionKey,
        });
        // persist evidence
        for (const ev of finding.evidence) {
          this.evidenceRepo.create({
            findingId, detectorType: ev.detectorType, matchBasis: ev.matchBasis,
            similarityScore: ev.similarityScore,
            sourceSubmissionId: ev.sourceSubmissionId, sourceNodeId: ev.sourceNodeId,
            sourceOriginalText: ev.sourceOriginalText, sourceNormalizedText: ev.sourceNormalizedText,
            sourceSectionPath: ev.sourceSectionPath, sourcePageRange: ev.sourcePageRange ?? undefined,
            sourceTableLocation: (ev.sourceTableLocation ?? undefined) as Record<string, unknown> | undefined,
            targetSubmissionId: ev.targetSubmissionId, targetNodeId: ev.targetNodeId,
            targetOriginalText: ev.targetOriginalText, targetNormalizedText: ev.targetNormalizedText,
            targetSectionPath: ev.targetSectionPath, targetPageRange: ev.targetPageRange ?? undefined,
            targetTableLocation: (ev.targetTableLocation ?? undefined) as Record<string, unknown> | undefined,
            contextBefore: ev.contextBefore, contextAfter: ev.contextAfter,
            tenderFiltered: ev.tenderFiltered, tenderFilterReason: ev.tenderFilterReason ?? undefined,
            ruleVersion: ev.ruleVersion, encryptionKey: this.encryptionKey,
          });
        }
      }

      // compute and persist file pair assessments
      this.filePairAssessmentRepo.deleteByProject(projectId);
      if (filePairResults.length > 0) {
        // Use Rust-computed file pair assessments
        for (const fp of filePairResults) {
          this.filePairAssessmentRepo.create({
            projectId, submissionAId: fp.submissionAId, submissionBId: fp.submissionBId,
            directionalCoverageAB: fp.directionalCoverageAB ?? 0, directionalCoverageBA: fp.directionalCoverageBA ?? 0,
            symmetricSimilarity: fp.symmetricSimilarity, riskLevel: fp.riskLevel,
            topFindingIds: fp.topFindingIds, findingCount: fp.findingCount,
            ruleVersion: fp.ruleVersion, analysisStatus: fp.analysisStatus as 'complete' | 'partial',
          });
        }
      } else {
        throw new Error('引擎未返回文件对评估结果');
      }

      // ── persisting ──
      this.setPhase(projectId, 'persisting');

      // persist project risk assessment
      const projectRow = this.projectRepo.getById(projectId);
      if (projectRow) {
        if (projectRisk) {
          // Use Rust-computed project risk
          this.projectRiskAssessmentRepo.create({
            projectId, level: projectRisk.level, rawRuleScore: projectRisk.rawRuleScore,
            topContributingFindingIds: projectRisk.topContributingFindingIds,
            preset: request.preset ?? 'standard', ruleVersion: '0.3.0',
            analysisStatus: 'complete',
            highValueFindingCount: projectRisk.highValueFindingCount,
            involvedSubmissionCount: projectRisk.involvedSubmissionCount,
            strongEntityHitCount: projectRisk.strongEntityHitCount,
            tenderDiscountApplied: projectRisk.tenderDiscountApplied,
            incompleteReason: projectRisk.incompleteReason ?? undefined,
          });
        } else {
          throw new Error('引擎未返回项目风险评估');
        }
      }

      // compute and store final elapsed
      const elapsedMs = Date.now() - started;
      this.projectRepo.updateStatus(projectId, 'ready', 'completed');
      this.projectRepo.updateElapsed(projectId, elapsedMs);
      this.emitProgress(projectId, 'ready', 'completed', '分析完成');

      this.auditEventRepo.append({ projectId, eventType: 'analysis-completed', payload: { elapsedMs, findingCount: findings.length } });
    } catch (error) {
      const elapsedMs = Date.now() - started;
      this.projectRepo.updateElapsed(projectId, elapsedMs);
      const row = this.projectRepo.getById(projectId);
      if (row?.status !== 'interrupted') {
        this.projectRepo.updateStatus(projectId, 'failed');
      }
      const msg = error instanceof Error ? error.message : '分析失败';
      const isCancelled = row?.status === 'interrupted';
      log.error('[Risk] Pipeline failed — projectId:', projectId, 'error:', msg, 'elapsed:', elapsedMs, 'ms');
      this.emitProgress(projectId, isCancelled ? 'interrupted' : 'failed', null, isCancelled ? '已取消' : '分析失败');
      this.auditEventRepo.append({ projectId, eventType: isCancelled ? 'analysis-cancelled' : 'analysis-failed', payload: { error: msg, elapsedMs } });
    } finally {
      this.activeRuns.delete(projectId);
    }
  }

  // ── helpers ──

  private cacheDocumentAst(ast: DocumentAst): void {
    try {
      const existing = this.documentVersionRepo.getByHash(ast.sha256);
      if (existing) {
        this.documentVersionRepo.incrementRef(existing.id);
        return;
      }
      const astJson = JSON.stringify(ast);
      const astEncrypted = encrypt(astJson, this.encryptionKey);
      this.documentVersionRepo.create({
        sha256: ast.sha256, fileName: ast.filename,
        fileFormat: (path.extname(ast.filename).slice(1).toLowerCase() || 'docx') as 'docx' | 'pdf' | 'nzbtf',
        fileSizeBytes: 0, pageCount: ast.pageCount ?? undefined,
        parserVersion: ast.parserVersion, astEncrypted,
      });
    } catch {
      // Non-fatal: caching is best-effort
    }
  }

  private loadCachedAstByHash(sha256: string): DocumentAst | null {
    try {
      const row = this.documentVersionRepo.getByHash(sha256);
      if (!row) return null;
      const json = decrypt(row.ast_encrypted, this.encryptionKey);
      return JSON.parse(json) as DocumentAst;
    } catch {
      return null;
    }
  }

  private setPhase(projectId: string, phase: AnalysisPhase) {
    const row = this.projectRepo.getById(projectId);
    if (!row) return;
    this.projectRepo.updateStatus(projectId, row.status as ProjectStatus, phase);
    this.checkpointRepo.save({
      projectId, phase, inputHash: '', processingVersion: '0.2.2',
      completedDetectors: [], warnings: [], errors: [],
    });
  }

  private checkCancelled(abort: AbortController, projectId: string) {
    if (abort.signal.aborted) {
      this.projectRepo.updateStatus(projectId, 'interrupted');
      throw new Error('分析已取消');
    }
  }

  private emitProgress(projectId: string, status: ProjectStatus | string, phase: AnalysisPhase | null, stageLabel: string, current?: number, total?: number) {
    const run = this.activeRuns.get(projectId);
    const row = this.projectRepo.getById(projectId);
    const elapsedMs = run ? Date.now() - run.startedAt : (row?.elapsed_ms ?? 0);
    const warnings: string[] = row ? JSON.parse(row.warnings_json) : [];
    const progress: RiskProgress = { projectId, status: status as ProjectStatus, phase, stageLabel, current, total, elapsedMs, warnings };
    this.window.webContents.send('risk:progress', progress);
  }

  private reconstructDetail(row: import('../db/repositories.js').ProjectRow): AnalysisProjectDetail {
    const submissionRows = this.submissionRepo.getByProject(row.id);
    const findingRows = this.findingRepo.getByProject(row.id);

    const submissions: RiskSubmission[] = submissionRows.map((s) => ({
      id: s.id, fileName: s.file_name, fileFormat: s.file_format as 'docx' | 'pdf' | 'nzbtf',
      fileSizeBytes: s.file_size_bytes, pageCount: s.page_count, sha256: s.sha256,
      status: s.status as SubmissionState, warnings: JSON.parse(s.warnings_json),
    }));

    const findings: RiskFinding[] = findingRows.map((f) => {
      const evidenceRows = this.evidenceRepo.getByFinding(f.id, this.encryptionKey);
      return this.rowToFinding(f, evidenceRows);
    });

    const baselineRow = this.tenderBaselineRepo.getByProject(row.id);
    const baseline: TenderBaseline | null = baselineRow ? {
      id: baselineRow.id, projectId: baselineRow.project_id,
      submissionId: baselineRow.submission_id,
      status: baselineRow.status as TenderBaseline['status'],
      parseWarnings: JSON.parse(baselineRow.parse_warnings_json),
    } : null;
    const filePairRows = this.filePairAssessmentRepo.getByProject(row.id);
    const filePairAssessments: FilePairAssessment[] = filePairRows.map(r => ({
      id: r.id, projectId: r.project_id,
      submissionAId: r.submission_a_id, submissionBId: r.submission_b_id,
      directionalCoverageAB: r.directional_coverage_ab, directionalCoverageBA: r.directional_coverage_ba,
      symmetricSimilarity: r.symmetric_similarity,
      riskLevel: r.risk_level as RiskLevel,
      topFindingIds: JSON.parse(r.top_finding_ids_json),
      findingCount: JSON.parse(r.finding_count_json),
      ruleVersion: r.rule_version,
      analysisStatus: r.analysis_status as 'complete' | 'partial',
    }));

    const assessmentRow = this.projectRiskAssessmentRepo.getByProject(row.id);
    const assessment = assessmentRow ? {
      id: assessmentRow.id, projectId: assessmentRow.project_id,
      level: assessmentRow.level as RiskLevel,
      rawRuleScore: assessmentRow.raw_rule_score,
      topContributingFindingIds: JSON.parse(assessmentRow.top_contributing_finding_ids_json),
      preset: assessmentRow.preset as AnalysisProjectDetail['preset'],
      ruleVersion: assessmentRow.rule_version,
      analysisStatus: assessmentRow.analysis_status as 'complete' | 'partial',
      highValueFindingCount: assessmentRow.high_value_finding_count,
      involvedSubmissionCount: assessmentRow.involved_submission_count,
      strongEntityHitCount: assessmentRow.strong_entity_hit_count,
      tenderDiscountApplied: Boolean(assessmentRow.tender_discount_applied),
      incompleteReason: assessmentRow.incomplete_reason,
    } : this.buildAssessment(row, findings);

    const detectorRunRows = this.detectorRunRepo.getByProject(row.id);
    const detectorRuns: DetectorRun[] = detectorRunRows.map(r => ({
      id: r.id, projectId: r.project_id,
      detectorType: r.detector_type as DetectorRun['detectorType'],
      status: r.status as DetectorRun['status'],
      candidateCount: r.candidate_count, hitCount: r.hit_count,
      elapsedMs: r.elapsed_ms, errorMessage: r.error_message ?? null,
      ruleVersion: r.rule_version,
    }));

    // checkpoints
    const checkpointRow = this.checkpointRepo.getLatest(row.id);
    const checkpoints: AnalysisCheckpoint[] = checkpointRow ? [{
      id: checkpointRow.id, projectId: checkpointRow.project_id,
      phase: checkpointRow.phase as AnalysisPhase,
      inputHash: checkpointRow.input_hash,
      processingVersion: checkpointRow.processing_version,
      completedDetectors: JSON.parse(checkpointRow.completed_detectors_json),
      intermediateResultRef: checkpointRow.intermediate_result_ref,
      warnings: JSON.parse(checkpointRow.warnings_json),
      errors: JSON.parse(checkpointRow.errors_json),
      createdAt: checkpointRow.created_at,
    }] : [];

    const elapsedMs = row.status === 'running' && this.activeRuns.has(row.id)
      ? Date.now() - this.activeRuns.get(row.id)!.startedAt
      : row.elapsed_ms;

    return {
      id: row.id, name: row.name, createdAt: row.created_at,
      status: row.status as ProjectStatus, phase: row.phase as AnalysisPhase | null,
      preset: row.preset as AnalysisProjectDetail['preset'],
      elapsedMs, submissions, baseline, findings, filePairAssessments, assessment,
      detectorRuns, checkpoints,
      modelVersion: row.model_version, ruleVersion: row.rule_version,
      parserVersion: row.parser_version, matcherVersion: row.matcher_version,
      warnings: JSON.parse(row.warnings_json),
      degradationReason: row.degradation_reason,
    };
  }

  private rowToFinding(
    f: import('../db/repositories.js').FindingRow,
    evidenceRows: ReturnType<ReturnType<typeof createEvidenceRepository>['getByFinding']>,
  ): RiskFinding {
    return {
      id: f.id, detectorType: f.detector_type as RiskFinding['detectorType'],
      riskLevel: f.risk_level as RiskLevel,
      involvedSubmissionIds: JSON.parse(f.involved_submission_ids_json),
      evidence: evidenceRows.map((ev) => ({
        id: ev.id, detectorType: ev.detectorType as Evidence['detectorType'],
        matchBasis: ev.matchBasis as Evidence['matchBasis'],
        similarityScore: ev.similarityScore,
        sourceSubmissionId: ev.sourceSubmissionId, sourceNodeId: ev.sourceNodeId,
        sourceOriginalText: ev.sourceOriginalText, sourceNormalizedText: ev.sourceNormalizedText,
        sourceSectionPath: ev.sourceSectionPath, sourcePageRange: ev.sourcePageRange,
        sourceTableLocation: ev.sourceTableLocation as Evidence['sourceTableLocation'],
        targetSubmissionId: ev.targetSubmissionId, targetNodeId: ev.targetNodeId,
        targetOriginalText: ev.targetOriginalText, targetNormalizedText: ev.targetNormalizedText,
        targetSectionPath: ev.targetSectionPath, targetPageRange: ev.targetPageRange,
        targetTableLocation: ev.targetTableLocation as Evidence['targetTableLocation'],
        contextBefore: ev.contextBefore, contextAfter: ev.contextAfter,
        tenderFiltered: ev.tenderFiltered, tenderFilterReason: ev.tenderFilterReason,
        ruleVersion: ev.ruleVersion,
      })),
      symmetricSimilarity: f.symmetric_similarity,
      directionalCoverage: JSON.parse(f.directional_coverage_json),
      confidenceScore: f.confidence_score,
      scoreBreakdown: JSON.parse(f.score_breakdown_json),
      ruleVersion: f.rule_version,
      reviewStatus: f.review_status as RiskFinding['reviewStatus'],
      important: Boolean(f.important),
      reviewNote: f.review_note_encrypted ? decrypt(f.review_note_encrypted, this.encryptionKey) : '',
      reviewedAt: f.reviewed_at,
    };
  }

  private buildAssessment(row: import('../db/repositories.js').ProjectRow, findings: RiskFinding[]) {
    if (row.status !== 'ready' && row.status !== 'partial') return null;
    // Align with Rust scoring: weighted average from file pairs, preset thresholds
    const filePairRows = this.filePairAssessmentRepo.getByProject(row.id);
    let rawRuleScore = 0;
    if (filePairRows.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const fp of filePairRows) {
        const w = fp.symmetric_similarity ** 2;
        weightedSum += fp.symmetric_similarity * w;
        totalWeight += w;
      }
      rawRuleScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    // Preset thresholds: standard high≥0.75, medium≥0.5, low≥0.3
    const thresholds: Record<string, { high: number; medium: number; low: number }> = {
      strict: { high: 0.6, medium: 0.4, low: 0.2 },
      standard: { high: 0.75, medium: 0.5, low: 0.3 },
      loose: { high: 0.85, medium: 0.65, low: 0.45 },
    };
    const t = thresholds[row.preset] ?? thresholds.standard;
    const level: RiskLevel = rawRuleScore >= t.high ? 'high' : rawRuleScore >= t.medium ? 'medium' : 'low';
    // Top contributing findings by score
    const sorted = [...findings].sort((a, b) => (b.scoreBreakdown?.finalScore ?? 0) - (a.scoreBreakdown?.finalScore ?? 0));
    return {
      id: randomUUID(), projectId: row.id, level, rawRuleScore: Number((rawRuleScore * 100).toFixed(2)),
      topContributingFindingIds: sorted.slice(0, 10).map((f) => f.id),
      preset: row.preset as AnalysisProjectDetail['preset'],
      ruleVersion: row.rule_version, analysisStatus: 'complete' as const,
      highValueFindingCount: findings.filter((f) => f.riskLevel === 'high').length,
      involvedSubmissionCount: new Set(findings.flatMap((f) => f.involvedSubmissionIds)).size,
      strongEntityHitCount: findings.filter((f) => f.detectorType === 'entity').length,
      tenderDiscountApplied: findings.some((f) => (f.scoreBreakdown?.tenderDiscount ?? 0) > 0),
      incompleteReason: null,
    };
  }

  private deriveRiskLevel(rows: import('../db/repositories.js').FindingRow[]): RiskLevel | null {
    if (!rows.length) return null;
    if (rows.some((f) => f.risk_level === 'high')) return 'high';
    if (rows.some((f) => f.risk_level === 'medium')) return 'medium';
    return 'low';
  }
}

// ── pure helpers (unchanged from original) ──

function toSubmissions(rows: import('../db/repositories.js').SubmissionRow[], docs: DocumentAst[], inputs: { path: string }[]): RiskSubmission[] {
  return rows.map((row, i) => ({
    id: row.id, fileName: row.file_name, fileFormat: row.file_format as 'docx' | 'pdf' | 'nzbtf',
    fileSizeBytes: row.file_size_bytes, pageCount: row.page_count ?? docs[i]?.pageCount ?? null,
    sha256: row.sha256 || docs[i]?.sha256 || '', status: row.status as SubmissionState, warnings: [],
  }));
}

