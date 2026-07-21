import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

/**
 * Subscribe to risk progress events.
 * Invalidates project list + detail queries on every progress tick.
 *
 * - projectId = null: subscribes to ALL progress events (for list/dashboard views)
 * - projectId = string: subscribes and filters to that project only (for detail/processing views)
 *
 * Handles edge cases:
 * - rapid projectId changes: previous subscription cleaned up before new one starts
 * - component unmount during callback: stale projectId check prevents invalidation
 */
export function useProgressSubscription(projectId: string | null): void {
  const queryClient = useQueryClient();
  const projectIdRef = useRef(projectId);

  // Keep ref in sync so the callback always sees the latest projectId.
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    if (!window.bidlens?.onRiskProgress) return;

    const unsubscribe = window.bidlens.onRiskProgress((progress) => {
      // If scoped to a project, ignore events for other projects.
      if (projectIdRef.current !== null && progress.projectId !== projectIdRef.current) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    });

    return unsubscribe;
  }, [projectId, queryClient]);
}
