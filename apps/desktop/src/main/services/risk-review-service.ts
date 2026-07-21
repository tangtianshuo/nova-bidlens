import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { DocumentAst, BlockNode } from '@bidlens/shared';
import type {
  AnalysisProjectDetail, AnalysisProjectSummary, CreateRiskProjectRequest, RiskFinding,
  RiskProgress, RiskSubmission, RiskLevel,
} from '@bidlens/shared';
import { parseDocumentFile, type ParserServiceOptions } from './parser-service.js';
import { validateFile } from './file-validator.js';

type ProjectState = AnalysisProjectDetail & { abort?: AbortController; inputSubmissionCount: number; inputHasBaseline: boolean };

/** Runtime owner for the multi-file review IPC chain. Persistence is deliberately injectable later. */
export class RiskReviewService {
  private readonly projects = new Map<string, ProjectState>();
  constructor(private readonly window: BrowserWindow) {}

  listProjects(): AnalysisProjectSummary[] {
    return [...this.projects.values()].map((project) => ({
      id: project.id, name: project.name, createdAt: project.createdAt, status: project.status,
      submissionCount: project.submissions.length || project.inputSubmissionCount,
      riskLevel: project.assessment?.level ?? null, preset: project.preset,
      hasBaseline: Boolean(project.baseline) || project.inputHasBaseline, elapsedMs: project.elapsedMs,
    }));
  }

  getProject(projectId: string): AnalysisProjectDetail {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`风险审查项目不存在: ${projectId}`);
    const { abort: _abort, inputSubmissionCount: _count, inputHasBaseline: _baseline, ...detail } = project;
    return detail;
  }

  async createProject(request: CreateRiskProjectRequest): Promise<{ projectId: string }> {
    if (request.submissions.length < 2 || request.submissions.length > 8) throw new Error('投标文件数量必须为 2-8 个');
    const projectId = randomUUID();
    const now = new Date().toISOString();
    const project: ProjectState = {
      id: projectId, name: request.name.trim(), createdAt: now, status: 'validating',
      preset: request.preset, elapsedMs: 0, submissions: [], baseline: null,
      findings: [], assessment: null, modelVersion: 'lexical-fallback', ruleVersion: '1.0.0',
      parserVersion: '0.2.2', matcherVersion: 'lexical-1.0.0',
      warnings: [...(!request.baseline ? ['未提供招标基线，公共内容可能产生误报'] : []), '本地语义模型尚未接入，当前使用可解释词法检测'],
      degradationReason: 'embedding_unavailable',
      abort: new AbortController(), inputSubmissionCount: request.submissions.length, inputHasBaseline: Boolean(request.baseline),
    };
    this.projects.set(projectId, project);
    void this.run(project, request);
    return { projectId };
  }

  cancel(projectId: string) {
    const project = this.projects.get(projectId);
    if (!project || ['ready', 'failed', 'partial', 'interrupted'].includes(project.status)) return { projectId, cancelled: false };
    project.abort?.abort();
    project.status = 'interrupted';
    project.warnings = [...project.warnings, '用户取消了分析，未生成完整风险报告'];
    this.emit(project, '已取消');
    return { projectId, cancelled: true };
  }

  saveFindingReview(request: { projectId: string; findingId: string; status?: string; important?: boolean; note?: string }): RiskFinding {
    const project = this.projects.get(request.projectId);
    const finding = project?.findings.find((item) => item.id === request.findingId);
    if (!project || !finding) throw new Error('风险发现项不存在');
    if (request.status && ['pending', 'confirmed', 'ignored', 'important'].includes(request.status)) finding.reviewStatus = request.status as RiskFinding['reviewStatus'];
    if (typeof request.important === 'boolean' && request.important) finding.reviewStatus = 'important';
    if (request.note !== undefined) finding.reviewNote = request.note;
    return finding;
  }

  private async run(project: ProjectState, request: CreateRiskProjectRequest) {
    const started = Date.now();
    try {
      this.emit(project, '正在验证文件...');
      const inputs = [...request.submissions, ...(request.baseline ? [request.baseline] : [])];
      const validations = await Promise.all(inputs.map((file) => validateFile(file.path)));
      if (validations.some((result) => !result.supported || result.error)) throw new Error('存在不可解析或不支持的文件');
      this.checkCancelled(project);
      project.status = 'parsing'; this.emit(project, '正在解析投标文件...', 0, inputs.length);
      const parsed: DocumentAst[] = [];
      for (let i = 0; i < inputs.length; i++) {
        const result = await parseDocumentFile(inputs[i].path, { signal: project.abort?.signal } satisfies ParserServiceOptions);
        if (!result.success || !result.ast) throw new Error(result.error?.message ?? '文档解析失败');
        parsed.push(result.ast); this.emit(project, `已解析 ${i + 1}/${inputs.length}`, i + 1, inputs.length);
        this.checkCancelled(project);
      }
      project.status = 'filtering'; this.emit(project, '正在过滤招标公共内容...');
      project.status = 'detecting'; this.emit(project, '正在检测跨文件相似内容...');
      project.submissions = parsed.slice(0, request.submissions.length).map((ast, i) => toSubmission(ast, inputs[i].path, 'ready'));
      project.baseline = request.baseline ? toSubmission(parsed[parsed.length - 1], request.baseline.path, 'ready') : null;
      project.findings = buildFindings(project.submissions, parsed.slice(0, request.submissions.length), project.baseline ? parsed[parsed.length - 1] : null);
      project.status = 'aggregating'; this.emit(project, '正在汇总风险...');
      const score = Math.min(100, project.findings.reduce((sum, finding) => sum + finding.confidenceScore * 25, 0));
      const level = project.findings.some((f) => f.riskLevel === 'high') ? 'high' : project.findings.some((f) => f.riskLevel === 'medium') ? 'medium' : 'low';
      project.assessment = { level, rawRuleScore: Number(score.toFixed(2)), topContributingFindingIds: project.findings.slice(0, 5).map((f) => f.id), preset: project.preset, ruleVersion: project.ruleVersion, analysisStatus: 'degraded' };
      project.status = 'ready'; project.elapsedMs = Date.now() - started; this.emit(project, '分析完成');
    } catch (error) {
      project.elapsedMs = Date.now() - started;
      if (project.status !== 'interrupted') { project.status = 'failed'; project.warnings = [...project.warnings, error instanceof Error ? error.message : '分析失败']; }
      this.emit(project, project.status === 'interrupted' ? '已取消' : '分析失败');
    }
  }

  private checkCancelled(project: ProjectState) { if (project.abort?.signal.aborted) { project.status = 'interrupted'; throw new Error('分析已取消'); } }
  private emit(project: ProjectState, stageLabel: string, current?: number, total?: number) {
    const progress: RiskProgress = { projectId: project.id, status: project.status, stageLabel, current, total, elapsedMs: project.elapsedMs || Date.now() - new Date(project.createdAt).getTime(), warnings: [...project.warnings] };
    this.window.webContents.send('risk:progress', progress);
  }
}

function toSubmission(ast: DocumentAst, filePath: string, status: RiskSubmission['status']): RiskSubmission {
  return { id: ast.id, fileName: path.basename(filePath), fileFormat: path.extname(filePath).slice(1).toLowerCase() as 'docx' | 'pdf', fileSizeBytes: 0, pageCount: ast.pageCount, sha256: ast.sha256, status, warnings: [] };
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
    findings.push({ id: randomUUID(), detectorType: 'text', riskLevel: level, involvedSubmissionIds: [submissions[i].id, submissions[j].id], evidence: matches.slice(0, 10).map((text, index) => ({ id: randomUUID(), submissionId: submissions[i].id, blockIndex: index, originalText: text, normalizedText: text, matchBasis: 'lexical', similarityScore: similarity, contextBefore: '', contextAfter: '', tenderFiltered: false, tenderFilterReason: null })), symmetricSimilarity: similarity, directionalCoverage: [{ fromId: submissions[i].id, toId: submissions[j].id, coverage: similarity }, { fromId: submissions[j].id, toId: submissions[i].id, coverage: similarity }], confidenceScore: similarity, reviewStatus: 'pending', reviewNote: '', ruleVersion: '1.0.0' });
  }
  return findings;
}
