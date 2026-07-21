import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { EvidenceDetailTabs } from './evidence-detail-tabs';
import type { RiskFinding } from '../../__fixtures__/risk-project';

afterEach(cleanup);

function makeFinding(overrides: Partial<RiskFinding> = {}): RiskFinding {
  return {
    id: 'find-test-001',
    detectorType: 'text',
    riskLevel: 'high',
    involvedSubmissionIds: ['sub-1', 'sub-2'],
    evidence: [],
    symmetricSimilarity: 0.89,
    directionalCoverage: [
      { fromId: 'sub-1', toId: 'sub-2', coverage: 0.85 },
      { fromId: 'sub-2', toId: 'sub-1', coverage: 0.78 },
    ],
    confidenceScore: 0.91,
    scoreBreakdown: { exactMatchScore: 0.9, lexicalScore: 0, structuralScore: 0, entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0, factConflictPenalty: 0, finalScore: 0.9, ruleVersion: '1.0.0' },
    ruleVersion: '1.0.0',
    reviewStatus: 'pending',
    important: false,
    reviewNote: '',
    reviewedAt: null,
    ...overrides,
  };
}

describe('EvidenceDetailTabs', () => {
  it('renders risk level badge', () => {
    const finding = makeFinding({ riskLevel: 'high' });
    render(<EvidenceDetailTabs finding={finding} submissionNames={new Map()} />);
    expect(screen.getByText('高风险')).toBeTruthy();
  });

  it('renders detector type label', () => {
    const finding = makeFinding({ detectorType: 'table' });
    render(<EvidenceDetailTabs finding={finding} submissionNames={new Map()} />);
    expect(screen.getByText('表格雷同')).toBeTruthy();
  });

  it('renders similarity and confidence', () => {
    const finding = makeFinding({ symmetricSimilarity: 0.85, confidenceScore: 0.92 });
    render(<EvidenceDetailTabs finding={finding} submissionNames={new Map()} />);
    const percentages = screen.getAllByText(/%$/);
    expect(percentages.length).toBeGreaterThanOrEqual(2);
  });

  it('renders involved files', () => {
    const finding = makeFinding({ involvedSubmissionIds: ['sub-1', 'sub-2'] });
    const names = new Map([['sub-1', 'A公司投标文件.docx'], ['sub-2', 'B公司投标文件.docx']]);
    render(<EvidenceDetailTabs finding={finding} submissionNames={names} />);
    // Names appear in both "涉及文件" and "方向覆盖率" sections
    const aMatches = screen.getAllByText('A公司投标文件.docx');
    expect(aMatches.length).toBeGreaterThanOrEqual(1);
    const bMatches = screen.getAllByText('B公司投标文件.docx');
    expect(bMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders directional coverage', () => {
    const finding = makeFinding();
    render(<EvidenceDetailTabs finding={finding} submissionNames={new Map()} />);
    expect(screen.getByText('方向覆盖率')).toBeTruthy();
    expect(screen.getByText('85%')).toBeTruthy();
    expect(screen.getByText('78%')).toBeTruthy();
  });

  it('renders rule version', () => {
    const finding = makeFinding({ ruleVersion: '2.0.0' });
    render(<EvidenceDetailTabs finding={finding} submissionNames={new Map()} />);
    expect(screen.getByText(/2.0.0/)).toBeTruthy();
  });

  it('has region role', () => {
    const finding = makeFinding();
    render(<EvidenceDetailTabs finding={finding} submissionNames={new Map()} />);
    expect(screen.getByRole('region', { name: '发现项详情' })).toBeTruthy();
  });
});
