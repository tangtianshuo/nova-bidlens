/**
 * Tests for HighlightOverlay and zoom-to-fit logic.
 */

import { describe, expect, it } from 'vitest';
import { computeHighlightZoom } from './highlight-overlay';
import type { HighlightRect } from './highlight-overlay';

const PAGE_DEFAULT_WIDTH = 816;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

/** Helper to build a HighlightRect with test defaults. */
function makeHighlight(overrides: Partial<HighlightRect> & Pick<HighlightRect, 'x1' | 'y1' | 'x2' | 'y2'>): HighlightRect {
  return {
    page: 1,
    matchBasis: 'test',
    similarityScore: 0.9,
    sectionPath: ['测试段落'],
    ...overrides,
  };
}

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
    const highlights = [makeHighlight({ x1: 100, y1: 100, x2: 300, y2: 200 })];
    const result = computeHighlightZoom({
      highlights,
      fitWidthZoom: 100,
      pageWidth: PAGE_DEFAULT_WIDTH,
      containerWidth: 800,
    });
    // highlightWidthFraction = 200/816 ≈ 0.2451
    // zoom = (80 / 0.2451) * 100 / 100 ≈ 326.4 → clamped to ZOOM_MAX=200
    expect(result).toBe(ZOOM_MAX);
  });

  it('returns fitWidthZoom for very wide highlights', () => {
    const highlights = [makeHighlight({ x1: 50, y1: 100, x2: 750, y2: 200 })];
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
    const highlights = [makeHighlight({ x1: 300, y1: 100, x2: 500, y2: 200 })];
    const result = computeHighlightZoom({
      highlights,
      fitWidthZoom: 75,
      pageWidth: PAGE_DEFAULT_WIDTH,
      containerWidth: 600,
    });
    // highlightWidthFraction = 200/816 ≈ 0.2451
    // zoom = (80 / 0.2451) * 75 / 100 ≈ 244.8 → clamped to 200
    expect(result).toBe(ZOOM_MAX);
  });
});
