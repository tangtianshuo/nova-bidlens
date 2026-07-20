import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './app-store';

describe('App Store State Machine', () => {
  beforeEach(() => {
    // Reset store to risk-review default with 'new' view (shared view)
    useAppStore.setState({ mode: 'risk-review', view: 'new', taskId: null });
  });

  // ── Mode switching ─────────────────────────────────────────────────────

  it('starts in risk-review / new view', () => {
    const state = useAppStore.getState();
    expect(state.mode).toBe('risk-review');
    expect(state.view).toBe('new');
    expect(state.taskId).toBeNull();
  });

  it('switches to version-diff and resets to new view', () => {
    useAppStore.getState().setMode('version-diff');
    const state = useAppStore.getState();
    expect(state.mode).toBe('version-diff');
    expect(state.view).toBe('new');
    expect(state.taskId).toBeNull();
  });

  it('switches to risk-review via setMode and resets to project-list', () => {
    useAppStore.getState().setMode('version-diff');
    useAppStore.getState().setMode('risk-review');
    expect(useAppStore.getState().view).toBe('project-list');
  });

  // ── Shared view transitions (work in both modes) ──────────────────────

  it('transitions from new to processing via startTask', () => {
    useAppStore.getState().startTask('task-1');
    expect(useAppStore.getState().view).toBe('processing');
    expect(useAppStore.getState().taskId).toBe('task-1');
  });

  it('transitions from processing to result via completeTask', () => {
    useAppStore.getState().startTask('task-1');
    useAppStore.getState().completeTask('task-1');
    expect(useAppStore.getState().view).toBe('result');
  });

  it('transitions from processing to new via cancelTask', () => {
    useAppStore.getState().startTask('task-1');
    useAppStore.getState().cancelTask();
    expect(useAppStore.getState().view).toBe('new');
    expect(useAppStore.getState().taskId).toBeNull();
  });

  it('transitions from result to new via resetToNew (version-diff mode)', () => {
    useAppStore.setState({ mode: 'version-diff' });
    useAppStore.getState().startTask('task-1');
    useAppStore.getState().completeTask('task-1');
    useAppStore.getState().resetToNew();
    expect(useAppStore.getState().view).toBe('new');
    expect(useAppStore.getState().taskId).toBeNull();
  });

  it('transitions from new to history', () => {
    useAppStore.getState().setView('history');
    expect(useAppStore.getState().view).toBe('history');
  });

  it('transitions from history to new', () => {
    useAppStore.getState().setView('history');
    useAppStore.getState().setView('new');
    expect(useAppStore.getState().view).toBe('new');
  });

  it('transitions from history to result (snapshot reopen)', () => {
    useAppStore.getState().setView('history');
    useAppStore.getState().setView('result');
    expect(useAppStore.getState().view).toBe('result');
  });

  it('transitions from result to history', () => {
    useAppStore.getState().startTask('task-1');
    useAppStore.getState().completeTask('task-1');
    useAppStore.getState().setView('history');
    expect(useAppStore.getState().view).toBe('history');
  });

  it('rejects invalid transition from new to result', () => {
    useAppStore.getState().setView('result');
    expect(useAppStore.getState().view).toBe('new');
  });

  it('rejects invalid transition from result to processing', () => {
    useAppStore.getState().startTask('task-1');
    useAppStore.getState().completeTask('task-1');
    useAppStore.getState().setView('processing');
    expect(useAppStore.getState().view).toBe('result');
  });

  it('rejects completeTask with wrong taskId', () => {
    useAppStore.getState().startTask('task-1');
    useAppStore.getState().completeTask('task-2');
    expect(useAppStore.getState().view).toBe('processing');
  });

  it('does not startTask from result state', () => {
    useAppStore.getState().startTask('task-1');
    useAppStore.getState().completeTask('task-1');
    useAppStore.getState().startTask('task-2');
    expect(useAppStore.getState().view).toBe('result');
    expect(useAppStore.getState().taskId).toBe('task-1');
  });

  it('transitions from history to processing via startTask (recompare)', () => {
    useAppStore.getState().setView('history');
    useAppStore.getState().startTask('task-recompare');
    expect(useAppStore.getState().view).toBe('processing');
    expect(useAppStore.getState().taskId).toBe('task-recompare');
  });

  // ── Risk-review project view transitions ──────────────────────────────

  describe('project views (risk-review)', () => {
    beforeEach(() => {
      // Put store in project-list view
      useAppStore.setState({ mode: 'risk-review', view: 'project-list', taskId: null });
    });

    it('transitions from project-list to new-project', () => {
      useAppStore.getState().setView('new-project');
      expect(useAppStore.getState().view).toBe('new-project');
    });

    it('transitions from project-list to project-result (reopen)', () => {
      useAppStore.getState().setView('project-result');
      expect(useAppStore.getState().view).toBe('project-result');
    });

    it('transitions from project-list to project-processing via startTask', () => {
      useAppStore.getState().startTask('proj-1');
      expect(useAppStore.getState().view).toBe('project-processing');
      expect(useAppStore.getState().taskId).toBe('proj-1');
    });

    it('transitions from new-project to project-processing via startTask', () => {
      useAppStore.getState().setView('new-project');
      useAppStore.getState().startTask('proj-1');
      expect(useAppStore.getState().view).toBe('project-processing');
      expect(useAppStore.getState().taskId).toBe('proj-1');
    });

    it('transitions from project-processing to project-result via completeTask', () => {
      useAppStore.getState().startTask('proj-1');
      useAppStore.getState().completeTask('proj-1');
      expect(useAppStore.getState().view).toBe('project-result');
    });

    it('transitions from project-processing to project-list via cancelTask', () => {
      useAppStore.getState().startTask('proj-1');
      useAppStore.getState().cancelTask();
      expect(useAppStore.getState().view).toBe('project-list');
      expect(useAppStore.getState().taskId).toBeNull();
    });

    it('transitions from project-result to project-list via resetToNew', () => {
      useAppStore.getState().startTask('proj-1');
      useAppStore.getState().completeTask('proj-1');
      useAppStore.getState().resetToNew();
      expect(useAppStore.getState().view).toBe('project-list');
      expect(useAppStore.getState().taskId).toBeNull();
    });

    it('transitions from project-result to new-project', () => {
      useAppStore.getState().startTask('proj-1');
      useAppStore.getState().completeTask('proj-1');
      useAppStore.getState().setView('new-project');
      expect(useAppStore.getState().view).toBe('new-project');
    });

    it('transitions from new-project back to project-list', () => {
      useAppStore.getState().setView('new-project');
      useAppStore.getState().setView('project-list');
      expect(useAppStore.getState().view).toBe('project-list');
    });

    it('rejects completeTask with wrong taskId', () => {
      useAppStore.getState().startTask('proj-1');
      useAppStore.getState().completeTask('proj-wrong');
      expect(useAppStore.getState().view).toBe('project-processing');
    });

    it('rejects transition to shared views from project views', () => {
      useAppStore.getState().setView('new');
      expect(useAppStore.getState().view).toBe('project-list');

      useAppStore.getState().setView('history');
      expect(useAppStore.getState().view).toBe('project-list');
    });

    it('rejects transition to project views from shared views', () => {
      // Go back to shared 'new' view
      useAppStore.setState({ view: 'new' });
      useAppStore.getState().setView('project-list');
      expect(useAppStore.getState().view).toBe('new');
    });
  });
});
