import { describe, expect, it } from 'vitest';
import { mapDiffItems, assertCleanExit, assertNoStderr, type ExitResult } from '../../scripts/v03/model-feasibility/run_jaccard_baseline';

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

describe('assertCleanExit', () => {
  it('accepts exit code 0', () => {
    expect(() => assertCleanExit({ exitCode: 0, signal: null })).not.toThrow();
  });

  it('rejects non-zero exit code', () => {
    expect(() => assertCleanExit({ exitCode: 1, signal: null })).toThrow('engine exited with code 1');
  });

  it('rejects null exit code (killed by signal)', () => {
    expect(() => assertCleanExit({ exitCode: null, signal: 'SIGTERM' })).toThrow('engine exited with code null');
  });
});

describe('assertNoStderr', () => {
  it('accepts empty stderr', () => {
    expect(() => assertNoStderr('')).not.toThrow();
  });

  it('rejects non-empty stderr', () => {
    expect(() => assertNoStderr('something went wrong')).toThrow('engine stderr: something went wrong');
  });
});
