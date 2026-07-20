import { describe, expect, it, beforeEach } from 'vitest';
import { useRiskReviewStore, matchesFilter, type FindingFilterState } from './risk-review-store';
import type { RiskFinding } from '../../__fixtures__/risk-project';

beforeEach(() => {
  useRiskReviewStore.setState({
    activeTab: 'overview',
    projectId: null,
    selectedFindingId: null,
    filters: {
      riskLevels: new Set(),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: null,
      searchText: '',
      showImportantOnly: false,
    },
    selectedFindingIds: new Set(),
  });
});

describe('useRiskReviewStore', () => {
  it('defaults to overview tab', () => {
    expect(useRiskReviewStore.getState().activeTab).toBe('overview');
  });

  it('sets active tab', () => {
    useRiskReviewStore.getState().setActiveTab('matrix');
    expect(useRiskReviewStore.getState().activeTab).toBe('matrix');
  });

  it('sets project id and resets finding selection', () => {
    useRiskReviewStore.getState().selectFinding('find-1');
    useRiskReviewStore.getState().setProjectId('proj-1');
    expect(useRiskReviewStore.getState().projectId).toBe('proj-1');
    expect(useRiskReviewStore.getState().selectedFindingId).toBeNull();
  });

  it('selects and deselects finding', () => {
    useRiskReviewStore.getState().selectFinding('find-1');
    expect(useRiskReviewStore.getState().selectedFindingId).toBe('find-1');
    useRiskReviewStore.getState().selectFinding(null);
    expect(useRiskReviewStore.getState().selectedFindingId).toBeNull();
  });

  it('sets risk filter', () => {
    useRiskReviewStore.getState().setRiskFilter(['high', 'medium']);
    const filters = useRiskReviewStore.getState().filters;
    expect(filters.riskLevels.has('high')).toBe(true);
    expect(filters.riskLevels.has('medium')).toBe(true);
    expect(filters.riskLevels.has('low')).toBe(false);
  });

  it('sets detector filter', () => {
    useRiskReviewStore.getState().setDetectorFilter(['text', 'entity']);
    const filters = useRiskReviewStore.getState().filters;
    expect(filters.detectorTypes.has('text')).toBe(true);
    expect(filters.detectorTypes.has('entity')).toBe(true);
  });

  it('sets review status filter', () => {
    useRiskReviewStore.getState().setReviewStatusFilter(['confirmed', 'important']);
    const filters = useRiskReviewStore.getState().filters;
    expect(filters.reviewStatuses.has('confirmed')).toBe(true);
    expect(filters.reviewStatuses.has('important')).toBe(true);
  });

  it('sets file pair filter', () => {
    useRiskReviewStore.getState().setFilePair(['sub-1', 'sub-2']);
    expect(useRiskReviewStore.getState().filters.filePair).toEqual(['sub-1', 'sub-2']);
  });

  it('sets search text', () => {
    useRiskReviewStore.getState().setSearchText('雷同');
    expect(useRiskReviewStore.getState().filters.searchText).toBe('雷同');
  });

  it('sets show important only', () => {
    useRiskReviewStore.getState().setShowImportantOnly(true);
    expect(useRiskReviewStore.getState().filters.showImportantOnly).toBe(true);
  });

  it('clears all filters', () => {
    useRiskReviewStore.getState().setRiskFilter(['high']);
    useRiskReviewStore.getState().setDetectorFilter(['text']);
    useRiskReviewStore.getState().setSearchText('test');
    useRiskReviewStore.getState().clearFilters();
    const filters = useRiskReviewStore.getState().filters;
    expect(filters.riskLevels.size).toBe(0);
    expect(filters.detectorTypes.size).toBe(0);
    expect(filters.searchText).toBe('');
  });

  it('toggles finding selection', () => {
    useRiskReviewStore.getState().toggleFindingSelection('find-1');
    expect(useRiskReviewStore.getState().selectedFindingIds.has('find-1')).toBe(true);
    useRiskReviewStore.getState().toggleFindingSelection('find-1');
    expect(useRiskReviewStore.getState().selectedFindingIds.has('find-1')).toBe(false);
  });

  it('selects all findings', () => {
    useRiskReviewStore.getState().selectAllFindings(['f1', 'f2', 'f3']);
    const ids = useRiskReviewStore.getState().selectedFindingIds;
    expect(ids.has('f1')).toBe(true);
    expect(ids.has('f2')).toBe(true);
    expect(ids.has('f3')).toBe(true);
  });

  it('clears selection', () => {
    useRiskReviewStore.getState().selectAllFindings(['f1', 'f2']);
    useRiskReviewStore.getState().clearSelection();
    expect(useRiskReviewStore.getState().selectedFindingIds.size).toBe(0);
  });
});

describe('matchesFilter', () => {
  const finding = {
    riskLevel: 'high' as const,
    detectorType: 'text' as const,
    reviewStatus: 'pending' as const,
    involvedSubmissionIds: ['sub-1', 'sub-2'],
  };

  it('matches when no filters are set', () => {
    const filters: FindingFilterState = {
      riskLevels: new Set(),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: null,
      searchText: '',
      showImportantOnly: false,
    };
    expect(matchesFilter(finding, filters)).toBe(true);
  });

  it('matches when risk level is in filter', () => {
    const filters: FindingFilterState = {
      riskLevels: new Set(['high'] as const),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: null,
      searchText: '',
      showImportantOnly: false,
    };
    expect(matchesFilter(finding, filters)).toBe(true);
  });

  it('does not match when risk level is not in filter', () => {
    const filters: FindingFilterState = {
      riskLevels: new Set(['low'] as const),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: null,
      searchText: '',
      showImportantOnly: false,
    };
    expect(matchesFilter(finding, filters)).toBe(false);
  });

  it('does not match when showImportantOnly is true and status is pending', () => {
    const filters: FindingFilterState = {
      riskLevels: new Set(),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: null,
      searchText: '',
      showImportantOnly: true,
    };
    expect(matchesFilter(finding, filters)).toBe(false);
  });

  it('matches when showImportantOnly is true and status is important', () => {
    const importantFinding = { ...finding, reviewStatus: 'important' as const };
    const filters: FindingFilterState = {
      riskLevels: new Set(),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: null,
      searchText: '',
      showImportantOnly: true,
    };
    expect(matchesFilter(importantFinding, filters)).toBe(true);
  });

  it('matches when file pair is in finding submissions', () => {
    const filters: FindingFilterState = {
      riskLevels: new Set(),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: ['sub-1', 'sub-2'] as [string, string],
      searchText: '',
      showImportantOnly: false,
    };
    expect(matchesFilter(finding, filters)).toBe(true);
  });

  it('does not match when file pair is not in finding submissions', () => {
    const filters: FindingFilterState = {
      riskLevels: new Set(),
      detectorTypes: new Set(),
      reviewStatuses: new Set(),
      filePair: ['sub-3', 'sub-4'] as [string, string],
      searchText: '',
      showImportantOnly: false,
    };
    expect(matchesFilter(finding, filters)).toBe(false);
  });
});
