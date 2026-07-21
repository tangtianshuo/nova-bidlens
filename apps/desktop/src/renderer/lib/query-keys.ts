/**
 * Centralized TanStack Query key factory.
 *
 * Usage:
 *   queryKeys.projects.list()           // readonly ['projects', 'list']
 *   queryKeys.projects.list({ status }) // readonly ['projects', 'list', { status }]
 *   queryKeys.projects.detail(id)       // readonly ['projects', 'detail', id]
 *   queryKeys.projects.findings(id)     // readonly ['projects', 'findings', id]
 */
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? (['projects', 'list', filters] as const) : (['projects', 'list'] as const),
    detail: (id: string) => ['projects', 'detail', id] as const,
    findings: (id: string, filters?: Record<string, unknown>) =>
      filters ? (['projects', 'findings', id, filters] as const) : (['projects', 'findings', id] as const),
  },
} as const;
