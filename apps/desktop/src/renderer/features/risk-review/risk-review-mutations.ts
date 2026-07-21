import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { riskResultKeys } from './risk-result-queries';
import type { FindingReviewStatus, RiskFinding } from '@bidlens/shared/types-only';

// ─── Save review mutation ────────────────────────────────────────────

interface SaveReviewVars {
  projectId: string;
  findingId: string;
  status?: FindingReviewStatus;
  important?: boolean;
  note?: string;
}

export function useSaveRiskFindingReview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: SaveReviewVars) =>
      window.bidlens.saveRiskFindingReview(vars),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: riskResultKeys.detail(vars.projectId) });
      const prev = qc.getQueryData(riskResultKeys.detail(vars.projectId));
      qc.setQueryData(riskResultKeys.detail(vars.projectId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          findings: old.findings.map((f: RiskFinding) =>
            f.id === vars.findingId
              ? {
                  ...f,
                  ...(vars.status !== undefined && { reviewStatus: vars.status }),
                  ...(vars.important !== undefined && { important: vars.important }),
                  ...(vars.note !== undefined && { reviewNote: vars.note }),
                }
              : f,
          ),
        };
      });
      return { prev };
    },

    onError: (_err, vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(riskResultKeys.detail(vars.projectId), ctx.prev);
      }
      toast.error('保存失败，请重试');
    },

    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: riskResultKeys.detail(vars.projectId) });
    },
  });
}

// ─── Debounced note save ─────────────────────────────────────────────

export function useDebouncedNoteSave(projectId: string, findingId: string) {
  const mutation = useSaveRiskFindingReview();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const save = useCallback(
    (note: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        mutation.mutate({ projectId, findingId, note });
      }, 300);
    },
    [mutation, projectId, findingId],
  );

  return save;
}
