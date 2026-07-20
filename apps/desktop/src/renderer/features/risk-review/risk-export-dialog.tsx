import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Download, AlertTriangle, FileText, Code, FileDown } from 'lucide-react';

type ExportFormat = 'pdf' | 'html' | 'markdown';
type ExportScope = 'full' | 'confirmed' | 'important';

interface RiskExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport?: (format: ExportFormat, scope: ExportScope) => void;
  projectStatus: 'ready' | 'partial' | 'degraded';
  totalFindings: number;
  confirmedFindings: number;
  importantFindings: number;
}

export function RiskExportDialog({
  isOpen,
  onClose,
  onExport,
  projectStatus,
  totalFindings,
  confirmedFindings,
  importantFindings,
}: RiskExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scope, setScope] = useState<ExportScope>('full');

  const handleExport = useCallback(() => {
    onExport?.(format, scope);
  }, [format, scope, onExport]);

  if (!isOpen) return null;

  const isPartial = projectStatus === 'partial';
  const isDegraded = projectStatus === 'degraded';
  const scopeCount =
    scope === 'full' ? totalFindings :
    scope === 'confirmed' ? confirmedFindings :
    importantFindings;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="导出报告"
        className="mx-4 w-full max-w-lg rounded-[var(--radius-lg)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-overlay)]"
      >
        <h2 className="text-lg font-semibold text-[var(--color-text)]">导出报告</h2>

        {/* Status warnings */}
        {(isPartial || isDegraded) && (
          <Alert variant="default" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {isPartial ? '分析结果不完整，报告可能缺少部分检测数据。' : ''}
              {isDegraded ? '分析以降级模式完成，报告精确度可能降低。' : ''}
            </span>
          </Alert>
        )}

        {/* Format selection */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">导出格式</h3>
          <div className="flex gap-2">
            {([
              { id: 'pdf' as const, label: 'PDF', icon: FileDown },
              { id: 'html' as const, label: 'HTML', icon: Code },
              { id: 'markdown' as const, label: 'Markdown', icon: FileText },
            ]).map(({ id, label, icon: Icon }) => (
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
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">导出范围</h3>
          <div className="flex flex-col gap-1.5">
            {([
              { id: 'full' as const, label: '全部发现项', count: totalFindings },
              { id: 'confirmed' as const, label: '已确认', count: confirmedFindings },
              { id: 'important' as const, label: '标记重要', count: importantFindings },
            ]).map(({ id, label, count }) => (
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
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            导出 {scopeCount} 项
          </Button>
        </div>
      </div>
    </div>
  );
}
