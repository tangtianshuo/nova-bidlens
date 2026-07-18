import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { DiffItem } from '@bidlens/shared/types-only';
import { DiffViewport } from './diff-viewport';

// Mock @tanstack/react-virtual — jsdom has no layout engine.
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

afterEach(cleanup);

function makeParagraphItem(overrides: Partial<DiffItem> = {}): DiffItem {
  return {
    matchId: 'p1',
    matchType: 'modified',
    confidence: 0.85,
    similarity: 0.72,
    sourceA: '基准文本内容',
    sourceB: '送审文本内容',
    nodeIdsA: ['a1'],
    nodeIdsB: ['b1'],
    diffDetail: [],
    summary: '文本修改',
    ...overrides,
  };
}

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
    tableA: { id: 'ta1', rows: [['列A', '列B'], ['值1', '值2']] },
    tableB: { id: 'tb1', rows: [['列A', '列B'], ['值1改', '值2']] },
    tableDiff: {
      tableMatchType: 'content_changed',
      structuralChanges: [],
      cellDiffs: [
        { position: [1, 0], changeType: 'modified', oldContent: '值1', newContent: '值1改', similarity: 0.6 },
      ],
      confidence: 0.9,
    },
    ...overrides,
  };
}

describe('DiffViewport', () => {
  describe('empty state', () => {
    it('renders empty state when no item is selected', () => {
      render(<DiffViewport selectedItem={null} />);
      expect(screen.getByText('请在左侧导航中选择一条差异')).toBeTruthy();
    });
  });

  describe('paragraph dispatch', () => {
    it('renders paragraph viewport for a paragraph diff item', () => {
      const item = makeParagraphItem();
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getByText('基准文档')).toBeTruthy();
      expect(screen.getByText('送审文档')).toBeTruthy();
      expect(screen.getByText('基准文本内容')).toBeTruthy();
      expect(screen.getByText('送审文本内容')).toBeTruthy();
    });

    it('renders paragraph viewport for items without blockType', () => {
      const item = makeParagraphItem({ blockType: undefined });
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getAllByText('基准文档').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('送审文档').length).toBeGreaterThanOrEqual(1);
    });

    it('renders paragraph viewport for added items', () => {
      const item = makeParagraphItem({
        matchType: 'added',
        sourceA: null,
        sourceB: '新增文本',
      });
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getByText('(无文本)')).toBeTruthy();
      expect(screen.getByText('新增文本')).toBeTruthy();
    });

    it('renders paragraph viewport for deleted items', () => {
      const item = makeParagraphItem({
        matchType: 'deleted',
        sourceA: '被删除的文本',
        sourceB: null,
      });
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getByText('被删除的文本')).toBeTruthy();
      expect(screen.getByText('(无文本)')).toBeTruthy();
    });
  });

  describe('table dispatch', () => {
    it('renders table viewport for a table diff item', () => {
      const item = makeTableItem();
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getByText('基准文档表格 (A)')).toBeTruthy();
      expect(screen.getByText('送审文档表格 (B)')).toBeTruthy();
      expect(screen.getByText('值1')).toBeTruthy();
      expect(screen.getByText('值1改')).toBeTruthy();
    });

    it('shows table match type and diff counts', () => {
      const item = makeTableItem();
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getByText('content_changed')).toBeTruthy();
      expect(screen.getByText('1 个单元格差异')).toBeTruthy();
    });

    it('falls back to paragraph view when blockType is table but tableDiff is missing', () => {
      // resolveViewType requires both blockType='table' AND tableDiff to be defined.
      // Without tableDiff, the item is dispatched to the paragraph view.
      const item = makeParagraphItem({
        blockType: 'table',
        tableDiff: undefined,
        sourceA: '基准文本',
        sourceB: '送审文本',
      });
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getByText('基准文档')).toBeTruthy();
      expect(screen.getByText('送审文档')).toBeTruthy();
    });

    it('shows empty table panes when tableA/tableB are missing', () => {
      // An item that IS recognized as table but has no table source data
      const item = makeTableItem({
        tableA: undefined,
        tableB: undefined,
      });
      render(<DiffViewport selectedItem={item} />);

      // TableViewport renders the "unavailable" message when data is missing
      expect(screen.getByText('表格差异数据不可用')).toBeTruthy();
    });
  });

  describe('view switching', () => {
    it('switches from paragraph to table when selected item changes', () => {
      const paragraphItem = makeParagraphItem();
      const { rerender } = render(<DiffViewport selectedItem={paragraphItem} />);
      expect(screen.getByText('基准文档')).toBeTruthy();

      const tableItem = makeTableItem();
      rerender(<DiffViewport selectedItem={tableItem} />);
      expect(screen.getByText('基准文档表格 (A)')).toBeTruthy();
    });

    it('switches to empty state when item is deselected', () => {
      const item = makeParagraphItem();
      const { rerender } = render(<DiffViewport selectedItem={item} />);
      expect(screen.getByText('基准文本内容')).toBeTruthy();

      rerender(<DiffViewport selectedItem={null} />);
      expect(screen.getByText('请在左侧导航中选择一条差异')).toBeTruthy();
    });
  });

  describe('structural changes', () => {
    it('displays structural change count when present', () => {
      const item = makeTableItem({
        tableDiff: {
          tableMatchType: 'structure_changed',
          structuralChanges: [{ type: 'rows_added', count: 2, position: 3 }],
          cellDiffs: [],
          confidence: 0.7,
        },
      });
      render(<DiffViewport selectedItem={item} />);

      expect(screen.getByText('1 项结构变化')).toBeTruthy();
    });
  });
});
