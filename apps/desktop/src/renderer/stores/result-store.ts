import { create } from 'zustand';
import type {
  CompareResult,
  DiffAst,
  DiffItem,
  ReviewAnnotation,
  ReviewStatus,
  MatchType,
} from '@bidlens/shared/types-only';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Set of match types currently visible in the filter. */
export type MatchTypeFilter = Set<MatchType>;

/** Set of review statuses currently visible in the filter. */
export type ReviewStatusFilter = Set<ReviewStatus>;

export interface ResultFilterState {
  matchTypes: MatchTypeFilter;
  reviewStatuses: ReviewStatusFilter;
  showImportantOnly: boolean;
  hideIdentical: boolean;
  searchQuery: string;
}

export interface DiffCounts {
  total: number;
  identical: number;
  modified: number;
  added: number;
  deleted: number;
  moved: number;
  split: number;
  merged: number;
  uncertain: number;
  reviewed: number;
  important: number;
}

/** Normalized item map for O(1) lookup by matchId. */
export type ItemMap = Map<string, DiffItem>;

export interface ResultState {
  // -- Snapshot (read-only) --
  /** The raw CompareResult loaded into the store. */
  result: CompareResult | null;
  /** DiffAst reference extracted from result for convenience. */
  diffAst: DiffAst | null;
  /** Normalized item map keyed by matchId. */
  itemMap: ItemMap;
  /** Review annotations indexed by matchId. */
  annotationMap: Map<string, ReviewAnnotation>;

  // -- Selection --
  selectedItemId: string | null;

  // -- Filters (persisted to localStorage) --
  filter: ResultFilterState;

  // -- Derived (computed on read, never mutated) --
  /** All items in document order. */
  items: DiffItem[];
  /** Items after applying current filter. */
  filteredItems: DiffItem[];
  /** O(1) index lookup for filteredItems by matchId (P6-04). */
  filteredIndexMap: Map<string, number>;
  /** Aggregate counts across all items. */
  counts: DiffCounts;

  // -- Actions: lifecycle --
  loadResult: (result: CompareResult) => void;
  loadFromSnapshot: (snapshot: { result: CompareResult; selectedItemId?: string | null; filter?: Partial<ResultFilterState> }) => void;
  upsertAnnotation: (annotation: ReviewAnnotation) => void;
  clearResult: () => void;

  // -- Actions: selection --
  selectItem: (matchId: string | null) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectNextUnreviewed: () => void;

  // -- Actions: filters --
  setFilter: <K extends keyof ResultFilterState>(key: K, value: ResultFilterState[K]) => void;
  resetFilters: () => void;
  toggleMatchType: (matchType: MatchType) => void;
  toggleReviewStatus: (status: ReviewStatus) => void;
  toggleHideIdentical: () => void;
  toggleShowImportantOnly: () => void;
  setSearchQuery: (query: string) => void;
}

// ---------------------------------------------------------------------------
// Filter persistence
// ---------------------------------------------------------------------------

const FILTER_STORAGE_KEY = 'bidlens-result-filter';

/** All match types for default filter. */
const ALL_MATCH_TYPES: MatchType[] = [
  'identical', 'modified', 'added', 'deleted', 'moved', 'split', 'merged', 'uncertain',
];

/** All review statuses for default filter. */
const ALL_REVIEW_STATUSES: ReviewStatus[] = [
  'unreviewed', 'confirmed', 'needs-confirmation', 'ignored',
];

/** Default (all-visible) filter. */
const DEFAULT_FILTER: ResultFilterState = {
  matchTypes: new Set(ALL_MATCH_TYPES),
  reviewStatuses: new Set(ALL_REVIEW_STATUSES),
  showImportantOnly: false,
  hideIdentical: false,
  searchQuery: '',
};

function serializeFilter(filter: ResultFilterState): string {
  return JSON.stringify({
    matchTypes: [...filter.matchTypes],
    reviewStatuses: [...filter.reviewStatuses],
    showImportantOnly: filter.showImportantOnly,
    hideIdentical: filter.hideIdentical,
    searchQuery: filter.searchQuery,
  });
}

function deserializeFilter(raw: string): ResultFilterState {
  try {
    const parsed = JSON.parse(raw);
    return {
      matchTypes: new Set(parsed.matchTypes ?? ALL_MATCH_TYPES),
      reviewStatuses: new Set(parsed.reviewStatuses ?? ALL_REVIEW_STATUSES),
      showImportantOnly: parsed.showImportantOnly ?? false,
      hideIdentical: parsed.hideIdentical ?? false,
      searchQuery: parsed.searchQuery ?? '',
    };
  } catch {
    return DEFAULT_FILTER;
  }
}

function loadPersistedFilter(): ResultFilterState {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) return deserializeFilter(raw);
  } catch {
    // localStorage unavailable (e.g. test env) — fall through
  }
  return DEFAULT_FILTER;
}

function persistFilter(filter: ResultFilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, serializeFilter(filter));
  } catch {
    // localStorage unavailable — ignore
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no side-effects, deterministic)
// ---------------------------------------------------------------------------

/** Build normalized item map from items array. */
function buildItemMap(items: DiffItem[]): ItemMap {
  const map = new Map<string, DiffItem>();
  for (const item of items) {
    map.set(item.matchId, item);
  }
  return map;
}

/** Build annotation lookup map. */
function buildAnnotationMap(annotations: ReviewAnnotation[]): Map<string, ReviewAnnotation> {
  const map = new Map<string, ReviewAnnotation>();
  for (const ann of annotations) {
    map.set(ann.matchId, ann);
  }
  return map;
}

/** Build O(1) index map from filteredItems (P6-04). */
function buildFilteredIndexMap(filteredItems: DiffItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < filteredItems.length; i++) {
    map.set(filteredItems[i].matchId, i);
  }
  return map;
}

/** Apply filter state to produce filtered items list. Never mutates input. */
function applyFilter(
  items: DiffItem[],
  annotationMap: Map<string, ReviewAnnotation>,
  filter: ResultFilterState,
): DiffItem[] {
  return items.filter((item) => {
    // Match type filter
    if (!filter.matchTypes.has(item.matchType)) return false;

    // Hide identical shortcut
    if (filter.hideIdentical && item.matchType === 'identical') return false;

    // Review status filter
    const annotation = annotationMap.get(item.matchId);
    const reviewStatus: ReviewStatus = annotation?.status ?? 'unreviewed';
    if (!filter.reviewStatuses.has(reviewStatus)) return false;

    // Important only
    if (filter.showImportantOnly && !annotation?.important) return false;

    // Search query (matches summary text)
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      if (!item.summary.toLowerCase().includes(q)) return false;
    }

    return true;
  });
}

/** Compute aggregate counts from items + annotations. Never mutates input. */
function computeCounts(
  items: DiffItem[],
  annotationMap: Map<string, ReviewAnnotation>,
): DiffCounts {
  const counts: DiffCounts = {
    total: items.length,
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
  };

  for (const item of items) {
    counts[item.matchType] += 1;
  }

  for (const annotation of annotationMap.values()) {
    if (annotation.status !== 'unreviewed') {
      counts.reviewed += 1;
    }
    if (annotation.important) {
      counts.important += 1;
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const INITIAL_FILTER = loadPersistedFilter();

const EMPTY_COUNTS: DiffCounts = {
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
};

export const useResultStore = create<ResultState>((set, get) => ({
  // -- Initial state --
  result: null,
  diffAst: null,
  itemMap: new Map(),
  annotationMap: new Map(),
  selectedItemId: null,
  filter: INITIAL_FILTER,
  items: [],
  filteredItems: [],
  filteredIndexMap: new Map(),
  counts: EMPTY_COUNTS,

  // -- Lifecycle --

  loadResult: (result: CompareResult) => {
    const items = result.diffAst.items;
    const itemMap = buildItemMap(items);
    const annotationMap = buildAnnotationMap(result.annotations);
    const filter = get().filter;
    const filteredItems = applyFilter(items, annotationMap, filter);
    const filteredIndexMap = buildFilteredIndexMap(filteredItems);
    const counts = computeCounts(items, annotationMap);

    set({
      result,
      diffAst: result.diffAst,
      itemMap,
      annotationMap,
      items,
      filteredItems,
      filteredIndexMap,
      counts,
      selectedItemId: null,
    });
  },

  loadFromSnapshot: (snapshot) => {
    const items = snapshot.result.diffAst.items;
    const itemMap = buildItemMap(items);
    const annotationMap = buildAnnotationMap(snapshot.result.annotations);
    const baseFilter = get().filter;
    const filter = snapshot.filter ? { ...baseFilter, ...snapshot.filter } : baseFilter;
    const filteredItems = applyFilter(items, annotationMap, filter);
    const filteredIndexMap = buildFilteredIndexMap(filteredItems);
    const counts = computeCounts(items, annotationMap);

    // Restore selectedItemId if it exists in the item map
    const selectedItemId = snapshot.selectedItemId && itemMap.has(snapshot.selectedItemId)
      ? snapshot.selectedItemId
      : null;

    persistFilter(filter);
    set({
      result: snapshot.result,
      diffAst: snapshot.result.diffAst,
      itemMap,
      annotationMap,
      items,
      filteredItems,
      filteredIndexMap,
      counts,
      filter,
      selectedItemId,
    });
  },

  upsertAnnotation: (annotation) => {
    const { result, items, filter } = get();
    if (!result) return;

    const annotations = result.annotations.some((item) => item.matchId === annotation.matchId)
      ? result.annotations.map((item) => item.matchId === annotation.matchId ? annotation : item)
      : [...result.annotations, annotation];
    const annotationMap = buildAnnotationMap(annotations);
    const filteredItems = applyFilter(items, annotationMap, filter);

    set({
      result: { ...result, annotations },
      annotationMap,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
      counts: computeCounts(items, annotationMap),
    });
  },

  clearResult: () => {
    set({
      result: null,
      diffAst: null,
      itemMap: new Map(),
      annotationMap: new Map(),
      items: [],
      filteredItems: [],
      filteredIndexMap: new Map(),
      counts: EMPTY_COUNTS,
      selectedItemId: null,
    });
  },

  // -- Selection --

  selectItem: (matchId: string | null) => {
    if (matchId === null) {
      set({ selectedItemId: null });
      return;
    }
    // Only select if the item exists
    if (get().itemMap.has(matchId)) {
      set({ selectedItemId: matchId });
    }
  },

  selectNext: () => {
    const { filteredItems, filteredIndexMap, selectedItemId } = get();
    if (filteredItems.length === 0) return;

    if (selectedItemId === null) {
      set({ selectedItemId: filteredItems[0].matchId });
      return;
    }

    const idx = filteredIndexMap.get(selectedItemId) ?? -1;
    if (idx === -1) {
      set({ selectedItemId: filteredItems[0].matchId });
    } else if (idx < filteredItems.length - 1) {
      set({ selectedItemId: filteredItems[idx + 1].matchId });
    }
    // At end — do nothing (stay on current)
  },

  selectPrevious: () => {
    const { filteredItems, filteredIndexMap, selectedItemId } = get();
    if (filteredItems.length === 0) return;

    if (selectedItemId === null) {
      set({ selectedItemId: filteredItems[filteredItems.length - 1].matchId });
      return;
    }

    const idx = filteredIndexMap.get(selectedItemId) ?? -1;
    if (idx === -1) {
      set({ selectedItemId: filteredItems[filteredItems.length - 1].matchId });
    } else if (idx > 0) {
      set({ selectedItemId: filteredItems[idx - 1].matchId });
    }
    // At start — do nothing (stay on current)
  },

  selectNextUnreviewed: () => {
    const { filteredItems, filteredIndexMap, annotationMap, selectedItemId } = get();
    if (filteredItems.length === 0) return;

    const isUnreviewed = (item: DiffItem): boolean => {
      const ann = annotationMap.get(item.matchId);
      return !ann || ann.status === 'unreviewed';
    };

    // Find starting index (O(1) lookup)
    let startIdx = 0;
    if (selectedItemId !== null) {
      const currentIdx = filteredIndexMap.get(selectedItemId) ?? -1;
      if (currentIdx !== -1) startIdx = currentIdx + 1;
    }

    // Search from startIdx to end
    for (let i = startIdx; i < filteredItems.length; i++) {
      if (isUnreviewed(filteredItems[i])) {
        set({ selectedItemId: filteredItems[i].matchId });
        return;
      }
    }

    // Wrap around: search from beginning to startIdx
    for (let i = 0; i < startIdx; i++) {
      if (isUnreviewed(filteredItems[i])) {
        set({ selectedItemId: filteredItems[i].matchId });
        return;
      }
    }

    // No unreviewed items found — stay on current
  },

  // -- Filters --

  setFilter: <K extends keyof ResultFilterState>(key: K, value: ResultFilterState[K]) => {
    const { items, annotationMap } = get();
    const newFilter = { ...get().filter, [key]: value };
    const filteredItems = applyFilter(items, annotationMap, newFilter);
    persistFilter(newFilter);
    set({
      filter: newFilter,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
    });
  },

  resetFilters: () => {
    const { items, annotationMap } = get();
    const filteredItems = applyFilter(items, annotationMap, DEFAULT_FILTER);
    persistFilter(DEFAULT_FILTER);
    set({
      filter: DEFAULT_FILTER,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
    });
  },

  toggleMatchType: (matchType: MatchType) => {
    const { filter, items, annotationMap } = get();
    const next = new Set(filter.matchTypes);
    if (next.has(matchType)) {
      next.delete(matchType);
    } else {
      next.add(matchType);
    }
    const newFilter = { ...filter, matchTypes: next };
    const filteredItems = applyFilter(items, annotationMap, newFilter);
    persistFilter(newFilter);
    set({
      filter: newFilter,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
    });
  },

  toggleReviewStatus: (status: ReviewStatus) => {
    const { filter, items, annotationMap } = get();
    const next = new Set(filter.reviewStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    const newFilter = { ...filter, reviewStatuses: next };
    const filteredItems = applyFilter(items, annotationMap, newFilter);
    persistFilter(newFilter);
    set({
      filter: newFilter,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
    });
  },

  toggleHideIdentical: () => {
    const { filter, items, annotationMap } = get();
    const newFilter = { ...filter, hideIdentical: !filter.hideIdentical };
    const filteredItems = applyFilter(items, annotationMap, newFilter);
    persistFilter(newFilter);
    set({
      filter: newFilter,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
    });
  },

  toggleShowImportantOnly: () => {
    const { filter, items, annotationMap } = get();
    const newFilter = { ...filter, showImportantOnly: !filter.showImportantOnly };
    const filteredItems = applyFilter(items, annotationMap, newFilter);
    persistFilter(newFilter);
    set({
      filter: newFilter,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
    });
  },

  setSearchQuery: (query: string) => {
    const { items, annotationMap } = get();
    const newFilter = { ...get().filter, searchQuery: query };
    const filteredItems = applyFilter(items, annotationMap, newFilter);
    persistFilter(newFilter);
    set({
      filter: newFilter,
      filteredItems,
      filteredIndexMap: buildFilteredIndexMap(filteredItems),
    });
  },
}));
