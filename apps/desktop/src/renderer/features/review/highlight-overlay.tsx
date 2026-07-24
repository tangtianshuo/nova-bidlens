import { useRef, useEffect, useState, useCallback } from 'react';

export interface HighlightRect {
  x1: number; y1: number; x2: number; y2: number; // PDF coords
  matchBasis: string;
  similarityScore: number;
  sectionPath: string[];
  page: number; // 1-based page number
}

interface HighlightOverlayProps {
  width: number;      // rendered page width in px
  height: number;     // rendered page height in px
  highlights: HighlightRect[];
  pageWidth: number;  // PDF native width (PAGE_DEFAULT_WIDTH)
  pageHeight: number; // PDF native height
}

const BASE_FILL = [37, 99, 235]; // #2563EB
const OPACITIES = [0.2, 0.3, 0.4];
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

/**
 * Compute zoom level so the first highlight fills ~80% of viewport width.
 * Returns fitWidthZoom when no highlights.
 */
export function computeHighlightZoom(opts: {
  highlights: HighlightRect[];
  fitWidthZoom: number;
  pageWidth: number;
  containerWidth: number;
}): number {
  const { highlights, fitWidthZoom, pageWidth } = opts;
  if (highlights.length === 0) return fitWidthZoom;
  const h = highlights[0];
  const highlightWidthFraction = (h.x2 - h.x1) / pageWidth;
  if (highlightWidthFraction <= 0) return fitWidthZoom;
  const zoom = (80 / highlightWidthFraction) * (fitWidthZoom / 100);
  return Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)));
}

export function HighlightOverlay({
  width,
  height,
  highlights,
  pageWidth,
  pageHeight,
}: HighlightOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    highlight: HighlightRect | null;
  }>({ visible: false, x: 0, y: 0, highlight: null });

  // Scale factor: PDF coords → pixel coords
  const scale = width / pageWidth;

  // Draw highlights on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    highlights.forEach((h, i) => {
      const opacity = OPACITIES[i % OPACITIES.length];
      const x = h.x1 * scale;
      const y = h.y1 * scale;
      const w = (h.x2 - h.x1) * scale;
      const hgt = (h.y2 - h.y1) * scale;

      ctx.fillStyle = `rgba(${BASE_FILL[0]}, ${BASE_FILL[1]}, ${BASE_FILL[2]}, ${opacity})`;
      ctx.fillRect(x, y, w, hgt);

      ctx.strokeStyle = `rgba(${BASE_FILL[0]}, ${BASE_FILL[1]}, ${BASE_FILL[2]}, 1)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, hgt);
    });
  }, [width, height, highlights, scale]);

  // Mouse tracking for tooltip
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (let i = highlights.length - 1; i >= 0; i--) {
        const h = highlights[i];
        const x = h.x1 * scale;
        const y = h.y1 * scale;
        const w = (h.x2 - h.x1) * scale;
        const hgt = (h.y2 - h.y1) * scale;

        if (mx >= x && mx <= x + w && my >= y && my <= y + hgt) {
          // Flip tooltip to left if overflowing right
          const tooltipX = mx + 280 > width ? mx - 292 : mx + 12;
          setTooltip({ visible: true, x: tooltipX, y: my + 12, highlight: h });
          return;
        }
      }
      setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    },
    [highlights, scale, width],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
      />
      {/* Transparent overlay for mouse events */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: highlights.length > 0 ? 'auto' : 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {/* Tooltip */}
      {tooltip.visible && tooltip.highlight && (
        <div
          className="absolute z-50 rounded-[var(--radius-sm)] bg-[var(--color-text)] px-2.5 py-1.5 text-xs text-[var(--color-bg)] shadow-md"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            maxWidth: 280,
            pointerEvents: 'none',
          }}
        >
          <div className="truncate">{tooltip.highlight.matchBasis}</div>
          <div>相似度: {(tooltip.highlight.similarityScore * 100).toFixed(1)}%</div>
          <div className="truncate">段落: {tooltip.highlight.sectionPath.join(' > ')}</div>
        </div>
      )}
    </>
  );
}
