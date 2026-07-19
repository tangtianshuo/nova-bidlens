export interface Phase0Evidence {
  legal: { redistributionApproved: boolean; reviewer: string; reviewedAt: string | null };
  dataset: { pairCount: number; relationCount: number };
  model: { dimension: number; minimumReferenceCosine: number; peakWorkingSetBytes: number };
  baseline: { f1: number; obviousErrorRate: number; datasetHash: string };
}

export function evaluatePhase0Gate(evidence: Phase0Evidence): { status: 'pass' | 'fail'; failures: string[] } {
  const failures: string[] = [];
  if (!evidence.legal.redistributionApproved || !evidence.legal.reviewer || evidence.legal.reviewer === 'unassigned' || !evidence.legal.reviewedAt) {
    failures.push('model redistribution is not approved');
  }
  if (!Number.isFinite(evidence.dataset.pairCount) || evidence.dataset.pairCount < 30) failures.push('gold dataset requires at least 30 pairs');
  if (!Number.isFinite(evidence.dataset.relationCount) || evidence.dataset.relationCount < 3000) failures.push('gold dataset requires at least 3000 relations');
  if (!Number.isFinite(evidence.model.dimension) || evidence.model.dimension !== 1024) failures.push('model output dimension must be 1024');
  if (!Number.isFinite(evidence.model.minimumReferenceCosine) || evidence.model.minimumReferenceCosine < 0.98) failures.push('INT8 reference cosine must be at least 0.98');
  if (!Number.isFinite(evidence.model.peakWorkingSetBytes) || evidence.model.peakWorkingSetBytes >= 2_147_483_648) failures.push('model peak working set must be below 2GB');
  if (!Number.isFinite(evidence.baseline.f1) || !Number.isFinite(evidence.baseline.obviousErrorRate)) {
    failures.push('Jaccard baseline metrics must be finite');
  }
  if (!evidence.baseline.datasetHash) failures.push('Jaccard baseline requires a dataset hash');
  return { status: failures.length === 0 ? 'pass' : 'fail', failures };
}

if (process.argv[1]?.endsWith('phase0_gate.ts')) {
  const { readFileSync } = await import('node:fs');
  const root = new URL('../../../', import.meta.url);
  const readJson = (relative: string) => JSON.parse(readFileSync(new URL(relative, root), 'utf-8')) as any;
  const legal = readJson('scripts/v03/model-feasibility/legal-decision.json');
  const gold = readJson('.artifacts/v03/results/gold-summary.json');
  const model = readJson('.artifacts/v03/results/bge-m3-int8.json');
  const processReport = readJson('.artifacts/v03/results/bge-m3-int8-process.json');
  const baseline = readJson('.artifacts/v03/results/jaccard-baseline.json');
  const evidence: Phase0Evidence = {
    legal,
    dataset: { pairCount: gold.pairCount, relationCount: gold.relationCount },
    model: {
      dimension: model.dimension,
      minimumReferenceCosine: Math.min(...model.referenceCosines),
      peakWorkingSetBytes: processReport.peakWorkingSetBytes,
    },
    baseline: { f1: baseline.f1, obviousErrorRate: baseline.obviousErrorRate, datasetHash: baseline.datasetHash },
  };
  const result = evaluatePhase0Gate(evidence);
  console.log(JSON.stringify({ ...result, evidence }, null, 2));
  if (result.status === 'fail') process.exitCode = 1;
}
