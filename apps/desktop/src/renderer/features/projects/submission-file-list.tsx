import { useState, useCallback, useMemo, useRef } from 'react';
import { AlertCircle, FileText, X, Upload, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

// ─── Types ──────────────────────────────────────────────────────────

export interface SubmissionFile {
  path?: string;
  id: string;
  name: string;
  format: 'docx' | 'pdf' | 'nzbtf';
  sizeBytes: number;
  pageCount: number | null;
  sha256: string;
}

export interface SubmissionFileListProps {
  files: SubmissionFile[];
  onChange: (files: SubmissionFile[]) => void;
  minFiles?: number;
  maxFiles?: number;
  maxTotalSizeBytes?: number;
  maxSingleSizeBytes?: number;
}

export interface FileValidationError {
  type: 'duplicate' | 'count' | 'format' | 'size' | 'total_size' | 'page_count';
  message: string;
  fileId?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_MIN_FILES = 2;
const DEFAULT_MAX_FILES = 8;
const DEFAULT_MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB
const DEFAULT_MAX_SINGLE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PAGE_COUNT = 1000;
const MAX_PROJECT_PAGES = 4000;
const ALLOWED_FORMATS: Array<'docx' | 'pdf' | 'nzbtf'> = ['docx', 'pdf', 'nzbtf'];

// ─── Helpers ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectDuplicates(files: SubmissionFile[]): Map<string, string[]> {
  const shaMap = new Map<string, string[]>();
  for (const f of files) {
    const existing = shaMap.get(f.sha256) ?? [];
    existing.push(f.id);
    shaMap.set(f.sha256, existing);
  }
  const dupes = new Map<string, string[]>();
  for (const [sha, ids] of shaMap) {
    if (ids.length > 1) {
      for (const id of ids) {
        dupes.set(id, ids.filter((i) => i !== id));
      }
    }
  }
  return dupes;
}

export function validateFiles(
  files: SubmissionFile[],
  minFiles = DEFAULT_MIN_FILES,
  maxFiles = DEFAULT_MAX_FILES,
  maxTotalSize = DEFAULT_MAX_TOTAL_SIZE,
  maxSingleSize = DEFAULT_MAX_SINGLE_SIZE,
): FileValidationError[] {
  const errors: FileValidationError[] = [];

  // Count check
  if (files.length > maxFiles) {
    errors.push({
      type: 'count',
      message: `最多上传 ${maxFiles} 个文件，当前 ${files.length} 个`,
    });
  }

  if (files.length > 0 && files.length < minFiles) {
    errors.push({
      type: 'count',
      message: `至少需要 ${minFiles} 个投标文件`,
    });
  }

  // Format and size per file
  for (const f of files) {
    if (!ALLOWED_FORMATS.includes(f.format)) {
      errors.push({
        type: 'format',
        message: `${f.name}：不支持的格式（仅支持 .docx、.pdf 和 .nzbtf）`,
        fileId: f.id,
      });
    }
    if (f.sizeBytes > maxSingleSize) {
      errors.push({
        type: 'size',
        message: `${f.name}：文件过大（${formatBytes(f.sizeBytes)}，上限 ${formatBytes(maxSingleSize)}）`,
        fileId: f.id,
      });
    }
    if (f.pageCount !== null && f.pageCount > MAX_PAGE_COUNT) {
      errors.push({
        type: 'page_count',
        message: `${f.name}：页数超限（${f.pageCount} 页，上限 ${MAX_PAGE_COUNT} 页）`,
        fileId: f.id,
      });
    }
  }

  // Total size
  const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  if (totalSize > maxTotalSize) {
    errors.push({
      type: 'total_size',
      message: `累计文件大小超限（${formatBytes(totalSize)}，上限 ${formatBytes(maxTotalSize)}）`,
    });
  }

  // Total pages
  const totalPages = files.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);
  if (totalPages > MAX_PROJECT_PAGES) {
    errors.push({
      type: 'page_count',
      message: `累计页数超限（${totalPages} 页，上限 ${MAX_PROJECT_PAGES} 页）`,
    });
  }

  // Duplicate hash
  const dupes = detectDuplicates(files);
  for (const [fileId, relatedIds] of dupes) {
    const f = files.find((x) => x.id === fileId);
    const related = relatedIds.map((id) => files.find((x) => x.id === id)?.name ?? id);
    if (f) {
      errors.push({
        type: 'duplicate',
        message: `${f.name}：与 ${related.join('、')} 文件内容重复`,
        fileId,
      });
    }
  }

  return errors;
}

// ─── Component ──────────────────────────────────────────────────────

export function SubmissionFileList({
  files,
  onChange,
  minFiles = DEFAULT_MIN_FILES,
  maxFiles = DEFAULT_MAX_FILES,
  maxTotalSizeBytes = DEFAULT_MAX_TOTAL_SIZE,
  maxSingleSizeBytes = DEFAULT_MAX_SINGLE_SIZE,
}: SubmissionFileListProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(
    () => validateFiles(files, minFiles, maxFiles, maxTotalSizeBytes, maxSingleSizeBytes),
    [files, minFiles, maxFiles, maxTotalSizeBytes, maxSingleSizeBytes],
  );

  const blockingErrors = errors.filter(
    (e) => e.type !== 'duplicate' || files.length > 1,
  );

  const canAddMore = files.length < maxFiles;

  const handleRemove = useCallback(
    (fileId: string) => {
      onChange(files.filter((f) => f.id !== fileId));
    },
    [files, onChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const addFilesFromList = useCallback(
    (fileList: FileList) => {
      const incoming: SubmissionFile[] = [];
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (ext !== 'docx' && ext !== 'pdf' && ext !== 'nzbtf') continue;
        // Electron 28+ deprecated File.path; use webUtils.getPathForFile() via preload
        const filePath = window.bidlens.getFilePath(file);
        const format = ext as 'docx' | 'pdf' | 'nzbtf';
        incoming.push({
          id: crypto.randomUUID(),
          path: filePath,
          name: file.name,
          format,
          sizeBytes: file.size,
          pageCount: null,
          sha256: filePath, // ponytail: path as proxy, real sha256 computed server-side during validation
        });
      }
      if (incoming.length > 0) {
        const remaining = maxFiles - files.length;
        onChange([...files, ...incoming.slice(0, remaining)]);
      }
    },
    [files, onChange, maxFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFilesFromList(e.dataTransfer.files);
      }
    },
    [addFilesFromList],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFilesFromList(e.target.files);
      e.target.value = '';
    },
    [addFilesFromList],
  );

  const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text)]">
          投标文件
          <span className="ml-1 text-xs text-[var(--color-danger)]">*</span>
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {files.length}/{maxFiles} 个文件 · {formatBytes(totalSize)}
        </span>
      </div>

      {/* Drop zone / file list */}
      <div
        role="region"
        aria-label="投标文件列表"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex min-h-[160px] flex-col gap-1.5 rounded-[var(--radius)] border border-dashed p-3 transition-colors ${
          isDragging
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
            : 'border-[var(--color-border)]'
        }`}
      >
        {files.length === 0 ? (
          <button
            type="button"
            className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text)] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-5 w-5" />
            <span>拖放投标文件到此处，或点击选择文件</span>
            <span>支持 .docx、.pdf 和 .nzbtf，{minFiles}-{maxFiles} 个文件</span>
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            {files.map((file, idx) => (
              <FileRow
                key={file.id}
                file={file}
                index={idx}
                onRemove={handleRemove}
                hasDuplicate={errors.some(
                  (e) => e.type === 'duplicate' && e.fileId === file.id,
                )}
              />
            ))}
          </div>
        )}

        {canAddMore && files.length > 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 flex items-center gap-1 self-start rounded-[var(--radius)] px-2 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            添加文件
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf,.nzbtf"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {/* Validation errors */}
      {blockingErrors.length > 0 && (
        <div className="flex flex-col gap-1" role="alert">
          {blockingErrors.map((err, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-danger)]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Capacity summary */}
      {files.length > 0 && (
        <CapacitySummary
          files={files}
          errors={errors}
          maxTotalSize={maxTotalSizeBytes}
        />
      )}
    </div>
  );
}

// ─── FileRow ────────────────────────────────────────────────────────

interface FileRowProps {
  file: SubmissionFile;
  index: number;
  onRemove: (id: string) => void;
  hasDuplicate: boolean;
}

function FileRow({ file, index, onRemove, hasDuplicate }: FileRowProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-sm ${
        hasDuplicate
          ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg)]'
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] cursor-grab" />
      <span className="w-5 text-xs text-[var(--color-text-muted)]">{index + 1}</span>
      <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
      <span className="flex-1 truncate text-[var(--color-text)]" title={file.name}>
        {file.name}
      </span>
      <Badge variant="default" className="text-[10px]">
        {file.format.toUpperCase()}
      </Badge>
      <span className="text-xs text-[var(--color-text-muted)]">{formatBytes(file.sizeBytes)}</span>
      {file.pageCount !== null && (
        <span className="text-xs text-[var(--color-text-muted)]">{file.pageCount}页</span>
      )}
      {hasDuplicate && (
        <Badge variant="risk-high" className="text-[10px]">
          重复
        </Badge>
      )}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className="ml-1 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
        aria-label={`移除 ${file.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── CapacitySummary ────────────────────────────────────────────────

interface CapacitySummaryProps {
  files: SubmissionFile[];
  errors: FileValidationError[];
  maxTotalSize: number;
}

function CapacitySummary({ files, errors, maxTotalSize }: CapacitySummaryProps) {
  const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const totalPages = files.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);
  const sizePercent = Math.min(100, (totalSize / maxTotalSize) * 100);
  const hasSizeError = errors.some((e) => e.type === 'total_size');
  const hasPageError = errors.some((e) => e.type === 'page_count');

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {/* Size bar */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-text-muted)]">容量</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              hasSizeError ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-accent)]'
            }`}
            style={{ width: `${sizePercent}%` }}
          />
        </div>
        <span className={hasSizeError ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}>
          {formatBytes(totalSize)} / {formatBytes(maxTotalSize)}
        </span>
      </div>

      {/* Page count */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-text-muted)]">页数</span>
        <span className={hasPageError ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}>
          {totalPages} / 4000 页
        </span>
      </div>
    </div>
  );
}
