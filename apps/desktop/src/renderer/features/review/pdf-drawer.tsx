import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { PdfViewer } from './pdf-viewer';

interface PdfDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  submissionId: string;
  fileName: string;
}

export function PdfDrawer({
  open,
  onOpenChange,
  projectId,
  submissionId,
  fileName,
}: PdfDrawerProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !projectId || !submissionId) {
      setFileUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    window.bidlens
      .getPdfFile(projectId, submissionId)
      .then((result) => {
        if (cancelled) return;
        if (result?.filePath) {
          setFileUrl(`file:///${result.filePath.replace(/\\/g, '/')}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, submissionId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[85vw] max-w-none flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-5 py-3 border-b border-[var(--color-border)] shrink-0">
          <SheetTitle className="truncate text-[16px] font-semibold overflow-wrap-anywhere">
            {fileName}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
              加载中...
            </div>
          )}
          {!loading && fileUrl && <PdfViewer fileUrl={fileUrl} fileName={fileName} />}
          {!loading && !fileUrl && (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
              无法加载 PDF 文件
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
