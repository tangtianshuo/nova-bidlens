import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cpus, platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateRelations, validateGoldDataset, type PredictedRelation } from './evaluate_gold';

interface Pair { pairId: string; docA: string; docB: string; }
interface Dataset { schemaVersion: number; pairs: Pair[]; }

async function sha256(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

async function request(lines: AsyncIterator<string>, stdin: NodeJS.WritableStream, method: string, params: unknown, id: string): Promise<any> {
  stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  while (true) {
    const next = await lines.next();
    if (next.done) throw new Error(`engine closed before response ${id}`);
    const message = JSON.parse(next.value) as { id?: string; error?: { message: string }; result?: unknown };
    if (message.id === undefined) continue;
    if (message.id !== id) continue;
    if (message.error) throw new Error(message.error.message);
    return message.result;
  }
}

export function mapDiffItems(pairId: string, items: Array<{ node_ids_a: string[]; node_ids_b: string[]; match_type: string }>): PredictedRelation[] {
  return items
    .filter((item) => item.node_ids_a.length > 0 && item.node_ids_b.length > 0)
    .map((item) => ({ pairId, nodeIdsA: item.node_ids_a, nodeIdsB: item.node_ids_b, matchType: item.match_type }));
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, '../../..');
  const manifestPath = resolve(root, 'tests/v03/private-gold/dataset.json');
  const dataset = JSON.parse(await readFile(manifestPath, 'utf-8')) as Dataset;
  const summary = validateGoldDataset(dataset);
  if (summary.pairCount < 30 || summary.relationCount < 3000) {
    throw new Error(`gold dataset too small: ${summary.pairCount} pairs, ${summary.relationCount} relations`);
  }
  execFileSync('cargo', ['build', '--manifest-path', 'bidlens-engine/Cargo.toml'], { cwd: root, stdio: 'inherit' });
  const binary = resolve(root, 'bidlens-engine/target/debug', platform() === 'win32' ? 'bidlens-engine.exe' : 'bidlens-engine');
  const child = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: child.stdout });
  const lineIterator = lines[Symbol.asyncIterator]();
  const stderr: Buffer[] = [];
  child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
  const predictions: PredictedRelation[] = [];
  let id = 0;
  try {
    const info = await request(lineIterator, child.stdin, 'ping', {}, `baseline-${++id}`);
    for (const pair of dataset.pairs) {
      const docA = JSON.parse(await readFile(resolve(root, 'tests/v03/private-gold', pair.docA), 'utf-8'));
      const docB = JSON.parse(await readFile(resolve(root, 'tests/v03/private-gold', pair.docB), 'utf-8'));
      const result = await request(lineIterator, child.stdin, 'compare', { doc_a: docA, doc_b: docB, options: { similarity_threshold: 0.45 } }, `baseline-${++id}`);
      predictions.push(...mapDiffItems(pair.pairId, result.diff.items as Array<{ node_ids_a: string[]; node_ids_b: string[]; match_type: string }>));
    }
    const metrics = evaluateRelations(dataset, predictions);
    const output = { ...metrics, engine: info, threshold: 0.45, pairCount: summary.pairCount, relationCount: summary.relationCount, datasetHash: await sha256(manifestPath), cpus: cpus().length, generatedAt: new Date().toISOString() };
    const outputPath = resolve(root, '.artifacts/v03/results/jaccard-baseline.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    await request(lineIterator, child.stdin, 'shutdown', {}, `baseline-${++id}`);
  } finally {
    lines.close();
    if (!child.killed) child.kill();
    const diagnostic = Buffer.concat(stderr).toString('utf-8').trim();
    if (diagnostic) throw new Error(`engine stderr: ${diagnostic}`);
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  await main();
}
