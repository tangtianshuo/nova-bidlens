import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryView } from './history-view';
import { useAppStore } from '../../stores/app-store';
import { useResultStore } from '../../stores/result-store';
import type { TaskSummary } from '@bidlens/shared/types-only';

// ---------------------------------------------------------------------------
// Mock window.bidlens
// ---------------------------------------------------------------------------

const mockListHistory = vi.fn();
const mockRetainTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockClearHistory = vi.fn();
const mockOpenSnapshot = vi.fn();
const mockRecompare = vi.fn();
const mockSelectFile = vi.fn();

function setupMocks() {
  (window as any).bidlens = {
    listHistory: mockListHistory,
    retainTask: mockRetainTask,
    deleteTask: mockDeleteTask,
    clearHistory: mockClearHistory,
    openSnapshot: mockOpenSnapshot,
    recompare: mockRecompare,
    selectFile: mockSelectFile,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  setupMocks();

  // Reset stores
  useAppStore.setState({ view: 'history', taskId: null });
  useResultStore.setState({
    result: null,
    diffAst: null,
    itemMap: new Map(),
    annotationMap: new Map(),
    items: [],
    filteredItems: [],
    counts: {
      total: 0, identical: 0, modified: 0, added: 0, deleted: 0,
      moved: 0, split: 0, merged: 0, uncertain: 0, reviewed: 0, important: 0,
    },
    selectedItemId: null,
  });
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTaskSummary(overrides: Partial<TaskSummary> & { taskId: string }): TaskSummary {
  return {
    displayName: `${overrides.taskId}-docA.docx vs ${overrides.taskId}-docB.docx`,
    status: 'ready',
    docAFilename: `${overrides.taskId}-docA.docx`,
    docBFilename: `${overrides.taskId}-docB.docx`,
    diffSummary: { modified: 5, added: 3, deleted: 1 },
    reviewProgress: { total: 10, reviewed: 3, important: 1 },
    lastAccessedAt: '2025-01-15T10:00:00Z',
    retained: false,
    startedAt: '2025-01-15T09:00:00Z',
    completedAt: '2025-01-15T09:05:00Z',
    durationMs: 300000,
    ...overrides,
  };
}

const MOCK_TASKS: TaskSummary[] = [
  makeTaskSummary({
    taskId: 'task-1',
    displayName: '招标文件A.docx vs 投标文件B.docx',
    docAFilename: '招标文件A.docx',
    docBFilename: '投标文件B.docx',
    status: 'ready',
    retained: false,
    lastAccessedAt: '2025-01-15T10:00:00Z',
    reviewProgress: { total: 10, reviewed: 10, important: 2 },
  }),
  makeTaskSummary({
    taskId: 'task-2',
    displayName: '技术规范V2.docx vs 技术规范V3.docx',
    docAFilename: '技术规范V2.docx',
    docBFilename: '技术规范V3.docx',
    status: 'failed',
    retained: true,
    lastAccessedAt: '2025-01-14T08:00:00Z',
    reviewProgress: { total: 20, reviewed: 5, important: 0 },
  }),
  makeTaskSummary({
    taskId: 'task-3',
    displayName: '合同模板.docx vs 合同终稿.docx',
    docAFilename: '合同模板.docx',
    docBFilename: '合同终稿.docx',
    status: 'ready',
    retained: false,
    lastAccessedAt: '2025-01-16T12:00:00Z',
    reviewProgress: { total: 5, reviewed: 0, important: 0 },
  }),
];

// ---------------------------------------------------------------------------
// Helper: render and wait for data to load
// ---------------------------------------------------------------------------

async function renderAndWaitForData(tasks = MOCK_TASKS) {
  mockListHistory.mockResolvedValue({ tasks });
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HistoryView />);
    // Flush microtasks
    await Promise.resolve();
  });
  return result!;
}

// Helper: get the first table body row
function getFirstDataRow() {
  const table = screen.getByRole('table');
  const rows = table.querySelectorAll('tbody tr');
  return rows[0];
}

// Helper: get all table body rows
function getDataRows() {
  const table = screen.getByRole('table');
  return Array.from(table.querySelectorAll('tbody tr'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HistoryView', () => {
  describe('loading and empty states', () => {
    it('shows loading skeleton while fetching', () => {
      mockListHistory.mockReturnValue(new Promise(() => {})); // never resolves
      const { container } = render(<HistoryView />);
      expect(container.querySelector('.animate-pulse')).toBeTruthy();
    });

    it('shows empty state when no tasks exist', async () => {
      await renderAndWaitForData([]);
      expect(screen.getByText('暂无比对记录')).toBeTruthy();
    });

    it('displays tasks after loading', async () => {
      await renderAndWaitForData();
      // Check that the table has 3 rows
      const rows = getDataRows();
      expect(rows.length).toBe(3);
      // Check that doc filenames appear in the table
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('招标文件A.docx');
      expect(table.textContent).toContain('技术规范V2.docx');
      expect(table.textContent).toContain('合同模板.docx');
    });

    it('displays error banner on load failure', async () => {
      mockListHistory.mockRejectedValue(new Error('Network error'));
      await act(async () => {
        render(<HistoryView />);
        await Promise.resolve();
      });
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  describe('P5-01: search, filter, sort', () => {
    it('filters by filename search (case-insensitive)', async () => {
      await renderAndWaitForData();

      const searchInputs = screen.getAllByPlaceholderText('搜索文件名...');
      const searchInput = searchInputs[0];
      fireEvent.change(searchInput, { target: { value: '技术' } });

      const rows = getDataRows();
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('技术规范V2.docx');
    });

    it('shows filtered count vs total', async () => {
      await renderAndWaitForData();

      expect(screen.getByText('共 3 条记录')).toBeTruthy();

      const searchInputs = screen.getAllByPlaceholderText('搜索文件名...');
      fireEvent.change(searchInputs[0], { target: { value: '技术' } });

      expect(screen.getByText('显示 1 / 3 条记录')).toBeTruthy();
    });

    it('filters by status', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await renderAndWaitForData();

      const filterButton = screen.getAllByRole('button', { name: /全部状态/ })[0];
      await user.click(filterButton);

      // Wait for the dropdown menu to appear
      const failedOption = await screen.findByRole('menuitem', { name: '失败' }, { timeout: 3000 });
      await user.click(failedOption);

      const rows = getDataRows();
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('技术规范V2.docx');
    });

    it('sorts by newest first (default)', async () => {
      await renderAndWaitForData();

      const rows = getDataRows();
      expect(rows.length).toBe(3);
      // task-3 (Jan 16) should be first
      expect(rows[0].textContent).toContain('合同模板.docx');
      expect(rows[1].textContent).toContain('招标文件A.docx');
      expect(rows[2].textContent).toContain('技术规范V2.docx');
    });

    it('sorts by name', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await renderAndWaitForData();

      const sortButton = screen.getAllByRole('button', { name: /最新优先/ })[0];
      await user.click(sortButton);

      const nameOption = await screen.findByRole('menuitem', { name: '按名称' }, { timeout: 3000 });
      await user.click(nameOption);

      const rows = getDataRows();
      expect(rows.length).toBe(3);
      expect(rows[0].textContent).toContain('合同模板.docx');
      expect(rows[1].textContent).toContain('技术规范V2.docx');
      expect(rows[2].textContent).toContain('招标文件A.docx');
    });
  });

  describe('P5-04: retain, delete, clear', () => {
    it('toggles retain status when shield button clicked', async () => {
      await renderAndWaitForData();

      // Default sort newest first: task-3 is first row
      const retainButtons = screen.getAllByTitle('保留');
      fireEvent.click(retainButtons[0]);

      expect(mockRetainTask).toHaveBeenCalledWith('task-3', true);
    });

    it('un-toggles retain when already retained', async () => {
      await renderAndWaitForData();

      // task-2 is the only retained item
      const unretainButtons = screen.getAllByTitle('取消保留');
      expect(unretainButtons.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(unretainButtons[0]);

      expect(mockRetainTask).toHaveBeenCalledWith('task-2', false);
    });

    it('shows delete confirmation dialog', async () => {
      await renderAndWaitForData();

      const deleteButtons = screen.getAllByTitle('删除');
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText('删除比对记录')).toBeTruthy();
      expect(screen.getByText(/确定要删除此比对记录吗/)).toBeTruthy();
    });

    it('deletes task after confirmation', async () => {
      mockDeleteTask.mockResolvedValue(undefined);
      await renderAndWaitForData();

      // Default sort newest first: task-3 is first row
      const deleteButtons = screen.getAllByTitle('删除');
      fireEvent.click(deleteButtons[0]);

      // Click the confirm button in the dialog
      const dialogButtons = screen.getAllByRole('button', { name: '删除' });
      const confirmButton = dialogButtons[dialogButtons.length - 1];
      fireEvent.click(confirmButton);

      expect(mockDeleteTask).toHaveBeenCalledWith('task-3');
    });

    it('shows clear history confirmation dialog', async () => {
      await renderAndWaitForData();

      const clearButtons = screen.getAllByRole('button', { name: /清空历史/ });
      fireEvent.click(clearButtons[0]);

      expect(screen.getByText('清空历史记录')).toBeTruthy();
      expect(screen.getByText(/确定要清空所有未保留的比对记录吗/)).toBeTruthy();
    });

    it('clears non-retained items after confirmation', async () => {
      mockClearHistory.mockResolvedValue({ deletedCount: 2 });
      await renderAndWaitForData();

      const clearButtons = screen.getAllByRole('button', { name: /清空历史/ });
      fireEvent.click(clearButtons[0]);

      const confirmButton = screen.getByRole('button', { name: '清空' });
      fireEvent.click(confirmButton);

      expect(mockClearHistory).toHaveBeenCalledWith({ type: 'all', confirm: true });
    });
  });

  describe('P5-02: snapshot reopen', () => {
    it('opens snapshot and navigates to result view when row clicked', async () => {
      const mockResult = {
        taskId: 'task-1',
        docA: { blocks: [], title: 'Doc A' },
        docB: { blocks: [], title: 'Doc B' },
        diffAst: { taskId: 'task-1', docAId: 'a', docBId: 'b', generatedAt: '', items: [], summary: {} },
        annotations: [],
        capabilities: [],
        options: { sensitivity: 'standard' },
        warnings: [],
        startedAt: '',
        completedAt: '',
        durationMs: 0,
      };
      mockOpenSnapshot.mockResolvedValue({ result: mockResult, annotations: [] });

      await renderAndWaitForData();

      // Click on a row's document name to open snapshot
      const docCells = screen.getAllByText('招标文件A.docx');
      await act(async () => {
        fireEvent.click(docCells[0]);
      });

      expect(mockOpenSnapshot).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(useAppStore.getState().view).toBe('result');
    });
  });

  describe('P5-03: recompare', () => {
    it('triggers recompare when recompare button clicked', async () => {
      mockRecompare.mockResolvedValue({ taskId: 'new-task-1' });

      await renderAndWaitForData();

      const recompareButtons = screen.getAllByTitle('重新比对');
      await act(async () => {
        fireEvent.click(recompareButtons[0]);
      });

      expect(mockRecompare).toHaveBeenCalled();
      expect(useAppStore.getState().view).toBe('processing');
    });

    it('shows relocate dialog when files not found', async () => {
      mockRecompare.mockRejectedValue({
        code: 'FILE_NOT_FOUND',
        message: '源文件未找到',
      });

      await renderAndWaitForData();

      const recompareButtons = screen.getAllByTitle('重新比对');
      await act(async () => {
        fireEvent.click(recompareButtons[0]);
      });

      // The error message appears in both title and description
      const matches = screen.getAllByText('源文件未找到');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('选择文件')).toBeTruthy();
    });
  });
});
