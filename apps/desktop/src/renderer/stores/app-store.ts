import { create } from 'zustand';

/**
 * Application view states.
 * - 'new': File selection for new comparison
 * - 'processing': Comparison in progress
 * - 'result': Viewing comparison results
 * - 'history': Viewing history of comparisons
 */
export type AppView = 'new' | 'processing' | 'result' | 'history';

/**
 * Legal state transitions.
 * new -> processing, history
 * processing -> result, new (cancel)
 * result -> new, history
 * history -> new, result, processing (recompare)
 */
const VALID_TRANSITIONS: Record<AppView, AppView[]> = {
  new: ['processing', 'history'],
  processing: ['result', 'new'],
  result: ['new', 'history'],
  history: ['new', 'result', 'processing'],
};

interface AppState {
  view: AppView;
  taskId: string | null;
  setView: (view: AppView) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  cancelTask: () => void;
  resetToNew: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'new',
  taskId: null,

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
    if (current === 'new' || current === 'history') {
      set({ view: 'processing', taskId });
    }
  },

  completeTask: (taskId: string) => {
    const current = get().view;
    if (current === 'processing' && get().taskId === taskId) {
      set({ view: 'result' });
    }
  },

  cancelTask: () => {
    const current = get().view;
    if (current === 'processing') {
      set({ view: 'new', taskId: null });
    }
  },

  resetToNew: () => {
    set({ view: 'new', taskId: null });
  },
}));
