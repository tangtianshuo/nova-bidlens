export interface Relation {
  nodeIdsA: string[];
  nodeIdsB: string[];
  matchType: string;
}

export interface PredictedRelation extends Relation {
  pairId: string;
}

interface GoldPair {
  pairId: string;
  docA: string;
  docB: string;
  relations: Relation[];
  forbiddenRelations: Array<Pick<Relation, 'nodeIdsA' | 'nodeIdsB'>>;
}

interface GoldDataset {
  schemaVersion: number;
  annotation: { independentAnnotators: number; adjudication: string };
  pairs: GoldPair[];
}

export interface EvaluationResult {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
  obviousErrorCount: number;
  obviousErrorRate: number;
}

function sorted(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function relationKey(pairId: string, relation: Relation): string {
  return JSON.stringify([
    pairId,
    sorted(relation.nodeIdsA),
    sorted(relation.nodeIdsB),
    relation.matchType,
  ]);
}

function edgeKey(pairId: string, relation: Pick<Relation, 'nodeIdsA' | 'nodeIdsB'>): string {
  return JSON.stringify([pairId, sorted(relation.nodeIdsA), sorted(relation.nodeIdsB)]);
}

export function validateGoldDataset(input: unknown): { pairCount: number; relationCount: number } {
  if (!input || typeof input !== 'object') throw new Error('gold dataset must be an object');
  const dataset = input as GoldDataset;
  if (dataset.schemaVersion !== 1 || !Array.isArray(dataset.pairs)) {
    throw new Error('unsupported gold dataset schema');
  }
  if (!dataset.annotation || dataset.annotation.independentAnnotators < 2 || !dataset.annotation.adjudication) {
    throw new Error('gold dataset requires independent annotation and adjudication');
  }
  const pairIds = new Set<string>();
  const relationIds = new Set<string>();
  let relationCount = 0;
  for (const pair of dataset.pairs) {
    if (!pair.pairId || pairIds.has(pair.pairId)) throw new Error('duplicate or empty pairId');
    pairIds.add(pair.pairId);
    if (!pair.docA || !pair.docB || !Array.isArray(pair.relations) || !Array.isArray(pair.forbiddenRelations)) {
      throw new Error(`invalid pair ${pair.pairId}`);
    }
    for (const relation of pair.relations) {
      if (!relation.nodeIdsA.length || !relation.nodeIdsB.length || !relation.matchType) {
        throw new Error(`invalid gold relation in ${pair.pairId}`);
      }
      const key = relationKey(pair.pairId, relation);
      if (relationIds.has(key)) throw new Error('duplicate gold relation');
      relationIds.add(key);
      relationCount += 1;
    }
  }
  return { pairCount: dataset.pairs.length, relationCount };
}

export function evaluateRelations(input: unknown, predictions: PredictedRelation[]): EvaluationResult {
  validateGoldDataset(input);
  const dataset = input as GoldDataset;
  const gold = new Set(dataset.pairs.flatMap((pair) => pair.relations.map((r) => relationKey(pair.pairId, r))));
  const forbidden = new Set(dataset.pairs.flatMap((pair) => pair.forbiddenRelations.map((r) => edgeKey(pair.pairId, r))));
  const predicted = new Set(predictions.map((r) => relationKey(r.pairId, r)));
  const truePositive = [...predicted].filter((key) => gold.has(key)).length;
  const falsePositive = predicted.size - truePositive;
  const falseNegative = gold.size - truePositive;
  const precision = predicted.size === 0 ? 0 : truePositive / predicted.size;
  const recall = gold.size === 0 ? 0 : truePositive / gold.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const obviousErrorCount = predictions.filter((r) => forbidden.has(edgeKey(r.pairId, r))).length;
  return {
    truePositive,
    falsePositive,
    falseNegative,
    precision,
    recall,
    f1,
    obviousErrorCount,
    obviousErrorRate: predicted.size === 0 ? 0 : obviousErrorCount / predicted.size,
  };
}

if (process.argv[1]?.endsWith('evaluate_gold.ts') && process.argv.length === 4) {
  const { createHash } = await import('node:crypto');
  const { mkdir, readFile, writeFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const datasetPath = resolve(process.argv[2]);
  const outputPath = resolve(process.argv[3]);
  const bytes = await readFile(datasetPath);
  const dataset = JSON.parse(bytes.toString('utf-8')) as GoldDataset;
  const counts = validateGoldDataset(dataset);
  const output = {
    ...counts,
    annotation: dataset.annotation,
    datasetHash: createHash('sha256').update(bytes).digest('hex'),
    generatedAt: new Date().toISOString(),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}
