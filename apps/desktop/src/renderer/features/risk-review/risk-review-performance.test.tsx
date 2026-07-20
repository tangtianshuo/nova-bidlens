import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { FindingVirtualList } from './finding-virtual-list';
import { matchesFilter } from './risk-review-store';
import type { RiskFinding } from '../../__fixtures__/risk-project';

afterEach(cleanup);

function makeFinding(id: string, overrides: Partial<RiskFinding> = {}): RiskFinding {
  return {
    id,
    detectorType: 'text',
    riskLevel: 'high',
    involvedSubmissionIds: ['sub-1', 'sub-2'],
    evidence: [],
    symmetricSimilarity: 0.85,
    directionalCoverage: [
      { fromId: 'sub-1', toId: 'sub-2', coverage: 0.85 },
    ],
    confidenceScore: 0.9,
    reviewStatus: 'pending',
    reviewNote: '',
    ruleVersion: '1.0.0',
    ...overrides,
  };
}

function makeFindings(count: number): RiskFinding[] {
  const riskLevels: RiskFinding['riskLevel'][] = ['high', 'medium', 'low'];
  const detectorTypes: RiskFinding['detectorType'][] = ['text', 'table', 'entity'];
  return Array.from({ length: count }, (_, i) =>
    makeFinding(`find-${i}`, {
      riskLevel: riskLevels[i % 3],
      detectorType: detectorTypes[i % 3],
      symmetricSimilarity: 0.5 + (i % 50) / 100,
    }),
  );
}

describe('Risk review performance', () => {
  describe('matchesFilter', () => {
    it('filters 1000 findings in under 50ms', () => {
      const findings = makeFindings(1000);
      const filters = {
        riskLevels: new Set(['high' as const]),
        detectorTypes: new Set() as Set<RiskFinding['detectorType']>,
        reviewStatuses: new Set() as Set<RiskFinding['reviewStatus']>,
        filePair: null,
        searchText: '',
        showImportantOnly: false,
      };

      const start = performance.now();
      const result = findings.filter((f) => matchesFilter(f, filters));
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((f) => expect(f.riskLevel).toBe('high'));
    });

    it('filters 1000 findings with multiple criteria in under 50ms', () => {
      const findings = makeFindings(1000);
      const filters = {
        riskLevels: new Set(['high' as const, 'medium' as const]),
        detectorTypes: new Set(['text' as const]),
        reviewStatuses: new Set() as Set<RiskFinding['reviewStatus']>,
        filePair: null,
        searchText: '',
        showImportantOnly: false,
      };

      const start = performance.now();
      const result = findings.filter((f) => matchesFilter(f, filters));
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      result.forEach((f) => {
        expect(['high', 'medium']).toContain(f.riskLevel);
        expect(f.detectorType).toBe('text');
      });
    });
  });

  describe('FindingVirtualList', () => {
    it('renders 100 findings without error', () => {
      const findings = makeFindings(100);
      render(<FindingVirtualList findings={findings} />);
      expect(screen.getByRole('listbox', { name: '发现项列表' })).toBeTruthy();
    });

    it('renders empty state for 0 findings', () => {
      render(<FindingVirtualList findings={[]} />);
      expect(screen.getByText('无匹配的发现项')).toBeTruthy();
    });

    it('renders filtered count correctly', () => {
      const findings = makeFindings(50);
      render(<FindingVirtualList findings={findings} />);
      expect(screen.getByText(/显示 \d+ \/ 50 个发现项/)).toBeTruthy();
    });
  });
});
