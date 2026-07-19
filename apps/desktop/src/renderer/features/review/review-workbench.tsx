/**
 * Review Workbench - Main page for reviewing comparison results.
 * Matches V0.2.2 prototype layout: taskbar | filterbar | work-grid.
 */

import { useState, useMemo, useCallback } from 'react';
import { FileText, Plus, Download, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import type { CompareResult, ReviewAnnotation, DiffItem, ReviewStatus } from '@bidlens/shared/types-only';
import { WorkbenchLayout } from './workbench-layout';
import { DiffNavList } from './diff-nav-list';
import { FilterBar, applyFilters, DEFAULT_FILTERS, type FilterState } from './filter-panel';
import { DiffViewport } from './diff-viewport';
import { DetailTabs } from './detail-tabs';
import { ReviewControls } from './review-controls';
import { ExportDialog } from './export-dialog';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Tooltip } from '../../components/ui/tooltip';

interface ReviewWorkbenchProps {
  result: CompareResult;
  selectedItemId: string | null;
  filters: FilterState;
  onSelectItem: (matchId: string | null) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onSelectNextUnreviewed: () => void;
  onFiltersChange: (filters: FilterState) => void;
  onSaveAnnotation: (matchId: string, updates: Partial<Pick<ReviewAnnotation, 'status' | 'important' | 'note'>>) => void;
  onNewCompare?: () => void;
}

export function ReviewWorkbench({
  result,
  selectedItemId,
  filters,
  onSelectItem,
  onSelectNext,
  onSelectPrevious,
  onSelectNextUnreviewed,
  onFiltersChange,
  onSaveAnnotation,
  onNewCompare,
}: ReviewWorkbenchProps) {
  const annotationMap = useMemo(
    () => new Map(result.annotations.map((a) => [a.matchId, a])),
    [result.annotations]
  );

  const filteredItems = useMemo(
    () => applyFilters(result.diffAst.items, filters, annotationMap),
    [result.diffAst.items, filters, annotationMap]
  );

  const selectedItem = useMemo(
    () => (selectedItemId ? result.diffAst.items.find((i) => i.matchId === selectedItemId) ?? null : null),
    [selectedItemId, result.diffAst.items]
  );

  const selectedAnnotation = useMemo(
    () => (selectedItemId ? annotationMap.get(selectedItemId) ?? null : null),
    [selectedItemId, annotationMap]
  );

  const selectedIndex = selectedItemId
    ? filteredItems.findIndex((i) => i.matchId === selectedItemId)
    : -1;

  const reviewedCount = useMemo(() => {
    let count = 0;
    for (const item of result.diffAst.items) {
      const ann = annotationMap.get(item.matchId);
      if (ann && ann.status !== 'unreviewed') count++;
    }
    return count;
  }, [result.diffAst.items, annotationMap]);

  const handleSaveStatus = useCallback(
    (matchId: string, status: ReviewStatus) => onSaveAnnotation(matchId, { status }),
    [onSaveAnnotation]
  );
  const handleSaveImportant = useCallback(
    (matchId: string, important: boolean) => onSaveAnnotation(matchId, { important }),
    [onSaveAnnotation]
  );
  const handleSaveNote = useCallback(
    (matchId: string, note: string) => onSaveAnnotation(matchId, { note }),
    [onSaveAnnotation]
  );

  const [exportOpen, setExportOpen] = useState(false);

  const handleExport = useCallback((format: 'html' | 'markdown', scope: string) => {
    // TODO: wire to main process export handler
    console.log('Export:', { format, scope });
  }, []);

  // Taskbar content (row 1)
  const taskbar = (
    <>
      <div className="flex items-center gap-2 min-w-0 font-bold">
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{result.docA.filename} ↔ {result.docB.filename}</span>
      </div>
      <div className="text-xs text-[var(--color-text-muted)] pl-2 border-l border-[var(--color-border)]" style={{ whiteSpace: 'nowrap' }}>
        已处理 {reviewedCount} / {result.diffAst.items.length}
      </div>
      <div className="flex-1" />
      {onNewCompare && (
        <Button variant="secondary" size="sm" onClick={onNewCompare}>
          <Plus className="h-3.5 w-3.5" />
          新建比对
        </Button>
      )}
      <Button size="sm" onClick={() => setExportOpen(true)}>
        <Download className="h-3.5 w-3.5" />
        导出报告
      </Button>
    </>
  );

  // Filter bar content (row 2)
  const filterbar = (
    <FilterBar
      filters={filters}
      onFiltersChange={onFiltersChange}
      totalCount={result.diffAst.items.length}
      filteredCount={filteredItems.length}
    />
  );

  // Nav panel content (left)
  const navPanel = (
    <DiffNavList
      items={filteredItems}
      selectedItemId={selectedItemId}
      annotationMap={annotationMap}
      onSelect={onSelectItem}
    />
  );

  // Viewport content (center)
  const viewport = (
    <div className="grid min-h-0 overflow-hidden" style={{ gridTemplateRows: '42px minmax(0, 1fr)' }}>
      {/* Viewport toolbar */}
      <div className="flex items-center gap-2 px-2.5 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
        <Tooltip content="上一项">
          <IconButton
            icon={<ChevronLeft className="h-4 w-4" />}
            tooltip="上一项"
            onClick={onSelectPrevious}
            disabled={filteredItems.length === 0}
            aria-label="上一项"
          />
        </Tooltip>
        <Tooltip content="下一项">
          <IconButton
            icon={<ChevronRight className="h-4 w-4" />}
            tooltip="下一项"
            onClick={onSelectNext}
            disabled={filteredItems.length === 0}
            aria-label="下一项"
          />
        </Tooltip>
        <div className="flex-1 min-w-0 truncate text-xs font-bold">
          {selectedItem?.summary || ''}
        </div>
        <Button variant="ghost" size="sm" onClick={onSelectNextUnreviewed} className="text-xs">
          下一条未审核
        </Button>
      </div>
      {/* Viewport body */}
      <div className="overflow-auto p-4">
        <DiffViewport selectedItem={selectedItem} />
      </div>
    </div>
  );

  // Detail panel content (right)
  const detailPanel = (
    <div className="flex flex-col h-full">
      {selectedItem ? (
        <>
          <DetailTabs
            item={selectedItem}
            capabilities={result.capabilities}
            className="flex-1"
          />
          <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
            <ReviewControls
              matchId={selectedItem.matchId}
              annotation={selectedAnnotation}
              onSaveStatus={handleSaveStatus}
              onSaveImportant={handleSaveImportant}
              onSaveNote={handleSaveNote}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
          选择一项差异查看详情
        </div>
      )}
    </div>
  );

  return (
    <>
      <WorkbenchLayout
        taskbar={taskbar}
        filterbar={filterbar}
        navPanel={navPanel}
        viewport={viewport}
        detailPanel={detailPanel}
        className="h-full"
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onExport={handleExport}
      />
    </>
  );
}
