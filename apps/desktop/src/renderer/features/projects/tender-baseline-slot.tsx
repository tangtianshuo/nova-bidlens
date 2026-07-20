import { useCallback, useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';

interface BaselineFile {
  name: string;
  format: string;
  sizeBytes: number;
}

interface TenderBaselineSlotProps {
  value: BaselineFile | null;
  onChange: (file: BaselineFile | null) => void;
  accept?: string;
}

const ACCEPT_DEFAULT = '.docx,.pdf';

export function TenderBaselineSlot({
  value,
  onChange,
  accept = ACCEPT_DEFAULT,
}: TenderBaselineSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const extractFile = useCallback(
    (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      onChange({ name: file.name, format: ext, sizeBytes: file.size });
    },
    [onChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) extractFile(file);
      // Reset so same file can be re-selected
      e.target.value = '';
    },
    [extractFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) extractFile(file);
    },
    [extractFile],
  );

  const handleRemove = useCallback(() => onChange(null), [onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text)]">
        招标基线文件
        <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">（可选）</span>
      </span>

      <div
        className={`min-h-[232px] rounded-[var(--radius)] border transition-colors ${
          dragging
            ? 'border-[var(--color-accent)] shadow-[inset_0_0_0_1px_var(--color-accent)]'
            : 'border-[var(--color-border)]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {/* Slot head */}
        <div className="flex min-h-[48px] items-center border-b border-[var(--color-border)] px-4">
          <span className="text-xs font-bold text-[var(--color-text-muted)]">
            招标文件
          </span>
        </div>

        {/* Slot content */}
        {value ? (
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-[58px] w-[48px] shrink-0 items-center justify-center rounded-[5px] border border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
              <FileText className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <div className="flex flex-col gap-0.5 overflow-hidden">
              <span className="truncate text-[15px] font-semibold text-[var(--color-text)]">
                {value.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {value.format.toUpperCase()} · {formatFileSize(value.sizeBytes)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0"
              onClick={handleRemove}
              aria-label="移除基线文件"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-4 p-5 text-left hover:bg-[var(--color-bg-hover)]"
            onClick={() => inputRef.current?.click()}
          >
            <div className="flex h-[58px] w-[48px] shrink-0 items-center justify-center rounded-[5px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]">
              <Upload className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-[var(--color-text)]">
                点击选择或拖放招标文件
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                支持 .docx, .pdf
              </span>
            </div>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {!value && (
        <Alert variant="warning">
          <AlertDescription>
            未选择招标基线文件，误报风险较高
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
