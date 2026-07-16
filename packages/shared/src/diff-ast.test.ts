import { describe, expect, it } from 'vitest';
import { createDiffSummary, isTraceableDiffItem } from './diff-ast';

describe('Diff AST helpers', () => {
  it('counts all MVP match types', () => {
    const summary = createDiffSummary([
      item('modified', ['a1'], ['b1']),
      item('added', [], ['b2']),
      item('deleted', ['a3'], [])
    ]);

    expect(summary.modified).toBe(1);
    expect(summary.added).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(summary.uncertain).toBe(0);
  });

  it('requires node references for traceability', () => {
    expect(isTraceableDiffItem(item('modified', [], ['b1']))).toBe(false);
    expect(isTraceableDiffItem(item('added', [], ['b1']))).toBe(true);
  });
});

function item(matchType: 'modified' | 'added' | 'deleted', nodeIdsA: string[], nodeIdsB: string[]) {
  return {
    matchId: `${matchType}-1`,
    matchType,
    confidence: 0.8,
    similarity: 0.8,
    sourceA: nodeIdsA.length ? 'A' : null,
    sourceB: nodeIdsB.length ? 'B' : null,
    nodeIdsA,
    nodeIdsB,
    diffDetail: [],
    summary: matchType
  };
}
