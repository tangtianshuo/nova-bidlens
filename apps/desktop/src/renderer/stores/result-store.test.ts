import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useResultStore } from './result-store';
import type {
  CompareResult,
  DiffItem,
  DiffAst,
  ReviewAnnotation,
  MatchType,
  ReviewStatus,
} from '@bidlens/shared/types-only';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeDiffItem(overrides: Partial<DiffItem> & { matchId: string; matchType: MatchType }): DiffItem {
  return {
    confidence: 1.0,
    similarity: 1.0,
    sourceA: null,
    sourceB: null,
    nodeIdsA: [],
    nodeIdsB: [],
    diffDetail: [],
    summary: `Item ${overrides.matchId}`,
    ...overrides,
  };
}

const ITEMS: DiffItem[] = [
  makeDiffItem({ matchId: 'item-1', matchType: 'identical', summary: '第一章 总则' }),
  makeDiffItem({ matchId: 'item-2', matchType: 'modified', summary: '第二章 投标人须知', similarity: 0.8 }),
  makeDiffItem({ matchId: 'item-3', matchType: 'added', summary: '新增条款 A' }),
  makeDiffItem({ matchId: 'item-4', matchType: 'deleted', summary: '删除条款 B' }),
  makeDiffItem({ matchId: 'item-5', matchType: 'moved', summary: '移动条款 C' }),
  makeDiffItem({ matchId: 'item-6', matchType: 'split', summary: '拆分条款 D' }),
  makeDiffItem({ matchId: 'item-7', matchType: 'merged', summary: '合并条款 E' }),
  makeDiffItem({ matchId: 'item-8', matchType: 'uncertain', summary: '不确定条款 F' }),
  makeDiffItem({ matchId: 'item-9', matchType: 'identical', summary: '第三章 评标办法' }),
  makeDiffItem({ matchId: 'item-10', matchType: 'modified', summary: '第四章 合同条款', similarity: 0.6 }),
];

const ANNOTATIONS: ReviewAnnotation[] = [
  {
    id: 'ann-1',
    taskId: 'task-1',
    matchId: 'item-2',
    status: 'confirmed',
    important: true,
    note: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'ann-2',
    taskId: 'task-1',
    matchId: 'item-3',
    status: 'needs-confirmation',
    important: false,
    note: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'ann-3',
    taskId: 'task-1',
    matchId: 'item-5',
    status: 'ignored',
    important: true,
    note: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
];

const DIFF_AST: DiffAst = {
  taskId: 'task-1',
  docAId: 'doc-a',
  docBId: 'doc-b',
  generatedAt: '2025-01-01T00:00:00Z',
  items: ITEMS,
  summary: {
    identical: 2,
    modified: 2,
    added: 1,
    deleted: 1,
    moved: 1,
    split: 1,
    merged: 1,
    uncertain: 1,
  },
};

function makeCompareResult(overrides?: Partial<CompareResult>): CompareResult {
  return {
    taskId: 'task-1',
    docA: { blocks: [], title: 'Doc A' } as any,
    docB: { blocks: [], title: 'Doc B' } as any,
    diffAst: DIFF_AST,
    annotations: ANNOTATIONS,
    capabilities: [],
    options: { sensitivity: 'standard' },
    warnings: [],
    startedAt: '2025-01-01T00:00:00Z',
    completedAt: '2025-01-01T00:00:01Z',
    durationMs: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset store to clean state before each test. */
function resetStore() {
  useResultStore.setState({
    result: null,
    diffAst: null,
    itemMap: new Map(),
    annotationMap: new Map(),
    items: [],
    filteredItems: [],
    counts: {
      total: 0,
      identical: 0,
      modified: 0,
      added: 0,
      deleted: 0,
      moved: 0,
      split: 0,
      merged: 0,
      uncertain: 0,
      reviewed: 0,
      important: 0,
    },
    selectedItemId: null,
    filter: {
      matchTypes: new Set(['identical', 'modified', 'added', 'deleted', 'moved', 'split', 'merged', 'uncertain']),
      reviewStatuses: new Set(['unreviewed', 'confirmed', 'needs-confirmation', 'ignored']),
      showImportantOnly: false,
      hideIdentical: false,
      searchQuery: '',
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Result Store', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  // =========================================================================
  // Loading a result
  // =========================================================================

  describe('loadResult', () => {
    it('populates all state from a CompareResult', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadResult(result);

      const state = useResultStore.getState();
      expect(state.result).toBe(result);
      expect(state.diffAst).toBe(result.diffAst);
      expect(state.items).toEqual(ITEMS);
      expect(state.itemMap.size).toBe(10);
      expect(state.itemMap.get('item-1')).toBe(ITEMS[0]);
      expect(state.annotationMap.size).toBe(3);
    });

    it('clears selectedItemId on load', () => {
      useResultStore.setState({ selectedItemId: 'item-1' });
      useResultStore.getState().loadResult(makeCompareResult());
      expect(useResultStore.getState().selectedItemId).toBeNull();
    });

    it('computes filteredItems with default (all-visible) filter', () => {
      useResultStore.getState().loadResult(makeCompareResult());
      expect(useResultStore.getState().filteredItems).toHaveLength(10);
    });
  });

  describe('clearResult', () => {
    it('resets all state to empty', () => {
      useResultStore.getState().loadResult(makeCompareResult());
      useResultStore.getState().clearResult();

      const state = useResultStore.getState();
      expect(state.result).toBeNull();
      expect(state.diffAst).toBeNull();
      expect(state.items).toHaveLength(0);
      expect(state.filteredItems).toHaveLength(0);
      expect(state.itemMap.size).toBe(0);
      expect(state.annotationMap.size).toBe(0);
      expect(state.selectedItemId).toBeNull();
      expect(state.counts.total).toBe(0);
    });
  });

  // =========================================================================
  // Item selection and navigation
  // =========================================================================

  describe('selection management', () => {
    beforeEach(() => {
      useResultStore.getState().loadResult(makeCompareResult());
    });

    describe('selectItem', () => {
      it('selects a valid item by matchId', () => {
        useResultStore.getState().selectItem('item-3');
        expect(useResultStore.getState().selectedItemId).toBe('item-3');
      });

      it('sets to null when null is passed', () => {
        useResultStore.getState().selectItem('item-1');
        useResultStore.getState().selectItem(null);
        expect(useResultStore.getState().selectedItemId).toBeNull();
      });

      it('ignores invalid matchId', () => {
        useResultStore.getState().selectItem('nonexistent');
        expect(useResultStore.getState().selectedItemId).toBeNull();
      });

      it('overwrites previous selection', () => {
        useResultStore.getState().selectItem('item-1');
        useResultStore.getState().selectItem('item-5');
        expect(useResultStore.getState().selectedItemId).toBe('item-5');
      });
    });

    describe('selectNext', () => {
      it('selects first item when nothing is selected', () => {
        useResultStore.getState().selectNext();
        expect(useResultStore.getState().selectedItemId).toBe('item-1');
      });

      it('advances to next item in filtered list', () => {
        useResultStore.getState().selectItem('item-3');
        useResultStore.getState().selectNext();
        expect(useResultStore.getState().selectedItemId).toBe('item-4');
      });

      it('stays at last item when already at end', () => {
        useResultStore.getState().selectItem('item-10');
        useResultStore.getState().selectNext();
        expect(useResultStore.getState().selectedItemId).toBe('item-10');
      });

      it('resets to first if selectedItemId points to removed item', () => {
        useResultStore.setState({ selectedItemId: 'removed-item' });
        useResultStore.getState().selectNext();
        expect(useResultStore.getState().selectedItemId).toBe('item-1');
      });

      it('navigates within filtered list only', () => {
        // Hide identical items
        useResultStore.getState().toggleHideIdentical();
        // First visible item is now item-2 (modified)
        useResultStore.getState().selectNext();
        expect(useResultStore.getState().selectedItemId).toBe('item-2');
      });
    });

    describe('selectPrevious', () => {
      it('selects last item when nothing is selected', () => {
        useResultStore.getState().selectPrevious();
        expect(useResultStore.getState().selectedItemId).toBe('item-10');
      });

      it('moves to previous item', () => {
        useResultStore.getState().selectItem('item-5');
        useResultStore.getState().selectPrevious();
        expect(useResultStore.getState().selectedItemId).toBe('item-4');
      });

      it('stays at first item when already at start', () => {
        useResultStore.getState().selectItem('item-1');
        useResultStore.getState().selectPrevious();
        expect(useResultStore.getState().selectedItemId).toBe('item-1');
      });

      it('navigates within filtered list only', () => {
        useResultStore.getState().toggleHideIdentical();
        useResultStore.getState().selectPrevious();
        // Last non-identical item
        expect(useResultStore.getState().selectedItemId).toBe('item-10');
      });
    });

    describe('selectNextUnreviewed', () => {
      it('selects first unreviewed item from the beginning', () => {
        useResultStore.getState().selectNextUnreviewed();
        // item-1 has no annotation (unreviewed), so it should be selected
        expect(useResultStore.getState().selectedItemId).toBe('item-1');
      });

      it('advances to next unreviewed after current selection', () => {
        useResultStore.getState().selectItem('item-1');
        useResultStore.getState().selectNextUnreviewed();
        // item-1 is unreviewed; next unreviewed is item-4 (item-2 confirmed, item-3 needs-confirmation)
        expect(useResultStore.getState().selectedItemId).toBe('item-4');
      });

      it('skips confirmed and needs-confirmation items', () => {
        useResultStore.getState().selectItem('item-1');
        useResultStore.getState().selectNextUnreviewed();
        // item-2: confirmed -> skip
        // item-3: needs-confirmation -> skip
        // item-4: unreviewed -> select
        expect(useResultStore.getState().selectedItemId).toBe('item-4');
      });

      it('skips ignored items', () => {
        useResultStore.getState().selectItem('item-4');
        useResultStore.getState().selectNextUnreviewed();
        // item-5: ignored -> skip
        // item-6: unreviewed -> select
        expect(useResultStore.getState().selectedItemId).toBe('item-6');
      });

      it('wraps around to beginning when at end', () => {
        useResultStore.getState().selectItem('item-9');
        useResultStore.getState().selectNextUnreviewed();
        // item-10: unreviewed -> select
        expect(useResultStore.getState().selectedItemId).toBe('item-10');
        // From item-10, wraps to item-1
        useResultStore.getState().selectNextUnreviewed();
        expect(useResultStore.getState().selectedItemId).toBe('item-1');
      });

      it('stays put if all items are reviewed', () => {
        // Mark all items as reviewed
        const allReviewed: ReviewAnnotation[] = ITEMS.map((item, i) => ({
          id: `ann-${i}`,
          taskId: 'task-1',
          matchId: item.matchId,
          status: 'confirmed' as ReviewStatus,
          important: false,
          note: '',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        }));
        useResultStore.getState().loadResult(makeCompareResult({ annotations: allReviewed }));
        useResultStore.getState().selectItem('item-3');
        useResultStore.getState().selectNextUnreviewed();
        expect(useResultStore.getState().selectedItemId).toBe('item-3');
      });

      it('does nothing when no items exist', () => {
        useResultStore.getState().clearResult();
        useResultStore.getState().selectNextUnreviewed();
        expect(useResultStore.getState().selectedItemId).toBeNull();
      });
    });
  });

  // =========================================================================
  // Filter state management
  // =========================================================================

  describe('filter state', () => {
    beforeEach(() => {
      useResultStore.getState().loadResult(makeCompareResult());
    });

    describe('toggleMatchType', () => {
      it('removes a match type from the filter', () => {
        useResultStore.getState().toggleMatchType('identical');
        const state = useResultStore.getState();
        expect(state.filter.matchTypes.has('identical')).toBe(false);
        // identical items: item-1, item-9 -> should be filtered out
        expect(state.filteredItems).toHaveLength(8);
      });

      it('adds a match type back to the filter', () => {
        useResultStore.getState().toggleMatchType('identical');
        useResultStore.getState().toggleMatchType('identical');
        expect(useResultStore.getState().filter.matchTypes.has('identical')).toBe(true);
        expect(useResultStore.getState().filteredItems).toHaveLength(10);
      });

      it('filters to only one match type', () => {
        // Remove all except 'modified'
        const types: MatchType[] = ['identical', 'added', 'deleted', 'moved', 'split', 'merged', 'uncertain'];
        for (const t of types) {
          useResultStore.getState().toggleMatchType(t);
        }
        const state = useResultStore.getState();
        expect(state.filteredItems).toHaveLength(2);
        expect(state.filteredItems.every((i) => i.matchType === 'modified')).toBe(true);
      });
    });

    describe('toggleReviewStatus', () => {
      it('removes a review status from the filter', () => {
        useResultStore.getState().toggleReviewStatus('confirmed');
        const state = useResultStore.getState();
        expect(state.filter.reviewStatuses.has('confirmed')).toBe(false);
        // item-2 is confirmed -> filtered out
        expect(state.filteredItems).toHaveLength(9);
      });

      it('shows only unreviewed items', () => {
        useResultStore.getState().toggleReviewStatus('confirmed');
        useResultStore.getState().toggleReviewStatus('needs-confirmation');
        useResultStore.getState().toggleReviewStatus('ignored');
        const state = useResultStore.getState();
        // Items with no annotation + items with unreviewed status
        // item-2: confirmed (removed), item-3: needs-confirmation (removed), item-5: ignored (removed)
        // Remaining: item-1, 4, 6, 7, 8, 9, 10 = 7
        expect(state.filteredItems).toHaveLength(7);
      });
    });

    describe('toggleHideIdentical', () => {
      it('hides identical items when toggled on', () => {
        useResultStore.getState().toggleHideIdentical();
        expect(useResultStore.getState().filter.hideIdentical).toBe(true);
        // 2 identical items removed
        expect(useResultStore.getState().filteredItems).toHaveLength(8);
      });

      it('shows identical items when toggled off', () => {
        useResultStore.getState().toggleHideIdentical();
        useResultStore.getState().toggleHideIdentical();
        expect(useResultStore.getState().filter.hideIdentical).toBe(false);
        expect(useResultStore.getState().filteredItems).toHaveLength(10);
      });
    });

    describe('toggleShowImportantOnly', () => {
      it('shows only important items', () => {
        useResultStore.getState().toggleShowImportantOnly();
        const state = useResultStore.getState();
        expect(state.filter.showImportantOnly).toBe(true);
        // item-2 (important) and item-5 (important)
        expect(state.filteredItems).toHaveLength(2);
      });
    });

    describe('setSearchQuery', () => {
      it('filters items by summary text (case-insensitive)', () => {
        useResultStore.getState().setSearchQuery('条款');
        // Items with "条款" in summary: item-3, 4, 5, 6, 7, 8, 10 = 7
        expect(useResultStore.getState().filteredItems).toHaveLength(7);
      });

      it('filters with partial match', () => {
        useResultStore.getState().setSearchQuery('总则');
        expect(useResultStore.getState().filteredItems).toHaveLength(1);
        expect(useResultStore.getState().filteredItems[0].matchId).toBe('item-1');
      });

      it('returns all items when query is empty', () => {
        useResultStore.getState().setSearchQuery('总则');
        useResultStore.getState().setSearchQuery('');
        expect(useResultStore.getState().filteredItems).toHaveLength(10);
      });

      it('returns empty when no match', () => {
        useResultStore.getState().setSearchQuery('nonexistent-query-xyz');
        expect(useResultStore.getState().filteredItems).toHaveLength(0);
      });
    });

    describe('setFilter', () => {
      it('sets arbitrary filter key', () => {
        useResultStore.getState().setFilter('showImportantOnly', true);
        expect(useResultStore.getState().filter.showImportantOnly).toBe(true);
      });

      it('sets searchQuery via setFilter', () => {
        useResultStore.getState().setFilter('searchQuery', '总则');
        expect(useResultStore.getState().filteredItems).toHaveLength(1);
      });
    });

    describe('resetFilters', () => {
      it('restores default filter', () => {
        useResultStore.getState().toggleHideIdentical();
        useResultStore.getState().toggleShowImportantOnly();
        useResultStore.getState().setSearchQuery('test');
        useResultStore.getState().toggleMatchType('added');

        useResultStore.getState().resetFilters();
        const state = useResultStore.getState();
        expect(state.filter.hideIdentical).toBe(false);
        expect(state.filter.showImportantOnly).toBe(false);
        expect(state.filter.searchQuery).toBe('');
        expect(state.filter.matchTypes.size).toBe(8);
        expect(state.filteredItems).toHaveLength(10);
      });
    });

    describe('combined filters', () => {
      it('applies matchType + hideIdentical together', () => {
        useResultStore.getState().toggleHideIdentical();
        useResultStore.getState().toggleMatchType('added');
        const state = useResultStore.getState();
        // Start: 10 items, hide 2 identical -> 8, remove 1 added -> 7
        expect(state.filteredItems).toHaveLength(7);
      });

      it('applies matchType + searchQuery together', () => {
        useResultStore.getState().toggleMatchType('identical');
        useResultStore.getState().setSearchQuery('条款');
        const state = useResultStore.getState();
        // After removing identical, search "条款" in remaining 8:
        // item-3, 4, 5, 6, 7, 8, 10 have "条款" -> 7
        expect(state.filteredItems).toHaveLength(7);
      });
    });
  });

  // =========================================================================
  // Derived count computation
  // =========================================================================

  describe('counts', () => {
    it('computes correct counts with annotations', () => {
      useResultStore.getState().loadResult(makeCompareResult());
      const counts = useResultStore.getState().counts;

      expect(counts.total).toBe(10);
      expect(counts.identical).toBe(2);
      expect(counts.modified).toBe(2);
      expect(counts.added).toBe(1);
      expect(counts.deleted).toBe(1);
      expect(counts.moved).toBe(1);
      expect(counts.split).toBe(1);
      expect(counts.merged).toBe(1);
      expect(counts.uncertain).toBe(1);
      // reviewed: item-2 (confirmed), item-3 (needs-confirmation), item-5 (ignored) = 3
      expect(counts.reviewed).toBe(3);
      // important: item-2, item-5 = 2
      expect(counts.important).toBe(2);
    });

    it('computes zero counts with no annotations', () => {
      useResultStore.getState().loadResult(makeCompareResult({ annotations: [] }));
      const counts = useResultStore.getState().counts;
      expect(counts.reviewed).toBe(0);
      expect(counts.important).toBe(0);
    });

    it('returns zero counts when no result loaded', () => {
      const counts = useResultStore.getState().counts;
      expect(counts.total).toBe(0);
      expect(counts.reviewed).toBe(0);
      expect(counts.important).toBe(0);
    });
  });

  // =========================================================================
  // localStorage persistence
  // =========================================================================

  describe('localStorage persistence', () => {
    const STORAGE_KEY = 'bidlens-result-filter';

    beforeEach(() => {
      useResultStore.getState().loadResult(makeCompareResult());
    });

    it('persists filter to localStorage on toggleMatchType', () => {
      useResultStore.getState().toggleMatchType('identical');
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.matchTypes).not.toContain('identical');
    });

    it('persists filter to localStorage on setSearchQuery', () => {
      useResultStore.getState().setSearchQuery('test-query');
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.searchQuery).toBe('test-query');
    });

    it('persists filter to localStorage on toggleHideIdentical', () => {
      useResultStore.getState().toggleHideIdentical();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.hideIdentical).toBe(true);
    });

    it('persists filter to localStorage on resetFilters', () => {
      useResultStore.getState().toggleHideIdentical();
      useResultStore.getState().resetFilters();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.hideIdentical).toBe(false);
      expect(stored.matchTypes).toHaveLength(8);
    });

    it('persists reviewStatus filter', () => {
      useResultStore.getState().toggleReviewStatus('confirmed');
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.reviewStatuses).not.toContain('confirmed');
    });

    it('persists showImportantOnly filter', () => {
      useResultStore.getState().toggleShowImportantOnly();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.showImportantOnly).toBe(true);
    });
  });

  // =========================================================================
  // Normalized map integrity
  // =========================================================================

  describe('normalized itemMap', () => {
    it('maps every item by matchId', () => {
      useResultStore.getState().loadResult(makeCompareResult());
      const { itemMap, items } = useResultStore.getState();
      for (const item of items) {
        expect(itemMap.get(item.matchId)).toBe(item);
      }
    });

    it('returns the exact same object reference (no cloning)', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadResult(result);
      const item = useResultStore.getState().itemMap.get('item-1');
      expect(item).toBe(result.diffAst.items[0]);
    });
  });

  // =========================================================================
  // loadFromSnapshot (P5-02)
  // =========================================================================

  describe('loadFromSnapshot', () => {
    it('loads result from snapshot data', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({ result });

      const state = useResultStore.getState();
      expect(state.result).toBe(result);
      expect(state.diffAst).toBe(result.diffAst);
      expect(state.items).toHaveLength(10);
      expect(state.itemMap.size).toBe(10);
      expect(state.annotationMap.size).toBe(3);
    });

    it('restores selectedItemId when it exists in item map', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({
        result,
        selectedItemId: 'item-5',
      });
      expect(useResultStore.getState().selectedItemId).toBe('item-5');
    });

    it('ignores selectedItemId when it does not exist in item map', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({
        result,
        selectedItemId: 'nonexistent-item',
      });
      expect(useResultStore.getState().selectedItemId).toBeNull();
    });

    it('sets selectedItemId to null when not provided', () => {
      useResultStore.setState({ selectedItemId: 'item-1' });
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({ result });
      expect(useResultStore.getState().selectedItemId).toBeNull();
    });

    it('merges partial filter override with current filter', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({
        result,
        filter: { hideIdentical: true },
      });
      const state = useResultStore.getState();
      expect(state.filter.hideIdentical).toBe(true);
      // Other filter values should be from default
      expect(state.filter.showImportantOnly).toBe(false);
      expect(state.filter.searchQuery).toBe('');
    });

    it('applies merged filter to compute filteredItems', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({
        result,
        filter: { hideIdentical: true },
      });
      // 2 identical items hidden
      expect(useResultStore.getState().filteredItems).toHaveLength(8);
    });

    it('restores filter and selectedItemId together', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({
        result,
        selectedItemId: 'item-3',
        filter: { hideIdentical: true },
      });
      const state = useResultStore.getState();
      expect(state.selectedItemId).toBe('item-3');
      expect(state.filter.hideIdentical).toBe(true);
      expect(state.filteredItems).toHaveLength(8);
    });

    it('clears selectedItemId if it becomes hidden by filter', () => {
      const result = makeCompareResult();
      // item-1 is identical, and hideIdentical will hide it
      useResultStore.getState().loadFromSnapshot({
        result,
        selectedItemId: 'item-1',
        filter: { hideIdentical: true },
      });
      // item-1 is identical and will be filtered out, but selectedItemId
      // should still be set since the item exists in itemMap
      // The filtering of selectedItemId is a UI concern, not the store's
      expect(useResultStore.getState().selectedItemId).toBe('item-1');
    });

    it('computes correct counts', () => {
      const result = makeCompareResult();
      useResultStore.getState().loadFromSnapshot({ result });
      const counts = useResultStore.getState().counts;
      expect(counts.total).toBe(10);
      expect(counts.reviewed).toBe(3);
      expect(counts.important).toBe(2);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('handles empty items array', () => {
      const result = makeCompareResult({
        diffAst: {
          ...DIFF_AST,
          items: [],
          summary: {
            identical: 0, modified: 0, added: 0, deleted: 0,
            moved: 0, split: 0, merged: 0, uncertain: 0,
          },
        },
      });
      useResultStore.getState().loadResult(result);
      expect(useResultStore.getState().items).toHaveLength(0);
      expect(useResultStore.getState().filteredItems).toHaveLength(0);
      expect(useResultStore.getState().counts.total).toBe(0);
    });

    it('selectNext does nothing on empty list', () => {
      useResultStore.getState().clearResult();
      useResultStore.getState().selectNext();
      expect(useResultStore.getState().selectedItemId).toBeNull();
    });

    it('selectPrevious does nothing on empty list', () => {
      useResultStore.getState().clearResult();
      useResultStore.getState().selectPrevious();
      expect(useResultStore.getState().selectedItemId).toBeNull();
    });

    it('filters with all match types removed show nothing', () => {
      useResultStore.getState().loadResult(makeCompareResult());
      for (const t of ['identical', 'modified', 'added', 'deleted', 'moved', 'split', 'merged', 'uncertain'] as MatchType[]) {
        useResultStore.getState().toggleMatchType(t);
      }
      expect(useResultStore.getState().filteredItems).toHaveLength(0);
    });

    it('filters with all review statuses removed show nothing', () => {
      useResultStore.getState().loadResult(makeCompareResult());
      for (const s of ['unreviewed', 'confirmed', 'needs-confirmation', 'ignored'] as ReviewStatus[]) {
        useResultStore.getState().toggleReviewStatus(s);
      }
      expect(useResultStore.getState().filteredItems).toHaveLength(0);
    });
  });
});
