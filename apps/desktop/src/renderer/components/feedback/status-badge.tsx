import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  EyeOff,
  Flag,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  getRiskLabel,
} from '../../lib/semantic-state';
import type { RiskLevel } from '../../lib/semantic-state';
import type { ProjectStatus, FindingReviewStatus } from '@bidlens/shared/types-only';

// ── Risk level badge ─────────────────────────────────────────────

export interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

const RISK_ICONS: Record<RiskLevel, React.ElementType> = {
  high: ShieldAlert,
  medium: AlertTriangle,
  low: ShieldCheck,
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const Icon = RISK_ICONS[level];
  return (
    <Badge variant={`risk-${level}` as 'risk-high' | 'risk-medium' | 'risk-low'} className={className}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {getRiskLabel(level)}
    </Badge>
  );
}

// ── Project status badge ─────────────────────────────────────────

export interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const STATUS_ICONS: Record<ProjectStatus, React.ElementType> = {
  draft: Circle,
  running: Loader2,
  ready: CheckCircle2,
  partial: AlertTriangle,
  interrupted: XCircle,
  failed: XCircle,
  cancelled: XCircle,
};

const STATUS_VARIANT: Record<ProjectStatus, string> = {
  draft: 'default',
  running: 'accent',
  ready: 'added',
  partial: 'modified',
  interrupted: 'deleted',
  failed: 'deleted',
  cancelled: 'deleted',
};

const SPIN_STATUSES = new Set<ProjectStatus>(['running']);

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '草稿',
  running: '处理中',
  ready: '已完成',
  partial: '部分结果',
  interrupted: '已中断',
  failed: '失败',
  cancelled: '已取消',
};

// Need Circle import for draft
import { Circle } from 'lucide-react';

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status];
  const spinning = SPIN_STATUSES.has(status);
  return (
    <Badge
      variant={STATUS_VARIANT[status] as 'accent' | 'added' | 'modified' | 'deleted' | 'default'}
      className={className}
    >
      <Icon
        className={`h-3 w-3 ${spinning ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

// ── Review status badge ──────────────────────────────────────────

export interface ReviewBadgeProps {
  status: FindingReviewStatus;
  important?: boolean;
  className?: string;
}

const REVIEW_ICONS: Record<FindingReviewStatus, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  ignored: EyeOff,
};

const REVIEW_VARIANT: Record<FindingReviewStatus, string> = {
  pending: 'uncertain',
  confirmed: 'added',
  ignored: 'default',
};

const REVIEW_LABELS: Record<FindingReviewStatus, string> = {
  pending: '待审查',
  confirmed: '已确认',
  ignored: '已忽略',
};

export function ReviewBadge({ status, important, className }: ReviewBadgeProps) {
  if (important) {
    return (
      <Badge variant="modified" className={className}>
        <Flag className="h-3 w-3" aria-hidden="true" />
        重要
      </Badge>
    );
  }
  const Icon = REVIEW_ICONS[status];
  return (
    <Badge
      variant={REVIEW_VARIANT[status] as 'uncertain' | 'added' | 'default'}
      className={className}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {REVIEW_LABELS[status]}
    </Badge>
  );
}
