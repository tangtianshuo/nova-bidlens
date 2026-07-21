import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRiskReviewStore } from './risk-review-store';
import type { RiskLevel, DetectorType, FindingReviewStatus } from '@bidlens/shared/types-only';

export function FindingFilterToolbar() {
  const { filters, setRiskFilter, setDetectorFilter, setReviewStatusFilter, setShowImportantOnly, clearFilters } = useRiskReviewStore();

  const toggleRisk = useCallback(
    (level: RiskLevel) => {
      const next = new Set(filters.riskLevels);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      setRiskFilter([...next]);
    },
    [filters.riskLevels, setRiskFilter],
  );

  const toggleDetector = useCallback(
    (type: DetectorType) => {
      const next = new Set(filters.detectorTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      setDetectorFilter([...next]);
    },
    [filters.detectorTypes, setDetectorFilter],
  );

  const toggleReview = useCallback(
    (status: FindingReviewStatus) => {
      const next = new Set(filters.reviewStatuses);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      setReviewStatusFilter([...next]);
    },
    [filters.reviewStatuses, setReviewStatusFilter],
  );

  const hasFilters =
    filters.riskLevels.size > 0 ||
    filters.detectorTypes.size > 0 ||
    filters.reviewStatuses.size > 0 ||
    filters.showImportantOnly;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label="发现项筛选">
      {/* Risk level filters */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--color-text-muted)] mr-1">风险</span>
        {(['high', 'medium', 'low'] as RiskLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => toggleRisk(level)}
            className={`rounded-[var(--radius)] border px-2 py-0.5 text-[10px] transition-colors ${
              filters.riskLevels.has(level)
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
            }`}
            aria-pressed={filters.riskLevels.has(level)}
          >
            {level === 'high' ? '高' : level === 'medium' ? '中' : '低'}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-[var(--color-border)]" />

      {/* Detector type filters */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--color-text-muted)] mr-1">类型</span>
        {(['text', 'table', 'entity'] as DetectorType[]).map((type) => (
          <button
            key={type}
            onClick={() => toggleDetector(type)}
            className={`rounded-[var(--radius)] border px-2 py-0.5 text-[10px] transition-colors ${
              filters.detectorTypes.has(type)
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
            }`}
            aria-pressed={filters.detectorTypes.has(type)}
          >
            {type === 'text' ? '文本' : type === 'table' ? '表格' : '实体'}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-[var(--color-border)]" />

      {/* Review status filters */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--color-text-muted)] mr-1">审阅</span>
        {(['pending', 'confirmed', 'ignored', 'important'] as FindingReviewStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => toggleReview(status)}
            className={`rounded-[var(--radius)] border px-2 py-0.5 text-[10px] transition-colors ${
              filters.reviewStatuses.has(status)
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
            }`}
            aria-pressed={filters.reviewStatuses.has(status)}
          >
            {status === 'pending' ? '待确认' : status === 'confirmed' ? '已确认' : status === 'ignored' ? '已忽略' : '重要'}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-[var(--color-border)]" />

      {/* Important only toggle */}
      <button
        onClick={() => setShowImportantOnly(!filters.showImportantOnly)}
        className={`rounded-[var(--radius)] border px-2 py-0.5 text-[10px] transition-colors ${
          filters.showImportantOnly
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
        }`}
        aria-pressed={filters.showImportantOnly}
      >
        仅重要
      </button>

      {/* Clear all */}
      {hasFilters && (
        <Button variant="secondary" size="sm" onClick={clearFilters} className="ml-auto text-[10px]">
          清除筛选
        </Button>
      )}
    </div>
  );
}
