import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReviewAnnotation } from '@bidlens/shared/types-only';
import { Toaster } from 'sonner';
import { useAppStore } from '../stores/app-store';
import { applyTheme, watchSystemTheme } from '../lib/theme';
import { AppShell } from '../components/layout/app-shell';
import { NewCompareView } from '../features/compare/new-compare-view';
import { ProcessingView } from '../features/compare/processing-view';
import { HistoryView } from '../features/history/history-view';
import { ErrorBoundary } from '../components/feedback';
import { ReviewWorkbench, DEFAULT_FILTERS, type FilterState } from '../features/review';
import { TooltipProvider } from '../components/ui/tooltip';

import { useResultStore } from '../stores/result-store';
import { ProjectListPage, NewProjectPage } from '../features/projects';
import { ProjectProcessingPage } from '../features/projects/project-processing-page';
import { RiskResultPage } from '../features/risk-review/risk-result-page';
import type { NewProjectFormData } from '../features/projects/new-project-page';
import { useRiskReviewStore } from '../features/risk-review/risk-review-store';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export function App() {
  const view = useAppStore((s) => s.view);

  // Apply theme on mount and watch for system changes
  useEffect(() => {
    applyTheme();
    const unwatch = watchSystemTheme(applyTheme);
    return unwatch;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <AppShell>
          {view === 'project-list' && <ProjectListPage onNewProject={() => useAppStore.getState().setView('new-project')} onOpenProject={(id) => { useRiskReviewStore.getState().setProjectId(id); useAppStore.getState().setView('project-result'); }} />}
          {view === 'new-project' && <NewProjectPage onStartAnalysis={startRiskProject} />}
          {view === 'project-processing' && <ProjectProcessingPage />}
          {view === 'project-result' && <RiskResultPage onBack={() => useAppStore.getState().setView('project-list')} />}
          {view === 'new' && <NewCompareView />}
          {view === 'processing' && <ProcessingView />}
          {view === 'result' && <ResultView />}
          {view === 'history' && <HistoryView />}
        </AppShell>
        <Toaster position="top-right" offset={52} />
      </TooltipProvider>
    </ErrorBoundary>
    </QueryClientProvider>
  );
}

async function startRiskProject(data: NewProjectFormData) {
  const paths = data.submissions.map((file) => file.path).filter((value): value is string => Boolean(value));
  if (paths.length !== data.submissions.length) return;
  const { projectId } = await window.bidlens.createRiskProject({ name: data.name, preset: data.preset, submissions: data.submissions.map((file) => ({ path: file.path!, name: file.name })), baseline: data.baseline?.path ? { path: data.baseline.path, name: data.baseline.name } : null });
  useRiskReviewStore.getState().setProjectId(projectId);
  useAppStore.getState().setView('project-processing');
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
    <div className="flex flex-1 flex-col items-center justify-center overflow-auto p-8">
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
