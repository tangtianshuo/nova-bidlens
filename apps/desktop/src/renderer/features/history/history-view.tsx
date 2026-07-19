import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Plus,
  Clock,
  ChevronRight,
  Search,
  RefreshCw,
  Trash2,
  Shield,
  ShieldOff,
  X,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../stores/app-store';
import { useResultStore } from '../../stores/result-store';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';
import type { TaskSummary, TaskStatus } from '@bidlens/shared/types-only';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'completed' | 'failed' | 'cancelled' | 'in-progress';
type SortMode = 'newest' | 'oldest' | 'name';

interface HistoryDisplayItem {
  id: string;
  displayName: string;
  docAFilename: string;
  docBFilename: string;
  status: 'completed' | 'failed' | 'cancelled' | 'in-progress';
  rawStatus: TaskStatus;
  diffSummary: string;
  reviewProgressPercent: number;
  reviewProgressText: string;
  lastAccessedAt: string;
  retained: boolean;
  startedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map TaskStatus to display status. */
function toDisplayStatus(status: TaskStatus): HistoryDisplayItem['status'] {
  if (status === 'ready') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed' || status === 'interrupted') return 'failed';
  return 'in-progress';
}

/** Format a TaskSummary.diffSummary (Record<string, number>) into a short string. */
function formatDiffSummary(summary: Record<string, number>): string {
  const labels: Record<string, string> = {
    identical: '相同',
    modified: '修改',
    added: '新增',
    deleted: '删除',
    moved: '移动',
    split: '拆分',
    merged: '合并',
    uncertain: '不确定',
  };
  const parts: string[] = [];
  for (const [key, count] of Object.entries(summary)) {
    if (count > 0 && labels[key]) {
      parts.push(`${labels[key]}:${count}`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : '无差异';
}

/** Format relative time from ISO string. */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString('zh-CN');
}

/** Convert TaskSummary to HistoryDisplayItem. */
function toDisplayItem(task: TaskSummary): HistoryDisplayItem {
  const total = task.reviewProgress.total;
  const reviewed = task.reviewProgress.reviewed;
  const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  return {
    id: task.taskId,
    displayName: task.displayName,
    docAFilename: task.docAFilename,
    docBFilename: task.docBFilename,
    status: toDisplayStatus(task.status),
    rawStatus: task.status,
    diffSummary: formatDiffSummary(task.diffSummary),
    reviewProgressPercent: percent,
    reviewProgressText: `${reviewed}/${total}`,
    lastAccessedAt: task.lastAccessedAt,
    retained: task.retained,
    startedAt: task.startedAt,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HistoryView() {
  const setView = useAppStore((s) => s.setView);
  const loadFromSnapshot = useResultStore((s) => s.loadFromSnapshot);

  // -- Data state --
  const [items, setItems] = useState<HistoryDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -- Filter/sort state --
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  // -- Dialog state --
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [relocateDialogOpen, setRelocateDialogOpen] = useState(false);
  const [relocateTargetId, setRelocateTargetId] = useState<string | null>(null);
  const [relocateError, setRelocateError] = useState<string | null>(null);

  // -- Load history from IPC --
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.bidlens.listHistory();
      const displayItems = response.tasks.map(toDisplayItem);
      setItems(displayItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // -- Filtered and sorted items --
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter (case-insensitive on displayName)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.displayName.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    // Sort
    switch (sortMode) {
      case 'newest':
        result.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime());
        break;
      case 'name':
        result.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'));
        break;
    }

    return result;
  }, [items, searchQuery, statusFilter, sortMode]);

  // -- Actions --

  /** Open a snapshot and navigate to result view. */
  const handleOpenSnapshot = useCallback(async (taskId: string) => {
    try {
      const { result, annotations } = await window.bidlens.openSnapshot({ taskId });
      // Merge annotations into the result for the store
      const resultWithAnnotations = { ...result, annotations };
      loadFromSnapshot({ result: resultWithAnnotations });
      setView('result');
    } catch (err) {
      console.error('[History] Failed to open snapshot:', err);
      setError(err instanceof Error ? err.message : '打开快照失败');
    }
  }, [loadFromSnapshot, setView]);

  /** Toggle retain status. */
  const handleToggleRetain = useCallback(async (taskId: string, currentRetained: boolean) => {
    try {
      await window.bidlens.retainTask(taskId, !currentRetained);
      setItems((prev) =>
        prev.map((item) =>
          item.id === taskId ? { ...item, retained: !currentRetained } : item
        )
      );
    } catch (err) {
      console.error('[History] Failed to toggle retain:', err);
    }
  }, []);

  /** Delete a single task. */
  const handleDelete = useCallback(async (taskId: string) => {
    try {
      await window.bidlens.deleteTask(taskId);
      setItems((prev) => prev.filter((item) => item.id !== taskId));
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
    } catch (err) {
      console.error('[History] Failed to delete task:', err);
    }
  }, []);

  /** Clear all non-retained tasks. */
  const handleClearHistory = useCallback(async () => {
    try {
      await window.bidlens.clearHistory({ type: 'all', confirm: true });
      setItems((prev) => prev.filter((item) => item.retained));
      setClearDialogOpen(false);
    } catch (err) {
      console.error('[History] Failed to clear history:', err);
    }
  }, []);

  /** Recompare: check if files exist, then trigger comparison. */
  const handleRecompare = useCallback(async (taskId: string) => {
    try {
      // Attempt recompare — the backend will check file existence
      const { taskId: newTaskId } = await window.bidlens.recompare({ taskId });
      // Start the comparison with the new task ID
      const appStore = useAppStore.getState();
      appStore.startTask(newTaskId);
      setView('processing');
    } catch (err: any) {
      // If files not found, show relocate dialog
      if (err?.code === 'FILE_NOT_FOUND' || err?.code === 'PERSISTENCE_ERROR') {
        setRelocateTargetId(taskId);
        setRelocateError(err.message || '源文件未找到');
        setRelocateDialogOpen(true);
      } else {
        console.error('[History] Failed to recompare:', err);
        setError(err instanceof Error ? err.message : '重新比对失败');
      }
    }
  }, [setView]);

  /** Relocate source files and recompare. */
  const handleRelocate = useCallback(async (newFileAPath: string, newFileBPath: string) => {
    if (!relocateTargetId) return;
    try {
      const { taskId: newTaskId } = await window.bidlens.recompare({
        taskId: relocateTargetId,
        newFileAPath,
        newFileBPath,
      });
      const appStore = useAppStore.getState();
      appStore.startTask(newTaskId);
      setView('processing');
      setRelocateDialogOpen(false);
      setRelocateTargetId(null);
      setRelocateError(null);
    } catch (err) {
      console.error('[History] Failed to recompare with relocated files:', err);
      setRelocateError(err instanceof Error ? err.message : '重新比对失败');
    }
  }, [relocateTargetId, setView]);

  /** Select files for relocation. */
  const handleSelectRelocateFiles = useCallback(async () => {
    // Select file A
    const fileA = await window.bidlens.selectFile();
    if (!fileA) return;
    // Select file B
    const fileB = await window.bidlens.selectFile();
    if (!fileB) return;
    await handleRelocate(fileA.path, fileB.path);
  }, [handleRelocate]);

  // -- Status filter label --
  const statusFilterLabel = statusFilter === 'all' ? '全部状态'
    : statusFilter === 'completed' ? '已完成'
    : statusFilter === 'failed' ? '失败'
    : statusFilter === 'cancelled' ? '已取消'
    : '进行中';

  const sortLabel = sortMode === 'newest' ? '最新优先'
    : sortMode === 'oldest' ? '最早优先'
    : '按名称';

  // -- Loading state --
  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-muted)]"
            />
          ))}
        </div>
      </div>
    );
  }

  // -- Empty state --
  if (items.length === 0 && !error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <Clock className="h-12 w-12 text-[var(--color-text-muted)]" />
        <h2 className="mt-4 text-lg font-medium text-[var(--color-text)]">
          暂无比对记录
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          完成的比对任务将显示在这里
        </p>
        <Button className="mt-4" onClick={() => setView('new')}>
          <Plus className="h-4 w-4" />
          新建比对
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6 mx-auto w-full" style={{ maxWidth: 1240 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          最近比对
        </h1>
        <Button size="sm" onClick={() => setView('new')}>
          <Plus className="h-3.5 w-3.5" />
          新建比对
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-deleted)]/30 bg-[var(--color-deleted-bg)] px-4 py-2 text-sm text-[var(--color-deleted)]">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="rounded p-0.5 hover:bg-[var(--color-deleted)]/10"
            aria-label="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: search, filter, sort */}
      <div className="mt-4 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="搜索文件名..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="清除搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Filter className="h-3.5 w-3.5" />
              {statusFilterLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              全部状态
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('completed')}>
              已完成
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('failed')}>
              失败
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('cancelled')}>
              已取消
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('in-progress')}>
              进行中
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSortMode('newest')}>
              最新优先
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortMode('oldest')}>
              最早优先
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortMode('name')}>
              按名称
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear history */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setClearDialogOpen(true)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-deleted)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          清空历史
        </Button>
      </div>

      {/* Result count */}
      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
        {filteredItems.length === items.length
          ? `共 ${items.length} 条记录`
          : `显示 ${filteredItems.length} / ${items.length} 条记录`}
      </div>

      {/* Table */}
      <div className="mt-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]" style={{ height: 38 }}>
              <th className="px-4 text-left text-[11px] font-bold text-[var(--color-text-muted)]" style={{ width: '38%' }}>
                文档对
              </th>
              <th className="px-4 text-left text-[11px] font-bold text-[var(--color-text-muted)]" style={{ width: '13%' }}>
                状态
              </th>
              <th className="px-4 text-left text-[11px] font-bold text-[var(--color-text-muted)]" style={{ width: '16%' }}>
                差异摘要
              </th>
              <th className="px-4 text-left text-[11px] font-bold text-[var(--color-text-muted)]" style={{ width: '18%' }}>
                审阅进度
              </th>
              <th className="px-4 text-left text-[11px] font-bold text-[var(--color-text-muted)]" style={{ width: '12%' }}>
                最后访问
              </th>
              <th className="px-4" style={{ width: 46 }} />
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  没有匹配的记录
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <HistoryRow
                  key={item.id}
                  item={item}
                  onOpen={() => handleOpenSnapshot(item.id)}
                  onRetain={() => handleToggleRetain(item.id, item.retained)}
                  onDelete={() => {
                    setDeleteTargetId(item.id);
                    setDeleteDialogOpen(true);
                  }}
                  onRecompare={() => handleRecompare(item.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogTitle>删除比对记录</DialogTitle>
          <DialogDescription>
            确定要删除此比对记录吗？此操作不可撤销。
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
            >
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear history confirmation dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogTitle>清空历史记录</DialogTitle>
          <DialogDescription>
            确定要清空所有未保留的比对记录吗？已标记为"保留"的记录不会被删除。此操作不可撤销。
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setClearDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClearHistory}>
              清空
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* File relocation dialog */}
      <Dialog open={relocateDialogOpen} onOpenChange={setRelocateDialogOpen}>
        <DialogContent>
          <DialogTitle>源文件未找到</DialogTitle>
          <DialogDescription>
            {relocateError || '原始比对文件已被移动或删除，请重新选择文件位置。'}
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRelocateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSelectRelocateFiles}>
              选择文件
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Row (sub-component)
// ---------------------------------------------------------------------------

interface HistoryRowProps {
  item: HistoryDisplayItem;
  onOpen: () => void;
  onRetain: () => void;
  onDelete: () => void;
  onRecompare: () => void;
}

function HistoryRow({ item, onOpen, onRetain, onDelete, onRecompare }: HistoryRowProps) {
  const statusBadgeVariant = item.status === 'completed'
    ? 'added'
    : item.status === 'failed'
    ? 'deleted'
    : 'accent';

  const statusLabel = item.status === 'completed'
    ? '完成'
    : item.status === 'failed'
    ? '失败'
    : item.status === 'cancelled'
    ? '已取消'
    : '进行中';

  return (
    <tr
      className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-subtle)]"
      style={{ height: 64 }}
    >
      {/* Document pair */}
      <td
        className="cursor-pointer px-4 py-3"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div>
            <div className="text-sm font-medium text-[var(--color-text)]">
              {item.docAFilename}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              vs {item.docBFilename}
            </div>
          </div>
          {item.retained && (
            <span title="已保留">
              <Shield className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={statusBadgeVariant} className="text-[11px] font-bold">{statusLabel}</Badge>
      </td>

      {/* Diff summary */}
      <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        {item.diffSummary}
      </td>

      {/* Review progress */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="overflow-hidden rounded-full bg-[var(--color-bg-muted)]" style={{ width: 72, height: 5 }}>
            <div
              className={cn(
                'h-full rounded-full transition-all',
                item.reviewProgressPercent === 100
                  ? 'bg-[var(--color-added)]'
                  : 'bg-[var(--color-accent)]'
              )}
              style={{ width: `${item.reviewProgressPercent}%` }}
            />
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            {item.reviewProgressText}
          </span>
        </div>
      </td>

      {/* Last accessed */}
      <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
        {formatRelativeTime(item.lastAccessedAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {/* Retain toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRetain();
            }}
            title={item.retained ? '取消保留' : '保留'}
            className={cn(
              'h-7 w-7 p-0',
              item.retained
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)]'
            )}
          >
            {item.retained ? (
              <ShieldOff className="h-3.5 w-3.5" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Recompare */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRecompare();
            }}
            title="重新比对"
            className="h-7 w-7 p-0 text-[var(--color-text-muted)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="删除"
            className="h-7 w-7 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-deleted)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {/* Open */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            title="查看"
            className="h-7 w-7 p-0 text-[var(--color-text-muted)]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
