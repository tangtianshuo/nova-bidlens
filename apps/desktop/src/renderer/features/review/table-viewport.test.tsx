/**
 * Tests for P4-14 (dual table viewport) and P4-15 (table change selection).
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { DiffItem } from '@bidlens/shared/types-only';
import { TableViewport } from './table-viewport';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock @tanstack/react-virtual — jsdom has no layout engine so we must stub
// useVirtualizer to return all items as "visible".
// ---------------------------------------------------------------------------
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 36,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 36,
        size: 36,
        end: (i + 1) * 36,
        key: i,
      })),
    scrollToIndex: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTableItem(overrides: Partial<DiffItem> = {}): DiffItem {
  return {
    matchId: 't1',
    matchType: 'modified',
    confidence: 0.9,
    similarity: 0.8,
    sourceA: null,
    sourceB: null,
    nodeIdsA: ['ta1'],
    nodeIdsB: ['tb1'],
    diffDetail: [],
    summary: '表格修改',
    blockType: 'table',
    tableA: {
      id: 'ta1',
      rows: [
        ['序号', '名称', '金额'],
        ['1', '材料费', '10000'],
        ['2', '人工费', '5000'],
        ['3', '管理费', '2000'],
      ],
    },
    tableB: {
      id: 'tb1',
      rows: [
        ['序号', '名称', '金额'],
        ['1', '材料费', '12000'],
        ['2', '人工费', '5000'],
        ['3', '管理费', '2500'],
      ],
    },
    tableDiff: {
      tableMatchType: 'content_changed',
      structuralChanges: [],
      cellDiffs: [
        {
          position: [1, 2],
          changeType: 'modified',
          oldContent: '10000',
          newContent: '12000',
          similarity: 0.6,
        },
        {
          position: [3, 2],
          changeType: 'modified',
          oldContent: '2000',
          newContent: '2500',
          similarity: 0.5,
        },
      ],
      confidence: 0.85,
    },
    ...overrides,
  };
}

function makeStructuralItem(): DiffItem {
  return {
    matchId: 't2',
    matchType: 'modified',
    confidence: 0.8,
    similarity: 0.7,
    sourceA: null,
    sourceB: null,
    nodeIdsA: ['ta2'],
    nodeIdsB: ['tb2'],
    diffDetail: [],
    summary: '表格结构变化',
    blockType: 'table',
    tableA: {
      id: 'ta2',
      rows: [
        ['A', 'B'],
        ['1', '2'],
      ],
    },
    tableB: {
      id: 'tb2',
      rows: [
        ['A', 'B'],
        ['1', '2'],
        ['3', '4'],
      ],
    },
    tableDiff: {
      tableMatchType: 'structure_changed',
      structuralChanges: [{ type: 'rows_added', count: 1, position: 2 }],
      cellDiffs: [],
      confidence: 0.7,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TableViewport (P4-14 / P4-15)', () => {
  describe('empty / missing data', () => {
    it('shows "unavailable" when tableDiff is missing', () => {
      const item = makeTableItem({ tableDiff: undefined });
      render(<TableViewport item={item} />);
      expect(screen.getByText('表格差异数据不可用')).toBeTruthy();
    });

    it('shows "unavailable" when tableA is missing', () => {
      const item = makeTableItem({ tableA: undefined });
      render(<TableViewport item={item} />);
      expect(screen.getByText('表格差异数据不可用')).toBeTruthy();
    });

    it('shows "unavailable" when tableB is missing', () => {
      const item = makeTableItem({ tableB: undefined });
      render(<TableViewport item={item} />);
      expect(screen.getByText('表格差异数据不可用')).toBeTruthy();
    });
  });

  describe('dual table rendering', () => {
    it('renders both table panes with labels', () => {
      render(<TableViewport item={makeTableItem()} />);
      expect(screen.getByText('基准文档表格 (A)')).toBeTruthy();
      expect(screen.getByText('送审文档表格 (B)')).toBeTruthy();
    });

    it('renders table cell content from both tables', () => {
      render(<TableViewport item={makeTableItem()} />);
      // '材料费' appears in both panes
      expect(screen.getAllByText('材料费').length).toBeGreaterThanOrEqual(2);
      // '10000' appears in table A only
      expect(screen.getByText('10000')).toBeTruthy();
      // '12000' appears in table B only
      expect(screen.getByText('12000')).toBeTruthy();
      // '2000' appears in table A only
      expect(screen.getByText('2000')).toBeTruthy();
      // '2500' appears in table B only
      expect(screen.getByText('2500')).toBeTruthy();
    });

    it('renders row numbers', () => {
      render(<TableViewport item={makeTableItem()} />);
      // Row numbers appear in both tables (column headers and row indices)
      const ones = screen.getAllByText('1');
      expect(ones.length).toBeGreaterThanOrEqual(2);
    });

    it('renders column headers', () => {
      render(<TableViewport item={makeTableItem()} />);
      expect(screen.getAllByText('序号').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('名称').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('金额').length).toBeGreaterThanOrEqual(2);
    });

    it('renders row and column counts in pane headers', () => {
      render(<TableViewport item={makeTableItem()} />);
      // Both panes show "4 行 x 3 列"
      const dimLabels = screen.getAllByText(/4 行 x 3 列/);
      expect(dimLabels.length).toBe(2);
    });
  });

  describe('summary bar', () => {
    it('shows table match type badge', () => {
      render(<TableViewport item={makeTableItem()} />);
      expect(screen.getByText('content_changed')).toBeTruthy();
    });

    it('shows non-identical cell diff count', () => {
      render(<TableViewport item={makeTableItem()} />);
      expect(screen.getByText('2 个单元格差异')).toBeTruthy();
    });

    it('shows structural change count', () => {
      render(<TableViewport item={makeStructuralItem()} />);
      expect(screen.getByText('1 项结构变化')).toBeTruthy();
    });
  });

  describe('structural changes', () => {
    it('renders structural change badges', () => {
      render(<TableViewport item={makeStructuralItem()} />);
      expect(screen.getByText(/新增行/)).toBeTruthy();
    });

    it('does not render structural section when none exist', () => {
      render(<TableViewport item={makeTableItem()} />);
      expect(screen.queryByText('结构变化:')).toBeNull();
    });
  });

  describe('change navigation (P4-15)', () => {
    it('shows change counter with total', () => {
      render(<TableViewport item={makeTableItem()} />);
      expect(screen.getByText('变更 0 / 2')).toBeTruthy();
    });

    it('advances to next change on next button click', () => {
      render(<TableViewport item={makeTableItem()} />);
      const nextBtn = screen.getByLabelText('下一个变更');
      fireEvent.click(nextBtn);
      expect(screen.getByText('变更 1 / 2')).toBeTruthy();
    });

    it('wraps around when going past last change', () => {
      render(<TableViewport item={makeTableItem()} />);
      const nextBtn = screen.getByLabelText('下一个变更');
      fireEvent.click(nextBtn); // 1
      fireEvent.click(nextBtn); // 2
      fireEvent.click(nextBtn); // wraps to 1
      expect(screen.getByText('变更 1 / 2')).toBeTruthy();
    });

    it('goes to previous change', () => {
      render(<TableViewport item={makeTableItem()} />);
      const nextBtn = screen.getByLabelText('下一个变更');
      const prevBtn = screen.getByLabelText('上一个变更');
      fireEvent.click(nextBtn); // 1
      fireEvent.click(nextBtn); // 2
      fireEvent.click(prevBtn); // 1
      expect(screen.getByText('变更 1 / 2')).toBeTruthy();
    });

    it('shows change detail text after selecting a change', () => {
      render(<TableViewport item={makeTableItem()} />);
      const nextBtn = screen.getByLabelText('下一个变更');
      fireEvent.click(nextBtn);
      // The detail text for modified cell should include the old and new values
      expect(screen.getByText(/修改:/)).toBeTruthy();
    });
  });

  describe('cell selection (P4-15)', () => {
    it('selects a changed cell on click', () => {
      const { container } = render(<TableViewport item={makeTableItem()} />);
      // Find the modified cell (value 12000 in table B) and click it
      const cells = container.querySelectorAll('td');
      const target = Array.from(cells).find(
        (c) => c.textContent === '12000',
      );
      expect(target).toBeTruthy();
      fireEvent.click(target!);
      // After clicking, the cell detail panel should show the old/new values
      expect(screen.getByText('旧值')).toBeTruthy();
      expect(screen.getByText('新值')).toBeTruthy();
    });

    it('shows cell detail panel with old and new values', () => {
      const { container } = render(<TableViewport item={makeTableItem()} />);
      const cells = container.querySelectorAll('td');
      const target = Array.from(cells).find(
        (c) => c.textContent === '12000',
      );
      fireEvent.click(target!);
      // Detail panel shows old value (10000) and new value (12000).
      // '10000' also appears in the table cell itself, so there are multiple matches.
      expect(screen.getAllByText('10000').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('12000').length).toBeGreaterThanOrEqual(2);
    });

    it('shows similarity percentage in detail panel', () => {
      const { container } = render(<TableViewport item={makeTableItem()} />);
      const cells = container.querySelectorAll('td');
      const target = Array.from(cells).find(
        (c) => c.textContent === '12000',
      );
      fireEvent.click(target!);
      expect(screen.getByText('60% 相似')).toBeTruthy();
    });

    it('closes detail panel on close button click', () => {
      const { container } = render(<TableViewport item={makeTableItem()} />);
      const cells = container.querySelectorAll('td');
      const target = Array.from(cells).find(
        (c) => c.textContent === '12000',
      );
      fireEvent.click(target!);
      expect(screen.getByText('旧值')).toBeTruthy();

      const closeBtn = screen.getByLabelText('关闭详情');
      fireEvent.click(closeBtn);
      expect(screen.queryByText('旧值')).toBeNull();
    });

    it('does not select identical cells', () => {
      const { container } = render(<TableViewport item={makeTableItem()} />);
      const cells = container.querySelectorAll('td');
      // Click on an unchanged cell
      const unchanged = Array.from(cells).find(
        (c) => c.textContent === '人工费',
      );
      if (unchanged) {
        fireEvent.click(unchanged);
      }
      // Detail panel should NOT appear
      expect(screen.queryByText('旧值')).toBeNull();
    });
  });

  describe('keyboard shortcuts (P4-15)', () => {
    it('navigates to next change with Alt+ArrowDown', () => {
      render(<TableViewport item={makeTableItem()} />);
      fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
      expect(screen.getByText('变更 1 / 2')).toBeTruthy();
    });

    it('navigates to previous change with Alt+ArrowUp', () => {
      render(<TableViewport item={makeTableItem()} />);
      fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
      fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
      fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
      expect(screen.getByText('变更 1 / 2')).toBeTruthy();
    });

    it('clears selection on Escape', () => {
      render(<TableViewport item={makeTableItem()} />);
      fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
      expect(screen.getByText('变更 1 / 2')).toBeTruthy();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.getByText('变更 0 / 2')).toBeTruthy();
    });
  });

  describe('diff highlighting', () => {
    it('highlights modified cells with yellow background', () => {
      const { container } = render(<TableViewport item={makeTableItem()} />);
      const cells = container.querySelectorAll('td');
      const modified = Array.from(cells).find(
        (c) => c.textContent === '12000',
      );
      expect(modified).toBeTruthy();
      // getCellChangeColor('modified') returns #fff3cd
      expect(modified!.style.backgroundColor).toBe('rgb(255, 243, 205)');
    });

    it('highlights added cells with green background', () => {
      const item = makeTableItem({
        tableDiff: {
          tableMatchType: 'content_changed',
          structuralChanges: [],
          cellDiffs: [
            {
              position: [0, 0],
              changeType: 'added',
              oldContent: null,
              newContent: '新增内容',
              similarity: 1.0,
            },
          ],
          confidence: 0.9,
        },
        tableB: {
          id: 'tb',
          rows: [['新增内容']],
        },
      });
      const { container } = render(<TableViewport item={item} />);
      const cells = container.querySelectorAll('td');
      const added = Array.from(cells).find(
        (c) => c.textContent === '新增内容',
      );
      expect(added).toBeTruthy();
      expect(added!.style.backgroundColor).toBe('rgb(212, 237, 218)');
    });

    it('highlights deleted cells with red background', () => {
      const item = makeTableItem({
        tableDiff: {
          tableMatchType: 'content_changed',
          structuralChanges: [],
          cellDiffs: [
            {
              position: [0, 0],
              changeType: 'deleted',
              oldContent: '被删内容',
              newContent: null,
              similarity: 0.0,
            },
          ],
          confidence: 0.9,
        },
        tableA: {
          id: 'ta',
          rows: [['被删内容']],
        },
      });
      const { container } = render(<TableViewport item={item} />);
      const cells = container.querySelectorAll('td');
      const deleted = Array.from(cells).find(
        (c) => c.textContent === '被删内容',
      );
      expect(deleted).toBeTruthy();
      expect(deleted!.style.backgroundColor).toBe('rgb(248, 215, 218)');
    });
  });

  describe('empty tables', () => {
    it('renders panes with empty rows when tables have no data rows', () => {
      const item = makeTableItem({
        tableA: { id: 'ta', rows: [] },
        tableB: { id: 'tb', rows: [] },
      });
      render(<TableViewport item={item} />);
      expect(screen.getByText('基准文档表格 (A)')).toBeTruthy();
      expect(screen.getByText('送审文档表格 (B)')).toBeTruthy();
    });
  });

  describe('tables with different row counts', () => {
    it('renders max rows with empty cells for shorter table', () => {
      const item = makeTableItem({
        tableA: {
          id: 'ta',
          rows: [['A', 'B']],
        },
        tableB: {
          id: 'tb',
          rows: [
            ['A', 'B'],
            ['C', 'D'],
          ],
        },
        tableDiff: {
          tableMatchType: 'structure_changed',
          structuralChanges: [{ type: 'rows_added', count: 1, position: 1 }],
          cellDiffs: [],
          confidence: 0.8,
        },
      });
      render(<TableViewport item={item} />);
      expect(screen.getByText('C')).toBeTruthy();
      expect(screen.getByText('D')).toBeTruthy();
    });
  });
});
