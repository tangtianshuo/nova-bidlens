import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FindingVirtualList } from './finding-virtual-list';
import { useRiskReviewStore } from './risk-review-store';
import { buildReadyScenario } from '../../__fixtures__/risk-project';

afterEach(cleanup);

beforeEach(() => {
  useRiskReviewStore.setState({
    selectedFindingId: null,
    selectedFindingIds: new Set(),
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

describe('FindingVirtualList', () => {
  it('renders all findings when no filters', () => {
    const project = buildReadyScenario();
    render(<FindingVirtualList findings={project.findings} />);
    expect(screen.getByText(/显示 5 \/ 5 个发现项/)).toBeTruthy();
  });

  it('renders listbox with aria-label', () => {
    const project = buildReadyScenario();
    render(<FindingVirtualList findings={project.findings} />);
    expect(screen.getByRole('listbox', { name: '发现项列表' })).toBeTruthy();
  });

  it('renders each finding as an option', () => {
    const project = buildReadyScenario();
    render(<FindingVirtualList findings={project.findings} />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(project.findings.length);
  });

  it('filters by risk level', async () => {
    const project = buildReadyScenario();
    useRiskReviewStore.getState().setRiskFilter(['high']);
    render(<FindingVirtualList findings={project.findings} />);
    // Ready scenario has 2 high-risk findings
    expect(screen.getByText(/显示 2 \/ 5 个发现项/)).toBeTruthy();
  });

  it('filters by detector type', async () => {
    const project = buildReadyScenario();
    useRiskReviewStore.getState().setDetectorFilter(['entity']);
    render(<FindingVirtualList findings={project.findings} />);
    expect(screen.getByText(/显示 1 \/ 5 个发现项/)).toBeTruthy();
  });

  it('shows empty state when no findings match', () => {
    const project = buildReadyScenario();
    useRiskReviewStore.getState().setRiskFilter(['low']);
    useRiskReviewStore.getState().setDetectorFilter(['entity']);
    render(<FindingVirtualList findings={project.findings} />);
    expect(screen.getByText('无匹配的发现项')).toBeTruthy();
  });

  it('selects finding on click', async () => {
    const user = userEvent.setup();
    const project = buildReadyScenario();
    render(<FindingVirtualList findings={project.findings} />);
    const options = screen.getAllByRole('option');
    await user.click(options[0]);
    expect(useRiskReviewStore.getState().selectedFindingId).toBeTruthy();
  });

  it('toggles checkbox on checkbox click', async () => {
    const user = userEvent.setup();
    const project = buildReadyScenario();
    render(<FindingVirtualList findings={project.findings} />);
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(useRiskReviewStore.getState().selectedFindingIds.size).toBe(1);
  });

  it('shows review status badges', () => {
    const project = buildReadyScenario();
    render(<FindingVirtualList findings={project.findings} />);
    // All findings in ready scenario are 'pending'
    expect(screen.getAllByText('待确认').length).toBe(project.findings.length);
  });

  it('shows empty state with total count when findings exist but none match', () => {
    useRiskReviewStore.getState().setShowImportantOnly(true);
    const project = buildReadyScenario(); // all pending, none important
    render(<FindingVirtualList findings={project.findings} />);
    expect(screen.getByText(/共 5 个发现项/)).toBeTruthy();
  });
});
