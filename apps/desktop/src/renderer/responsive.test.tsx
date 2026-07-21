import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { RelationshipMatrix } from './features/risk-review/relationship-matrix';
import type { SubmissionSummary, RiskFinding } from './__fixtures__/risk-project';

afterEach(cleanup);

const DEFAULT_SCORE = { exactMatchScore: 0.8, lexicalScore: 0, structuralScore: 0, entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0, factConflictPenalty: 0, finalScore: 0.8, ruleVersion: '1.0.0' };

function makeSubmissions(count: number): SubmissionSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sub-${i + 1}`,
    fileName: `投标文件${i + 1}.docx`,
    fileFormat: 'docx' as const,
    fileSizeBytes: 1024 * (i + 1),
    pageCount: 10 * (i + 1),
    sha256: `hash-${i + 1}`,
    status: 'extracted' as const,
    warnings: [],
  }));
}

function makeFindings(submissions: SubmissionSummary[]): RiskFinding[] {
  const findings: RiskFinding[] = [];
  for (let i = 0; i < submissions.length - 1; i++) {
    findings.push({
      id: `find-${i}`,
      detectorType: 'text',
      riskLevel: 'high',
      involvedSubmissionIds: [submissions[i].id, submissions[i + 1].id],
      evidence: [],
      symmetricSimilarity: 0.8,
      directionalCoverage: [
        { fromId: submissions[i].id, toId: submissions[i + 1].id, coverage: 0.85 },
        { fromId: submissions[i + 1].id, toId: submissions[i].id, coverage: 0.78 },
      ],
      confidenceScore: 0.9,
      scoreBreakdown: DEFAULT_SCORE,
      ruleVersion: '1.0.0',
      reviewStatus: 'pending',
      important: false,
      reviewNote: '',
      reviewedAt: null,
    });
  }
  return findings;
}

describe('Responsive layout', () => {
  describe('RelationshipMatrix', () => {
    it('has overflow-x-auto container', () => {
      const subs = makeSubmissions(4);
      render(<RelationshipMatrix submissions={subs} findings={makeFindings(subs)} />);
      const grid = screen.getByRole('grid', { name: '文件关系矩阵' });
      expect(grid.className).toContain('overflow-x-auto');
    });

    it('has overscroll-behavior-inline-contain', () => {
      const subs = makeSubmissions(3);
      render(<RelationshipMatrix submissions={subs} findings={[]} />);
      const grid = screen.getByRole('grid', { name: '文件关系矩阵' });
      expect(grid.className).toContain('overscroll-behavior-inline-contain');
    });

    it('renders all submission headers', () => {
      const subs = makeSubmissions(5);
      render(<RelationshipMatrix submissions={subs} findings={[]} />);
      const headers = screen.getAllByText(/投标文件/);
      expect(headers.length).toBeGreaterThanOrEqual(5);
    });

    it('renders grid cells with findings', () => {
      const subs = makeSubmissions(3);
      const findings = makeFindings(subs);
      render(<RelationshipMatrix submissions={subs} findings={findings} />);
      const cells = screen.getAllByRole('gridcell');
      expect(cells.length).toBe(6);
    });
  });
});
