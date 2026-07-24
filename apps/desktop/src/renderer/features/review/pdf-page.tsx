import { useCallback, useState } from 'react';
import { Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { HighlightOverlay } from './highlight-overlay';
import type { HighlightRect } from './highlight-overlay';

const PAGE_DEFAULT_WIDTH = 816;
const PAGE_DEFAULT_HEIGHT = 1056; // Letter at 96dpi

interface PdfPageProps {
  pageNumber: number;
  width: number;
  highlights?: HighlightRect[];
}

export function PdfPage({ pageNumber, width, highlights }: PdfPageProps) {
  const [pageHeight, setPageHeight] = useState(PAGE_DEFAULT_HEIGHT);

  const handleLoadSuccess = useCallback((page: { getViewport: (opts: { scale: number }) => { width: number; height: number } }) => {
    const vp = page.getViewport({ scale: 1 });
    setPageHeight(vp.height);
  }, []);

  const renderedHeight = pageHeight * (width / PAGE_DEFAULT_WIDTH);
  const pageHighlights = highlights?.filter((h) => h.page === pageNumber) ?? [];

  return (
    <div className="bg-white shadow-sm relative">
      <Page
        pageNumber={pageNumber}
        width={width}
        renderMode="canvas"
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onLoadSuccess={handleLoadSuccess}
      />
      {pageHighlights.length > 0 && (
        <HighlightOverlay
          width={width}
          height={renderedHeight}
          highlights={pageHighlights}
          pageWidth={PAGE_DEFAULT_WIDTH}
          pageHeight={pageHeight}
        />
      )}
    </div>
  );
}
