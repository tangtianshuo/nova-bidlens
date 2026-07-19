import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPhase0Evidence, evaluatePhase0Gate, type Phase0Evidence } from '../../scripts/v03/model-feasibility/phase0_gate';

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

  it('blocks reviewer unassigned even when redistribution approved and reviewedAt set', () => {
    const evidence = structuredClone(passing);
    evidence.legal.reviewer = 'unassigned';
    expect(evaluatePhase0Gate(evidence).failures).toContain('model redistribution is not approved');
  });

  it.each([
    ['dataset.pairCount', (e: Phase0Evidence) => { e.dataset.pairCount = NaN; }, 'gold dataset requires at least 30 pairs'],
    ['dataset.relationCount', (e: Phase0Evidence) => { e.dataset.relationCount = NaN; }, 'gold dataset requires at least 3000 relations'],
    ['model.dimension', (e: Phase0Evidence) => { e.model.dimension = NaN; }, 'model output dimension must be 1024'],
    ['model.minimumReferenceCosine', (e: Phase0Evidence) => { e.model.minimumReferenceCosine = NaN; }, 'INT8 reference cosine must be at least 0.98'],
    ['model.peakWorkingSetBytes', (e: Phase0Evidence) => { e.model.peakWorkingSetBytes = NaN; }, 'model peak working set must be below 2GB'],
  ])('blocks non-finite %s', (_label, mutator, expectedFailure) => {
    const evidence = structuredClone(passing);
    mutator(evidence);
    expect(evaluatePhase0Gate(evidence).failures).toContain(expectedFailure);
  });
});

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function scaffoldFixtures(root: string, overrides?: { modelPatch?: Record<string, unknown> }): void {
  mkdirSync(join(root, 'scripts/v03/model-feasibility'), { recursive: true });
  mkdirSync(join(root, '.artifacts/v03/results'), { recursive: true });
  writeJson(join(root, 'scripts/v03/model-feasibility/legal-decision.json'), {
    redistributionApproved: true, reviewer: 'LEGAL-123', reviewedAt: '2026-07-19T00:00:00Z',
  });
  writeJson(join(root, '.artifacts/v03/results/gold-summary.json'), { pairCount: 40, relationCount: 3500 });
  writeJson(join(root, '.artifacts/v03/results/bge-m3-int8.json'), {
    dimension: 1024,
    referenceCosines: [0.991, 0.992],
    peakRssBytes: 1_800_000_000,
    ...(overrides?.modelPatch ?? {}),
  });
  writeJson(join(root, '.artifacts/v03/results/jaccard-baseline.json'), {
    f1: 0.62, obviousErrorRate: 0.07, datasetHash: 'deadbeef',
  });
}

describe('buildPhase0Evidence', () => {
  it('reads peakRssBytes from bge-m3-int8.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'phase0-'));
    scaffoldFixtures(root);
    const evidence = await buildPhase0Evidence(root);
    expect(evidence.model.peakWorkingSetBytes).toBe(1_800_000_000);
    expect(evaluatePhase0Gate(evidence).status).toBe('pass');
  });

  it('does not read bge-m3-int8-process.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'phase0-'));
    scaffoldFixtures(root);
    writeJson(join(root, '.artifacts/v03/results/bge-m3-int8-process.json'), { peakWorkingSetBytes: 999 });
    const evidence = await buildPhase0Evidence(root);
    expect(evidence.model.peakWorkingSetBytes).toBe(1_800_000_000);
  });

  it('maps fields from all four JSON sources', async () => {
    const root = mkdtempSync(join(tmpdir(), 'phase0-'));
    scaffoldFixtures(root);
    const evidence = await buildPhase0Evidence(root);
    expect(evidence.legal.redistributionApproved).toBe(true);
    expect(evidence.dataset).toEqual({ pairCount: 40, relationCount: 3500 });
    expect(evidence.model.dimension).toBe(1024);
    expect(evidence.model.minimumReferenceCosine).toBe(0.991);
    expect(evidence.baseline).toEqual({ f1: 0.62, obviousErrorRate: 0.07, datasetHash: 'deadbeef' });
  });

  it('propagates file-not-found errors', async () => {
    const root = mkdtempSync(join(tmpdir(), 'phase0-'));
    await expect(buildPhase0Evidence(root)).rejects.toThrow();
  });
});
