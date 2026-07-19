import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, Check, Clock, FileText, Loader2, XCircle, RefreshCw, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../stores/app-store';
import { useResultStore } from '../../stores/result-store';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/feedback';
import { WarningBanner } from '../../components/feedback';

type StageStatus = 'completed' | 'current' | 'pending' | 'error';

interface Stage {
  id: string;
  label: string;
  description: string;
  status: StageStatus;
}

export function ProcessingView() {
  const { taskId, completeTask, cancelTask } = useAppStore();
  const loadResult = useResultStore((state) => state.loadResult);
  const completingRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [stages, setStages] = useState<Stage[]>([
    { id: 'validating', label: '文件校验', description: '检查格式、大小与读取权限', status: 'current' },
    { id: 'parsing_baseline', label: '解析基准文档', description: '提取正文、表格、格式、批注与修订', status: 'pending' },
    { id: 'parsing_review', label: '解析待审文档', description: '构建统一文档结构', status: 'pending' },
    { id: 'comparing', label: '执行比对', description: '匹配结构并计算差异', status: 'pending' },
    { id: 'finalizing', label: '整理结果', description: '生成审核索引并保存本地快照', status: 'pending' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to real task progress from the main process.
  useEffect(() => {
    if (!taskId) return;

    const stageOrder = ['validating', 'parsing_baseline', 'parsing_review', 'comparing', 'finalizing'];
    return window.bidlens.onCompareProgress((progress) => {
      if (progress.taskId !== taskId) return;

      const currentIndex = stageOrder.indexOf(progress.phase);
      setElapsed(Math.floor(progress.elapsedMs / 1000));
      setWarnings(progress.warnings);
      setStages((current) => current.map((stage, index) => ({
        ...stage,
        status: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'pending',
      })));

      const progressWithError = progress as typeof progress & { error?: { message: string } };
      if (progressWithError.error) {
        setError(progressWithError.error.message);
        return;
      }

      if (
        progress.phase === 'finalizing' &&
        progress.stageLabel === '比对完成' &&
        !completingRef.current
      ) {
        completingRef.current = true;
        void window.bidlens.getCompareResult(taskId)
          .then((result) => {
            loadResult(result);
            setStages((current) => current.map((stage) => ({ ...stage, status: 'completed' })));
            completeTask(taskId);
          })
          .catch((err: unknown) => {
            completingRef.current = false;
            setError(err instanceof Error ? err.message : '读取比对结果失败');
          });
      }
    });
  }, [completeTask, loadResult, taskId]);

  const handleRetry = useCallback(() => {
    setError(null);
    setElapsed(0);
    setStages((prev) =>
      prev.map((s, i) => ({
        ...s,
        status: i === 0 ? 'current' : 'pending',
      }))
    );
  }, []);

  const handleCancel = useCallback(async () => {
    if (!taskId) return;
    try {
      await window.bidlens.cancelCompare(taskId);
    } finally {
      cancelTask();
    }
  }, [cancelTask, taskId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-deleted)]/30 bg-[var(--color-deleted-bg)] p-6 text-center">
            <XCircle className="mx-auto h-10 w-10 text-[var(--color-deleted)]" />
            <h2 className="mt-3 text-sm font-medium text-[var(--color-text)]">
              比对失败
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {error}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="secondary" size="sm" onClick={cancelTask}>
                返回
              </Button>
              <Button size="sm" onClick={handleRetry}>
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full" style={{ maxWidth: 820 }}>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">正在比对</h1>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">标准灵敏度</p>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-[var(--color-border)] text-sm" style={{ gap: 14, padding: '14px 0 18px' }}>
          <div className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 text-[var(--color-text-muted)]" /><div className="min-w-0"><strong className="block truncate">基准文档</strong><span className="text-xs text-[var(--color-text-muted)]">等待文件信息</span></div></div>
          <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 text-[var(--color-text-muted)]" /><div className="min-w-0"><strong className="block truncate">待审文档</strong><span className="text-xs text-[var(--color-text-muted)]">等待文件信息</span></div></div>
        </div>

        <ol className="mt-5 border-t border-[var(--color-border)]" style={{ marginTop: 22 }}>
          {stages.map((stage) => (
            <li
              key={stage.id}
              className={cn(
                'grid items-center border-b border-[var(--color-border)] px-1 transition-colors',
                stage.status === 'current' && 'bg-[var(--color-accent-soft)]/50'
              )}
              style={{ minHeight: 66, gridTemplateColumns: '28px minmax(0,1fr) auto', gap: 12 }}
            >
              {stage.status === 'completed' ? (
                <div className="grid h-6 w-6 place-items-center rounded-full border border-[var(--color-added-border)] bg-[var(--color-added-bg)]">
                  <Check className="h-3.5 w-3.5 text-[var(--color-added)]" />
                </div>
              ) : stage.status === 'current' ? (
                <div className="grid h-6 w-6 place-items-center rounded-full border border-[var(--color-accent)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]" />
                </div>
              ) : (
                <div className="grid h-6 w-6 place-items-center rounded-full border border-[var(--color-border-strong)] text-xs text-[var(--color-text-muted)]">{stages.indexOf(stage) + 1}</div>
              )}
              <span
                className={cn(
                  'text-sm',
                  stage.status === 'completed' && 'text-[var(--color-text-muted)]',
                  stage.status === 'current' && 'font-medium text-[var(--color-text)]',
                  stage.status === 'pending' && 'text-[var(--color-text-muted)]'
                )}
              >
                <span className="block">{stage.label}</span><span className="mt-0.5 block text-xs font-normal text-[var(--color-text-muted)]">{stage.description}</span>
              </span>
              <span className={cn('text-xs text-[var(--color-text-muted)]', stage.status === 'current' && 'text-[var(--color-accent)]')}>{stage.status === 'current' ? '处理中' : stage.status === 'completed' ? '完成' : '等待'}</span>
            </li>
          ))}
        </ol>

        {warnings.length > 0 && (
          <div className="mt-4">
            <WarningBanner title="处理警告" details={warnings.join('\n')} />
          </div>
        )}

        <div className="flex items-center justify-between" style={{ marginTop: 20 }}>
          <span className="flex items-center text-xs text-[var(--color-text-secondary)]" style={{ gap: 7 }}><Clock className="h-4 w-4" />已用时间 <strong>{formatTime(elapsed)}</strong></span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelDialogOpen(true)}
            className="text-[var(--color-danger)]"
          >
            <X className="h-3.5 w-3.5" />
            取消比对
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="取消比对"
        description="确定要取消当前比对任务吗？已处理的进度将丢失。"
        confirmLabel="取消比对"
        cancelLabel="继续比对"
        variant="destructive"
        onConfirm={() => { void handleCancel(); }}
      />
    </div>
  );
}
