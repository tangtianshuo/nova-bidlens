/**
 * Typed fixtures for the similarity risk review product.
 * Imports canonical types from Shared — no local type definitions.
 */

import type {
  ProjectStatus, AnalysisPhase, SubmissionState, RiskLevel, DetectorType,
  FindingReviewStatus, RiskFileFormat, RiskSubmission, Evidence, RiskFinding,
  ProjectRiskAssessment, AnalysisProjectSummary, AnalysisProjectDetail,
  TenderBaseline, ScoreBreakdown,
} from '@bidlens/shared/types-only';

// Re-export for test files that import these from the fixture
export type { ProjectStatus as AnalysisProjectStatus } from '@bidlens/shared/types-only';
export type { AnalysisProjectSummary, RiskFinding, Evidence, SubmissionSummary } from '@bidlens/shared/types-only';

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

function makeSubmission(overrides: Partial<RiskSubmission> = {}): RiskSubmission {
  return {
    id: nextId('sub'),
    fileName: '投标文件.docx',
    fileFormat: 'docx',
    fileSizeBytes: 2_500_000,
    pageCount: 120,
    sha256: 'a'.repeat(64),
    status: 'extracted',
    warnings: [],
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: nextId('ev'),
    detectorType: 'text',
    matchBasis: 'semantic',
    similarityScore: 0.92,
    sourceSubmissionId: 'sub-fixture-001',
    sourceNodeId: 'node-42',
    sourceOriginalText: '本项目拟投入技术人员共计15人，其中高级工程师3人...',
    sourceNormalizedText: '本项目拟投入技术人员共计15人其中高级工程师3人',
    sourceSectionPath: ['技术方案', '项目团队配置'],
    sourcePageRange: null,
    sourceTableLocation: null,
    targetSubmissionId: 'sub-fixture-002',
    targetNodeId: 'node-42',
    targetOriginalText: '本项目拟投入技术人员共计15人，其中高级工程师3人...',
    targetNormalizedText: '本项目拟投入技术人员共计15人其中高级工程师3人',
    targetSectionPath: ['技术方案', '项目团队配置'],
    targetPageRange: null,
    targetTableLocation: null,
    contextBefore: '（三）项目团队配置',
    contextAfter: '（四）质量保证措施',
    tenderFiltered: false,
    tenderFilterReason: null,
    ruleVersion: '1.0.0',
    ...overrides,
  };
}

const DEFAULT_SCORE: ScoreBreakdown = {
  exactMatchScore: 0.9, lexicalScore: 0, structuralScore: 0,
  entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0,
  factConflictPenalty: 0, finalScore: 0.9, ruleVersion: '1.0.0',
};

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
    scoreBreakdown: DEFAULT_SCORE,
    ruleVersion: '1.0.0',
    reviewStatus: 'pending',
    important: false,
    reviewNote: '',
    reviewedAt: null,
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<ProjectRiskAssessment> = {}): ProjectRiskAssessment {
  return {
    id: nextId('assess'),
    projectId: 'proj-fixture-001',
    level: 'high',
    rawRuleScore: 82.5,
    topContributingFindingIds: ['find-fixture-001'],
    preset: 'standard',
    ruleVersion: '1.0.0',
    analysisStatus: 'complete',
    highValueFindingCount: 2,
    involvedSubmissionCount: 3,
    strongEntityHitCount: 0,
    tenderDiscountApplied: true,
    incompleteReason: null,
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
    phase: 'completed',
    submissions: subs,
    baseline: { id: 'bl-fixture-001', projectId: 'proj-fixture-001', submissionId: 'sub-fixture-baseline', status: 'parsed', parseWarnings: [] },
    findings,
    filePairAssessments: [],
    assessment: makeAssessment({
      level: 'high',
      rawRuleScore: 82.5,
      topContributingFindingIds: ['find-fixture-001', 'find-fixture-002'],
    }),
    detectorRuns: [],
    checkpoints: [],
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
    makeSubmission({ id: 'sub-fixture-001', fileName: 'A公司投标文件.docx', status: 'extracting' }),
    makeSubmission({ id: 'sub-fixture-002', fileName: 'B公司投标文件.docx', status: 'parsing' }),
  ];
  return {
    id: 'proj-fixture-005',
    name: 'XX道路改造工程（已中断）',
    createdAt: '2026-07-20T10:00:00Z',
    status: 'interrupted',
    phase: 'extracting-entities',
    submissions: subs,
    baseline: null,
    findings: [],
    filePairAssessments: [],
    assessment: null,
    detectorRuns: [],
    checkpoints: [],
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
    makeSubmission({ id: 'sub-fixture-001', fileName: 'A公司投标文件.docx', status: 'extracting' }),
    makeSubmission({ id: 'sub-fixture-002', fileName: 'B公司投标文件.docx', status: 'parsing' }),
  ];
  return {
    id: 'proj-fixture-007',
    name: 'XX道路改造工程（分析失败）',
    createdAt: '2026-07-20T08:00:00Z',
    status: 'failed',
    phase: 'extracting-entities',
    submissions: subs,
    baseline: null,
    findings: [],
    filePairAssessments: [],
    assessment: null,
    detectorRuns: [],
    checkpoints: [],
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
    makeSubmission({ id: 'sub-fixture-001', fileName: 'A公司投标文件.docx', sha256: 'a'.repeat(64), status: 'extracted' }),
    makeSubmission({ id: 'sub-fixture-002', fileName: 'B公司投标文件.docx', sha256: 'b'.repeat(64), status: 'extracted' }),
    makeSubmission({ id: 'sub-fixture-003', fileName: 'C公司投标文件.docx', sha256: 'c'.repeat(64), status: 'extracting' }),
  ];
  return {
    id: 'proj-fixture-006',
    name: 'XX道路改造工程（处理中）',
    createdAt: '2026-07-20T14:00:00Z',
    status: 'running',
    phase: 'detecting',
    submissions: subs,
    baseline: { id: 'bl-fixture-002', projectId: 'proj-fixture-006', submissionId: 'sub-fixture-baseline', status: 'parsed', parseWarnings: [] },
    findings: [],
    filePairAssessments: [],
    assessment: null,
    detectorRuns: [],
    checkpoints: [],
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
      status: 'running',
      submissionCount: 3,
      riskLevel: null,
      preset: 'standard',
      hasBaseline: true,
      elapsedMs: 23_000,
    },
  ];
}
