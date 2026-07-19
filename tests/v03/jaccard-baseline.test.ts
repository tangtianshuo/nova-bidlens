import { describe, expect, it } from 'vitest';
import { mapDiffItems } from '../../scripts/v03/model-feasibility/run_jaccard_baseline';

describe('Jaccard baseline mapping', () => {
  it('keeps only correspondence items and preserves complex node lists', () => {
    expect(mapDiffItems('pair-001', [
      { node_ids_a: ['a-1'], node_ids_b: ['b-1'], match_type: 'modified' },
      { node_ids_a: ['a-2'], node_ids_b: [], match_type: 'deleted' },
      { node_ids_a: ['a-3'], node_ids_b: ['b-3', 'b-4'], match_type: 'split' },
    ])).toEqual([
      { pairId: 'pair-001', nodeIdsA: ['a-1'], nodeIdsB: ['b-1'], matchType: 'modified' },
      { pairId: 'pair-001', nodeIdsA: ['a-3'], nodeIdsB: ['b-3', 'b-4'], matchType: 'split' },
    ]);
  });
});
