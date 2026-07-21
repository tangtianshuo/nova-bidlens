import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../lib/query-keys';

// Backward-compat alias matching the old projectKeys shape.
export const projectKeys = {
  all: queryKeys.projects.all,
  list: queryKeys.projects.list,
  detail: queryKeys.projects.detail,
};

// ─── Hooks ───────────────────────────────────────────────────────────────

/**
 * Fetch the list of analysis project summaries.
 * For progress-driven auto-refresh, use useProgressSubscription from lib/progress-subscription.ts.
 */
export function useProjectList() {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => window.bidlens.listProjects(),
  });
}

/**
 * Fetch full detail for a single analysis project.
 * For progress-driven auto-refresh, use useProgressSubscription from lib/progress-subscription.ts.
 */
export function useProjectDetail(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('projectId is required');
      return window.bidlens.getProject(projectId);
    },
    enabled: projectId !== null,
  });
}
