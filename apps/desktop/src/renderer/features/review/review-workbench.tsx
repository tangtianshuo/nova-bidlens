/**
 * Review Workbench - Main page for reviewing comparison results.
 * Integrates navigation, viewport, detail tabs, filters, and review controls.
 */

import { useMemo, useCallback } from 'react';
import type { CompareResult, ReviewAnnotation, DiffItem, ReviewStatus } from '@bidlens/shared/types-only';
import { WorkbenchLayout } from './workbench-layout';
import { DiffNavList } from './diff-nav-list';
import { FilterPanel, applyFilters, DEFAULT_FILTERS, type FilterState } from './filter-panel';
import { TaskToolbar } from './task-toolbar';
import { DiffViewport } from './diff-viewport';
import { DetailTabs } from './detail-tabs';
import { ReviewControls } from './review-controls';

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

  const handleSaveStatus = useCallback(
    (matchId: string, status: ReviewStatus) => {
      onSaveAnnotation(matchId, { status });
    },
    [onSaveAnnotation]
  );

  const handleSaveImportant = useCallback(
    (matchId: string, important: boolean) => {
      onSaveAnnotation(matchId, { important });
    },
    [onSaveAnnotation]
  );

  const handleSaveNote = useCallback(
    (matchId: string, note: string) => {
      onSaveAnnotation(matchId, { note });
    },
    [onSaveAnnotation]
  );

  // Left panel: filters + navigation list
  const leftPanel = (
    <div className="flex flex-col h-full">
      <FilterPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        totalCount={result.diffAst.items.length}
        filteredCount={filteredItems.length}
      />
      <DiffNavList
        items={filteredItems}
        selectedItemId={selectedItemId}
        annotationMap={annotationMap}
        onSelect={onSelectItem}
        className="flex-1"
      />
    </div>
  );

  // Center panel: toolbar + viewport
  const centerPanel = (
    <div className="flex flex-col h-full">
      <TaskToolbar
        items={filteredItems}
        selectedItemId={selectedItemId}
        annotations={result.annotations}
        onSelect={onSelectItem}
        onSelectNext={onSelectNext}
        onSelectPrevious={onSelectPrevious}
        onSelectNextUnreviewed={onSelectNextUnreviewed}
      />
      <div className="flex-1 overflow-auto">
        <DiffViewport selectedItem={selectedItem} />
      </div>
    </div>
  );

  // Right panel: review controls + detail tabs
  const rightPanel = (
    <div className="flex flex-col h-full">
      {selectedItem && (
        <>
          <div className="p-3 border-b border-[var(--color-border)]">
            <ReviewControls
              matchId={selectedItem.matchId}
              annotation={selectedAnnotation}
              onSaveStatus={handleSaveStatus}
              onSaveImportant={handleSaveImportant}
              onSaveNote={handleSaveNote}
            />
          </div>
          <DetailTabs
            item={selectedItem}
            capabilities={result.capabilities}
            className="flex-1"
          />
        </>
      )}
      {!selectedItem && (
        <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
          选择一项差异查看详情
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <WorkbenchLayout
        leftPanel={leftPanel}
        centerPanel={centerPanel}
        rightPanel={rightPanel}
        className="flex-1"
      />
    </div>
  );
}
