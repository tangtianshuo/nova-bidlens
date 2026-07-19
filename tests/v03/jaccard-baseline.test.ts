import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { awaitChildExit, mapDiffItems, assertCleanExit, assertNoStderr, type ExitResult } from '../../scripts/v03/model-feasibility/run_jaccard_baseline';

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

describe('awaitChildExit', () => {
  it('resolves immediately when child already exited (exitCode set)', async () => {
    const fake = new EventEmitter() as any;
    fake.exitCode = 0;
    fake.signalCode = null;
    fake.kill = () => false;
    const result = await awaitChildExit(fake);
    expect(result).toEqual({ exitCode: 0, signal: null });
  });

  it('resolves immediately when child killed by signal before listeners attach', async () => {
    const fake = new EventEmitter() as any;
    fake.exitCode = null;
    fake.signalCode = 'SIGTERM';
    fake.kill = () => false;
    const result = await awaitChildExit(fake);
    expect(result).toEqual({ exitCode: null, signal: 'SIGTERM' });
  });

  it('remains pending when child is still running (both exitCode and signalCode null)', async () => {
    const fake = new EventEmitter() as any;
    fake.exitCode = null;
    fake.signalCode = null;
    fake.kill = () => false;

    let resolved = false;
    const promise = awaitChildExit(fake).then((r) => { resolved = true; return r; });

    // Give microtasks a tick — must still be pending
    await new Promise((r) => setTimeout(r, 20));
    expect(resolved).toBe(false);

    // Now simulate the child exiting
    fake.emit('close', 0, null);
    const result = await promise;
    expect(resolved).toBe(true);
    expect(result).toEqual({ exitCode: 0, signal: null });
  });
});
