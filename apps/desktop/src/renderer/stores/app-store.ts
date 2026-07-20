import { create } from 'zustand';

/**
 * Application product modes.
 * - 'risk-review': Similarity risk review (雷同性审查) — primary mode
 * - 'version-diff': Version diff comparison (版本差异比对) — secondary mode
 */
export type AppMode = 'risk-review' | 'version-diff';

/**
 * Application view states.
 *
 * Shared views (both modes):
 * - 'new': File selection for new comparison
 * - 'processing': Comparison in progress
 * - 'result': Viewing comparison results
 * - 'history': Viewing history of comparisons
 *
 * Risk-review project views:
 * - 'project-list': Project list / dashboard
 * - 'new-project': Creating a new analysis project
 * - 'project-processing': Analysis in progress
 * - 'project-result': Viewing analysis results
 */
export type AppView =
  | 'new'
  | 'processing'
  | 'result'
  | 'history'
  | 'project-list'
  | 'new-project'
  | 'project-processing'
  | 'project-result';

/** Default view when switching modes via setMode. */
const MODE_DEFAULT_VIEW: Record<AppMode, AppView> = {
  'risk-review': 'project-list',
  'version-diff': 'new',
};

/**
 * Legal state transitions.
 *
 * Shared views follow the same transitions in both modes.
 * Project views are only reachable in risk-review mode.
 */
const VALID_TRANSITIONS: Record<AppView, AppView[]> = {
  // Shared views — valid in both modes
  new: ['processing', 'history'],
  processing: ['result', 'new'],
  result: ['new', 'history'],
  history: ['new', 'result', 'processing'],
  // Risk-review project views
  'project-list': ['new-project', 'project-processing', 'project-result'],
  'new-project': ['project-processing', 'project-list'],
  'project-processing': ['project-result', 'project-list'],
  'project-result': ['project-list', 'new-project'],
};

interface AppState {
  mode: AppMode;
  view: AppView;
  taskId: string | null;
  setMode: (mode: AppMode) => void;
  setView: (view: AppView) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  cancelTask: () => void;
  resetToNew: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'risk-review',
  view: 'new',
  taskId: null,

  setMode: (mode: AppMode) => {
    set({ mode, view: MODE_DEFAULT_VIEW[mode], taskId: null });
  },

  setView: (view: AppView) => {
    const current = get().view;
    if (VALID_TRANSITIONS[current]?.includes(view)) {
      set({ view });
    } else {
      console.warn(`Invalid transition: ${current} -> ${view}`);
    }
  },

  startTask: (taskId: string) => {
    const current = get().view;
    if (current === 'new' || current === 'history' || current === 'project-list' || current === 'new-project') {
      const nextView: AppView = current === 'new' || current === 'history' ? 'processing' : 'project-processing';
      set({ view: nextView, taskId });
    }
  },

  completeTask: (taskId: string) => {
    const { view: current, taskId: activeTaskId } = get();
    if (activeTaskId !== taskId) return;
    if (current === 'processing') {
      set({ view: 'result' });
    } else if (current === 'project-processing') {
      set({ view: 'project-result' });
    }
  },

  cancelTask: () => {
    const current = get().view;
    if (current === 'processing') {
      set({ view: 'new', taskId: null });
    } else if (current === 'project-processing') {
      set({ view: 'project-list', taskId: null });
    }
  },

  resetToNew: () => {
    const { mode } = get();
    if (mode === 'version-diff') {
      set({ view: 'new', taskId: null });
    } else {
      set({ view: 'project-list', taskId: null });
    }
  },
}));
