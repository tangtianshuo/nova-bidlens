import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FindingFilterToolbar } from './finding-filter-toolbar';
import { useRiskReviewStore } from './risk-review-store';

afterEach(cleanup);

beforeEach(() => {
  useRiskReviewStore.setState({
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

describe('FindingFilterToolbar', () => {
  it('renders all filter buttons', () => {
    render(<FindingFilterToolbar />);
    expect(screen.getByText('高')).toBeTruthy();
    expect(screen.getByText('中')).toBeTruthy();
    expect(screen.getByText('低')).toBeTruthy();
    expect(screen.getByText('文本')).toBeTruthy();
    expect(screen.getByText('表格')).toBeTruthy();
    expect(screen.getByText('实体')).toBeTruthy();
    expect(screen.getByText('待确认')).toBeTruthy();
    expect(screen.getByText('已确认')).toBeTruthy();
    expect(screen.getByText('仅重要')).toBeTruthy();
  });

  it('has toolbar role with aria-label', () => {
    render(<FindingFilterToolbar />);
    expect(screen.getByRole('toolbar', { name: '发现项筛选' })).toBeTruthy();
  });

  it('toggles risk level filter on click', async () => {
    const user = userEvent.setup();
    render(<FindingFilterToolbar />);
    await user.click(screen.getByText('高'));
    expect(useRiskReviewStore.getState().filters.riskLevels.has('high')).toBe(true);
    await user.click(screen.getByText('高'));
    expect(useRiskReviewStore.getState().filters.riskLevels.has('high')).toBe(false);
  });

  it('toggles detector type filter on click', async () => {
    const user = userEvent.setup();
    render(<FindingFilterToolbar />);
    await user.click(screen.getByText('文本'));
    expect(useRiskReviewStore.getState().filters.detectorTypes.has('text')).toBe(true);
  });

  it('toggles review status filter on click', async () => {
    const user = userEvent.setup();
    render(<FindingFilterToolbar />);
    await user.click(screen.getByText('已确认'));
    expect(useRiskReviewStore.getState().filters.reviewStatuses.has('confirmed')).toBe(true);
  });

  it('toggles show important only', async () => {
    const user = userEvent.setup();
    render(<FindingFilterToolbar />);
    await user.click(screen.getByText('仅重要'));
    expect(useRiskReviewStore.getState().filters.showImportantOnly).toBe(true);
  });

  it('shows clear button when filters are active', async () => {
    const user = userEvent.setup();
    render(<FindingFilterToolbar />);
    expect(screen.queryByText('清除筛选')).toBeNull();
    await user.click(screen.getByText('高'));
    expect(screen.getByText('清除筛选')).toBeTruthy();
  });

  it('clears all filters when clear button clicked', async () => {
    const user = userEvent.setup();
    render(<FindingFilterToolbar />);
    await user.click(screen.getByText('高'));
    await user.click(screen.getByText('文本'));
    await user.click(screen.getByText('清除筛选'));
    const filters = useRiskReviewStore.getState().filters;
    expect(filters.riskLevels.size).toBe(0);
    expect(filters.detectorTypes.size).toBe(0);
  });

  it('sets aria-pressed on active filters', async () => {
    const user = userEvent.setup();
    render(<FindingFilterToolbar />);
    const highBtn = screen.getByText('高');
    expect(highBtn.getAttribute('aria-pressed')).toBe('false');
    await user.click(highBtn);
    expect(highBtn.getAttribute('aria-pressed')).toBe('true');
  });
});
