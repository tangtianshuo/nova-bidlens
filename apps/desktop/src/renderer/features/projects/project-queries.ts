import { useQuery } from '@tanstack/react-query';

import {
  buildProjectSummaries,
  buildReadyScenario,
  buildNoBaselineScenario,
  buildDegradedScenario,
  buildPartialScenario,
  buildInterruptedScenario,
  buildProcessingScenario,
  buildFailedScenario,
} from '../../__fixtures__/risk-project';
import type {
  AnalysisProjectSummary,
  AnalysisProjectDetail,
} from '../../__fixtures__/risk-project';

// ─── Query keys ──────────────────────────────────────────────────────────

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

// ─── Fixture lookup ──────────────────────────────────────────────────────

// TODO: Replace with real IPC call `window.bidlens.listProjects()` once Shared IPC is frozen.
function getFixtureSummaries(): AnalysisProjectSummary[] {
  return buildProjectSummaries();
}

// TODO: Replace with real IPC call `window.bidlens.getProjectDetail(id)` once Shared IPC is frozen.
function getFixtureDetail(id: string): AnalysisProjectDetail | undefined {
  const details: Record<string, () => AnalysisProjectDetail> = {
    'proj-fixture-001': buildReadyScenario,
    'proj-fixture-002': buildNoBaselineScenario,
    'proj-fixture-003': buildDegradedScenario,
    'proj-fixture-004': buildPartialScenario,
    'proj-fixture-005': buildInterruptedScenario,
    'proj-fixture-006': buildProcessingScenario,
    'proj-fixture-007': buildFailedScenario,
  };
  const builder = details[id];
  return builder?.();
}

// ─── Hooks ───────────────────────────────────────────────────────────────

/**
 * Fetch the list of analysis project summaries.
 * Currently returns fixture data; swap to IPC when Shared contract is frozen.
 */
export function useProjectList() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => getFixtureSummaries(),
  });
}

/**
 * Fetch full detail for a single analysis project.
 * Currently returns fixture data; swap to IPC when Shared contract is frozen.
 */
export function useProjectDetail(projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('projectId is required');
      const detail = getFixtureDetail(projectId);
      if (!detail) throw new Error(`Project not found: ${projectId}`);
      return detail;
    },
    enabled: projectId !== null,
  });
}
