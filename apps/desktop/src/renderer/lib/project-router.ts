import type { ProjectStatus } from '@bidlens/shared/types-only';
import type { AppView } from '../stores/app-store';

/**
 * Map a project's current status to the appropriate app view.
 */
export function getRouteForStatus(status: ProjectStatus): AppView {
  switch (status) {
    case 'draft':
    case 'running':
    case 'interrupted':
    case 'failed':
      return 'project-processing';
    case 'ready':
    case 'partial':
      return 'project-result';
    case 'cancelled':
      return 'project-list';
  }
}

/**
 * Select a project and navigate to the view matching its status.
 * Intended to be called with setView from useAppStore and selectProject from useProjectStore.
 */
export function navigateToProject(
  projectId: string,
  status: ProjectStatus,
  opts: { selectProject: (id: string) => void; setView: (view: AppView) => void },
): void {
  opts.selectProject(projectId);
  opts.setView(getRouteForStatus(status));
}
