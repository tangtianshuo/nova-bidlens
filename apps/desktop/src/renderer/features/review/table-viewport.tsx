/**
 * P4-14 / P4-15 / P4-16: Dual table viewport with cell selection, change navigation,
 * row virtualization, merged-cell handling, and accessibility.
 *
 * Renders side-by-side baseline (A) and review (B) tables with:
 * - Cell-level diff highlighting (added/deleted/modified)
 * - Structural change indicators (rows/cols added/deleted)
 * - Synchronized scrolling between both panes
 * - Click-to-select with cross-table alignment
 * - Previous/next change navigation
 * - Cell detail expansion showing old -> new values
 * - Virtualized rows via @tanstack/react-virtual for large tables (>= 50 rows)
 * - Small-table bypass (< 50 rows renders without virtualization)
 * - ARIA grid semantics for accessibility
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type UIEvent,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react';
import type { DiffItem, CellDiff, StructuralChange } from '@bidlens/shared/types-only';
import { getCellChangeColor, getCellDiffTooltip } from '@bidlens/shared/types-only';
import type { ViewportViewProps } from './viewport-provider';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { SimpleTooltip } from '../../components/ui/tooltip';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tables with fewer rows than this threshold render without virtualization. */
const VIRTUALIZATION_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A [row, col] position tuple. */
type CellPosition = [number, number];

interface CellDiffMap {
  /** Lookup cell diff by "row,col" string key. */
  get(key: string): CellDiff | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function buildCellDiffMap(cellDiffs: CellDiff[]): CellDiffMap {
  const map = new Map<string, CellDiff>();
  for (const d of cellDiffs) {
    map.set(cellKey(d.position[0], d.position[1]), d);
  }
  return map;
}

function getMaxColumns(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

/** Returns sets of structurally added/deleted row indices and col indices. */
function computeStructuralSets(changes: StructuralChange[]): {
  addedRows: Set<number>;
  deletedRows: Set<number>;
  addedCols: Set<number>;
  deletedCols: Set<number>;
} {
  const addedRows = new Set<number>();
  const deletedRows = new Set<number>();
  const addedCols = new Set<number>();
  const deletedCols = new Set<number>();

  for (const c of changes) {
    for (let i = 0; i < c.count; i++) {
      const idx = c.position + i;
      switch (c.type) {
        case 'rows_added':
          addedRows.add(idx);
          break;
        case 'rows_deleted':
          deletedRows.add(idx);
          break;
        case 'columns_added':
          addedCols.add(idx);
          break;
        case 'columns_deleted':
          deletedCols.add(idx);
          break;
      }
    }
  }
  return { addedRows, deletedRows, addedCols, deletedCols };
}

/** Get an ordered list of changed cell positions for prev/next navigation. */
function collectChangedPositions(cellDiffs: CellDiff[]): CellPosition[] {
  return cellDiffs
    .filter((d) => d.changeType !== 'identical')
    .map((d) => d.position)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function formatStructuralLabel(c: StructuralChange): string {
  const typeLabel =
    c.type === 'rows_added'
      ? '新增行'
      : c.type === 'rows_deleted'
        ? '删除行'
        : c.type === 'columns_added'
          ? '新增列'
          : '删除列';
  return `${typeLabel} x${c.count} @${c.position + 1}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Summary bar at the top of the viewport. */
function SummaryBar({
  item,
  changeCount,
  structuralChanges,
}: {
  item: DiffItem;
  changeCount: number;
  structuralChanges: StructuralChange[];
}) {
  const tableMatchType = item.tableDiff?.tableMatchType ?? 'identical';
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2">
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">
        表格匹配
      </span>
      <Badge variant="default">{tableMatchType}</Badge>
      <span className="text-xs text-[var(--color-text-muted)]">
        {changeCount} 个单元格差异
      </span>
      {structuralChanges.length > 0 && (
        <span className="text-xs text-[var(--color-text-muted)]">
          {structuralChanges.length} 项结构变化
        </span>
      )}
    </div>
  );
}

/** Navigation controls for stepping through changes within the table. */
function ChangeNav({
  current,
  total,
  onPrev,
  onNext,
  detailText,
}: {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  detailText?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)]">
        变更 {total > 0 ? current + 1 : 0} / {total}
      </span>
      <SimpleTooltip content="上一个变更">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onPrev}
          disabled={total === 0}
          aria-label="上一个变更"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
      <SimpleTooltip content="下一个变更">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onNext}
          disabled={total === 0}
          aria-label="下一个变更"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
      {detailText && (
        <span className="ml-2 text-xs text-[var(--color-text-secondary)] truncate max-w-[300px]">
          {detailText}
        </span>
      )}
    </div>
  );
}

/** Cell detail panel showing old -> new values for a selected cell. */
function CellDetailPanel({
  diff,
  onClose,
}: {
  diff: CellDiff;
  onClose: () => void;
}) {
  const changeLabel =
    diff.changeType === 'modified'
      ? '修改'
      : diff.changeType === 'added'
        ? '新增'
        : diff.changeType === 'deleted'
          ? '删除'
          : diff.changeType === 'span_changed'
            ? '合并变化'
            : diff.changeType;

  return (
    <div className="flex items-start gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-2">
      <Badge
        variant={
          diff.changeType === 'added'
            ? 'added'
            : diff.changeType === 'deleted'
              ? 'deleted'
              : diff.changeType === 'modified'
                ? 'modified'
                : 'default'
        }
      >
        {changeLabel}
      </Badge>
      <div className="flex flex-1 items-center gap-3 text-xs min-w-0">
        {diff.oldContent !== null && (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-[var(--color-text-muted)]">旧值</span>
            <span className="truncate rounded bg-[var(--color-deleted-bg)] px-1.5 py-0.5 text-[var(--color-deleted)]">
              {diff.oldContent || '(空)'}
            </span>
          </div>
        )}
        {(diff.changeType === 'modified' || diff.changeType === 'added') && (
          <ArrowLeftRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />
        )}
        {diff.newContent !== null && (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-[var(--color-text-muted)]">新值</span>
            <span className="truncate rounded bg-[var(--color-added-bg)] px-1.5 py-0.5 text-[var(--color-added)]">
              {diff.newContent || '(空)'}
            </span>
          </div>
        )}
        {diff.changeType === 'modified' && (
          <span className="flex-shrink-0 text-[var(--color-text-muted)]">
            {Math.round(diff.similarity * 100)}% 相似
          </span>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs"
        aria-label="关闭详情"
      >
        x
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table pane
// ---------------------------------------------------------------------------

interface TablePaneProps {
  label: string;
  rows: string[][];
  maxRows: number;
  maxCols: number;
  cellDiffMap: CellDiffMap;
  /** Structural row/col sets *for this pane* (inverted for A vs B). */
  highlightRows: Set<number>;
  highlightCols: Set<number>;
  isDeletedRow: (idx: number) => boolean;
  isAddedRow: (idx: number) => boolean;
  selectedPos: CellPosition | null;
  onCellClick: (pos: CellPosition) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
}

function TablePane({
  label,
  rows,
  maxRows,
  maxCols,
  cellDiffMap,
  highlightRows,
  highlightCols,
  isDeletedRow,
  isAddedRow,
  selectedPos,
  onCellClick,
  scrollRef,
  onScroll,
}: TablePaneProps) {
  const ROW_HEIGHT = 36;
  const estimateSize = useCallback(() => ROW_HEIGHT, []);
  const useVirtualization = maxRows >= VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: maxRows,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 12,
    enabled: useVirtualization,
  });

  const virtualItems = useVirtualization ? virtualizer.getVirtualItems() : [];

  /** Render a single data row (shared by virtualized and non-virtualized paths). */
  const renderRow = (rowIdx: number, style?: React.CSSProperties) => {
    const row = rows[rowIdx];
    const isDel = isDeletedRow(rowIdx);
    const isAdd = isAddedRow(rowIdx);
    const rowSelected = selectedPos !== null && selectedPos[0] === rowIdx;

    return (
      <tr
        key={rowIdx}
        role="row"
        aria-rowindex={rowIdx + 2} /* +2: 1-based, +1 for header row */
        aria-selected={rowSelected || undefined}
        style={style}
        className={cn(
          isDel && 'bg-[var(--color-deleted-bg)]/30',
          isAdd && 'bg-[var(--color-added-bg)]/30',
        )}
      >
        {/* Row index */}
        <td
          role="gridcell"
          className="w-10 border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-1 py-0.5 text-center text-[10px] text-[var(--color-text-muted)]"
        >
          {rowIdx + 1}
        </td>

        {/* Data cells */}
        {Array.from({ length: maxCols }, (_, colIdx) => {
          const content = row?.[colIdx] ?? '';
          const diff = cellDiffMap.get(cellKey(rowIdx, colIdx));
          const bg = diff ? getCellChangeColor(diff.changeType) : undefined;
          const isSelected =
            selectedPos !== null &&
            selectedPos[0] === rowIdx &&
            selectedPos[1] === colIdx;
          const isChanged = diff && diff.changeType !== 'identical';
          const tooltip = diff ? getCellDiffTooltip(diff) : undefined;

          return (
            <td
              key={colIdx}
              role="gridcell"
              aria-colindex={colIdx + 2} /* +2: 1-based, +1 for row-index col */
              aria-selected={isSelected || undefined}
              className={cn(
                'border border-[var(--color-border)] px-2 py-0.5 truncate max-h-full',
                isChanged && 'cursor-pointer',
                isSelected && 'ring-2 ring-inset ring-[var(--color-accent)]',
                highlightCols.has(colIdx) && !bg && 'bg-[var(--color-modified-bg)]/30',
              )}
              style={{ backgroundColor: bg }}
              onClick={
                isChanged ? () => onCellClick([rowIdx, colIdx]) : undefined
              }
              title={tooltip}
            >
              {content || ' '}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--color-border)]">
      {/* Pane header */}
      <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-1.5">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
          {rows.length} 行 x {getMaxColumns(rows)} 列
        </span>
      </div>

      {/* Scrollable table body */}
      <div
        ref={scrollRef}
        onScroll={useVirtualization ? onScroll : undefined}
        className="flex-1 overflow-auto"
      >
        <table
          role="grid"
          aria-rowcount={maxRows + 1} /* +1 for header row */
          aria-colcount={maxCols + 1} /* +1 for row-index col */
          aria-label={label}
          className="w-full border-collapse text-xs"
          style={{ tableLayout: 'fixed' }}
        >
          {/* Sticky column header row */}
          <thead className="sticky top-0 z-10 bg-[var(--color-bg-muted)]">
            <tr role="row" aria-rowindex={1}>
              <th
                role="columnheader"
                className="w-10 border border-[var(--color-border)] px-1 py-1 text-center text-[10px] font-medium text-[var(--color-text-muted)]"
              >
                #
              </th>
              {Array.from({ length: maxCols }, (_, c) => (
                <th
                  key={c}
                  role="columnheader"
                  aria-colindex={c + 2}
                  className={cn(
                    'border border-[var(--color-border)] px-2 py-1 text-left text-[10px] font-medium text-[var(--color-text-muted)]',
                    highlightCols.has(c) && 'bg-[var(--color-modified-bg)]',
                  )}
                >
                  {c + 1}
                </th>
              ))}
            </tr>
          </thead>

          {useVirtualization ? (
            /* Virtualized body: absolute-positioned rows inside a sized container */
            <tbody>
              <tr style={{ height: virtualizer.getTotalSize() }} aria-hidden="true" />
              {virtualItems.map((vRow) =>
                renderRow(vRow.index, {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${vRow.start}px)`,
                }),
              )}
            </tbody>
          ) : (
            /* Non-virtualized body: render all rows directly */
            <tbody>
              {Array.from({ length: rows.length }, (_, rowIdx) => renderRow(rowIdx))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TableViewport({ item }: ViewportViewProps) {
  const tableDiff = item.tableDiff;
  const tableA = item.tableA;
  const tableB = item.tableB;

  // ---- state ----
  const [selectedPos, setSelectedPos] = useState<CellPosition | null>(null);
  const [changeIdx, setChangeIdx] = useState<number>(-1);

  // ---- derived data ----
  const cellDiffMap = useMemo(
    () => buildCellDiffMap(tableDiff?.cellDiffs ?? []),
    [tableDiff?.cellDiffs],
  );

  const changedPositions = useMemo(
    () => collectChangedPositions(tableDiff?.cellDiffs ?? []),
    [tableDiff?.cellDiffs],
  );

  const structuralSets = useMemo(
    () => computeStructuralSets(tableDiff?.structuralChanges ?? []),
    [tableDiff?.structuralChanges],
  );

  const maxRows = Math.max(
    tableA?.rows.length ?? 0,
    tableB?.rows.length ?? 0,
  );
  const maxColsA = tableA ? getMaxColumns(tableA.rows) : 0;
  const maxColsB = tableB ? getMaxColumns(tableB.rows) : 0;
  const maxCols = Math.max(maxColsA, maxColsB);

  // For table A: deleted rows/cols are highlighted; added rows/cols show as empty
  // For table B: added rows/cols are highlighted; deleted rows/cols show as empty
  const { addedRows, deletedRows, addedCols, deletedCols } = structuralSets;

  // ---- scroll sync ----
  const scrollRefA = useRef<HTMLDivElement | null>(null);
  const scrollRefB = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  const handleScrollA = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      const el = e.currentTarget;
      if (scrollRefB.current) {
        scrollRefB.current.scrollTop = el.scrollTop;
        scrollRefB.current.scrollLeft = el.scrollLeft;
      }
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    },
    [],
  );

  const handleScrollB = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      const el = e.currentTarget;
      if (scrollRefA.current) {
        scrollRefA.current.scrollTop = el.scrollTop;
        scrollRefA.current.scrollLeft = el.scrollLeft;
      }
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    },
    [],
  );

  // ---- cell selection ----
  const handleCellClick = useCallback(
    (pos: CellPosition) => {
      setSelectedPos(pos);
      // Find the index in changedPositions for this cell
      const idx = changedPositions.findIndex(
        (p) => p[0] === pos[0] && p[1] === pos[1],
      );
      if (idx >= 0) {
        setChangeIdx(idx);
      }
    },
    [changedPositions],
  );

  const goToChange = useCallback(
    (idx: number) => {
      if (changedPositions.length === 0) return;
      const clamped = ((idx % changedPositions.length) + changedPositions.length) % changedPositions.length;
      setChangeIdx(clamped);
      setSelectedPos(changedPositions[clamped]);
    },
    [changedPositions],
  );

  const handlePrev = useCallback(() => goToChange(changeIdx - 1), [goToChange, changeIdx]);
  const handleNext = useCallback(() => goToChange(changeIdx + 1), [goToChange, changeIdx]);

  // Keyboard shortcuts for prev/next when this viewport is focused
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        setSelectedPos(null);
        setChangeIdx(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePrev, handleNext]);

  // ---- detail text for current change ----
  const selectedDiff = selectedPos
    ? cellDiffMap.get(cellKey(selectedPos[0], selectedPos[1]))
    : undefined;

  const detailText = useMemo(() => {
    if (!selectedDiff) return undefined;
    return getCellDiffTooltip(selectedDiff);
  }, [selectedDiff]);

  // ---- early return for no data ----
  if (!tableDiff || !tableA || !tableB) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
        表格差异数据不可用
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-1">
      {/* Summary */}
      <SummaryBar
        item={item}
        changeCount={tableDiff.cellDiffs.filter((d) => d.changeType !== 'identical').length}
        structuralChanges={tableDiff.structuralChanges}
      />

      {/* Navigation */}
      <ChangeNav
        current={changeIdx}
        total={changedPositions.length}
        onPrev={handlePrev}
        onNext={handleNext}
        detailText={detailText}
      />

      {/* Structural changes badges */}
      {tableDiff.structuralChanges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            结构变化:
          </span>
          {tableDiff.structuralChanges.map((c, i) => (
            <Badge key={i} variant="modified">
              {formatStructuralLabel(c)}
            </Badge>
          ))}
        </div>
      )}

      {/* Cell detail panel */}
      {selectedDiff && selectedDiff.changeType !== 'identical' && (
        <CellDetailPanel
          diff={selectedDiff}
          onClose={() => {
            setSelectedPos(null);
            setChangeIdx(-1);
          }}
        />
      )}

      {/* Dual table panes */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        <TablePane
          label="基准文档表格 (A)"
          rows={tableA.rows}
          maxRows={maxRows}
          maxCols={maxCols}
          cellDiffMap={cellDiffMap}
          highlightRows={deletedRows}
          highlightCols={deletedCols}
          isDeletedRow={(i) => deletedRows.has(i)}
          isAddedRow={() => false}
          selectedPos={selectedPos}
          onCellClick={handleCellClick}
          scrollRef={scrollRefA}
          onScroll={handleScrollA}
        />
        <TablePane
          label="送审文档表格 (B)"
          rows={tableB.rows}
          maxRows={maxRows}
          maxCols={maxCols}
          cellDiffMap={cellDiffMap}
          highlightRows={addedRows}
          highlightCols={addedCols}
          isDeletedRow={() => false}
          isAddedRow={(i) => addedRows.has(i)}
          selectedPos={selectedPos}
          onCellClick={handleCellClick}
          scrollRef={scrollRefB}
          onScroll={handleScrollB}
        />
      </div>
    </div>
  );
}
