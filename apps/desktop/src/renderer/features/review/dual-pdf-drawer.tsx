import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { PdfViewer } from './pdf-viewer';
import type { HighlightRect } from './highlight-overlay';

interface PaneData {
  submissionId: string;
  fileName: string;
  initialPage: number;
  highlights?: HighlightRect[];
}

interface DualPdfDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  source: PaneData;
  target: PaneData;
}

function useFileUrl(projectId: string, submissionId: string, open: boolean) {
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

  return { fileUrl, loading };
}

function PdfPane({
  projectId,
  submissionId,
  fileName,
  initialPage,
  highlights,
  open,
}: PaneData & { projectId: string; open: boolean }) {
  const { fileUrl, loading } = useFileUrl(projectId, submissionId, open);

  return (
    <div className="flex flex-col min-h-0 min-w-0">
      <div className="px-3 py-2 border-b border-[var(--color-border)] shrink-0">
        <p className="truncate text-[13px] font-medium text-[var(--color-text)]">
          {fileName}
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
            加载中...
          </div>
        )}
        {!loading && fileUrl && (
          <PdfViewer
            key={submissionId}
            fileUrl={fileUrl}
            fileName={fileName}
            initialPage={initialPage}
            highlights={highlights}
          />
        )}
        {!loading && !fileUrl && (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
            无法加载 PDF 文件
          </div>
        )}
      </div>
    </div>
  );
}

export function DualPdfDrawer({
  open,
  onOpenChange,
  projectId,
  source,
  target,
}: DualPdfDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] max-h-[90vh] w-full flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-5 py-2 border-b border-[var(--color-border)] shrink-0">
          <SheetTitle className="text-[14px] font-semibold">
            双栏对比
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-[var(--color-border)]">
          <PdfPane
            projectId={projectId}
            submissionId={source.submissionId}
            fileName={source.fileName}
            initialPage={source.initialPage}
            highlights={source.highlights}
            open={open}
          />
          <PdfPane
            projectId={projectId}
            submissionId={target.submissionId}
            fileName={target.fileName}
            initialPage={target.initialPage}
            highlights={target.highlights}
            open={open}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
