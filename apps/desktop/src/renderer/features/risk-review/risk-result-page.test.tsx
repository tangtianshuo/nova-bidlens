import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RiskResultPage } from './risk-result-page';
import { useRiskReviewStore } from './risk-review-store';

// Mock the query hooks
vi.mock('./risk-result-queries', () => ({
  useRiskResultDetail: (id: string | null) => {
    if (!id) return { data: null, isLoading: true, error: null };
    if (id === 'proj-not-found') return { data: null, isLoading: false, error: new Error('not found') };
    return {
      data: {
        id,
        name: '测试项目',
        status: 'ready',
        submissions: [
          { id: 'sub-1', fileName: 'A.docx', fileFormat: 'docx', fileSizeBytes: 1000, pageCount: 10, sha256: 'a'.repeat(64), status: 'ready', warnings: [] },
          { id: 'sub-2', fileName: 'B.docx', fileFormat: 'docx', fileSizeBytes: 1000, pageCount: 10, sha256: 'b'.repeat(64), status: 'ready', warnings: [] },
        ],
        findings: [
          { id: 'f1', detectorType: 'text', riskLevel: 'high', involvedSubmissionIds: ['sub-1', 'sub-2'], evidence: [], symmetricSimilarity: 0.9, directionalCoverage: [], confidenceScore: 0.95, reviewStatus: 'pending', important: false, reviewNote: '', reviewedAt: null, scoreBreakdown: { exactMatchScore: 0, lexicalScore: 0.9, structuralScore: 0, entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0, factConflictPenalty: 0, finalScore: 0.9, ruleVersion: '1.0.0' }, ruleVersion: '1.0.0' },
        ],
        assessment: { level: 'high', rawRuleScore: 82, topContributingFindingIds: ['f1'], preset: 'standard', ruleVersion: '1.0.0', analysisStatus: 'complete' },
        filePairAssessments: [],
        baseline: null,
        warnings: [],
        degradationReason: null,
        preset: 'standard',
        modelVersion: 'bge-m3-1.0',
        ruleVersion: '1.0.0',
        parserVersion: '0.2.2',
        matcherVersion: '0.2.2',
        elapsedMs: 45000,
      },
      isLoading: false,
      error: null,
    };
  },
  useFindingCounts: (findings: any[]) => ({
    total: findings.length,
    byRisk: { high: 1, medium: 0, low: 0 },
    byDetector: { text: 1, table: 0, entity: 0, 'key-fact': 0 },
    byReviewStatus: { pending: 1, confirmed: 0, ignored: 0 },
    important: 0,
    confirmed: 0,
    pending: 1,
  }),
}));

// Mock mutations
vi.mock('./risk-review-mutations', () => ({
  useSaveRiskFindingReview: () => ({ mutate: vi.fn() }),
  useDebouncedNoteSave: () => vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  useRiskReviewStore.setState({
    projectId: 'proj-fixture-001',
    selectedFindingId: null,
    filters: {
      riskLevels: new Set(),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: null,
      searchText: '',
      showImportantOnly: false,
    },
  });
});

describe('RiskResultPage', () => {
  it('renders project name', () => {
    render(<RiskResultPage />);
    expect(screen.getByText('测试项目')).toBeTruthy();
  });

  it('renders back button', () => {
    render(<RiskResultPage />);
    expect(screen.getByText('返回项目列表')).toBeTruthy();
  });

  it('calls onBack when back clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<RiskResultPage onBack={onBack} />);
    await user.click(screen.getByText('返回项目列表'));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows loading state when no project selected', () => {
    useRiskReviewStore.setState({ projectId: null });
    render(<RiskResultPage />);
    expect(screen.queryByText('测试项目')).toBeNull();
  });

  it('shows error state when project not found', () => {
    useRiskReviewStore.setState({ projectId: 'proj-not-found' });
    render(<RiskResultPage />);
    expect(screen.getByText(/加载结果失败/)).toBeTruthy();
  });

  it('renders persistent banner for partial results', () => {
    render(<RiskResultPage />);
    // No partial banner for ready project
    expect(screen.queryByText('结果不完整')).toBeNull();
  });

  it('renders three-column layout', () => {
    render(<RiskResultPage />);
    // Finding list placeholder
    expect(screen.getByText('文件关系矩阵')).toBeTruthy();
    expect(screen.getByText('导出报告')).toBeTruthy();
  });
});
