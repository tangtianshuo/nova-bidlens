/**
 * Filter bar for the workbench - matches V0.2.2 prototype filterbar.
 * Horizontal bar with type filters, dimension filters, review status, and search.
 */

import { useState, useCallback, useMemo } from 'react';
import { Search, Star } from 'lucide-react';
import type { MatchType, ReviewStatus } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';

export interface FilterState {
  searchQuery: string;
  matchTypes: Set<MatchType>;
  reviewStatuses: Set<ReviewStatus>;
  showImportantOnly: boolean;
  hideIdentical: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  matchTypes: new Set(),
  reviewStatuses: new Set(),
  showImportantOnly: false,
  hideIdentical: true,
};

const MATCH_TYPE_CHIPS: { value: MatchType; label: string }[] = [
  { value: 'modified', label: '修改' },
  { value: 'added', label: '新增' },
  { value: 'deleted', label: '删除' },
  { value: 'table' as MatchType, label: '表格' },
];

const REVIEW_STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: 'unreviewed', label: '未审核' },
  { value: 'confirmed', label: '已确认' },
  { value: 'needs-confirmation', label: '待确认' },
  { value: 'ignored', label: '已忽略' },
];

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

export function FilterBar({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  className,
}: FilterBarProps) {
  const updateFilter = useCallback(
    (patch: Partial<FilterState>) => {
      onFiltersChange({ ...filters, ...patch });
    },
    [filters, onFiltersChange]
  );

  const toggleMatchType = useCallback(
    (type: MatchType) => {
      const next = new Set(filters.matchTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      updateFilter({ matchTypes: next });
    },
    [filters.matchTypes, updateFilter]
  );

  return (
    <>
      {/* Type filter chips */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => updateFilter({ matchTypes: new Set() })}
          className={cn(
            'min-h-7 px-2 text-xs rounded-[var(--radius-sm)] border border-transparent transition-colors whitespace-nowrap',
            filters.matchTypes.size === 0
              ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] font-semibold'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
          )}
        >
          全部 <span className="text-[var(--color-text-muted)] ml-0.5">{totalCount}</span>
        </button>
        {MATCH_TYPE_CHIPS.map(({ value, label }) => {
          const isActive = filters.matchTypes.has(value);
          return (
            <button
              key={value}
              onClick={() => toggleMatchType(value)}
              className={cn(
                'min-h-7 px-2 text-xs rounded-[var(--radius-sm)] border border-transparent transition-colors whitespace-nowrap',
                isActive
                  ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-[22px] bg-[var(--color-border)] mx-0.5" />

      {/* Dimension filters */}
      <div className="flex items-center gap-1 dimensions">
        {['正文', '表格', '格式', '批注', '修订'].map((dim) => (
          <button
            key={dim}
            className="min-h-7 px-2 text-xs rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors whitespace-nowrap"
          >
            {dim}
          </button>
        ))}
      </div>

      {/* Review status */}
      <select
        value={filters.reviewStatuses.size === 1 ? [...filters.reviewStatuses][0] : 'all'}
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'all') updateFilter({ reviewStatuses: new Set() });
          else updateFilter({ reviewStatuses: new Set([val as ReviewStatus]) });
        }}
        className="min-h-7 px-2 text-xs rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-secondary)] bg-transparent cursor-pointer"
        aria-label="审核状态筛选"
      >
        <option value="all">审核状态</option>
        {REVIEW_STATUS_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {/* Important filter */}
      <button
        onClick={() => updateFilter({ showImportantOnly: !filters.showImportantOnly })}
        className={cn(
          'min-h-7 px-2 text-xs rounded-[var(--radius-sm)] border border-transparent transition-colors',
          filters.showImportantOnly
            ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text)] font-semibold'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
        )}
        title="仅看重要"
        aria-label="仅看重要"
      >
        <Star className="h-3.5 w-3.5" />
      </button>

      {/* Result count */}
      <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
        {filteredCount} / {totalCount}
      </span>

      {/* Search */}
      <div className="flex items-center gap-1.5 h-7 min-w-[190px] ml-auto px-2.5 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-bg-input)] text-[var(--color-text-muted)]">
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <input
          value={filters.searchQuery}
          onChange={(e) => updateFilter({ searchQuery: e.target.value })}
          placeholder="搜索差异"
          className="min-w-0 flex-1 border-0 outline-0 bg-transparent text-xs text-[var(--color-text)]"
          aria-label="搜索差异"
        />
      </div>
    </>
  );
}

/**
 * Apply filters to a list of diff items.
 */
export function applyFilters(
  items: import('@bidlens/shared/types-only').DiffItem[],
  filters: FilterState,
  annotationMap: Map<string, import('@bidlens/shared/types-only').ReviewAnnotation>
): import('@bidlens/shared/types-only').DiffItem[] {
  return items.filter((item) => {
    if (filters.hideIdentical && item.matchType === 'identical') return false;

    if (filters.matchTypes.size > 0 && !filters.matchTypes.has(item.matchType)) return false;

    if (filters.reviewStatuses.size > 0) {
      const ann = annotationMap.get(item.matchId);
      const status = ann?.status ?? 'unreviewed';
      if (!filters.reviewStatuses.has(status)) return false;
    }

    if (filters.showImportantOnly) {
      const ann = annotationMap.get(item.matchId);
      if (!ann?.important) return false;
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const text = [item.sourceA, item.sourceB, item.summary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!text.includes(query)) return false;
    }

    return true;
  });
}
