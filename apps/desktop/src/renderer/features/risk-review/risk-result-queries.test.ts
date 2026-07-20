import { describe, expect, it } from 'vitest';
import { computeFindingCounts } from './risk-result-queries';
import type { RiskFinding } from '../../__fixtures__/risk-project';

function makeFinding(overrides: Partial<RiskFinding> = {}): RiskFinding {
  return {
    id: 'find-test-001',
    detectorType: 'text',
    riskLevel: 'high',
    involvedSubmissionIds: ['sub-1', 'sub-2'],
    evidence: [],
    symmetricSimilarity: 0.85,
    directionalCoverage: [],
    confidenceScore: 0.9,
    reviewStatus: 'pending',
    reviewNote: '',
    ruleVersion: '1.0.0',
    ...overrides,
  };
}

describe('computeFindingCounts', () => {
  it('returns zero counts for empty findings', () => {
    const counts = computeFindingCounts([]);
    expect(counts.total).toBe(0);
    expect(counts.byRisk.high).toBe(0);
    expect(counts.byRisk.medium).toBe(0);
    expect(counts.byRisk.low).toBe(0);
    expect(counts.confirmed).toBe(0);
    expect(counts.pending).toBe(0);
  });

  it('counts findings by risk level', () => {
    const findings = [
      makeFinding({ id: 'f1', riskLevel: 'high' }),
      makeFinding({ id: 'f2', riskLevel: 'high' }),
      makeFinding({ id: 'f3', riskLevel: 'medium' }),
      makeFinding({ id: 'f4', riskLevel: 'low' }),
    ];
    const counts = computeFindingCounts(findings);
    expect(counts.total).toBe(4);
    expect(counts.byRisk.high).toBe(2);
    expect(counts.byRisk.medium).toBe(1);
    expect(counts.byRisk.low).toBe(1);
  });

  it('counts findings by detector type', () => {
    const findings = [
      makeFinding({ id: 'f1', detectorType: 'text' }),
      makeFinding({ id: 'f2', detectorType: 'text' }),
      makeFinding({ id: 'f3', detectorType: 'table' }),
      makeFinding({ id: 'f4', detectorType: 'entity' }),
    ];
    const counts = computeFindingCounts(findings);
    expect(counts.byDetector.text).toBe(2);
    expect(counts.byDetector.table).toBe(1);
    expect(counts.byDetector.entity).toBe(1);
  });

  it('counts findings by review status', () => {
    const findings = [
      makeFinding({ id: 'f1', reviewStatus: 'pending' }),
      makeFinding({ id: 'f2', reviewStatus: 'pending' }),
      makeFinding({ id: 'f3', reviewStatus: 'confirmed' }),
      makeFinding({ id: 'f4', reviewStatus: 'ignored' }),
      makeFinding({ id: 'f5', reviewStatus: 'important' }),
    ];
    const counts = computeFindingCounts(findings);
    expect(counts.pending).toBe(2);
    expect(counts.confirmed).toBe(1);
    expect(counts.byReviewStatus.ignored).toBe(1);
    expect(counts.byReviewStatus.important).toBe(1);
  });

  it('maintains separate raw, confirmed, and filtered counts', () => {
    const findings = [
      makeFinding({ id: 'f1', riskLevel: 'high', reviewStatus: 'confirmed' }),
      makeFinding({ id: 'f2', riskLevel: 'high', reviewStatus: 'pending' }),
      makeFinding({ id: 'f3', riskLevel: 'medium', reviewStatus: 'confirmed' }),
    ];
    const counts = computeFindingCounts(findings);
    expect(counts.total).toBe(3); // raw
    expect(counts.confirmed).toBe(2); // human confirmed
    expect(counts.pending).toBe(1);
    expect(counts.byRisk.high).toBe(2); // filtered by risk
  });
});
