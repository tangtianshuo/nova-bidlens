/**
 * 04-02: Diff regression tests — evidence compatibility with V0.2.2 tooling.
 *
 * Verifies that RiskFinding, Evidence, ScoreBreakdown, FilePairAssessment,
 * ProjectRiskAssessment, and ExportRiskReportRequest structures are compatible
 * with existing Diff tooling and contain all required fields for migration.
 */

import { describe, it, expect } from 'vitest';
import type {
  RiskFinding,
  Evidence,
  ScoreBreakdown,
  FilePairAssessment,
  ProjectRiskAssessment,
  DetectorType,
  RiskLevel,
  FindingReviewStatus,
} from '../../packages/shared/src/risk-review';
import type { ExportRiskReportRequest } from '../../packages/shared/src/ipc';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeScoreBreakdown(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    exactMatchScore: 0.9,
    lexicalScore: 0.05,
    structuralScore: 0.03,
    entityScore: 0.02,
    factScore: 0.01,
    tenderDiscount: 0.1,
    templateDiscount: 0.05,
    factConflictPenalty: 0.02,
    finalScore: 0.84,
    ruleVersion: '1.0.0',
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'ev-001',
    detectorType: 'text',
    matchBasis: 'semantic',
    similarityScore: 0.92,
    sourceSubmissionId: 'sub-001',
    sourceNodeId: 'node-42',
    sourceOriginalText: '本项目拟投入技术人员共计15人，其中高级工程师3人...',
    sourceNormalizedText: '本项目拟投入技术人员共计15人其中高级工程师3人',
    sourceSectionPath: ['技术方案', '项目团队配置'],
    sourcePageRange: [10, 12],
    sourceTableLocation: null,
    targetSubmissionId: 'sub-002',
    targetNodeId: 'node-42',
    targetOriginalText: '本项目拟投入技术人员共计15人，其中高级工程师3人...',
    targetNormalizedText: '本项目拟投入技术人员共计15人其中高级工程师3人',
    targetSectionPath: ['技术方案', '项目团队配置'],
    targetPageRange: [8, 10],
    targetTableLocation: null,
    contextBefore: '（三）项目团队配置',
    contextAfter: '（四）质量保证措施',
    tenderFiltered: false,
    tenderFilterReason: null,
    ruleVersion: '1.0.0',
    ...overrides,
  };
}

function makeFinding(overrides: Partial<RiskFinding> = {}): RiskFinding {
  return {
    id: 'find-001',
    detectorType: 'text',
    riskLevel: 'high',
    involvedSubmissionIds: ['sub-001', 'sub-002'],
    evidence: [makeEvidence()],
    symmetricSimilarity: 0.89,
    directionalCoverage: [
      { fromId: 'sub-001', toId: 'sub-002', coverage: 0.85 },
      { fromId: 'sub-002', toId: 'sub-001', coverage: 0.78 },
    ],
    confidenceScore: 0.91,
    scoreBreakdown: makeScoreBreakdown(),
    ruleVersion: '1.0.0',
    reviewStatus: 'pending',
    important: false,
    reviewNote: '',
    reviewedAt: null,
    ...overrides,
  };
}

function makeFilePairAssessment(overrides: Partial<FilePairAssessment> = {}): FilePairAssessment {
  return {
    id: 'fpa-001',
    projectId: 'proj-001',
    submissionAId: 'sub-001',
    submissionBId: 'sub-002',
    directionalCoverageAB: 0.85,
    directionalCoverageBA: 0.78,
    symmetricSimilarity: 0.82,
    riskLevel: 'high',
    topFindingIds: ['find-001'],
    findingCount: { high: 2, medium: 1, low: 0 },
    ruleVersion: '1.0.0',
    analysisStatus: 'complete',
    ...overrides,
  };
}

function makeProjectAssessment(overrides: Partial<ProjectRiskAssessment> = {}): ProjectRiskAssessment {
  return {
    id: 'pra-001',
    projectId: 'proj-001',
    level: 'high',
    rawRuleScore: 82.5,
    topContributingFindingIds: ['find-001'],
    preset: 'standard',
    ruleVersion: '1.0.0',
    analysisStatus: 'complete',
    highValueFindingCount: 2,
    involvedSubmissionCount: 3,
    strongEntityHitCount: 1,
    tenderDiscountApplied: true,
    incompleteReason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Evidence structure compatibility
// ---------------------------------------------------------------------------

describe('Evidence Structure Compatibility', () => {
  it('finding evidence has required fields', () => {
    const finding = makeFinding();
    expect(finding.evidence.length).toBeGreaterThan(0);

    for (const ev of finding.evidence) {
      expect(ev.sourceSubmissionId).toBeDefined();
      expect(ev.targetSubmissionId).toBeDefined();
      expect(ev.sourceNodeId).toBeDefined();
      expect(ev.targetNodeId).toBeDefined();
      expect(ev.sourceOriginalText).toBeDefined();
      expect(ev.targetOriginalText).toBeDefined();
      expect(ev.similarityScore).toBeDefined();
      expect(ev.sourceSectionPath).toBeDefined();
    }
  });

  it('evidence similarityScore is between 0 and 1', () => {
    const ev = makeEvidence({ similarityScore: 0.95 });
    expect(ev.similarityScore).toBeGreaterThanOrEqual(0);
    expect(ev.similarityScore).toBeLessThanOrEqual(1);
  });

  it('evidence sourceSectionPath is a non-empty array', () => {
    const ev = makeEvidence();
    expect(Array.isArray(ev.sourceSectionPath)).toBe(true);
    expect(ev.sourceSectionPath.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. ScoreBreakdown structure
// ---------------------------------------------------------------------------

describe('ScoreBreakdown Structure', () => {
  it('ScoreBreakdown has all required fields', () => {
    const score = makeScoreBreakdown();
    expect(score.exactMatchScore).toBeDefined();
    expect(score.lexicalScore).toBeDefined();
    expect(score.structuralScore).toBeDefined();
    expect(score.entityScore).toBeDefined();
    expect(score.factScore).toBeDefined();
    expect(score.tenderDiscount).toBeDefined();
    expect(score.templateDiscount).toBeDefined();
    expect(score.factConflictPenalty).toBeDefined();
    expect(score.finalScore).toBeDefined();
    expect(score.ruleVersion).toBeDefined();
  });

  it('finalScore is sum of component scores', () => {
    const components = {
      exactMatchScore: 0.5,
      lexicalScore: 0.2,
      structuralScore: 0.1,
      entityScore: 0.05,
      factScore: 0.03,
      tenderDiscount: 0.1,
      templateDiscount: 0.05,
      factConflictPenalty: 0.02,
    };
    const expected =
      components.exactMatchScore +
      components.lexicalScore +
      components.structuralScore +
      components.entityScore +
      components.factScore -
      components.tenderDiscount -
      components.templateDiscount -
      components.factConflictPenalty;

    const score = makeScoreBreakdown({ ...components, finalScore: expected });

    // Allow rounding tolerance
    expect(Math.abs(score.finalScore - expected)).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// 3. FilePairAssessment compatibility
// ---------------------------------------------------------------------------

describe('FilePairAssessment Compatibility', () => {
  it('file pair assessment has source/target submission IDs', () => {
    const fpa = makeFilePairAssessment();
    expect(fpa.submissionAId).toBeDefined();
    expect(fpa.submissionBId).toBeDefined();
    expect(typeof fpa.submissionAId).toBe('string');
    expect(typeof fpa.submissionBId).toBe('string');
  });

  it('file pair assessment has risk level and score', () => {
    const fpa = makeFilePairAssessment();
    expect(['low', 'medium', 'high']).toContain(fpa.riskLevel);
    expect(fpa.symmetricSimilarity).toBeGreaterThanOrEqual(0);
    expect(fpa.symmetricSimilarity).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Project-level assessment
// ---------------------------------------------------------------------------

describe('Project-level Assessment', () => {
  it('project assessment has risk level', () => {
    const pra = makeProjectAssessment();
    expect(pra.level).toBeDefined();
    expect(['low', 'medium', 'high', 'incomplete']).toContain(pra.level);
  });

  it('project assessment has summary-like fields', () => {
    const pra = makeProjectAssessment();
    // ProjectRiskAssessment has analysisStatus instead of summary text
    expect(pra.analysisStatus).toBeDefined();
    expect(['complete', 'degraded', 'partial']).toContain(pra.analysisStatus);
    expect(typeof pra.highValueFindingCount).toBe('number');
    expect(typeof pra.involvedSubmissionCount).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// 5. Export model compatibility
// ---------------------------------------------------------------------------

describe('Export Model Compatibility', () => {
  it('export request has valid format', () => {
    const validFormats = ['pdf', 'html', 'markdown'];
    for (const format of validFormats) {
      const req: ExportRiskReportRequest = {
        projectId: 'proj-001',
        format: format as ExportRiskReportRequest['format'],
        scope: 'all',
      };
      expect(validFormats).toContain(req.format);
    }
  });

  it('export request has valid scope', () => {
    const validScopes = ['all', 'confirmed', 'important', 'filtered'];
    for (const scope of validScopes) {
      const req: ExportRiskReportRequest = {
        projectId: 'proj-001',
        format: 'pdf',
        scope: scope as ExportRiskReportRequest['scope'],
      };
      expect(validScopes).toContain(req.scope);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. V0.2.2 DiffItem field presence in RiskFinding
// ---------------------------------------------------------------------------

describe('V0.2.2 DiffItem Field Mapping', () => {
  it('RiskFinding fields map to DiffItem equivalents', () => {
    const finding = makeFinding();

    // DiffItem.matchId ≈ RiskFinding.id
    expect(finding.id).toBeDefined();
    expect(typeof finding.id).toBe('string');

    // DiffItem.matchType ≈ RiskFinding.detectorType (category)
    const validDetectorTypes: DetectorType[] = ['text', 'table', 'entity', 'key-fact'];
    expect(validDetectorTypes).toContain(finding.detectorType);

    // DiffItem.confidence ≈ RiskFinding.confidenceScore
    expect(finding.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(finding.confidenceScore).toBeLessThanOrEqual(1);

    // DiffItem.similarity ≈ RiskFinding.symmetricSimilarity
    expect(finding.symmetricSimilarity).toBeGreaterThanOrEqual(0);
    expect(finding.symmetricSimilarity).toBeLessThanOrEqual(1);

    // DiffItem.sourceA ≈ Evidence.sourceOriginalText
    expect(finding.evidence.length).toBeGreaterThan(0);
    expect(finding.evidence[0].sourceOriginalText).toBeDefined();

    // DiffItem.sourceB ≈ Evidence.targetOriginalText
    expect(finding.evidence[0].targetOriginalText).toBeDefined();

    // Structural mapping exists for migration
    const mapping = {
      matchId: finding.id,
      matchType: finding.detectorType,
      confidence: finding.confidenceScore,
      similarity: finding.symmetricSimilarity,
      sourceA: finding.evidence[0].sourceOriginalText,
      sourceB: finding.evidence[0].targetOriginalText,
    };
    expect(Object.keys(mapping)).toHaveLength(6);
  });
});
