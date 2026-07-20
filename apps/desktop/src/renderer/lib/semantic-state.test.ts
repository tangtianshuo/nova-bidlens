import { describe, it, expect } from 'vitest';
import {
  getRiskColor, getRiskBg, getRiskBorder, getRiskLabel,
  getDetectorColor, getDetectorBg, getDetectorLabel,
  getStatusColor, getStatusBg, getStatusLabel,
  getDiffVariant, getDiffColor, getDiffBg, getDiffBorder, getDiffLabel,
  getReviewStatusLabel,
} from './semantic-state';

describe('Risk tokens', () => {
  it('returns CSS var for each risk level', () => {
    expect(getRiskColor('high')).toBe('var(--risk-high)');
    expect(getRiskColor('medium')).toBe('var(--risk-medium)');
    expect(getRiskColor('low')).toBe('var(--risk-low)');
  });

  it('returns bg/border vars', () => {
    expect(getRiskBg('high')).toBe('var(--risk-high-bg)');
    expect(getRiskBorder('medium')).toBe('var(--risk-medium-border)');
  });

  it('returns Chinese labels', () => {
    expect(getRiskLabel('high')).toBe('高风险');
    expect(getRiskLabel('medium')).toBe('中风险');
    expect(getRiskLabel('low')).toBe('低风险');
  });
});

describe('Detector tokens', () => {
  it('returns CSS var for each detector category', () => {
    expect(getDetectorColor('text')).toBe('var(--detector-text)');
    expect(getDetectorColor('table')).toBe('var(--detector-table)');
    expect(getDetectorColor('entity')).toBe('var(--detector-entity)');
  });

  it('returns bg vars', () => {
    expect(getDetectorBg('text')).toBe('var(--detector-text-bg)');
    expect(getDetectorBg('entity')).toBe('var(--detector-entity-bg)');
  });

  it('returns Chinese labels', () => {
    expect(getDetectorLabel('text')).toBe('文本检测');
    expect(getDetectorLabel('table')).toBe('表格检测');
    expect(getDetectorLabel('entity')).toBe('实体检测');
  });
});

describe('Status tokens', () => {
  it('maps parsing_baseline and parsing_review to same token', () => {
    expect(getStatusColor('parsing_baseline')).toBe('var(--status-parsing)');
    expect(getStatusColor('parsing_review')).toBe('var(--status-parsing)');
  });

  it('returns distinct tokens for other statuses', () => {
    expect(getStatusColor('draft')).toBe('var(--status-draft)');
    expect(getStatusColor('ready')).toBe('var(--status-ready)');
    expect(getStatusColor('failed')).toBe('var(--status-failed)');
    expect(getStatusColor('comparing')).toBe('var(--status-comparing)');
  });

  it('returns bg vars', () => {
    expect(getStatusBg('ready')).toBe('var(--status-ready-bg)');
    expect(getStatusBg('failed')).toBe('var(--status-failed-bg)');
  });

  it('returns Chinese labels for all TaskStatus values', () => {
    const statuses = [
      'draft', 'validating', 'parsing_baseline', 'parsing_review',
      'comparing', 'finalizing', 'ready', 'cancelling', 'cancelled',
      'failed', 'interrupted',
    ] as const;
    for (const s of statuses) {
      const label = getStatusLabel(s);
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
    }
  });
});

describe('Diff tokens', () => {
  it('maps added/deleted/modified/uncertain to their variants', () => {
    expect(getDiffVariant('added')).toBe('added');
    expect(getDiffVariant('deleted')).toBe('deleted');
    expect(getDiffVariant('modified')).toBe('modified');
    expect(getDiffVariant('uncertain')).toBe('uncertain');
  });

  it('maps moved/split/merged to modified variant', () => {
    expect(getDiffVariant('moved')).toBe('modified');
    expect(getDiffVariant('split')).toBe('modified');
    expect(getDiffVariant('merged')).toBe('modified');
  });

  it('maps identical to null', () => {
    expect(getDiffVariant('identical')).toBeNull();
  });

  it('returns CSS vars for variant match types', () => {
    expect(getDiffColor('added')).toBe('var(--color-added)');
    expect(getDiffBg('deleted')).toBe('var(--color-deleted-bg)');
    expect(getDiffBorder('modified')).toBe('var(--color-modified-border)');
  });

  it('returns null for identical', () => {
    expect(getDiffColor('identical')).toBeNull();
    expect(getDiffBg('identical')).toBeNull();
    expect(getDiffBorder('identical')).toBeNull();
  });

  it('returns Chinese labels for all MatchType values', () => {
    const types = ['identical', 'modified', 'added', 'deleted', 'moved', 'split', 'merged', 'uncertain'] as const;
    for (const t of types) {
      expect(getDiffLabel(t)).toBeTruthy();
    }
  });
});

describe('Review status labels', () => {
  it('returns Chinese labels', () => {
    expect(getReviewStatusLabel('unreviewed')).toBe('未审查');
    expect(getReviewStatusLabel('confirmed')).toBe('已确认');
    expect(getReviewStatusLabel('needs-confirmation')).toBe('待确认');
    expect(getReviewStatusLabel('ignored')).toBe('已忽略');
  });
});
