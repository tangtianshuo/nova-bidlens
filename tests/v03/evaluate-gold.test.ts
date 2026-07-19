import { describe, expect, it } from 'vitest';
import {
  evaluateRelations,
  validateGoldDataset,
  type PredictedRelation,
} from '../../scripts/v03/model-feasibility/evaluate_gold';
import sample from './fixtures/gold-sample.json';

describe('V0.3 gold evaluation', () => {
  it('accepts the canonical sample', () => {
    expect(validateGoldDataset(sample)).toEqual({ pairCount: 1, relationCount: 2 });
  });

  it('normalizes node order when scoring exact relations', () => {
    const predictions: PredictedRelation[] = [
      { pairId: 'sample-001', nodeIdsA: ['a-1'], nodeIdsB: ['b-2'], matchType: 'moved' },
      { pairId: 'sample-001', nodeIdsA: ['a-2'], nodeIdsB: ['b-4', 'b-3'], matchType: 'split' },
    ];
    expect(evaluateRelations(sample, predictions)).toMatchObject({
      truePositive: 2,
      falsePositive: 0,
      falseNegative: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    });
  });

  it('counts explicitly forbidden predictions as obvious errors', () => {
    const predictions: PredictedRelation[] = [
      { pairId: 'sample-001', nodeIdsA: ['a-3'], nodeIdsB: ['b-5'], matchType: 'modified' },
    ];
    expect(evaluateRelations(sample, predictions).obviousErrorRate).toBe(1);
  });

  it('rejects duplicate relation identities', () => {
    const duplicate = structuredClone(sample);
    duplicate.pairs[0].relations.push(duplicate.pairs[0].relations[0]);
    expect(() => validateGoldDataset(duplicate)).toThrow('duplicate gold relation');
  });
});
