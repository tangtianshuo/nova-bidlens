/**
 * Review Workbench - Main page for reviewing comparison results.
 * Matches V0.2.2 prototype layout: taskbar | filterbar | work-grid.
 */

import { useState, useMemo, useCallback } from 'react';
import { FileText, Plus, Download, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import type { CompareResult, ReviewAnnotation, DiffItem, ReviewStatus } from '@bidlens/shared/types-only';
import { WorkbenchLayout } from './workbench-layout';
import { DiffNavList } from './diff-nav-list';
import { FilterBar, applyFilters, DEFAULT_FILTERS, type FilterState } from './filter-panel';
import { DiffViewport } from './diff-viewport';
import { DetailTabs } from './detail-tabs';
import { ReviewControls } from './review-controls';
import { ExportDialog } from './export-dialog';
import { formatDiffSummary } from './diff-presentation';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Tooltip } from '../../components/ui/tooltip';

interface ReviewWorkbenchProps {
  result: CompareResult;
  selectedItemId: string | null;
  filters: FilterState;
  onSelectItem: (matchId: string | null) => void;
  onFiltersChange: (filters: FilterState) => void;
  onSaveAnnotation: (matchId: string, updates: Partial<Pick<ReviewAnnotation, 'status' | 'important' | 'note'>>) => void;
  onNewCompare?: () => void;
}

export function ReviewWorkbench({
  result,
  selectedItemId,
  filters,
  onSelectItem,
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

  const hiddenIdenticalCount = useMemo(() => {
    if (!filters.hideIdentical) return 0;
    const itemsIncludingIdentical = applyFilters(
      result.diffAst.items,
      { ...filters, hideIdentical: false },
      annotationMap
    );
    return itemsIncludingIdentical.length - filteredItems.length;
  }, [annotationMap, filteredItems.length, filters, result.diffAst.items]);

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

  const handleSelectNext = useCallback(() => {
    if (filteredItems.length === 0) return;
    const nextIndex = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, filteredItems.length - 1);
    onSelectItem(filteredItems[nextIndex].matchId);
  }, [filteredItems, onSelectItem, selectedIndex]);

  const handleSelectPrevious = useCallback(() => {
    if (filteredItems.length === 0) return;
    const previousIndex = selectedIndex < 0
      ? filteredItems.length - 1
      : Math.max(selectedIndex - 1, 0);
    onSelectItem(filteredItems[previousIndex].matchId);
  }, [filteredItems, onSelectItem, selectedIndex]);

  const handleSelectNextUnreviewed = useCallback(() => {
    if (filteredItems.length === 0) return;
    const startIndex = selectedIndex < 0 ? 0 : selectedIndex + 1;
    for (let offset = 0; offset < filteredItems.length; offset++) {
      const item = filteredItems[(startIndex + offset) % filteredItems.length];
      const annotation = annotationMap.get(item.matchId);
      if (!annotation || annotation.status === 'unreviewed') {
        onSelectItem(item.matchId);
        return;
      }
    }
  }, [annotationMap, filteredItems, onSelectItem, selectedIndex]);

  const handleExport = useCallback(async (
    format: 'html' | 'markdown',
    scope: 'all' | 'current_filter' | 'important' | 'needs-confirmation',
  ) => {
    const exported = await window.bidlens.exportReport({
      taskId: result.taskId,
      format,
      scope,
      includeIdentical: !filters.hideIdentical,
      matchIds: scope === 'current_filter' ? filteredItems.map((item) => item.matchId) : undefined,
    });
    toast.success(`报告已导出，共 ${exported.itemCount} 条`, {
      description: exported.filePath,
    });
  }, [filteredItems, filters.hideIdentical, result.taskId]);

  // Taskbar content (row 1)
  const taskbar = (
    <>
      <div className="flex min-w-0 items-center gap-2 font-bold">
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{result.docA.filename} ↔ {result.docB.filename}</span>
      </div>
      <div className="optional-label border-l border-[var(--color-border)] pl-2 text-xs text-[var(--color-text-muted)]" style={{ whiteSpace: 'nowrap' }}>
        已处理 {reviewedCount} / {result.diffAst.items.length}
      </div>
      <div className="flex-1" />
      {onNewCompare && (
        <Button variant="secondary" size="sm" onClick={onNewCompare} className="optional-label">
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
      hiddenIdenticalCount={hiddenIdenticalCount}
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
            onClick={handleSelectPrevious}
            disabled={filteredItems.length === 0}
            aria-label="上一项"
          />
        </Tooltip>
        <Tooltip content="下一项">
          <IconButton
            icon={<ChevronRight className="h-4 w-4" />}
            tooltip="下一项"
            onClick={handleSelectNext}
            disabled={filteredItems.length === 0}
            aria-label="下一项"
          />
        </Tooltip>
        <div className="flex-1 min-w-0 truncate text-xs font-bold">
          {selectedItem ? formatDiffSummary(selectedItem) : ''}
        </div>
        <Button variant="ghost" size="sm" onClick={handleSelectNextUnreviewed} className="text-xs">
          下一条未审核
        </Button>
      </div>
      {/* Viewport body */}
      <div className="overflow-auto p-[var(--layout-panel)]">
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
          <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--layout-panel)]">
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
