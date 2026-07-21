import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Code, FileDown, FolderOpen, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { ReportFormat, ReportScope } from '@bidlens/shared/types-only';
import type { FindingCounts } from './risk-result-queries';

interface ReportExportPanelProps {
  projectId: string;
  counts: FindingCounts;
  filteredCount: number;
}

const FORMAT_OPTIONS: { id: ReportFormat; label: string; icon: typeof FileDown }[] = [
  { id: 'pdf', label: 'PDF', icon: FileDown },
  { id: 'html', label: 'HTML', icon: Code },
  { id: 'markdown', label: 'Markdown', icon: FileText },
];

const SCOPE_OPTIONS: { id: ReportScope; label: string; countKey: keyof FindingCounts | 'filtered' }[] = [
  { id: 'all', label: '全部发现项', countKey: 'total' },
  { id: 'confirmed', label: '已确认', countKey: 'confirmed' },
  { id: 'important', label: '标记重要', countKey: 'important' },
  { id: 'filtered', label: '筛选结果', countKey: 'filtered' },
];

export function ReportExportPanel({ projectId, counts, filteredCount }: ReportExportPanelProps) {
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [scope, setScope] = useState<ReportScope>('all');
  const [exporting, setExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);

  const scopeCount =
    scope === 'filtered' ? filteredCount :
    scope === 'all' ? counts.total :
    (counts as unknown as Record<string, number>)[scope];

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportedPath(null);
    try {
      const result = await window.bidlens.exportRiskReport({ projectId, format, scope });
      setExportedPath(result.filePath);
      toast.success('报告导出成功');
    } catch (err) {
      toast.error('导出失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setExporting(false);
    }
  }, [projectId, format, scope]);

  const handleOpenFile = useCallback(() => {
    if (exportedPath) void window.bidlens.openExportedFile(exportedPath);
  }, [exportedPath]);

  const handleOpenFolder = useCallback(() => {
    if (exportedPath) void window.bidlens.openExportFolder(exportedPath);
  }, [exportedPath]);

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Format selection */}
      <div>
        <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">导出格式</h3>
        <div className="flex gap-2">
          {FORMAT_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFormat(id)}
              className={`flex items-center gap-1.5 rounded-[var(--radius)] border px-3 py-2 text-xs transition-colors ${
                format === id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope selection */}
      <div>
        <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">导出范围</h3>
        <div className="flex flex-col gap-1.5">
          {SCOPE_OPTIONS.map(({ id, label, countKey }) => {
            const count = countKey === 'filtered' ? filteredCount : (counts as unknown as Record<string, number>)[countKey];
            return (
              <button
                key={id}
                onClick={() => setScope(id)}
                className={`flex items-center justify-between rounded-[var(--radius)] border px-3 py-2 text-xs transition-colors ${
                  scope === id
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <span className={scope === id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
                  {label}
                </span>
                <Badge variant="default" className="text-[10px]">{count}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Export button */}
      <Button
        variant="primary"
        size="sm"
        onClick={() => void handleExport()}
        disabled={exporting || scopeCount === 0}
        className="w-full"
      >
        <Download className="h-3.5 w-3.5" />
        {exporting ? '导出中...' : `导出 ${scopeCount} 项`}
      </Button>

      {/* Post-export actions */}
      {exportedPath && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleOpenFile} className="flex-1">
            <ExternalLink className="h-3.5 w-3.5" />
            打开文件
          </Button>
          <Button variant="secondary" size="sm" onClick={handleOpenFolder} className="flex-1">
            <FolderOpen className="h-3.5 w-3.5" />
            打开文件夹
          </Button>
        </div>
      )}
    </div>
  );
}
