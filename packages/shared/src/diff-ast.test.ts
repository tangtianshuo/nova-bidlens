import { describe, expect, it } from 'vitest';
import { createDiffSummary, isTraceableDiffItem, type MatchType } from './diff-ast';

describe('Diff AST helpers', () => {
  it('counts all MVP match types', () => {
    const summary = createDiffSummary([
      item('identical', ['a0'], ['b0']),
      item('modified', ['a1'], ['b1']),
      item('added', [], ['b2']),
      item('deleted', ['a3'], []),
      item('moved', ['a4'], ['b4']),
      item('split', ['a5'], ['b5', 'b6']),
      item('merged', ['a7', 'a8'], ['b7']),
      item('uncertain', ['a9'], ['b9'])
    ]);

    expect(summary).toEqual({
      identical: 1,
      modified: 1,
      added: 1,
      deleted: 1,
      moved: 1,
      split: 1,
      merged: 1,
      uncertain: 1
    });
  });

  it('requires node references for traceability', () => {
    expect(isTraceableDiffItem(item('modified', [], ['b1']))).toBe(false);
    expect(isTraceableDiffItem(item('added', [], ['b1']))).toBe(true);
  });
});

function item(matchType: MatchType, nodeIdsA: string[], nodeIdsB: string[]) {
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
