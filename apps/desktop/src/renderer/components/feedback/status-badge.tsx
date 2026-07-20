import {
  AlertTriangle,
  CheckCircle2,
  Circle,
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
  getStatusLabel,
  getReviewStatusLabel,
} from '../../lib/semantic-state';
import type { RiskLevel } from '../../lib/semantic-state';

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

// ── Analysis status badge ────────────────────────────────────────

type AnalysisStatus =
  | 'validating'
  | 'parsing'
  | 'filtering'
  | 'embedding'
  | 'retrieving'
  | 'detecting'
  | 'aggregating'
  | 'ready'
  | 'partial'
  | 'interrupted'
  | 'failed';

export interface StatusBadgeProps {
  status: AnalysisStatus;
  className?: string;
}

const STATUS_ICONS: Record<AnalysisStatus, React.ElementType> = {
  validating: Loader2,
  parsing: Loader2,
  filtering: Loader2,
  embedding: Loader2,
  retrieving: Loader2,
  detecting: Loader2,
  aggregating: Loader2,
  ready: CheckCircle2,
  partial: AlertTriangle,
  interrupted: XCircle,
  failed: XCircle,
};

const STATUS_VARIANT: Record<AnalysisStatus, string> = {
  validating: 'accent',
  parsing: 'accent',
  filtering: 'accent',
  embedding: 'accent',
  retrieving: 'accent',
  detecting: 'accent',
  aggregating: 'accent',
  ready: 'added',
  partial: 'modified',
  interrupted: 'deleted',
  failed: 'deleted',
};

const SPIN_STATUSES = new Set([
  'validating',
  'parsing',
  'filtering',
  'embedding',
  'retrieving',
  'detecting',
  'aggregating',
]);

const ANALYSIS_LABELS: Record<AnalysisStatus, string> = {
  validating: '验证中',
  parsing: '解析中',
  filtering: '筛选中',
  embedding: '向量化',
  retrieving: '检索中',
  detecting: '检测中',
  aggregating: '聚合中',
  ready: '已完成',
  partial: '部分结果',
  interrupted: '已中断',
  failed: '失败',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status];
  const spinning = SPIN_STATUSES.has(status);
  return (
    <Badge
      variant={STATUS_VARIANT[status] as 'accent' | 'added' | 'modified' | 'deleted'}
      className={className}
    >
      <Icon
        className={`h-3 w-3 ${spinning ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      {ANALYSIS_LABELS[status]}
    </Badge>
  );
}

// ── Review status badge ──────────────────────────────────────────

type ReviewStatus = 'pending' | 'confirmed' | 'ignored' | 'important';

export interface ReviewBadgeProps {
  status: ReviewStatus;
  className?: string;
}

const REVIEW_ICONS: Record<ReviewStatus, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  ignored: EyeOff,
  important: Flag,
};

const REVIEW_VARIANT: Record<ReviewStatus, string> = {
  pending: 'uncertain',
  confirmed: 'added',
  ignored: 'default',
  important: 'modified',
};

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: '待审查',
  confirmed: '已确认',
  ignored: '已忽略',
  important: '重要',
};

export function ReviewBadge({ status, className }: ReviewBadgeProps) {
  const Icon = REVIEW_ICONS[status];
  return (
    <Badge
      variant={REVIEW_VARIANT[status] as 'uncertain' | 'added' | 'default' | 'modified'}
      className={className}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {REVIEW_LABELS[status]}
    </Badge>
  );
}
