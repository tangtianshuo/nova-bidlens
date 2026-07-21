import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  AnalysisProjectDetail,
  RiskFinding,
  RiskLevel,
  DetectorType,
  FindingReviewStatus,
} from '@bidlens/shared/types-only';

// ─── Query keys ─────────────────────────────────────────────────────

export const riskResultKeys = {
  all: ['risk-results'] as const,
  detail: (projectId: string) => [...riskResultKeys.all, 'detail', projectId] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────

export function useRiskResultDetail(projectId: string | null) {
  return useQuery({
    queryKey: riskResultKeys.detail(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('projectId is required');
      return window.bidlens.getProject(projectId);
    },
    enabled: projectId !== null,
  });
}

// ─── Derived selectors ──────────────────────────────────────────────

export interface FindingCounts {
  total: number;
  byRisk: Record<RiskLevel, number>;
  byDetector: Record<DetectorType, number>;
  byReviewStatus: Record<FindingReviewStatus, number>;
  important: number;
  confirmed: number;
  pending: number;
}

export function computeFindingCounts(findings: RiskFinding[]): FindingCounts {
  const byRisk: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
  const byDetector: Record<DetectorType, number> = { text: 0, table: 0, entity: 0, 'key-fact': 0 };
  const byReviewStatus: Record<FindingReviewStatus, number> = {
    pending: 0,
    confirmed: 0,
    ignored: 0,
  };
  let important = 0;

  for (const f of findings) {
    byRisk[f.riskLevel]++;
    byDetector[f.detectorType]++;
    byReviewStatus[f.reviewStatus]++;
    if (f.important) important++;
  }

  return {
    total: findings.length,
    byRisk,
    byDetector,
    byReviewStatus,
    important,
    confirmed: byReviewStatus.confirmed,
    pending: byReviewStatus.pending,
  };
}

export function useFindingCounts(findings: RiskFinding[]): FindingCounts {
  return useMemo(() => computeFindingCounts(findings), [findings]);
}
