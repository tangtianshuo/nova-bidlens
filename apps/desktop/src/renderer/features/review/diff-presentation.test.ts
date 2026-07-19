import { describe, expect, it } from 'vitest';
import type { DiffItem } from '@bidlens/shared/types-only';
import { formatDiffSummary, resolveTextDiffTokens } from './diff-presentation';

function makeItem(overrides: Partial<DiffItem> = {}): DiffItem {
  return {
    matchId: 'm1',
    matchType: 'modified',
    confidence: 0.9,
    similarity: 0.8,
    sourceA: '合同金额为620元',
    sourceB: '合同金额为263元',
    nodeIdsA: ['a1'],
    nodeIdsB: ['b1'],
    diffDetail: [],
    summary: 'semantic match',
    ...overrides,
  };
}

describe('diff presentation', () => {
  it('localizes internal semantic match labels', () => {
    expect(formatDiffSummary(makeItem())).toBe('语义匹配');
  });

  it('uses engine-provided tokens when available', () => {
    const tokens = [{ kind: 'added' as const, text: '引擎结果' }];
    expect(resolveTextDiffTokens(makeItem({ diffDetail: tokens }))).toBe(tokens);
  });

  it('generates character-level tokens when engine detail is empty', () => {
    const tokens = resolveTextDiffTokens(makeItem());
    const removed = tokens.filter((token) => token.kind === 'removed').map((token) => token.text).join('');
    const added = tokens.filter((token) => token.kind === 'added').map((token) => token.text).join('');
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);
    expect(tokens.map((token) => token.text).join('')).toContain('合同金额为');
  });

  it('bounds processing for very long paragraphs', () => {
    const prefix = '相同内容'.repeat(3000);
    const tokens = resolveTextDiffTokens(makeItem({
      sourceA: `${prefix}旧`,
      sourceB: `${prefix}新`,
    }));
    expect(tokens.length).toBeLessThanOrEqual(4);
    expect(tokens.some((token) => token.kind === 'removed' && token.text === '旧')).toBe(true);
    expect(tokens.some((token) => token.kind === 'added' && token.text === '新')).toBe(true);
  });
});
