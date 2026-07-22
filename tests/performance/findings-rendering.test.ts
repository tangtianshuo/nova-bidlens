/**
 * 04-02: Performance tests for 1000+ findings store filtering and sorting.
 *
 * Tests the matchesFilter predicate and sorting performance with large
 * finding sets, ensuring all operations complete within budget.
 */

import { describe, it, expect } from 'vitest';
import { BenchmarkRunner } from '../benchmark/benchmark-harness';
import type {
  RiskLevel,
  DetectorType,
  FindingReviewStatus,
  RiskFinding,
  ScoreBreakdown,
} from '../../packages/shared/src/risk-review';

// ---------------------------------------------------------------------------
// matchesFilter — inline replica (renderer module not importable in vitest)
// ---------------------------------------------------------------------------

interface FindingFilterState {
  riskLevels: Set<RiskLevel>;
  detectorTypes: Set<DetectorType>;
  reviewStatuses: Set<FindingReviewStatus>;
  filePair: [string, string] | null;
  searchText: string;
  showImportantOnly: boolean;
}

function matchesFilter(
  finding: {
    riskLevel: RiskLevel;
    detectorType: DetectorType;
    reviewStatus: FindingReviewStatus;
    important: boolean;
    involvedSubmissionIds: string[];
  },
  filters: FindingFilterState,
): boolean {
  if (filters.riskLevels.size > 0 && !filters.riskLevels.has(finding.riskLevel)) return false;
  if (filters.detectorTypes.size > 0 && !filters.detectorTypes.has(finding.detectorType)) return false;
  if (filters.reviewStatuses.size > 0 && !filters.reviewStatuses.has(finding.reviewStatus)) return false;
  if (filters.showImportantOnly && !finding.important) return false;
  if (filters.filePair) {
    const [a, b] = filters.filePair;
    if (
      !finding.involvedSubmissionIds.includes(a) ||
      !finding.involvedSubmissionIds.includes(b)
    ) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Fixture generators
// ---------------------------------------------------------------------------

const DEFAULT_SCORE: ScoreBreakdown = {
  exactMatchScore: 0.9,
  lexicalScore: 0,
  structuralScore: 0,
  entityScore: 0,
  factScore: 0,
  tenderDiscount: 0,
  templateDiscount: 0,
  factConflictPenalty: 0,
  finalScore: 0.9,
  ruleVersion: '1.0.0',
};

function makeFinding(id: string, overrides: Partial<RiskFinding> = {}): RiskFinding {
  return {
    id,
    detectorType: 'text',
    riskLevel: 'high',
    involvedSubmissionIds: ['sub-1', 'sub-2'],
    evidence: [],
    symmetricSimilarity: 0.85,
    directionalCoverage: [{ fromId: 'sub-1', toId: 'sub-2', coverage: 0.85 }],
    confidenceScore: 0.9,
    scoreBreakdown: DEFAULT_SCORE,
    ruleVersion: '1.0.0',
    reviewStatus: 'pending',
    important: false,
    reviewNote: '',
    reviewedAt: null,
    ...overrides,
  };
}

function makeFindings(count: number): RiskFinding[] {
  const riskLevels: RiskLevel[] = ['high', 'medium', 'low'];
  const detectorTypes: DetectorType[] = ['text', 'table', 'entity', 'key-fact'];
  const reviewStatuses: FindingReviewStatus[] = ['pending', 'confirmed', 'ignored'];
  return Array.from({ length: count }, (_, i) =>
    makeFinding(`find-${i}`, {
      riskLevel: riskLevels[i % 3],
      detectorType: detectorTypes[i % 4],
      reviewStatus: reviewStatuses[i % 3],
      symmetricSimilarity: 0.5 + (i % 50) / 100,
      confidenceScore: 0.5 + (i % 50) / 100,
      important: i % 10 === 0,
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Findings Rendering Performance — 1000+ findings', () => {
  const FINDING_COUNT = 1000;

  it('filters 1000 findings by risk level in under 50ms', async () => {
    const findings = makeFindings(FINDING_COUNT);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('filter-risk-level-1000', (tracker) => {
      tracker.startPhase('filter');
      const filtered = findings.filter((f) =>
        matchesFilter(f, {
          riskLevels: new Set(['high']),
          detectorTypes: new Set(),
          reviewStatuses: new Set(),
          filePair: null,
          searchText: '',
          showImportantOnly: false,
        }),
      );
      tracker.endPhase();

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((f) => expect(f.riskLevel).toBe('high'));
    });

    const phase = result.phases.find((p) => p.name === 'filter')!;
    expect(phase.durationMs).toBeLessThan(50);
  });

  it('filters 1000 findings by detector type in under 50ms', async () => {
    const findings = makeFindings(FINDING_COUNT);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('filter-detector-type-1000', (tracker) => {
      tracker.startPhase('filter');
      const filtered = findings.filter((f) =>
        matchesFilter(f, {
          riskLevels: new Set(),
          detectorTypes: new Set(['text']),
          reviewStatuses: new Set(),
          filePair: null,
          searchText: '',
          showImportantOnly: false,
        }),
      );
      tracker.endPhase();

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((f) => expect(f.detectorType).toBe('text'));
    });

    const phase = result.phases.find((p) => p.name === 'filter')!;
    expect(phase.durationMs).toBeLessThan(50);
  });

  it('filters 1000 findings by review status in under 50ms', async () => {
    const findings = makeFindings(FINDING_COUNT);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('filter-review-status-1000', (tracker) => {
      tracker.startPhase('filter');
      const filtered = findings.filter((f) =>
        matchesFilter(f, {
          riskLevels: new Set(),
          detectorTypes: new Set(),
          reviewStatuses: new Set(['confirmed']),
          filePair: null,
          searchText: '',
          showImportantOnly: false,
        }),
      );
      tracker.endPhase();

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((f) => expect(f.reviewStatus).toBe('confirmed'));
    });

    const phase = result.phases.find((p) => p.name === 'filter')!;
    expect(phase.durationMs).toBeLessThan(50);
  });

  it('filters 1000 findings by search text in under 100ms', async () => {
    const findings = makeFindings(FINDING_COUNT);
    // Add some searchable text to evidence
    findings[0].evidence = [
      {
        id: 'ev-1',
        detectorType: 'text',
        matchBasis: 'semantic',
        similarityScore: 0.9,
        sourceSubmissionId: 'sub-1',
        sourceNodeId: 'node-1',
        sourceOriginalText: '本项目拟投入技术人员共计15人',
        sourceNormalizedText: '本项目拟投入技术人员共计15人',
        sourceSectionPath: ['技术方案'],
        sourcePageRange: null,
        sourceTableLocation: null,
        targetSubmissionId: 'sub-2',
        targetNodeId: 'node-1',
        targetOriginalText: '本项目拟投入技术人员共计15人',
        targetNormalizedText: '本项目拟投入技术人员共计15人',
        targetSectionPath: ['技术方案'],
        targetPageRange: null,
        targetTableLocation: null,
        contextBefore: '',
        contextAfter: '',
        tenderFiltered: false,
        tenderFilterReason: null,
        ruleVersion: '1.0.0',
      },
    ];

    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('filter-search-text-1000', (tracker) => {
      tracker.startPhase('filter');
      const query = '技术人员';
      const filtered = findings.filter((f) =>
        f.evidence.some(
          (e) =>
            e.sourceOriginalText.includes(query) ||
            e.targetOriginalText.includes(query),
        ),
      );
      tracker.endPhase();

      expect(filtered.length).toBeGreaterThan(0);
    });

    const phase = result.phases.find((p) => p.name === 'filter')!;
    expect(phase.durationMs).toBeLessThan(100);
  });

  it('sorts 1000 findings by confidence in under 100ms', async () => {
    const findings = makeFindings(FINDING_COUNT);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('sort-confidence-1000', (tracker) => {
      tracker.startPhase('sort');
      const sorted = [...findings].sort((a, b) => b.confidenceScore - a.confidenceScore);
      tracker.endPhase();

      expect(sorted.length).toBe(FINDING_COUNT);
      // Verify descending order
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].confidenceScore).toBeLessThanOrEqual(sorted[i - 1].confidenceScore);
      }
    });

    const phase = result.phases.find((p) => p.name === 'sort')!;
    expect(phase.durationMs).toBeLessThan(100);
  });

  it('combined filter on 1000 findings in under 100ms', async () => {
    const findings = makeFindings(FINDING_COUNT);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('combined-filter-1000', (tracker) => {
      tracker.startPhase('combined');
      const filtered = findings.filter((f) =>
        matchesFilter(f, {
          riskLevels: new Set(['high', 'medium']),
          detectorTypes: new Set(['text']),
          reviewStatuses: new Set(),
          filePair: null,
          searchText: '',
          showImportantOnly: false,
        }),
      );
      tracker.endPhase();

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((f) => {
        expect(['high', 'medium']).toContain(f.riskLevel);
        expect(f.detectorType).toBe('text');
      });
    });

    const phase = result.phases.find((p) => p.name === 'combined')!;
    expect(phase.durationMs).toBeLessThan(100);
  });
});
