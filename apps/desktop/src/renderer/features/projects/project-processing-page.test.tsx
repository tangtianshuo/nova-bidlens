import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ProjectProcessingPage } from './project-processing-page';
import { useRiskReviewStore } from '../risk-review/risk-review-store';
import { deriveStages } from './analysis-stage-list';
import type { ProjectStatus } from '@bidlens/shared/types-only';
import {
  buildReadyScenario,
  buildProcessingScenario,
  buildInterruptedScenario,
  buildFailedScenario,
  buildPartialScenario,
  buildDegradedScenario,
} from '../../__fixtures__/risk-project';

afterEach(cleanup);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function selectProject(id: string) {
  useRiskReviewStore.setState({ projectId: id });
}

const details = [
  buildReadyScenario,
  buildProcessingScenario,
  buildInterruptedScenario,
  buildFailedScenario,
  buildPartialScenario,
  buildDegradedScenario,
].map((b) => b());

beforeEach(() => {
  useRiskReviewStore.setState({
    projectId: null,
    activeTab: 'overview',
    selectedFindingId: null,
    filters: { riskLevels: new Set(), detectorTypes: new Set(), reviewStatuses: new Set(), filePair: null, searchText: '', showImportantOnly: false },
    selectedFindingIds: new Set(),
  });
  (window as any).bidlens = {
    onRiskProgress: vi.fn(() => () => {}),
    cancelRiskProject: vi.fn(() => Promise.resolve({ projectId: '', cancelled: true })),
    resumeRiskProject: vi.fn(() => Promise.resolve({ projectId: '' })),
    retryRiskSubmission: vi.fn(() => Promise.resolve({ projectId: '' })),
    acceptPartial: vi.fn(() => Promise.resolve({ projectId: '' })),
    deleteProject: vi.fn(() => Promise.resolve({ deleted: true })),
    getProject: vi.fn((id: string) => {
      const found = details.find((d) => d.id === id);
      return found ? Promise.resolve(found) : Promise.reject(new Error('项目不存在'));
    }),
  };
});

describe('deriveStages', () => {
  it('marks stages before current as done', () => {
    const stages = deriveStages('running', 'detecting');
    expect(stages[0].state).toBe('done'); // validating
    expect(stages[1].state).toBe('done'); // parsing
    expect(stages[2].state).toBe('done'); // extracting-nodes
    expect(stages[3].state).toBe('done'); // extracting-entities
    expect(stages[4].state).toBe('done'); // filtering-tender-content
    expect(stages[5].state).toBe('done'); // recalling-candidates
    expect(stages[6].state).toBe('active'); // detecting
  });

  it('marks stages after current as pending', () => {
    const stages = deriveStages('running', 'detecting');
    expect(stages[7].state).toBe('pending'); // aggregating
    expect(stages[8].state).toBe('pending'); // persisting
    expect(stages[9].state).toBe('pending'); // completed
  });

  it('marks all pipeline stages as done when project is ready', () => {
    const stages = deriveStages('ready');
    for (let i = 0; i < 10; i++) {
      expect(stages[i].state).toBe('done');
    }
    expect(stages[10].state).toBe('done'); // ready terminal
  });

  it('marks failed stage as done when project failed', () => {
    const stages = deriveStages('failed');
    expect(stages[10].state).toBe('done'); // failed terminal (all stages done in terminal state)
  });

  it('uses stage timings when provided', () => {
    const stages = deriveStages('running', 'detecting', {
      validating: 2,
      parsing: 8,
    });
    expect(stages[0].elapsedSec).toBe(2);
    expect(stages[1].elapsedSec).toBe(8);
    expect(stages[2].elapsedSec).toBeNull();
  });

  it('returns 11 stages total', () => {
    const stages = deriveStages('running', 'validating');
    expect(stages.length).toBe(11);
  });
});

describe('ProjectProcessingPage', () => {
  it('renders loading skeleton when no project selected', () => {
    const wrapper = createWrapper();
    const { container } = render(<ProjectProcessingPage />, { wrapper });
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('shows project name after loading', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/处理中/)).toBeTruthy();
    });
  });

  it('displays the 9 analysis stages', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      const list = screen.getByRole('list', { name: '分析阶段' });
      const items = list.querySelectorAll('[role="listitem"]');
      expect(items.length).toBe(9);
    });
  });

  it('shows stage list with role="list"', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('list', { name: '分析阶段' })).toBeTruthy();
    });
  });

  it('displays file progress table', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('A公司投标文件.docx')).toBeTruthy();
      expect(screen.getByText('B公司投标文件.docx')).toBeTruthy();
      expect(screen.getByText('C公司投标文件.docx')).toBeTruthy();
    });
  });

  it('shows cancel button for active project', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('取消分析')).toBeTruthy();
    });
  });

  it('does not show cancel button for completed project', async () => {
    selectProject('proj-fixture-001');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.queryByText('取消分析')).toBeNull();
    });
  });

  it('does not call cancelRiskProject immediately on cancel button click', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('取消分析')).toBeTruthy();
    });

    const cancelBtn = screen.getByText('取消分析');
    fireEvent.click(cancelBtn);
    // Should NOT call cancelRiskProject immediately (confirmation dialog intercepts)
    expect((window as any).bidlens.cancelRiskProject).not.toHaveBeenCalled();
  });

  it('navigates back on back button click', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('返回项目列表')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('返回项目列表'));
    expect(useRiskReviewStore.getState().projectId).toBeNull();
  });

  it('shows warnings as banners when present', async () => {
    selectProject('proj-fixture-005'); // interrupted scenario has warnings
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/分析过程中断/)).toBeTruthy();
    });
  });

  it('shows elapsed time in header', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/耗时：/)).toBeTruthy();
    });
  });

  it('shows preset label', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/预设：标准/)).toBeTruthy();
    });
  });

  it('shows error state for non-existent project', async () => {
    selectProject('proj-nonexistent');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/加载项目详情失败/)).toBeTruthy();
    });
  });

  it('shows recovery section with retry button for failed project', async () => {
    selectProject('proj-fixture-007');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      const recovery = screen.getByRole('region', { name: '分析恢复操作' });
      expect(recovery).toBeTruthy();
      expect(screen.getByText('分析失败')).toBeTruthy();
      expect(screen.getByText('重试分析')).toBeTruthy();
    });
  });

  it('does not show recovery section for non-failed project', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.queryByText('重试分析')).toBeNull();
    });
  });
});
