import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import type { DocumentAst, BlockNode } from '@bidlens/shared';
import type {
  AnalysisProjectDetail, AnalysisProjectSummary, CreateRiskProjectRequest, RiskFinding,
  RiskProgress, RiskSubmission, RiskLevel, ProjectStatus, AnalysisPhase, TenderBaseline,
  SubmissionState, AuditEvent, AnalysisCheckpoint, DetectorRun, Evidence,
  ExportRiskReportRequest, ExportRiskReportResponse, FilePairAssessment,
} from '@bidlens/shared';
import { parseDocumentFile, type ParserServiceOptions } from './parser-service.js';
import { validateFile } from './file-validator.js';
import { generateMarkdownReport, generateHtmlReport, computeReportHash } from './report-generator.js';
import {
  createProjectRepository,
  createSubmissionRepository,
  createFindingRepository,
  createEvidenceRepository,
  createReviewDecisionRepository,
  createCheckpointRepository,
  createAuditEventRepository,
  createExportedReportRepository,
  createFilePairAssessmentRepository,
} from '../db/repositories.js';
import { decrypt } from '../db/crypto.js';

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
  private readonly findingRepo;
  private readonly evidenceRepo;
  private readonly reviewDecisionRepo;
  private readonly checkpointRepo;
  private readonly auditEventRepo;
  private readonly exportReportRepo;
  private readonly filePairAssessmentRepo;

  constructor(
    private readonly window: BrowserWindow,
    db: Database.Database,
    private readonly encryptionKey: Buffer,
  ) {
    this.projectRepo = createProjectRepository(db);
    this.submissionRepo = createSubmissionRepository(db);
    this.findingRepo = createFindingRepository(db);
    this.evidenceRepo = createEvidenceRepository(db);
    this.reviewDecisionRepo = createReviewDecisionRepository(db);
    this.checkpointRepo = createCheckpointRepository(db);
    this.auditEventRepo = createAuditEventRepository(db);
    this.exportReportRepo = createExportedReportRepository(db);
    this.filePairAssessmentRepo = createFilePairAssessmentRepository(db);
  }

  // ── public API ──

  listProjects(filters?: { status?: ProjectStatus; limit?: number; offset?: number }): AnalysisProjectSummary[] {
    const rows = this.projectRepo.list(filters);
    return rows.map((row) => {
      const submissions = this.submissionRepo.getByProject(row.id);
      const findings = this.findingRepo.getByProject(row.id);
      const level = this.deriveRiskLevel(findings);
      const hasBaseline = submissions.some((s) => {
        // baseline is stored as a submission with file_name starting with special convention,
        // but simpler: check if there's a tender_baselines row
        // ponytail: no tender_baseline repo yet, derive from project warnings
        return false;
      });
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
    if (request.submissions.length < 2 || request.submissions.length > 8) throw new Error('投标文件数量必须为 2-8 个');

    const projectId = this.projectRepo.create({
      name: request.name.trim(),
      preset: request.preset,
      modelVersion: 'lexical-fallback',
      ruleVersion: '1.0.0',
      parserVersion: '0.2.2',
      matcherVersion: 'lexical-1.0.0',
    });

    // create submission rows
    const submissionIds: string[] = [];
    for (const file of request.submissions) {
      const id = this.submissionRepo.create({
        projectId, fileName: path.basename(file.path),
        fileFormat: path.extname(file.path).slice(1).toLowerCase() as 'docx' | 'pdf',
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
    this.auditEventRepo.append({ projectId, eventType: 'project-created', payload: { warnings, degradationReason: 'embedding_unavailable', submissionCount: request.submissions.length, hasBaseline: Boolean(request.baseline) } });

    const abort = new AbortController();
    this.activeRuns.set(projectId, { abort, startedAt: Date.now() });
    void this.run(projectId, request, abort);
    return { projectId };
  }

  cancel(projectId: string) {
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
      files: this.submissionRepo.getByProject(projectId).map(s => ({ path: '', name: s.file_name })),
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

    try {
      this.projectRepo.updateStatus(projectId, 'running', PHASE_ORDER[startIdx] ?? 'validating');
      this.emitProgress(projectId, 'running', PHASE_ORDER[startIdx] ?? 'validating', '正在验证文件...');

      const inputs = [...request.submissions, ...(request.baseline ? [request.baseline] : [])];

      // ── validating ──
      if (startIdx <= 0) {
        this.setPhase(projectId, 'validating');
        const validations = await Promise.all(inputs.map((file) => validateFile(file.path)));
        if (validations.some((result) => !result.supported || result.error)) throw new Error('存在不可解析或不支持的文件');
        this.checkCancelled(abort, projectId);
      }

      // ── parsing ──
      let parsed: DocumentAst[];
      if (startIdx <= 1) {
        this.setPhase(projectId, 'parsing');
        this.emitProgress(projectId, 'running', 'parsing', '正在解析投标文件...', 0, inputs.length);
        parsed = [];
        for (let i = 0; i < inputs.length; i++) {
          const result = await parseDocumentFile(inputs[i].path, { signal: abort.signal } satisfies ParserServiceOptions);
          if (!result.success || !result.ast) throw new Error(result.error?.message ?? '文档解析失败');
          parsed.push(result.ast);
          this.emitProgress(projectId, 'running', 'parsing', `已解析 ${i + 1}/${inputs.length}`, i + 1, inputs.length);
          this.checkCancelled(abort, projectId);
        }
      } else {
        // resuming past parsing — we'd need cached ASTs; for now re-parse
        parsed = [];
        for (const file of inputs) {
          const result = await parseDocumentFile(file.path, { signal: abort.signal } satisfies ParserServiceOptions);
          if (!result.success || !result.ast) throw new Error(result.error?.message ?? '文档解析失败');
          parsed.push(result.ast);
        }
      }

      // update submission statuses to 'extracted'
      const submissionRows = this.submissionRepo.getByProject(projectId);
      for (const sub of submissionRows) {
        this.submissionRepo.updateStatus(sub.id, 'extracted');
      }

      // ── extracting-nodes (placeholder) ──
      if (startIdx <= 2) {
        this.setPhase(projectId, 'extracting-nodes');
      }

      // ── extracting-entities (placeholder) ──
      if (startIdx <= 3) {
        this.setPhase(projectId, 'extracting-entities');
      }

      // ── filtering-tender-content ──
      if (startIdx <= 4) {
        this.setPhase(projectId, 'filtering-tender-content');
        this.emitProgress(projectId, 'running', 'filtering-tender-content', '正在过滤招标公共内容...');
      }

      // ── recalling-candidates (placeholder) ──
      if (startIdx <= 5) {
        this.setPhase(projectId, 'recalling-candidates');
      }

      // ── detecting ──
      if (startIdx <= 6) {
        this.setPhase(projectId, 'detecting');
        this.emitProgress(projectId, 'running', 'detecting', '正在检测跨文件相似内容...');
      }

      const submissions = toSubmissions(submissionRows, parsed.slice(0, request.submissions.length), inputs);
      const baselineAst = request.baseline ? parsed[parsed.length - 1] : null;

      const findings = buildFindings(submissions, parsed.slice(0, request.submissions.length), baselineAst);

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
      const pairMap = new Map<string, { findings: typeof findings; submissionAId: string; submissionBId: string }>();
      for (const finding of findings) {
        const ids = [...finding.involvedSubmissionIds].sort();
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key = `${ids[i]}|${ids[j]}`;
            if (!pairMap.has(key)) pairMap.set(key, { findings: [], submissionAId: ids[i], submissionBId: ids[j] });
            pairMap.get(key)!.findings.push(finding);
          }
        }
      }
      for (const [, pair] of pairMap) {
        const high = pair.findings.filter(f => f.riskLevel === 'high').length;
        const medium = pair.findings.filter(f => f.riskLevel === 'medium').length;
        const low = pair.findings.filter(f => f.riskLevel === 'low').length;
        const maxSim = Math.max(0, ...pair.findings.map(f => f.symmetricSimilarity));
        const topIds = pair.findings.filter(f => f.riskLevel === 'high').slice(0, 5).map(f => f.id);
        const level: RiskLevel = maxSim >= 0.6 ? 'high' : maxSim >= 0.3 ? 'medium' : 'low';
        this.filePairAssessmentRepo.create({
          projectId, submissionAId: pair.submissionAId, submissionBId: pair.submissionBId,
          directionalCoverageAB: 0, directionalCoverageBA: 0,
          symmetricSimilarity: maxSim, riskLevel: level,
          topFindingIds: topIds, findingCount: { high, medium, low },
          ruleVersion: '1.0.0', analysisStatus: 'complete',
        });
      }

      // ── persisting ──
      this.setPhase(projectId, 'persisting');

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
      this.emitProgress(projectId, isCancelled ? 'interrupted' : 'failed', null, isCancelled ? '已取消' : '分析失败');
      this.auditEventRepo.append({ projectId, eventType: isCancelled ? 'analysis-cancelled' : 'analysis-failed', payload: { error: msg, elapsedMs } });
    } finally {
      this.activeRuns.delete(projectId);
    }
  }

  // ── helpers ──

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
      id: s.id, fileName: s.file_name, fileFormat: s.file_format as 'docx' | 'pdf',
      fileSizeBytes: s.file_size_bytes, pageCount: s.page_count, sha256: s.sha256,
      status: s.status as SubmissionState, warnings: JSON.parse(s.warnings_json),
    }));

    const findings: RiskFinding[] = findingRows.map((f) => {
      const evidenceRows = this.evidenceRepo.getByFinding(f.id, this.encryptionKey);
      return this.rowToFinding(f, evidenceRows);
    });

    // ponytail: no tender_baseline repo yet, return empty
    const baseline: TenderBaseline | null = null;
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

    const assessment = this.buildAssessment(row, findings);

    // detector runs from DB
    const detectorRuns: DetectorRun[] = []; // ponytail: add DetectorRunRepo when detector pipeline is wired

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
      strongEntityHitCount: 0, tenderDiscountApplied: false, incompleteReason: null,
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
    id: row.id, fileName: row.file_name, fileFormat: row.file_format as 'docx' | 'pdf',
    fileSizeBytes: row.file_size_bytes, pageCount: row.page_count ?? docs[i]?.pageCount ?? null,
    sha256: row.sha256 || docs[i]?.sha256 || '', status: row.status as SubmissionState, warnings: [],
  }));
}

function blockText(block: BlockNode): string {
  if (block.type === 'paragraph') return block.text;
  if (block.type === 'section') return [block.title, ...block.children.map(blockText)].join(' ');
  if (block.type === 'list') return block.items.map((item) => item.text).join(' ');
  return block.rows.flat().join(' ');
}

function normalize(text: string) { return text.replace(/\s+/g, '').replace(/[，。；：、,.!?！？（）()]/g, '').toLowerCase(); }

function buildFindings(submissions: RiskSubmission[], docs: DocumentAst[], baseline: DocumentAst | null): RiskFinding[] {
  const findings: RiskFinding[] = [];
  for (let i = 0; i < docs.length; i++) for (let j = i + 1; j < docs.length; j++) {
    const left = docs[i].blocks.map(blockText).map(normalize).filter((text) => text.length >= 12);
    const right = new Set(docs[j].blocks.map(blockText).map(normalize));
    const matches = left.filter((text) => right.has(text) && (!baseline || !baseline.blocks.some((block) => normalize(blockText(block)) === text)));
    if (!matches.length) continue;
    const similarity = Math.min(1, matches.length / Math.max(1, Math.min(left.length, docs[j].blocks.length)));
    const level: RiskLevel = similarity >= 0.6 ? 'high' : similarity >= 0.3 ? 'medium' : 'low';
    findings.push({
      id: randomUUID(), detectorType: 'text', riskLevel: level,
      involvedSubmissionIds: [submissions[i].id, submissions[j].id],
      evidence: matches.slice(0, 10).map((text, index) => ({
        id: randomUUID(), detectorType: 'text' as const, matchBasis: 'lexical' as const, similarityScore: similarity,
        sourceSubmissionId: submissions[i].id, sourceNodeId: `node-${index}`, sourceOriginalText: text, sourceNormalizedText: text,
        sourceSectionPath: [], sourcePageRange: null, sourceTableLocation: null,
        targetSubmissionId: submissions[j].id, targetNodeId: `node-${index}`, targetOriginalText: text, targetNormalizedText: text,
        targetSectionPath: [], targetPageRange: null, targetTableLocation: null,
        contextBefore: '', contextAfter: '', tenderFiltered: false, tenderFilterReason: null, ruleVersion: '1.0.0',
      })),
      symmetricSimilarity: similarity,
      directionalCoverage: [{ fromId: submissions[i].id, toId: submissions[j].id, coverage: similarity }, { fromId: submissions[j].id, toId: submissions[i].id, coverage: similarity }],
      confidenceScore: similarity,
      scoreBreakdown: { exactMatchScore: similarity, lexicalScore: 0, structuralScore: 0, entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0, factConflictPenalty: 0, finalScore: similarity, ruleVersion: '1.0.0' },
      ruleVersion: '1.0.0', reviewStatus: 'pending', important: false, reviewNote: '', reviewedAt: null,
    });
  }
  return findings;
}
