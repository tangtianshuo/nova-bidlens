import { useState, useCallback } from 'react';
import { ArrowLeftRight, Check, FileText, Settings2, Trash2, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../stores/app-store';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/icon-button';
import { FieldError } from '../../components/feedback';

interface FileSlot {
  path: string | null;
  name: string | null;
  size: number | null;
  format: string | null;
  error: string | null;
}

export function NewCompareView() {
  const startTask = useAppStore((s) => s.startTask);
  const [baseline, setBaseline] = useState<FileSlot>({
    path: null,
    name: null,
    size: null,
    format: null,
    error: null,
  });
  const [review, setReview] = useState<FileSlot>({
    path: null,
    name: null,
    size: null,
    format: null,
    error: null,
  });
  const [sensitivity, setSensitivity] = useState<'strict' | 'standard' | 'loose'>('standard');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const clearSlot = useCallback((slot: 'baseline' | 'review') => {
    const empty: FileSlot = { path: null, name: null, size: null, format: null, error: null };
    if (slot === 'baseline') setBaseline(empty);
    else setReview(empty);
  }, []);

  const selectFile = useCallback(async (slot: 'baseline' | 'review') => {
    try {
      const result = await window.bidlens.selectFile();
      if (result) {
        const fileSlot: FileSlot = {
          path: result.path,
          name: result.name,
          size: result.size,
          format: result.format,
          error: null,
        };
        if (slot === 'baseline') {
          setBaseline(fileSlot);
        } else {
          setReview(fileSlot);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : '文件选择失败';
      if (slot === 'baseline') {
        setBaseline((prev) => ({ ...prev, error }));
      } else {
        setReview((prev) => ({ ...prev, error }));
      }
    }
  }, []);

  const handleSwap = useCallback(() => {
    setBaseline(review);
    setReview(baseline);
  }, [baseline, review]);

  const canStart = baseline.path && review.path && !baseline.error && !review.error;

  const handleStart = useCallback(async () => {
    if (!canStart || !baseline.path || !review.path || isStarting) return;

    setIsStarting(true);
    try {
      const validation = await window.bidlens.validateFiles({
        fileAPath: baseline.path,
        fileBPath: review.path,
      });

      if (validation.fileA.error || !validation.fileA.supported) {
        setBaseline((current) => ({
          ...current,
          error: validation.fileA.error?.message ?? '不支持该文件格式',
        }));
        return;
      }
      if (validation.fileB.error || !validation.fileB.supported) {
        setReview((current) => ({
          ...current,
          error: validation.fileB.error?.message ?? '不支持该文件格式',
        }));
        return;
      }

      const { taskId } = await window.bidlens.startCompare({
        fileAPath: baseline.path,
        fileBPath: review.path,
        options: { sensitivity },
      });
      startTask(taskId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法启动比对任务';
      setReview((current) => ({ ...current, error: message }));
    } finally {
      setIsStarting(false);
    }
  }, [baseline.path, canStart, isStarting, review.path, sensitivity, startTask]);

  return (
    <div className="flex flex-1 overflow-auto">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">新建比对</h1>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">文档内容仅在本机处理</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-stretch gap-4">
          {/* Baseline slot */}
          <FileSlotCard
            label="基准文档"
            slot={baseline}
            onSelect={() => selectFile('baseline')}
            onClear={() => clearSlot('baseline')}
          />

          {/* Swap button */}
          <div className="flex items-center pt-8">
            <IconButton
              icon={<ArrowLeftRight className="h-4 w-4" />}
              tooltip="交换文档"
              onClick={handleSwap}
              aria-label="交换基准和审查文档"
            />
          </div>

          {/* Review slot */}
          <FileSlotCard
            label="审查文档"
            slot={review}
            onSelect={() => selectFile('review')}
            onClear={() => clearSlot('review')}
          />
        </div>

        <div className="mt-4 border-y border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="mr-1 font-semibold text-[var(--color-text-secondary)]">检测维度</span>
            {['正文', '表格', '格式', '批注', '修订'].map((dimension) => (
              <span key={dimension} className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-text-secondary)]">
                <Check className="h-3 w-3 text-[var(--color-added)]" />{dimension}
              </span>
            ))}
          </div>
        </div>

        {/* Advanced settings */}
        <div className="mt-5 border-b border-[var(--color-border)] pb-3">
          <button
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            高级设置
          </button>
          {showAdvanced && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div><strong className="block text-sm text-[var(--color-text)]">匹配灵敏度</strong><span className="text-xs text-[var(--color-text-muted)]">标准适用于结构相近但措辞可能调整的文档</span></div>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value as typeof sensitivity)}
                className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]/20"
              >
                <option value="strict">严格</option>
                <option value="standard">标准</option>
                <option value="loose">宽松</option>
              </select>
            </div>
          )}
        </div>

        {/* Start button */}
        <div className="mt-auto flex items-center gap-4 pt-6">
          <span className="mr-auto text-xs text-[var(--color-text-muted)]">{canStart ? '两份文档已就绪' : '请选择两份文档'}</span>
          <Button
            size="lg"
            className="min-w-40"
            disabled={!canStart || isStarting}
            onClick={handleStart}
          >
            {isStarting ? '正在启动...' : '开始比对'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface FileSlotCardProps {
  label: string;
  slot: FileSlot;
  onSelect: () => void;
  onClear: () => void;
}

function FileSlotCard({ label, slot, onSelect, onClear }: FileSlotCardProps) {
  const hasFile = slot.path !== null;

  return (
    <article className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="flex min-h-12 items-center justify-between border-b border-[var(--color-border)] px-4">
        <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span>
        {hasFile && <button onClick={onClear} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)]" aria-label={`移除${label}`}><Trash2 className="h-4 w-4" /></button>}
      </div>
      <button
        onClick={onSelect}
        className={cn(
          'flex min-h-44 w-full items-center gap-4 p-5 text-left transition-colors',
          hasFile
            ? 'border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]'
            : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)]/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
        )}
        aria-label={hasFile ? `已选择: ${slot.name}` : `选择${label}`}
      >
        {hasFile ? (
          <>
            <FileText className="h-8 w-8 text-[var(--color-text-muted)]" />
            <div className="w-full truncate text-sm font-medium text-[var(--color-text)]">
              {slot.name}
            </div>
            <div className="flex items-center gap-2">
              {slot.format && (
                <Badge variant="default">{slot.format}</Badge>
              )}
              {slot.size && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {formatFileSize(slot.size)}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 shrink-0 text-[var(--color-text-muted)]" />
            <span><strong className="block text-sm text-[var(--color-text)]">点击选择文件</strong><span className="mt-1 block text-xs text-[var(--color-text-muted)]">支持 .docx 和 .pdf 格式</span></span>
          </>
        )}
      </button>
      {slot.error && <FieldError message={slot.error} className="px-4 pb-3" />}
    </article>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
