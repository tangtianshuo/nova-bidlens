import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  RotateCcw,
  Play,
  XCircle,
  AlertTriangle,
  Download,
  WifiOff,
  Cpu,
} from 'lucide-react';
import type { AnalysisProjectStatus } from '../../__fixtures__/risk-project';

// ─── Types ──────────────────────────────────────────────────────────

export type RecoveryAction = 'retry' | 'resume' | 'accept-partial' | 'cancel';

export interface AnalysisRecoveryActionsProps {
  status: AnalysisProjectStatus;
  degradationReason: string | null;
  warnings: string[];
  onAction?: (action: RecoveryAction) => void;
  hasPartialResults?: boolean;
  elapsedMs?: number;
}

// ─── Degradation reason metadata ────────────────────────────────────

interface DegradationInfo {
  icon: typeof Cpu;
  title: string;
  description: string;
  severity: 'warning' | 'error';
}

const DEGRADATION_MAP: Record<string, DegradationInfo> = {
  model_unavailable: {
    icon: Cpu,
    title: '本地模型不可用',
    description: '本地 Embedding 模型未找到或加载失败，已自动切换到传统匹配模式。结果精确度可能降低，但核心雷同检测仍可使用。',
    severity: 'warning',
  },
  network_error: {
    icon: WifiOff,
    title: '网络异常',
    description: '部分需要网络的功能不可用，本地分析正常进行。',
    severity: 'warning',
  },
  memory_pressure: {
    icon: AlertTriangle,
    title: '内存不足',
    description: '系统可用内存不足，已降低批处理大小。分析速度可能变慢。',
    severity: 'warning',
  },
  user_accepted_partial: {
    icon: Download,
    title: '部分结果已接受',
    description: '分析未完成，已接受当前部分结果。可随时重新运行完整分析。',
    severity: 'warning',
  },
};

function getDegradationInfo(reason: string | null): DegradationInfo | null {
  if (!reason) return null;
  return (
    DEGRADATION_MAP[reason] ?? {
      icon: AlertTriangle,
      title: '降级运行',
      description: '分析以降级模式完成，部分功能可能受限。',
      severity: 'warning',
    }
  );
}

// ─── Component ──────────────────────────────────────────────────────

export function AnalysisRecoveryActions({
  status,
  degradationReason,
  warnings,
  onAction,
  hasPartialResults = false,
  elapsedMs = 0,
}: AnalysisRecoveryActionsProps) {
  const handleRetry = useCallback(() => onAction?.('retry'), [onAction]);
  const handleResume = useCallback(() => onAction?.('resume'), [onAction]);
  const handleAcceptPartial = useCallback(
    () => onAction?.('accept-partial'),
    [onAction],
  );
  const handleCancel = useCallback(() => onAction?.('cancel'), [onAction]);

  const degradation = getDegradationInfo(degradationReason);
  const isFailed = status === 'failed';
  const isInterrupted = status === 'interrupted';
  const isPartial = status === 'partial';
  const isDegraded = degradationReason !== null && status === 'ready';

  // Nothing to show for non-terminal states
  if (!isFailed && !isInterrupted && !isPartial && !isDegraded) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="分析恢复操作">
      {/* Degradation banner */}
      {isDegraded && degradation && (
        <Alert variant={degradation.severity === 'error' ? 'destructive' : 'default'}>
          <degradation.icon className="h-4 w-4" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{degradation.title}</span>
            <span className="text-xs">{degradation.description}</span>
          </div>
        </Alert>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="rounded-[var(--radius)] border border-[var(--color-danger)] bg-[var(--color-danger)]/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <p className="text-sm font-medium text-[var(--color-danger)]">
                  分析失败
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  分析过程中出现错误，已处理的检查点已保留。
                  {elapsedMs > 0 && ` 已用时 ${formatElapsed(elapsedMs)}。`}
                </p>
              </div>

              {warnings.length > 0 && (
                <div className="flex flex-col gap-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-[var(--color-text-muted)]">
                      · {w}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleRetry}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  重试分析
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCancel}>
                  返回项目列表
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interrupted state */}
      {isInterrupted && (
        <div className="rounded-[var(--radius)] border border-[var(--color-modified)] bg-[var(--color-modified)]/5 p-4">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-modified)]" />
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <p className="text-sm font-medium text-[var(--color-modified)]">
                  分析已中断
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  分析过程被取消或中断，可从最近检查点恢复。
                  {elapsedMs > 0 && ` 已用时 ${formatElapsed(elapsedMs)}。`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleResume}>
                  <Play className="h-3.5 w-3.5" />
                  恢复分析
                </Button>
                <Button variant="secondary" size="sm" onClick={handleRetry}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  重新开始
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCancel}>
                  返回项目列表
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partial results state */}
      {isPartial && (
        <div className="rounded-[var(--radius)] border border-[var(--color-modified)] bg-[var(--color-modified)]/5 p-4">
          <div className="flex items-start gap-2">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-modified)]" />
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--color-modified)]">
                    部分结果可用
                  </p>
                  <Badge variant="default" className="text-[10px]">不完整</Badge>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  分析未完成，当前结果可能不完整。您可以查看已有结果或重新运行完整分析。
                </p>
              </div>

              <div className="flex items-center gap-2">
                {hasPartialResults && (
                  <Button variant="primary" size="sm" onClick={handleAcceptPartial}>
                    <Download className="h-3.5 w-3.5" />
                    查看部分结果
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={handleRetry}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  重新分析
                </Button>
                <Button variant="secondary" size="sm" onClick={handleResume}>
                  <Play className="h-3.5 w-3.5" />
                  继续分析
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}
