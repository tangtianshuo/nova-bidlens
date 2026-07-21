import { useQuery } from '@tanstack/react-query';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// ─── Query keys ──────────────────────────────────────────────────────────

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────

/**
 * Fetch the list of analysis project summaries.
 * Reads project summaries from the Electron main process.
 */
export function useProjectList() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!window.bidlens?.onRiskProgress) return;
    return window.bidlens.onRiskProgress(() => {
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    });
  }, [queryClient]);
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => window.bidlens.listProjects(),
  });
}

/**
 * Fetch full detail for a single analysis project.
 * Reads one project snapshot from the Electron main process.
 */
export function useProjectDetail(projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('projectId is required');
      return window.bidlens.getProject(projectId);
    },
    enabled: projectId !== null,
  });
}
