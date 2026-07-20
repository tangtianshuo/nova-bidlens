import { describe, expect, it } from 'vitest';
import { getReviewModeConfig } from './review-mode';

describe('getReviewModeConfig', () => {
  it('returns risk-review config with evidence panel and finding nav', () => {
    const config = getReviewModeConfig('risk-review');
    expect(config.mode).toBe('risk-review');
    expect(config.showEvidencePanel).toBe(true);
    expect(config.showFindingNav).toBe(true);
    expect(config.showFormatTabs).toBe(false);
    expect(config.showCommentTab).toBe(false);
    expect(config.showRevisionTab).toBe(false);
  });

  it('returns version-diff config with format/comment/revision tabs', () => {
    const config = getReviewModeConfig('version-diff');
    expect(config.mode).toBe('version-diff');
    expect(config.showFormatTabs).toBe(true);
    expect(config.showCommentTab).toBe(true);
    expect(config.showRevisionTab).toBe(true);
    expect(config.showEvidencePanel).toBe(false);
    expect(config.showFindingNav).toBe(false);
  });

  it('risk-review mode does not show diff-specific tabs', () => {
    const config = getReviewModeConfig('risk-review');
    expect(config.showFormatTabs).toBe(false);
    expect(config.showCommentTab).toBe(false);
    expect(config.showRevisionTab).toBe(false);
  });

  it('version-diff mode does not show risk-specific panels', () => {
    const config = getReviewModeConfig('version-diff');
    expect(config.showEvidencePanel).toBe(false);
    expect(config.showFindingNav).toBe(false);
  });
});
