/**
 * Typed fixtures for the similarity risk review product.
 *
 * These types are LOCAL to the renderer fixtures. They will be replaced
 * by `@bidlens/shared/types-only` exports once the Shared contract is frozen.
 * Production code MUST NOT import these types — only the fixture builders.
 */

// ─── Local type definitions (will move to Shared) ───────────────────────

export type AnalysisProjectStatus =
  | 'validating'
  | 'parsing'
  | 'filtering'
  | 'embedding'
  | 'retrieving'
  | 'detecting'
  | 'aggregating'
  | 'ready'
  | 'partial'
  | 'interrupted'
  | 'failed';

export type RiskLevel = 'high' | 'medium' | 'low';

export type DetectorType = 'text' | 'table' | 'entity';

export type FindingReviewStatus = 'pending' | 'confirmed' | 'ignored' | 'important';

export type FileFormat = 'docx' | 'pdf';

export interface SubmissionSummary {
  id: string;
  fileName: string;
  fileFormat: FileFormat;
  fileSizeBytes: number;
  pageCount: number | null;
  sha256: string;
  status: AnalysisProjectStatus;
  warnings: string[];
}

export interface Evidence {
  id: string;
  submissionId: string;
  blockIndex: number;
  originalText: string;
  normalizedText: string;
  matchBasis: 'lexical' | 'semantic' | 'structural' | 'entity';
  similarityScore: number;
  contextBefore: string;
  contextAfter: string;
  tenderFiltered: boolean;
  tenderFilterReason: string | null;
}

export interface RiskFinding {
  id: string;
  detectorType: DetectorType;
  riskLevel: RiskLevel;
  involvedSubmissionIds: string[];
  evidence: Evidence[];
  symmetricSimilarity: number;
  directionalCoverage: { fromId: string; toId: string; coverage: number }[];
  confidenceScore: number;
  reviewStatus: FindingReviewStatus;
  reviewNote: string;
  ruleVersion: string;
}

export interface RiskAssessment {
  level: RiskLevel | 'incomplete';
  rawRuleScore: number;
  topContributingFindingIds: string[];
  preset: 'strict' | 'standard' | 'loose';
  ruleVersion: string;
  analysisStatus: 'complete' | 'degraded' | 'partial';
}

export interface AnalysisProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  status: AnalysisProjectStatus;
  submissionCount: number;
  riskLevel: RiskLevel | 'incomplete' | null;
  preset: 'strict' | 'standard' | 'loose';
  hasBaseline: boolean;
  elapsedMs: number;
}

export interface AnalysisProjectDetail {
  id: string;
  name: string;
  createdAt: string;
  status: AnalysisProjectStatus;
  submissions: SubmissionSummary[];
  baseline: SubmissionSummary | null;
  findings: RiskFinding[];
  assessment: RiskAssessment | null;
  preset: 'strict' | 'standard' | 'loose';
  modelVersion: string;
  ruleVersion: string;
  parserVersion: string;
  matcherVersion: string;
  elapsedMs: number;
  warnings: string[];
  degradationReason: string | null;
}

// ─── Deterministic ID generator ─────────────────────────────────────────

let _counter = 0;
function nextId(prefix: string): string {
  _counter += 1;
  return `${prefix}-fixture-${String(_counter).padStart(3, '0')}`;
}

export function resetFixtureIds(): void {
  _counter = 0;
}

// ─── Base builders ──────────────────────────────────────────────────────

function makeSubmission(overrides: Partial<SubmissionSummary> = {}): SubmissionSummary {
  return {
    id: nextId('sub'),
    fileName: '投标文件.docx',
    fileFormat: 'docx',
    fileSizeBytes: 2_500_000,
    pageCount: 120,
    sha256: 'a'.repeat(64),
    status: 'ready',
    warnings: [],
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: nextId('ev'),
    submissionId: 'sub-fixture-001',
    blockIndex: 42,
    originalText: '本项目拟投入技术人员共计15人，其中高级工程师3人...',
    normalizedText: '本项目拟投入技术人员共计15人其中高级工程师3人',
    matchBasis: 'semantic',
    similarityScore: 0.92,
    contextBefore: '（三）项目团队配置',
    contextAfter: '（四）质量保证措施',
    tenderFiltered: false,
    tenderFilterReason: null,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<RiskFinding> = {}): RiskFinding {
  return {
    id: nextId('find'),
    detectorType: 'text',
    riskLevel: 'high',
    involvedSubmissionIds: ['sub-fixture-001', 'sub-fixture-002'],
    evidence: [makeEvidence()],
    symmetricSimilarity: 0.89,
    directionalCoverage: [
      { fromId: 'sub-fixture-001', toId: 'sub-fixture-002', coverage: 0.85 },
      { fromId: 'sub-fixture-002', toId: 'sub-fixture-001', coverage: 0.78 },
    ],
    confidenceScore: 0.91,
    reviewStatus: 'pending',
    reviewNote: '',
    ruleVersion: '1.0.0',
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    level: 'high',
    rawRuleScore: 82.5,
    topContributingFindingIds: ['find-fixture-001'],
    preset: 'standard',
    ruleVersion: '1.0.0',
    analysisStatus: 'complete',
    ...overrides,
  };
}

// ─── Scenario builders ──────────────────────────────────────────────────

/** Ready: 3 submissions, 5 findings, complete assessment */
export function buildReadyScenario(): AnalysisProjectDetail {
  resetFixtureIds();
  const subs = [
    makeSubmission({ id: 'sub-fixture-001', fileName: 'A公司投标文件.docx', sha256: 'a'.repeat(64) }),
    makeSubmission({ id: 'sub-fixture-002', fileName: 'B公司投标文件.docx', sha256: 'b'.repeat(64) }),
    makeSubmission({ id: 'sub-fixture-003', fileName: 'C公司投标文件.docx', sha256: 'c'.repeat(64) }),
  ];
  _counter = 0;
  const findings = [
    makeFinding({ id: 'find-fixture-001', riskLevel: 'high', detectorType: 'text', symmetricSimilarity: 0.91 }),
    makeFinding({ id: 'find-fixture-002', riskLevel: 'high', detectorType: 'entity', symmetricSimilarity: 0.95 }),
    makeFinding({ id: 'find-fixture-003', riskLevel: 'medium', detectorType: 'table', symmetricSimilarity: 0.72 }),
    makeFinding({ id: 'find-fixture-004', riskLevel: 'medium', detectorType: 'text', symmetricSimilarity: 0.68 }),
    makeFinding({ id: 'find-fixture-005', riskLevel: 'low', detectorType: 'text', symmetricSimilarity: 0.45 }),
  ];
  return {
    id: 'proj-fixture-001',
    name: 'XX道路改造工程招标项目',
    createdAt: '2026-07-20T10:00:00Z',
    status: 'ready',
    submissions: subs,
    baseline: makeSubmission({ id: 'sub-fixture-baseline', fileName: '招标文件.docx', sha256: '0'.repeat(64) }),
    findings,
    assessment: makeAssessment({
      level: 'high',
      rawRuleScore: 82.5,
      topContributingFindingIds: ['find-fixture-001', 'find-fixture-002'],
    }),
    preset: 'standard',
    modelVersion: 'bge-m3-1.0',
    ruleVersion: '1.0.0',
    parserVersion: '0.2.2',
    matcherVersion: '0.2.2',
    elapsedMs: 45_000,
    warnings: [],
    degradationReason: null,
  };
}

/** No baseline: same as ready but no baseline file, warnings present */
export function buildNoBaselineScenario(): AnalysisProjectDetail {
  const detail = buildReadyScenario();
  return {
    ...detail,
    id: 'proj-fixture-002',
    name: 'XX道路改造工程（无基线）',
    baseline: null,
    warnings: ['未提供招标基线，误报风险较高'],
  };
}

/** Degraded: model unavailable, used traditional matching */
export function buildDegradedScenario(): AnalysisProjectDetail {
  const detail = buildReadyScenario();
  return {
    ...detail,
    id: 'proj-fixture-003',
    name: 'XX道路改造工程（降级）',
    status: 'ready',
    assessment: makeAssessment({
      ...detail.assessment!,
      analysisStatus: 'degraded',
    }),
    warnings: ['本地 Embedding 模型不可用，已使用传统匹配'],
    degradationReason: 'model_unavailable',
  };
}

/** Partial: analysis interrupted partway, some results available */
export function buildPartialScenario(): AnalysisProjectDetail {
  const detail = buildReadyScenario();
  return {
    ...detail,
    id: 'proj-fixture-004',
    name: 'XX道路改造工程（部分结果）',
    status: 'partial',
    assessment: makeAssessment({
      level: 'incomplete',
      analysisStatus: 'partial',
      rawRuleScore: 0,
      topContributingFindingIds: [],
    }),
    warnings: ['分析未完成，结果不完整'],
    degradationReason: 'user_accepted_partial',
  };
}

/** Interrupted: process crashed or was killed */
export function buildInterruptedScenario(): AnalysisProjectDetail {
  const subs = [
    makeSubmission({ id: 'sub-fixture-001', fileName: 'A公司投标文件.docx', status: 'embedding' }),
    makeSubmission({ id: 'sub-fixture-002', fileName: 'B公司投标文件.docx', status: 'parsing' }),
  ];
  return {
    id: 'proj-fixture-005',
    name: 'XX道路改造工程（已中断）',
    createdAt: '2026-07-20T10:00:00Z',
    status: 'interrupted',
    submissions: subs,
    baseline: null,
    findings: [],
    assessment: null,
    preset: 'standard',
    modelVersion: 'bge-m3-1.0',
    ruleVersion: '1.0.0',
    parserVersion: '0.2.2',
    matcherVersion: '0.2.2',
    elapsedMs: 12_000,
    warnings: ['分析过程中断，可从最近检查点恢复'],
    degradationReason: null,
  };
}

/** Failed: analysis pipeline failed */
export function buildFailedScenario(): AnalysisProjectDetail {
  const subs = [
    makeSubmission({ id: 'sub-fixture-001', fileName: 'A公司投标文件.docx', status: 'embedding' }),
    makeSubmission({ id: 'sub-fixture-002', fileName: 'B公司投标文件.docx', status: 'parsing' }),
  ];
  return {
    id: 'proj-fixture-007',
    name: 'XX道路改造工程（分析失败）',
    createdAt: '2026-07-20T08:00:00Z',
    status: 'failed',
    submissions: subs,
    baseline: null,
    findings: [],
    assessment: null,
    preset: 'standard',
    modelVersion: 'bge-m3-1.0',
    ruleVersion: '1.0.0',
    parserVersion: '0.2.2',
    matcherVersion: '0.2.2',
    elapsedMs: 8_000,
    warnings: ['分析过程中出现错误'],
    degradationReason: null,
  };
}

/** Processing: project currently running through the analysis pipeline */
export function buildProcessingScenario(): AnalysisProjectDetail {
  resetFixtureIds();
  const subs = [
    makeSubmission({ id: 'sub-fixture-001', fileName: 'A公司投标文件.docx', sha256: 'a'.repeat(64), status: 'detecting' }),
    makeSubmission({ id: 'sub-fixture-002', fileName: 'B公司投标文件.docx', sha256: 'b'.repeat(64), status: 'detecting' }),
    makeSubmission({ id: 'sub-fixture-003', fileName: 'C公司投标文件.docx', sha256: 'c'.repeat(64), status: 'embedding' }),
  ];
  return {
    id: 'proj-fixture-006',
    name: 'XX道路改造工程（处理中）',
    createdAt: '2026-07-20T14:00:00Z',
    status: 'detecting',
    submissions: subs,
    baseline: makeSubmission({ id: 'sub-fixture-baseline', fileName: '招标文件.docx', sha256: '0'.repeat(64), status: 'ready' }),
    findings: [],
    assessment: null,
    preset: 'standard',
    modelVersion: 'bge-m3-1.0',
    ruleVersion: '1.0.0',
    parserVersion: '0.2.2',
    matcherVersion: '0.2.2',
    elapsedMs: 23_000,
    warnings: [],
    degradationReason: null,
  };
}

/** Empty: no projects exist yet */
export function buildEmptyProjectList(): AnalysisProjectSummary[] {
  return [];
}

/** Summary list for project list page */
export function buildProjectSummaries(): AnalysisProjectSummary[] {
  return [
    {
      id: 'proj-fixture-001',
      name: 'XX道路改造工程招标项目',
      createdAt: '2026-07-20T10:00:00Z',
      status: 'ready',
      submissionCount: 3,
      riskLevel: 'high',
      preset: 'standard',
      hasBaseline: true,
      elapsedMs: 45_000,
    },
    {
      id: 'proj-fixture-002',
      name: 'XX道路改造工程（无基线）',
      createdAt: '2026-07-20T09:00:00Z',
      status: 'ready',
      submissionCount: 3,
      riskLevel: 'medium',
      preset: 'standard',
      hasBaseline: false,
      elapsedMs: 38_000,
    },
    {
      id: 'proj-fixture-003',
      name: 'XX道路改造工程（降级）',
      createdAt: '2026-07-19T15:00:00Z',
      status: 'ready',
      submissionCount: 3,
      riskLevel: 'low',
      preset: 'strict',
      hasBaseline: true,
      elapsedMs: 52_000,
    },
    {
      id: 'proj-fixture-004',
      name: 'XX道路改造工程（部分结果）',
      createdAt: '2026-07-19T14:00:00Z',
      status: 'partial',
      submissionCount: 4,
      riskLevel: 'incomplete',
      preset: 'standard',
      hasBaseline: true,
      elapsedMs: 20_000,
    },
    {
      id: 'proj-fixture-005',
      name: 'XX道路改造工程（已中断）',
      createdAt: '2026-07-19T12:00:00Z',
      status: 'interrupted',
      submissionCount: 2,
      riskLevel: null,
      preset: 'loose',
      hasBaseline: false,
      elapsedMs: 12_000,
    },
    {
      id: 'proj-fixture-006',
      name: 'XX道路改造工程（处理中）',
      createdAt: '2026-07-20T14:00:00Z',
      status: 'detecting',
      submissionCount: 3,
      riskLevel: null,
      preset: 'standard',
      hasBaseline: true,
      elapsedMs: 23_000,
    },
  ];
}
