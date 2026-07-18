/**
 * P6-04: Web Worker for off-main-thread diff item filtering.
 *
 * Receives items + filter state, returns filtered items + counts.
 * Prevents UI jank when filtering 50,000+ items.
 */

interface FilterRequest {
  type: 'filter';
  requestId: string;
  items: SerializedDiffItem[];
  annotations: SerializedAnnotation[];
  filter: SerializedFilter;
}

interface FilterResponse {
  type: 'filterResult';
  requestId: string;
  filteredIndices: number[];
  counts: FilterCounts;
}

interface SerializedDiffItem {
  matchId: string;
  matchType: string;
  summary: string;
}

interface SerializedAnnotation {
  matchId: string;
  status: string;
  important: boolean;
}

interface SerializedFilter {
  matchTypes: string[];
  reviewStatuses: string[];
  showImportantOnly: boolean;
  hideIdentical: boolean;
  searchQuery: string;
}

interface FilterCounts {
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

self.onmessage = (event: MessageEvent<FilterRequest>) => {
  const { type, requestId, items, annotations, filter } = event.data;

  if (type !== 'filter') return;

  // Build annotation lookup
  const annotationMap = new Map<string, SerializedAnnotation>();
  for (const ann of annotations) {
    annotationMap.set(ann.matchId, ann);
  }

  // Build filter sets for O(1) lookup
  const matchTypeSet = new Set(filter.matchTypes);
  const reviewStatusSet = new Set(filter.reviewStatuses);
  const searchLower = filter.searchQuery.toLowerCase();

  // Filter items and compute counts in single pass
  const filteredIndices: number[] = [];
  const counts: FilterCounts = {
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

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Count by match type
    switch (item.matchType) {
      case 'identical': counts.identical++; break;
      case 'modified': counts.modified++; break;
      case 'added': counts.added++; break;
      case 'deleted': counts.deleted++; break;
      case 'moved': counts.moved++; break;
      case 'split': counts.split++; break;
      case 'merged': counts.merged++; break;
      case 'uncertain': counts.uncertain++; break;
    }

    // Count annotations
    const annotation = annotationMap.get(item.matchId);
    if (annotation) {
      if (annotation.status !== 'unreviewed') counts.reviewed++;
      if (annotation.important) counts.important++;
    }

    // Apply filters
    if (!matchTypeSet.has(item.matchType)) continue;
    if (filter.hideIdentical && item.matchType === 'identical') continue;

    const reviewStatus = annotation?.status ?? 'unreviewed';
    if (!reviewStatusSet.has(reviewStatus)) continue;

    if (filter.showImportantOnly && !annotation?.important) continue;

    if (searchLower && !item.summary.toLowerCase().includes(searchLower)) continue;

    filteredIndices.push(i);
  }

  const response: FilterResponse = {
    type: 'filterResult',
    requestId,
    filteredIndices,
    counts,
  };

  self.postMessage(response);
};
