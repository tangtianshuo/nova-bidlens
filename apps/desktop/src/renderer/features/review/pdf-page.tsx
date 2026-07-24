import { Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PdfPageProps {
  pageNumber: number;
  width: number;
}

export function PdfPage({ pageNumber, width }: PdfPageProps) {
  return (
    <div className="bg-white shadow-sm">
      <Page
        pageNumber={pageNumber}
        width={width}
        renderMode="canvas"
        renderTextLayer={false}
        renderAnnotationLayer={false}
      />
    </div>
  );
}
