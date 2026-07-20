import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useProjectList, useProjectDetail, projectKeys } from './project-queries';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('project-queries', () => {
  describe('useProjectList', () => {
    it('returns project summaries from fixtures', async () => {
      const { result } = renderHook(() => useProjectList(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const projects = result.current.data!;
      expect(projects.length).toBe(5);
      expect(projects[0].id).toBe('proj-fixture-001');
      expect(projects[0].name).toContain('XX道路改造工程');
    });

    it('includes all expected status types', async () => {
      const { result } = renderHook(() => useProjectList(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const statuses = result.current.data!.map((p) => p.status);
      expect(statuses).toContain('ready');
      expect(statuses).toContain('partial');
      expect(statuses).toContain('interrupted');
    });
  });

  describe('useProjectDetail', () => {
    it('fetches detail for a known project', async () => {
      const { result } = renderHook(() => useProjectDetail('proj-fixture-001'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const detail = result.current.data!;
      expect(detail.id).toBe('proj-fixture-001');
      expect(detail.submissions.length).toBe(3);
      expect(detail.findings.length).toBe(5);
      expect(detail.assessment).not.toBeNull();
    });

    it('returns no-baseline scenario', async () => {
      const { result } = renderHook(() => useProjectDetail('proj-fixture-002'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.baseline).toBeNull();
    });

    it('returns degraded scenario', async () => {
      const { result } = renderHook(() => useProjectDetail('proj-fixture-003'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.degradationReason).toBe('model_unavailable');
    });

    it('returns partial scenario', async () => {
      const { result } = renderHook(() => useProjectDetail('proj-fixture-004'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.status).toBe('partial');
    });

    it('returns interrupted scenario', async () => {
      const { result } = renderHook(() => useProjectDetail('proj-fixture-005'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.status).toBe('interrupted');
      expect(result.current.data!.findings).toHaveLength(0);
    });

    it('errors for unknown project', async () => {
      const { result } = renderHook(() => useProjectDetail('proj-unknown'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('is disabled when projectId is null', () => {
      const { result } = renderHook(() => useProjectDetail(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('projectKeys', () => {
    it('generates correct query keys', () => {
      expect(projectKeys.all).toEqual(['projects']);
      expect(projectKeys.list()).toEqual(['projects', 'list']);
      expect(projectKeys.detail('proj-1')).toEqual(['projects', 'detail', 'proj-1']);
    });
  });
});
