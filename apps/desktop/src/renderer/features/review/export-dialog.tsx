/**
 * Export report dialog.
 * Matches V0.2.2 prototype: format selection (HTML/Markdown), scope options.
 */

import { useState, useCallback, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

type ExportFormat = 'html' | 'markdown';
type ExportScope = 'all' | 'current_filter' | 'important' | 'needs-confirmation';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: ExportFormat, scope: ExportScope) => Promise<void>;
}

export function ExportDialog({ open, onOpenChange, onExport }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('html');
  const [scope, setScope] = useState<ExportScope>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    try {
      await onExport(format, scope);
      onOpenChange(false);
    } catch (exportError) {
      // Cancelling the native save dialog is a normal user action, not an error.
      const message = exportError instanceof Error ? exportError.message : '';
      if (/export cancelled/i.test(message)) return;
      setError(message || '报告导出失败');
    } finally {
      setIsExporting(false);
    }
  }, [format, scope, onExport, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>导出报告</DialogTitle>
        </DialogHeader>

        <DialogBody>
        {/* Format selection */}
        <div>
          <div className="text-[11px] font-bold text-[var(--color-text-muted)] mb-2">格式</div>
          <div className="inline-flex items-center p-[3px] border border-[var(--color-border)] rounded bg-[var(--color-bg-subtle)]">
            {(['html', 'markdown'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFormat(opt)}
                className={`min-w-[68px] min-h-[30px] px-2.5 text-sm rounded-sm transition-colors ${
                  format === opt
                    ? 'bg-[var(--color-bg)] text-[var(--color-text)] font-semibold'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                {opt === 'html' ? 'HTML' : 'Markdown'}
              </button>
            ))}
          </div>
        </div>

        {/* Scope selection */}
        <div className="mt-4">
          <div className="text-[11px] font-bold text-[var(--color-text-muted)] mb-2">导出范围</div>
          <div className="grid gap-2.5">
            {([
              { value: 'all', label: '全部差异' },
              { value: 'current_filter', label: '当前筛选结果' },
              { value: 'important', label: '仅重要' },
              { value: 'needs-confirmation', label: '仅待确认' },
            ] as const).map(({ value, label }) => (
              <label
                key={value}
                className={`flex items-center gap-2.5 p-2.5 border rounded cursor-pointer transition-colors ${
                  scope === value
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text)]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger-text)]">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isExporting}>
            取消
          </Button>
          <Button onClick={() => { void handleExport(); }} disabled={isExporting}>
            <Download className="h-3.5 w-3.5" />
            {isExporting ? '正在导出...' : '导出'}
          </Button>
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
