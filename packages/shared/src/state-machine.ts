import type { TaskStatus, ReviewStatus, ComparePhase } from './compare-task.js';

// --- Task state machine (Spec §9) ---
// Legal transitions:
//   draft -> validating
//   validating -> parsing_baseline | cancelling | failed
//   parsing_baseline -> parsing_review | cancelling | failed
//   parsing_review -> comparing | cancelling | failed
//   comparing -> finalizing | cancelling | failed
//   finalizing -> ready | cancelling | failed
//   cancelling -> cancelled
//   running states discovered at launch -> interrupted

const LEGAL_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ['validating'],
  validating: ['parsing_baseline', 'cancelling', 'failed'],
  parsing_baseline: ['parsing_review', 'cancelling', 'failed'],
  parsing_review: ['comparing', 'cancelling', 'failed'],
  comparing: ['finalizing', 'cancelling', 'failed'],
  finalizing: ['ready', 'cancelling', 'failed'],
  ready: [],
  cancelling: ['cancelled'],
  cancelled: [],
  failed: [],
  interrupted: [],
};

export function isLegalTransition(from: TaskStatus, to: TaskStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!isLegalTransition(from, to)) {
    throw new Error(`Illegal task transition: ${from} -> ${to}`);
  }
}

export function isTerminalState(status: TaskStatus): boolean {
  return ['ready', 'cancelled', 'failed', 'interrupted'].includes(status);
}

export function isRunningState(status: TaskStatus): boolean {
  return ['validating', 'parsing_baseline', 'parsing_review', 'comparing', 'finalizing', 'cancelling'].includes(status);
}

export function phaseToComparePhase(phase: ComparePhase): TaskStatus {
  return phase;
}

// --- Review state machine (D10) ---
// Review status transitions are unrestricted - any status can move to any other.
// Important is an independent boolean.

export function isValidReviewStatus(status: string): status is ReviewStatus {
  return ['unreviewed', 'confirmed', 'needs-confirmation', 'ignored'].includes(status);
}

export function computeReviewProgress(statuses: ReviewStatus[]): {
  total: number;
  reviewed: number;
  important: number;
} {
  const total = statuses.length;
  const reviewed = statuses.filter(s => s !== 'unreviewed').length;
  return { total, reviewed, important: 0 };
}
