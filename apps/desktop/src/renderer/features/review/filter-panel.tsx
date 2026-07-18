/**
 * P4-02: Search and combined filters for diff items.
 * Filter by match type, review status, importance, and text search.
 */

import { useState, useCallback, useMemo } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import type { MatchType, ReviewStatus } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';

export interface FilterState {
  searchQuery: string;
  matchTypes: Set<MatchType>;
  reviewStatuses: Set<ReviewStatus>;
  showImportantOnly: boolean;
  hideIdentical: boolean;
}

const MATCH_TYPE_OPTIONS: { value: MatchType; label: string; color: string }[] = [
  { value: 'modified', label: '修改', color: 'var(--color-modified)' },
  { value: 'added', label: '新增', color: 'var(--color-added)' },
  { value: 'deleted', label: '删除', color: 'var(--color-deleted)' },
  { value: 'moved', label: '移动', color: 'var(--color-moved)' },
  { value: 'split', label: '拆分', color: 'var(--color-uncertain)' },
  { value: 'merged', label: '合并', color: 'var(--color-uncertain)' },
  { value: 'uncertain', label: '不确定', color: 'var(--color-uncertain)' },
  { value: 'identical', label: '相同', color: 'var(--color-text-muted)' },
];

const REVIEW_STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: 'unreviewed', label: '未审核' },
  { value: 'confirmed', label: '已确认' },
  { value: 'needs-confirmation', label: '待确认' },
  { value: 'ignored', label: '已忽略' },
];

export const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  matchTypes: new Set(),
  reviewStatuses: new Set(),
  showImportantOnly: false,
  hideIdentical: true,
};

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

export function FilterPanel({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  className,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.matchTypes.size > 0) count++;
    if (filters.reviewStatuses.size > 0) count++;
    if (filters.showImportantOnly) count++;
    if (filters.hideIdentical) count++;
    return count;
  }, [filters]);

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

  const toggleReviewStatus = useCallback(
    (status: ReviewStatus) => {
      const next = new Set(filters.reviewStatuses);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      updateFilter({ reviewStatuses: next });
    },
    [filters.reviewStatuses, updateFilter]
  );

  const resetFilters = useCallback(() => {
    onFiltersChange(DEFAULT_FILTERS);
  }, [onFiltersChange]);

  return (
    <div className={cn('border-b border-[var(--color-border)]', className)}>
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <Input
            value={filters.searchQuery}
            onChange={(e) => updateFilter({ searchQuery: e.target.value })}
            placeholder="搜索差异..."
            className="h-7 pl-8 text-xs"
            aria-label="搜索差异"
          />
          {filters.searchQuery && (
            <button
              onClick={() => updateFilter({ searchQuery: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="清除搜索"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 px-2 text-xs"
          aria-expanded={expanded}
          aria-label="展开筛选选项"
        >
          筛选
          {activeFilterCount > 0 && (
            <Badge variant="default" className="ml-1 h-4 w-4 p-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 px-2 text-xs"
            aria-label="重置筛选"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Result count */}
      <div className="px-3 pb-1.5 text-xs text-[var(--color-text-muted)]">
        {filteredCount === totalCount
          ? `共 ${totalCount} 项`
          : `${filteredCount} / ${totalCount} 项`}
      </div>

      {/* Expanded filter options */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Match type filters */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">
              差异类型
            </label>
            <div className="flex flex-wrap gap-1">
              {MATCH_TYPE_OPTIONS.map(({ value, label, color }) => {
                const isActive = filters.matchTypes.has(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleMatchType(value)}
                    className={cn(
                      'h-6 px-2 text-xs rounded-md border transition-colors',
                      isActive
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                    )}
                    aria-pressed={isActive}
                    aria-label={`筛选${label}`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Review status filters */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">
              审核状态
            </label>
            <div className="flex flex-wrap gap-1">
              {REVIEW_STATUS_OPTIONS.map(({ value, label }) => {
                const isActive = filters.reviewStatuses.has(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleReviewStatus(value)}
                    className={cn(
                      'h-6 px-2 text-xs rounded-md border transition-colors',
                      isActive
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                    )}
                    aria-pressed={isActive}
                    aria-label={`筛选${label}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Toggle filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter({ showImportantOnly: !filters.showImportantOnly })}
              className={cn(
                'h-6 px-2 text-xs rounded-md border transition-colors',
                filters.showImportantOnly
                  ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
              )}
              aria-pressed={filters.showImportantOnly}
            >
              仅重要
            </button>
            <button
              onClick={() => updateFilter({ hideIdentical: !filters.hideIdentical })}
              className={cn(
                'h-6 px-2 text-xs rounded-md border transition-colors',
                filters.hideIdentical
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
              )}
              aria-pressed={filters.hideIdentical}
            >
              隐藏相同
            </button>
          </div>
        </div>
      )}
    </div>
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
    // Hide identical
    if (filters.hideIdentical && item.matchType === 'identical') return false;

    // Match type filter
    if (filters.matchTypes.size > 0 && !filters.matchTypes.has(item.matchType)) return false;

    // Review status filter
    if (filters.reviewStatuses.size > 0) {
      const ann = annotationMap.get(item.matchId);
      const status = ann?.status ?? 'unreviewed';
      if (!filters.reviewStatuses.has(status)) return false;
    }

    // Important only
    if (filters.showImportantOnly) {
      const ann = annotationMap.get(item.matchId);
      if (!ann?.important) return false;
    }

    // Text search
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
