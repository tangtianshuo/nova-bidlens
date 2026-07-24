import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, pdfjs } from 'react-pdf';
import { FileWarning } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { PdfToolbar } from './pdf-toolbar';
import { PdfPage } from './pdf-page';

// CDN worker -- avoids bundling the worker file
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  fileName: string;
}

const ZOOM_STEP = 25;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const PAGE_DEFAULT_WIDTH = 816; // Letter size at 96dpi
const DEBOUNCE_MS = 100;

export function PdfViewer({ fileUrl }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [error, setError] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Measure container for fit-width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitWidthZoom = useMemo(() => {
    if (containerWidth <= 0) return 100;
    const available = containerWidth - 32; // 16px padding each side
    const pct = (available / PAGE_DEFAULT_WIDTH) * 100;
    return Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pct)));
  }, [containerWidth]);

  const pageWidth = useMemo(() => (PAGE_DEFAULT_WIDTH * zoom) / 100, [zoom]);

  const handleLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
      setZoom(fitWidthZoom);
      setError(false);
    },
    [fitWidthZoom],
  );

  const handleLoadError = useCallback(() => setError(true), []);

  const handlePrevPage = useCallback(
    () => setCurrentPage((p) => Math.max(1, p - 1)),
    [],
  );
  const handleNextPage = useCallback(
    () => setCurrentPage((p) => Math.min(numPages, p + 1)),
    [numPages],
  );
  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP)),
    [],
  );
  const handleFitWidth = useCallback(() => setZoom(fitWidthZoom), [fitWidthZoom]);

  // Scroll-based page tracking (debounced)
  const handleScroll = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const target = scrollRef.current;
      if (!target) return;
      const pages = target.querySelectorAll('[data-pdf-page]');
      let best = 1;
      let bestDist = Infinity;
      const scrollTop = target.scrollTop;
      const viewportMid = scrollTop + target.clientHeight / 2;
      pages.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const pg = Number(htmlEl.getAttribute('data-pdf-page'));
        const mid = htmlEl.offsetTop + htmlEl.offsetHeight / 2;
        const dist = Math.abs(mid - viewportMid);
        if (dist < bestDist) {
          bestDist = dist;
          best = pg;
        }
      });
      setCurrentPage(best);
    }, DEBOUNCE_MS);
  }, []);

  // Attach scroll listener to the scrollable div
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevPage();
      else if (e.key === 'ArrowRight') handleNextPage();
      else if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-') handleZoomOut();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm">
        <FileWarning className="h-8 w-8 text-[var(--color-text-muted)]" />
        <p className="font-medium text-[var(--color-text)]">PDF 加载失败</p>
        <p className="text-[var(--color-text-muted)]">文件可能已损坏或被移动，请检查项目文件目录。</p>
        <Button variant="secondary" size="sm" onClick={() => setError(false)}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <PdfToolbar
        currentPage={currentPage}
        totalPages={numPages}
        zoom={zoom}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitWidth={handleFitWidth}
      />
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="flex flex-col items-center gap-4 p-4">
          <Document
            file={fileUrl}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={
              <div className="flex items-center justify-center py-16 text-sm text-[var(--color-text-muted)]">
                加载中...
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i + 1} data-pdf-page={i + 1}>
                <PdfPage pageNumber={i + 1} width={pageWidth} />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
