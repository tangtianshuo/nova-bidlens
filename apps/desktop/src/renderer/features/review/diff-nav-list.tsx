/**
 * Virtualized left difference navigation list.
 * Matches V0.2.2 prototype: 68px items, 3-column grid (marker/content/flags).
 */

import { useRef, useCallback, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Flag, Check, AlertTriangle, EyeOff, Circle } from 'lucide-react';
import type { DiffItem, ReviewAnnotation, MatchType } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';

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
  moved: 'var(--color-warning)',
  split: 'var(--color-uncertain)',
  merged: 'var(--color-uncertain)',
  uncertain: 'var(--color-warning)',
};

const MATCH_TYPE_BADGE_STYLES: Record<MatchType, { bg: string; color: string; border: string; label: string }> = {
  identical: { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', border: 'var(--color-border)', label: '相同' },
  modified: { bg: 'var(--color-modified-bg)', color: 'var(--color-modified-text)', border: 'var(--color-modified-border)', label: '修改' },
  added: { bg: 'var(--color-added-bg)', color: 'var(--color-added-text)', border: 'var(--color-added-border)', label: '新增' },
  deleted: { bg: 'var(--color-deleted-bg)', color: 'var(--color-deleted-text)', border: 'var(--color-deleted-border)', label: '删除' },
  moved: { bg: 'var(--color-modified-bg)', color: 'var(--color-modified-text)', border: 'var(--color-modified-border)', label: '移动' },
  split: { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', border: 'var(--color-border)', label: '拆分' },
  merged: { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', border: 'var(--color-border)', label: '合并' },
  uncertain: { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', border: 'var(--color-border)', label: '低置信' },
};

function ReviewStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'confirmed':
      return <Check className="h-3.5 w-3.5 text-[var(--color-added)]" />;
    case 'needs-confirmation':
      return <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)]" />;
    case 'ignored':
      return <EyeOff className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />;
    default:
      return null;
  }
}

const ITEM_HEIGHT = 68;

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
  const badge = MATCH_TYPE_BADGE_STYLES[item.matchType] || MATCH_TYPE_BADGE_STYLES.uncertain;

  return (
    <button
      onClick={() => onSelect(item.matchId)}
      className={cn(
        'w-full text-left transition-colors cursor-pointer',
        isSelected
          ? 'bg-[var(--color-accent-soft)]'
          : 'hover:bg-[var(--color-bg-hover)]'
      )}
      style={{
        display: 'grid',
        gridTemplateColumns: '4px minmax(0, 1fr) auto',
        gap: 9,
        padding: '8px 8px 8px 6px',
        minHeight: ITEM_HEIGHT,
        border: isSelected
          ? '1px solid color-mix(in srgb, var(--color-accent) 28%, var(--color-border))'
          : '1px solid transparent',
        borderRadius: 5,
      }}
      role="option"
      aria-selected={isSelected}
    >
      {/* Color marker */}
      <div
        style={{
          width: 3,
          borderRadius: 2,
          backgroundColor: MATCH_TYPE_COLORS[item.matchType] || 'var(--color-text-muted)',
        }}
      />

      {/* Content */}
      <div className="min-w-0">
        {/* Badge */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center min-h-5 px-1 text-[11px] font-bold rounded"
            style={{
              background: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
            }}
          >
            {badge.label}
          </span>
        </div>
        {/* Summary */}
        <div className="mt-1 text-xs text-[var(--color-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
          {item.summary || item.sourceA?.slice(0, 50) || '无文本'}
        </div>
        {/* Location */}
        <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
          {item.sourceA && item.sourceB
            ? `基准 · 待审`
            : item.sourceA
            ? '基准'
            : '待审'}
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-col items-center gap-1.5 text-[var(--color-text-muted)]">
        {isImportant && (
          <Flag className="h-3.5 w-3.5 text-[var(--color-warning)] fill-current" />
        )}
        <ReviewStatusIcon status={status} />
      </div>
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
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

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
      className={cn('overflow-auto h-full p-1.5', className)}
      role="listbox"
      aria-label="差异导航"
      aria-activedescendant={selectedItemId ?? undefined}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
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
