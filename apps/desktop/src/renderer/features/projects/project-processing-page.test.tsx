import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ProjectProcessingPage } from './project-processing-page';
import { useProjectStore } from './project-store';
import { deriveStages } from './analysis-stage-list';
import type { AnalysisProjectStatus } from '../../__fixtures__/risk-project';

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
  useProjectStore.setState({ selectedProjectId: id });
}

beforeEach(() => {
  useProjectStore.setState({
    selectedProjectId: null,
    searchText: '',
    statusFilter: null,
    riskFilter: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10,
  });
});

describe('deriveStages', () => {
  it('marks stages before current as done', () => {
    const stages = deriveStages('detecting' as AnalysisProjectStatus);
    expect(stages[0].state).toBe('done'); // validating
    expect(stages[1].state).toBe('done'); // parsing
    expect(stages[2].state).toBe('done'); // filtering
    expect(stages[3].state).toBe('done'); // embedding
    expect(stages[4].state).toBe('done'); // retrieving
    expect(stages[5].state).toBe('active'); // detecting
  });

  it('marks stages after current as pending', () => {
    const stages = deriveStages('detecting' as AnalysisProjectStatus);
    expect(stages[6].state).toBe('pending'); // aggregating
    expect(stages[7].state).toBe('pending'); // ready
    expect(stages[8].state).toBe('pending'); // failed
  });

  it('marks all pipeline stages as done when project is ready', () => {
    const stages = deriveStages('ready' as AnalysisProjectStatus);
    for (let i = 0; i < 7; i++) {
      expect(stages[i].state).toBe('done');
    }
    expect(stages[7].state).toBe('done'); // ready
    expect(stages[8].state).toBe('pending'); // failed
  });

  it('marks failed stage as error when project failed', () => {
    const stages = deriveStages('failed' as AnalysisProjectStatus);
    expect(stages[7].state).toBe('pending'); // ready
    expect(stages[8].state).toBe('error'); // failed
  });

  it('uses stage timings when provided', () => {
    const stages = deriveStages('detecting' as AnalysisProjectStatus, {
      validating: 2,
      parsing: 8,
    });
    expect(stages[0].elapsedSec).toBe(2);
    expect(stages[1].elapsedSec).toBe(8);
    expect(stages[2].elapsedSec).toBeNull();
  });

  it('returns 9 stages total', () => {
    const stages = deriveStages('validating' as AnalysisProjectStatus);
    expect(stages.length).toBe(9);
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

  it('logs cancel on cancel button click', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('取消分析')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('取消分析'));
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ProjectProcessing] cancel analysis for:',
      'proj-fixture-006',
    );
    consoleSpy.mockRestore();
  });

  it('navigates back on back button click', async () => {
    selectProject('proj-fixture-006');
    const wrapper = createWrapper();
    render(<ProjectProcessingPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('返回项目列表')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('返回项目列表'));
    expect(useProjectStore.getState().selectedProjectId).toBeNull();
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
});
