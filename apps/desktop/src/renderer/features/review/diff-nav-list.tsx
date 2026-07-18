/**
 * P4-03: Virtualized left difference navigation list.
 * Shows diff items with status, importance, and match type indicators.
 * Uses @tanstack/react-virtual for performance with large item lists.
 */

import { useRef, useCallback, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Flag, Check, AlertTriangle, EyeOff, Circle } from 'lucide-react';
import type { DiffItem, ReviewAnnotation, MatchType } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Badge } from '../../components/ui/badge';

interface DiffNavListProps {
  items: DiffItem[];
  selectedItemId: string | null;
  annotationMap: Map<string, ReviewAnnotation>;
  onSelect: (matchId: string) => void;
  className?: string;
}

const MATCH_TYPE_COLORS: Record<MatchType, string> = {
  identical: 'var(--color-text-muted)',
  modified: 'var(--color-modified)',
  added: 'var(--color-added)',
  deleted: 'var(--color-deleted)',
  moved: 'var(--color-moved)',
  split: 'var(--color-uncertain)',
  merged: 'var(--color-uncertain)',
  uncertain: 'var(--color-uncertain)',
};

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  identical: '同',
  modified: '改',
  added: '增',
  deleted: '删',
  moved: '移',
  split: '拆',
  merged: '并',
  uncertain: '?',
};

function ReviewStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'confirmed':
      return <Check className="h-3 w-3 text-[var(--color-added)]" />;
    case 'needs-confirmation':
      return <AlertTriangle className="h-3 w-3 text-[var(--color-warning)]" />;
    case 'ignored':
      return <EyeOff className="h-3 w-3 text-[var(--color-text-muted)]" />;
    default:
      return <Circle className="h-3 w-3 text-[var(--color-text-muted)]" />;
  }
}

const DiffNavItem = memo(function DiffNavItem({
  item,
  annotation,
  isSelected,
  onSelect,
}: {
  item: DiffItem;
  annotation: ReviewAnnotation | undefined;
  isSelected: boolean;
  onSelect: (matchId: string) => void;
}) {
  const status = annotation?.status ?? 'unreviewed';
  const isImportant = annotation?.important ?? false;

  return (
    <button
      onClick={() => onSelect(item.matchId)}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs transition-colors',
        'hover:bg-[var(--color-bg-hover)]',
        isSelected && 'bg-[var(--color-accent)]/10 border-l-2 border-[var(--color-accent)]',
        !isSelected && 'border-l-2 border-transparent'
      )}
      role="option"
      aria-selected={isSelected}
      aria-label={`${MATCH_TYPE_LABELS[item.matchType]}: ${item.summary || item.sourceA?.slice(0, 30) || '无文本'}`}
    >
      {/* Match type indicator */}
      <span
        className="flex-shrink-0 w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-medium"
        style={{
          backgroundColor: `color-mix(in srgb, ${MATCH_TYPE_COLORS[item.matchType]} 15%, transparent)`,
          color: MATCH_TYPE_COLORS[item.matchType],
        }}
      >
        {MATCH_TYPE_LABELS[item.matchType]}
      </span>

      {/* Summary text */}
      <span className="flex-1 truncate text-[var(--color-text)]">
        {item.summary || item.sourceA?.slice(0, 50) || '无文本'}
      </span>

      {/* Status and importance indicators */}
      <span className="flex items-center gap-1 flex-shrink-0">
        {isImportant && (
          <Flag className="h-3 w-3 text-[var(--color-warning)] fill-current" />
        )}
        <ReviewStatusIcon status={status} />
      </span>
    </button>
  );
});

export function DiffNavList({
  items,
  selectedItemId,
  annotationMap,
  onSelect,
  className,
}: DiffNavListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  // Scroll to selected item when it changes
  useEffect(() => {
    if (selectedItemId) {
      const index = items.findIndex((i) => i.matchId === selectedItemId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'auto' });
      }
    }
  }, [selectedItemId, items, virtualizer]);

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto h-full', className)}
      role="listbox"
      aria-label="差异导航"
      aria-activedescendant={selectedItemId ?? undefined}
    >
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.matchId}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <DiffNavItem
                item={item}
                annotation={annotationMap.get(item.matchId)}
                isSelected={item.matchId === selectedItemId}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
          无差异项
        </div>
      )}
    </div>
  );
}
