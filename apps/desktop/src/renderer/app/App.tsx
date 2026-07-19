import { useCallback, useEffect, useState } from 'react';
import type { ReviewAnnotation } from '@bidlens/shared/types-only';
import { Toaster } from 'sonner';
import { useAppStore } from '../stores/app-store';
import { applyTheme, watchSystemTheme } from '../lib/theme';
import { TopBar } from '../components/layout/top-bar';
import { NewCompareView } from '../features/compare/new-compare-view';
import { ProcessingView } from '../features/compare/processing-view';
import { HistoryView } from '../features/history/history-view';
import { ErrorBoundary } from '../components/feedback';
import { ReviewWorkbench, DEFAULT_FILTERS, type FilterState } from '../features/review';

import { useResultStore } from '../stores/result-store';

export function App() {
  const view = useAppStore((s) => s.view);

  // Apply theme on mount and watch for system changes
  useEffect(() => {
    applyTheme();
    const unwatch = watchSystemTheme(applyTheme);
    return unwatch;
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto">
          {view === 'new' && <NewCompareView />}
          {view === 'processing' && <ProcessingView />}
          {view === 'result' && <ResultView />}
          {view === 'history' && <HistoryView />}
        </main>
      </div>
      <Toaster position="top-right" offset={52} />
    </ErrorBoundary>
  );
}

function ResultView() {
  const resetToNew = useAppStore((s) => s.resetToNew);
  const result = useResultStore((s) => s.result);
  const selectedItemId = useResultStore((s) => s.selectedItemId);
  const selectItem = useResultStore((s) => s.selectItem);
  const upsertAnnotation = useResultStore((s) => s.upsertAnnotation);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const saveAnnotation = useCallback(async (
    matchId: string,
    updates: Partial<Pick<ReviewAnnotation, 'status' | 'important' | 'note'>>,
  ) => {
    if (!result) return;
    const annotation = await window.bidlens.saveAnnotation({
      taskId: result.taskId,
      matchId,
      ...updates,
    });
    upsertAnnotation(annotation);
  }, [result, upsertAnnotation]);

  if (result) {
    return (
      <ReviewWorkbench
        result={result}
        selectedItemId={selectedItemId}
        filters={filters}
        onSelectItem={selectItem}
        onFiltersChange={setFilters}
        onSaveAnnotation={(matchId, updates) => { void saveAnnotation(matchId, updates); }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <p className="text-sm text-[var(--color-text-secondary)]">
        未找到比对结果
      </p>
      <button
        className="mt-4 text-sm text-[var(--color-accent)] hover:underline"
        onClick={resetToNew}
      >
        返回新建比对
      </button>
    </div>
  );
}
