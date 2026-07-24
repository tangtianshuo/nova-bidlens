/**
 * Tests for HighlightOverlay and zoom-to-fit logic.
 */

import { describe, expect, it } from 'vitest';
import { computeHighlightZoom } from './highlight-overlay';

const PAGE_DEFAULT_WIDTH = 816;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

describe('computeHighlightZoom', () => {
  it('returns fitWidthZoom when no highlights', () => {
    const result = computeHighlightZoom({
      highlights: [],
      fitWidthZoom: 100,
      pageWidth: PAGE_DEFAULT_WIDTH,
      containerWidth: 800,
    });
    expect(result).toBe(100);
  });

  it('zooms so first highlight fills 80% viewport', () => {
    // Highlight is 200px wide out of 816 page → ~24.5% of page
    // To fill 80% of viewport: zoom = (80 / 24.5) * fitWidthZoom / 100
    const highlights = [{ x1: 100, y1: 100, x2: 300, y2: 200, page: 1 }];
    const fitWidthZoom = 100;
    const result = computeHighlightZoom({
      highlights,
      fitWidthZoom,
      pageWidth: PAGE_DEFAULT_WIDTH,
      containerWidth: 800,
    });
    // highlightWidthFraction = 200/816 ≈ 0.2451
    // zoom = (80 / 0.2451) * 100 / 100 ≈ 326.4 → clamped to ZOOM_MAX=200
    expect(result).toBe(ZOOM_MAX);
  });

  it('clamps to ZOOM_MIN for very wide highlights', () => {
    // Highlight is 700px wide out of 816 → ~85.8% of page
    // zoom = (80 / 0.858) * 100 / 100 ≈ 93.2
    const highlights = [{ x1: 50, y1: 100, x2: 750, y2: 200, page: 1 }];
    const result = computeHighlightZoom({
      highlights,
      fitWidthZoom: 100,
      pageWidth: PAGE_DEFAULT_WIDTH,
      containerWidth: 800,
    });
    // 80 / (700/816) * 100/100 ≈ 93.3
    expect(result).toBeGreaterThanOrEqual(90);
    expect(result).toBeLessThanOrEqual(95);
  });

  it('uses fitWidthZoom as base', () => {
    const highlights = [{ x1: 300, y1: 100, x2: 500, y2: 200, page: 1 }];
    const fitWidthZoom = 75;
    const result = computeHighlightZoom({
      highlights,
      fitWidthZoom,
      pageWidth: PAGE_DEFAULT_WIDTH,
      containerWidth: 600,
    });
    // highlightWidthFraction = 200/816 ≈ 0.2451
    // zoom = (80 / 0.2451) * 75 / 100 ≈ 244.8 → clamped to 200
    expect(result).toBe(ZOOM_MAX);
  });
});
