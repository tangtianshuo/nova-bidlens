import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './app-store';

describe('App Store State Machine', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({ view: 'new', taskId: null });
  });

  it('starts in new view', () => {
    expect(useAppStore.getState().view).toBe('new');
    expect(useAppStore.getState().taskId).toBeNull();
  });

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

  it('transitions from result to new via resetToNew', () => {
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
    // Now in 'result' view
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
});
