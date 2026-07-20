import { Badge } from '@/components/ui/badge';
import type { FindingCounts } from './risk-result-queries';

interface RiskResultToolbarProps {
  counts: FindingCounts;
}

export function RiskResultToolbar({ counts }: RiskResultToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">发现项</span>
        <span className="font-medium text-[var(--color-text)]">{counts.total}</span>
      </div>

      <div className="h-3 w-px bg-[var(--color-border)]" />

      <div className="flex items-center gap-1.5">
        <Badge variant="risk-high" className="text-[10px]">高 {counts.byRisk.high}</Badge>
        <Badge variant="risk-medium" className="text-[10px]">中 {counts.byRisk.medium}</Badge>
        <Badge variant="risk-low" className="text-[10px]">低 {counts.byRisk.low}</Badge>
      </div>

      <div className="h-3 w-px bg-[var(--color-border)]" />

      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">文本</span>
        <span className="text-[var(--color-text)]">{counts.byDetector.text}</span>
        <span className="text-[var(--color-text-muted)]">表格</span>
        <span className="text-[var(--color-text)]">{counts.byDetector.table}</span>
        <span className="text-[var(--color-text-muted)]">实体</span>
        <span className="text-[var(--color-text)]">{counts.byDetector.entity}</span>
      </div>

      <div className="h-3 w-px bg-[var(--color-border)]" />

      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-text-muted)]">已确认</span>
        <span className="font-medium text-[var(--color-added)]">{counts.confirmed}</span>
        <span className="text-[var(--color-text-muted)]">待确认</span>
        <span className="text-[var(--color-text)]">{counts.pending}</span>
      </div>
    </div>
  );
}
