import { memo, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { useRiskReviewStore, matchesFilter } from './risk-review-store';
import type { RiskFinding } from '@bidlens/shared/types-only';

interface FindingVirtualListProps {
  findings: RiskFinding[];
  onFindingClick?: (id: string) => void;
}

export function FindingVirtualList({ findings, onFindingClick }: FindingVirtualListProps) {
  const { filters, selectedFindingId, selectFinding, selectedFindingIds, toggleFindingSelection } =
    useRiskReviewStore();

  const filtered = useMemo(
    () => findings.filter((f) => matchesFilter(f, filters)),
    [findings, filters],
  );

  const handleRowClick = useCallback(
    (id: string) => {
      selectFinding(id);
      onFindingClick?.(id);
    },
    [selectFinding, onFindingClick],
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      toggleFindingSelection(id);
    },
    [toggleFindingSelection],
  );

  if (filtered.length === 0) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyTitle className="text-sm">无匹配的发现项</EmptyTitle>
          {findings.length > 0 && (
            <EmptyDescription>共 {findings.length} 个发现项，当前筛选条件无匹配</EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="发现项列表"
      aria-setsize={filtered.length}
      className="flex flex-col gap-0.5"
    >
      <div className="mb-2 text-xs text-[var(--color-text-muted)]">
        显示 {filtered.length} / {findings.length} 个发现项
      </div>
      {filtered.map((finding) => (
        <FindingRow
          key={finding.id}
          finding={finding}
          isSelected={selectedFindingId === finding.id}
          isChecked={selectedFindingIds.has(finding.id)}
          onClick={handleRowClick}
          onCheckboxClick={handleCheckboxClick}
        />
      ))}
    </div>
  );
}

// ─── FindingRow ─────────────────────────────────────────────────────

interface FindingRowProps {
  finding: RiskFinding;
  isSelected: boolean;
  isChecked: boolean;
  onClick: (id: string) => void;
  onCheckboxClick: (e: React.MouseEvent, id: string) => void;
}

const RISK_MARKER_COLOR: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-success)',
};

const FindingRow = memo(function FindingRow({ finding, isSelected, isChecked, onClick, onCheckboxClick }: FindingRowProps) {
  const reviewLabel =
    finding.reviewStatus === 'confirmed' ? '已确认' :
    finding.reviewStatus === 'ignored' ? '已忽略' :
    finding.reviewStatus === 'important' ? '重要' : '待确认';

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={() => onClick(finding.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(finding.id);
        }
      }}
      className={`grid items-center rounded-[var(--radius-sm)] border px-2.5 py-2 text-xs transition-colors cursor-pointer ${
        isSelected
          ? 'border-[color-mix(in_srgb,var(--color-accent)_28%,var(--color-border))] bg-[var(--color-accent-soft)]'
          : 'border-transparent hover:bg-[var(--color-bg-hover)]'
      }`}
      style={{ gridTemplateColumns: '4px 14px minmax(0,1fr) auto', gap: '0 9px' }}
    >
      {/* Marker bar — prototype diff-item style */}
      <div
        className="w-[3px] rounded-full self-stretch"
        style={{ backgroundColor: RISK_MARKER_COLOR[finding.riskLevel] ?? 'var(--color-text-muted)' }}
      />

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => {}}
        onClick={(e) => onCheckboxClick(e, finding.id)}
        className="h-3.5 w-3.5"
        aria-label={`选择发现项 ${finding.id}`}
      />

      {/* Content */}
      <div className="min-w-0 flex items-center gap-2">
        <Badge variant={`risk-${finding.riskLevel}`} className="text-[10px] shrink-0">
          {finding.riskLevel === 'high' ? '高' : finding.riskLevel === 'medium' ? '中' : '低'}
        </Badge>
        <span className="text-[var(--color-text-muted)] shrink-0">
          {finding.detectorType === 'text' ? '文本' : finding.detectorType === 'table' ? '表格' : '实体'}
        </span>
        <span className="font-medium text-[var(--color-text)] shrink-0">
          {(finding.symmetricSimilarity * 100).toFixed(0)}%
        </span>
        <span className="text-[var(--color-text-muted)] truncate">
          {finding.involvedSubmissionIds.length} 个文件
        </span>
      </div>

      {/* Review status */}
      <Badge variant={finding.reviewStatus === 'confirmed' ? 'added' : finding.reviewStatus === 'important' ? 'accent' : 'default'} className="text-[10px]">
        {reviewLabel}
      </Badge>
    </div>
  );
});
