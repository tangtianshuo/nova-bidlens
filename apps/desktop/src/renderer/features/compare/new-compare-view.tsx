import { useState, useCallback } from 'react';
import { ArrowLeftRight, Check, FileText, Settings2, Trash2, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../stores/app-store';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { SimpleTooltip } from '../../components/ui/tooltip';
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

  const handleDropFile = useCallback((slot: 'baseline' | 'review') => (file: File) => {
    // Electron adds path property to File objects
    const filePath = (file as File & { path?: string }).path;
    if (!filePath) return;
    const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
    const fileSlot: FileSlot = {
      path: filePath,
      name: file.name,
      size: file.size,
      format: ext,
      error: null,
    };
    if (slot === 'baseline') setBaseline(fileSlot);
    else setReview(fileSlot);
  }, []);

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
      <div className="app-page flex min-h-full flex-col" data-width="narrow">
        <div className="mb-[var(--layout-section-gap)]">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">新建比对</h1>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">文档内容仅在本机处理</p>
        </div>
        <div className="responsive-file-grid">
          {/* Baseline slot */}
          <FileSlotCard
            label="基准文档"
            slot={baseline}
            onSelect={() => selectFile('baseline')}
            onClear={() => clearSlot('baseline')}
            onDropFile={handleDropFile('baseline')}
          />

          {/* Swap button */}
          <div className="file-swap flex items-center pt-8">
            <SimpleTooltip content="交换文档">
              <Button
                variant="secondary"
                size="icon"
                onClick={handleSwap}
                aria-label="交换基准和审查文档"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          </div>

          {/* Review slot */}
          <FileSlotCard
            label="审查文档"
            slot={review}
            onSelect={() => selectFile('review')}
            onClear={() => clearSlot('review')}
            onDropFile={handleDropFile('review')}
          />
        </div>

        <div className="mt-[var(--layout-panel)] border-y border-[var(--color-border)] px-[var(--layout-panel)] py-3" style={{ background: 'color-mix(in srgb, var(--color-bg) 72%, transparent)' }}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="mr-1 font-semibold text-[var(--color-text-secondary)]">检测维度</span>
            {['正文', '表格', '格式', '批注', '修订'].map((dimension) => (
              <span key={dimension} className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--color-added-border)] bg-[var(--color-added-bg)] px-2 py-0.5 text-[var(--color-added)]" style={{ minHeight: 26, fontSize: 12 }}>
                <Check className="h-3 w-3" />{dimension}
              </span>
            ))}
          </div>
        </div>

        {/* Advanced settings */}
        <div className="mt-[var(--layout-section-gap)] border-b border-[var(--color-border)] pb-3">
          <button
            className="flex w-full items-center gap-1.5 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-pointer"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            高级设置
          </button>
          {showAdvanced && (
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-1">
              <div><strong className="block text-sm text-[var(--color-text)]">匹配灵敏度</strong><span className="text-xs text-[var(--color-text-muted)]">标准适用于结构相近但措辞可能调整的文档</span></div>
              <div className="inline-flex items-center p-[3px] border border-[var(--color-border)] rounded-[5px] bg-[var(--color-bg-subtle)]">
                {(['strict', 'standard', 'loose'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSensitivity(opt)}
                    className={cn(
                      'min-w-[68px] min-h-[30px] px-2.5 text-sm rounded transition-colors cursor-pointer',
                      sensitivity === opt
                        ? 'bg-[var(--color-bg)] text-[var(--color-text)] font-semibold shadow-sm'
                        : 'text-[var(--color-text-secondary)]'
                    )}
                  >
                    {opt === 'strict' ? '严格' : opt === 'standard' ? '标准' : '宽松'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Start button */}
        <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-[var(--layout-section-gap)]">
          <span className="mr-auto text-xs text-[var(--color-text-muted)]">{canStart ? '两份文档已就绪' : '请选择两份文档'}</span>
          <Button
            variant="primary"
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
  onDropFile?: (file: File) => void;
}

function FileSlotCard({ label, slot, onSelect, onClear, onDropFile }: FileSlotCardProps) {
  const hasFile = slot.path !== null;
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && onDropFile) {
      onDropFile(file);
    }
  }, [onDropFile]);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[var(--radius-sm)] border bg-[var(--color-bg)]',
        dragging
          ? 'border-[var(--color-accent)]'
          : 'border-[var(--color-border)]'
      )}
      style={dragging ? { boxShadow: 'inset 0 0 0 1px var(--color-accent)' } : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex min-h-12 items-center justify-between border-b border-[var(--color-border)] px-[var(--layout-panel)]">
        <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span>
        {hasFile && <button onClick={onClear} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)]" aria-label={`移除${label}`}><Trash2 className="h-4 w-4" /></button>}
      </div>
      <button
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3.5 p-[var(--layout-panel)] text-left transition-colors cursor-pointer',
          hasFile
            ? 'bg-[var(--color-bg-subtle)]'
            : 'hover:bg-[var(--color-bg-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
        )}
        style={{ minHeight: 'clamp(176px, 26vh, 232px)' }}
        aria-label={hasFile ? `已选择: ${slot.name}` : `选择${label}`}
      >
        {hasFile ? (
          <>
            <div className="flex-shrink-0 grid place-items-center rounded-[5px] border border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]" style={{ width: 48, height: 58 }}>
              <FileText className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-[var(--color-text)]">
                {slot.name}
              </div>
              <div className="mt-1 flex items-center gap-2">
                {slot.format && (
                  <Badge variant="default">{slot.format}</Badge>
                )}
                {slot.size && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatFileSize(slot.size)}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 shrink-0 text-[var(--color-text-muted)]" />
            <span><strong className="block text-sm text-[var(--color-text)]">点击选择文件</strong><span className="mt-1 block text-xs text-[var(--color-text-muted)]">支持 .docx 和 .pdf 格式</span></span>
          </>
        )}
      </button>
      {slot.error && <FieldError message={slot.error} className="px-[var(--layout-panel)] pb-3" />}
    </article>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
