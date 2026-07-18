/**
 * P4-07: Task toolbar with compact statistics and navigation.
 * Shows match counts, review progress, and prev/next/next-unreviewed controls.
 */

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CircleDot, Flag, CheckCircle2 } from 'lucide-react';
import type { DiffItem, ReviewAnnotation } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';

interface TaskToolbarProps {
  items: DiffItem[];
  selectedItemId: string | null;
  annotations: ReviewAnnotation[];
  onSelect: (matchId: string | null) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onSelectNextUnreviewed: () => void;
  className?: string;
}

function useStats(items: DiffItem[], annotations: ReviewAnnotation[]) {
  return useMemo(() => {
    const annotationMap = new Map(annotations.map((a) => [a.matchId, a]));
    let reviewed = 0;
    let important = 0;

    for (const item of items) {
      const ann = annotationMap.get(item.matchId);
      if (ann && ann.status !== 'unreviewed') reviewed++;
      if (ann?.important) important++;
    }

    return {
      total: items.length,
      reviewed,
      important,
      unreviewed: items.length - reviewed,
    };
  }, [items, annotations]);
}

export function TaskToolbar({
  items,
  selectedItemId,
  annotations,
  onSelectNext,
  onSelectPrevious,
  onSelectNextUnreviewed,
  className,
}: TaskToolbarProps) {
  const stats = useStats(items, annotations);

  const currentIndex = selectedItemId
    ? items.findIndex((i) => i.matchId === selectedItemId)
    : -1;

  return (
    <div
      className={cn(
        'flex items-center justify-between h-9 px-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]',
        className
      )}
      role="toolbar"
      aria-label="比对工具栏"
    >
      {/* Statistics */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <CircleDot className="h-3 w-3" />
          {stats.total}
        </span>
        <Separator orientation="vertical" className="h-3" />
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {stats.reviewed}
        </span>
        <span className="flex items-center gap-1">
          <Flag className="h-3 w-3" />
          {stats.important}
        </span>
        {stats.unreviewed > 0 && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <Badge variant="default" className="text-xs h-5 px-1.5">
              {stats.unreviewed} 待审
            </Badge>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        {currentIndex >= 0 && (
          <span className="text-xs text-[var(--color-text-muted)] mr-2">
            {currentIndex + 1} / {items.length}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectPrevious}
          disabled={items.length === 0}
          aria-label="上一项"
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectNext}
          disabled={items.length === 0}
          aria-label="下一项"
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectNextUnreviewed}
          disabled={stats.unreviewed === 0}
          aria-label="下一项未审核"
          className="h-7 px-2 text-xs"
        >
          下一待审
        </Button>
      </div>
    </div>
  );
}
