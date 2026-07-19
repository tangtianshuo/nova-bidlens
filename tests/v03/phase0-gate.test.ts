import { describe, expect, it } from 'vitest';
import { evaluatePhase0Gate, type Phase0Evidence } from '../../scripts/v03/model-feasibility/phase0_gate';

const passing: Phase0Evidence = {
  legal: { redistributionApproved: true, reviewer: 'LEGAL-123', reviewedAt: '2026-07-19T00:00:00Z' },
  dataset: { pairCount: 30, relationCount: 3000 },
  model: { dimension: 1024, minimumReferenceCosine: 0.981, peakWorkingSetBytes: 1_900_000_000 },
  baseline: { f1: 0.61, obviousErrorRate: 0.08, datasetHash: 'abc' },
};

describe('V0.3 Phase 0 gate', () => {
  it('passes complete evidence', () => {
    expect(evaluatePhase0Gate(passing)).toEqual({ status: 'pass', failures: [] });
  });

  it('blocks unapproved redistribution', () => {
    const evidence = structuredClone(passing);
    evidence.legal.redistributionApproved = false;
    expect(evaluatePhase0Gate(evidence).failures).toContain('model redistribution is not approved');
  });

  it('blocks memory at or above 2GB', () => {
    const evidence = structuredClone(passing);
    evidence.model.peakWorkingSetBytes = 2_147_483_648;
    expect(evaluatePhase0Gate(evidence).failures).toContain('model peak working set must be below 2GB');
  });

  it('blocks insufficient gold data', () => {
    const evidence = structuredClone(passing);
    evidence.dataset.relationCount = 2999;
    expect(evaluatePhase0Gate(evidence).failures).toContain('gold dataset requires at least 3000 relations');
  });
});
