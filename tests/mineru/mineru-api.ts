#!/usr/bin/env npx tsx
/**
 * MinerU Cloud API Test Script
 * Usage:
 *   npx tsx tests/mineru/mineru-api.ts                    # 测试所有 fixtures PDF, 两个后端
 *   npx tsx tests/mineru/mineru-api.ts fixture.pdf        # 测试指定 PDF, 两个后端
 *   npx tsx tests/mineru/mineru-api.ts fixture.pdf vlm    # 测试指定 PDF, 指定后端
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import { join, basename } from 'path';

const API_BASE = 'https://mineru.net/api/v4';
const API_TOKEN = 'sk-gqygNnaDIKxd5gia6tdTFlZDAA7OyPO9EA4BtuTplDX9p8dS';
const FIXTURES_DIR = join(import.meta.dirname ?? __dirname, 'fixtures');
const OUTPUT_DIR = join(import.meta.dirname ?? __dirname, 'output');
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 600_000; // 10 minutes

type ModelVersion = 'pipeline' | 'vlm';

interface TaskResult {
  taskId: string;
  state: string;
  fullZipUrl?: string;
  extractProgress?: { extractedPages: number; totalPages: number };
  error?: string;
}

interface ContentListItem {
  type: string;
  bbox?: [number, number, number, number];
  page_idx?: number;
  text?: string;
  text_level?: number;
  table_body?: string;
  table_caption?: string[];
  table_footnote?: string[];
  img_path?: string;
  image_caption?: string[];
  sub_type?: string;
  list_items?: string[];
}

interface TestReport {
  file: string;
  modelVersion: ModelVersion;
  taskId: string;
  latencyMs: number;
  contentListItems: number;
  typeDistribution: Record<string, number>;
  sampleItems: ContentListItem[];
  fullMdPreview: string;
  error?: string;
}

// --- API functions ---

async function createTask(pdfUrl: string, modelVersion: ModelVersion): Promise<string> {
  const res = await fetch(`${API_BASE}/extract/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: pdfUrl, model_version: modelVersion }),
  });
  const data = await res.json() as { code: number; msg?: string; data?: { task_id: string } };
  if (data.code !== 0) throw new Error(`createTask failed: ${data.msg ?? JSON.stringify(data)}`);
  return data.data!.task_id;
}

async function uploadLocalFile(filePath: string, modelVersion: ModelVersion): Promise<string> {
  const fileName = basename(filePath);
  const dataId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Step 1: get signed upload URL
  const res = await fetch(`${API_BASE}/file-urls/batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: [{ name: fileName, data_id: dataId }],
      model_version: modelVersion,
    }),
  });
  const data = await res.json() as { code: number; msg?: string; data?: { batch_id: string; file_urls: string[] } };
  if (data.code !== 0) throw new Error(`uploadLocalFile failed: ${data.msg ?? JSON.stringify(data)}`);

  const { batch_id, file_urls } = data.data!;

  // Step 2: PUT file to signed URL (no Content-Type per Pitfall 1)
  const fileBuffer = await readFile(filePath);
  await fetch(file_urls[0], { method: 'PUT', body: fileBuffer });

  return batch_id;
}

async function pollBatch(batchId: string): Promise<{ state: string; fullZipUrl?: string; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const res = await fetch(`${API_BASE}/extract-results/batch/${batchId}`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
    const data = await res.json() as { code: number; data?: { extract_result: Array<{ file_name: string; state: string; full_zip_url?: string; err_msg?: string }> } };
    if (data.code !== 0) throw new Error(`pollBatch failed: ${JSON.stringify(data)}`);

    const result = data.data!.extract_result[0];
    if (!result) throw new Error('No extract_result in response');

    if (result.state === 'done') return { state: 'done', fullZipUrl: result.full_zip_url };
    if (result.state === 'failed') return { state: 'failed', error: result.err_msg ?? 'unknown' };

    process.stdout.write(`  [poll] state=${result.state} (${Math.round((Date.now() - start) / 1000)}s)\n`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Poll timeout');
}

async function pollTask(taskId: string): Promise<TaskResult> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const res = await fetch(`${API_BASE}/extract/task/${taskId}`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
    const data = await res.json() as { code: number; data?: { state: string; full_zip_url?: string; extract_progress?: { extracted_pages: number; total_pages: number }; err_msg?: string } };
    if (data.code !== 0) throw new Error(`pollTask failed: ${JSON.stringify(data)}`);

    const d = data.data!;
    if (d.state === 'done') return { taskId, state: 'done', fullZipUrl: d.full_zip_url };
    if (d.state === 'failed') return { taskId, state: 'failed', error: d.err_msg ?? 'unknown' };

    process.stdout.write(`  [poll] state=${d.state} (${Math.round((Date.now() - start) / 1000)}s)\n`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { taskId, state: 'timeout', error: 'Poll timeout after 10 minutes' };
}

async function downloadAndExtractZip(zipUrl: string, outputDir: string): Promise<string> {
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const zipPath = join(outputDir, 'result.zip');
  await writeFile(zipPath, buffer);

  // Extract using Windows tar (supports ZIP on Windows 10+)
  const extractDir = join(outputDir, 'extracted');
  await mkdir(extractDir, { recursive: true });
  execSync(`tar -xf "${zipPath}" -C "${extractDir}"`, { stdio: 'pipe' });

  return extractDir;
}

function analyzeContentList(items: ContentListItem[]): { typeDistribution: Record<string, number>; sampleItems: ContentListItem[] } {
  const typeDistribution: Record<string, number> = {};
  for (const item of items) {
    typeDistribution[item.type] = (typeDistribution[item.type] ?? 0) + 1;
  }
  // Sample: first item of each type
  const seenTypes = new Set<string>();
  const sampleItems: ContentListItem[] = [];
  for (const item of items) {
    if (!seenTypes.has(item.type)) {
      seenTypes.add(item.type);
      sampleItems.push(item);
    }
  }
  return { typeDistribution, sampleItems };
}

async function runTest(pdfFile: string, modelVersion: ModelVersion): Promise<TestReport> {
  const pdfPath = join(FIXTURES_DIR, pdfFile);
  const pdfBase = basename(pdfFile, '.pdf');
  const startMs = Date.now();

  process.stdout.write(`\n=== Testing ${pdfFile} with ${modelVersion} ===\n`);

  // Upload and start parsing
  process.stdout.write(`[upload] ${pdfFile}...\n`);
  const batchId = await uploadLocalFile(pdfPath, modelVersion);
  process.stdout.write(`[upload] batch_id=${batchId}\n`);

  // Poll until done
  const result = await pollBatch(batchId);
  if (result.state !== 'done') {
    return {
      file: pdfFile, modelVersion, taskId: batchId,
      latencyMs: Date.now() - startMs,
      contentListItems: 0, typeDistribution: {}, sampleItems: [], fullMdPreview: '',
      error: result.error ?? `state=${result.state}`,
    };
  }

  const latencyMs = Date.now() - startMs;
  process.stdout.write(`[done] latency=${(latencyMs / 1000).toFixed(1)}s\n`);

  // Download and extract
  const extractDir = await downloadAndExtractZip(result.fullZipUrl!, join(OUTPUT_DIR, `${pdfBase}-${modelVersion}`));

  // Find and parse content_list.json
  const files = await readdir(extractDir, { recursive: true });
  const contentListFile = files.find(f => typeof f === 'string' && f.includes('content_list.json'));
  if (!contentListFile) throw new Error(`content_list.json not found in ${extractDir}`);

  const contentListPath = join(extractDir, contentListFile);
  const items: ContentListItem[] = JSON.parse(await readFile(contentListPath, 'utf-8'));

  // Read full.md preview
  const fullMdFile = files.find(f => typeof f === 'string' && f.endsWith('.md'));
  let fullMdPreview = '';
  if (fullMdFile) {
    fullMdPreview = (await readFile(join(extractDir, fullMdFile as string), 'utf-8')).slice(0, 2000);
  }

  const { typeDistribution, sampleItems } = analyzeContentList(items);

  return {
    file: pdfFile, modelVersion, taskId: batchId,
    latencyMs, contentListItems: items.length,
    typeDistribution, sampleItems, fullMdPreview,
  };
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const targetFile = args[0]; // optional: specific PDF
  const targetBackend = args[1] as ModelVersion | undefined; // optional: pipeline|vlm

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Find PDF files
  const allFiles = await readdir(FIXTURES_DIR);
  const pdfFiles = allFiles.filter(f => f.endsWith('.pdf'));
  const targetFiles = targetFile ? [targetFile] : pdfFiles;

  if (targetFiles.length === 0) {
    console.error('No PDF files found in tests/mineru/fixtures/');
    console.error('Please add 1-2 bid PDFs (digital + scanned) to run tests.');
    process.exit(1);
  }

  const backends: ModelVersion[] = targetBackend ? [targetBackend] : ['pipeline', 'vlm'];
  const reports: TestReport[] = [];

  for (const pdf of targetFiles) {
    for (const backend of backends) {
      try {
        const report = await runTest(pdf, backend);
        reports.push(report);
      } catch (err) {
        reports.push({
          file: pdf, modelVersion: backend, taskId: '',
          latencyMs: 0, contentListItems: 0, typeDistribution: {},
          sampleItems: [], fullMdPreview: '', error: String(err),
        });
      }
    }
  }

  // Write JSON report
  const reportPath = join(OUTPUT_DIR, 'test-report.json');
  await writeFile(reportPath, JSON.stringify(reports, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  // Print summary
  console.log('\n=== Summary ===');
  for (const r of reports) {
    console.log(`\n${r.file} [${r.modelVersion}]:`);
    if (r.error) {
      console.log(`  ERROR: ${r.error}`);
    } else {
      console.log(`  Latency: ${(r.latencyMs / 1000).toFixed(1)}s`);
      console.log(`  Items: ${r.contentListItems}`);
      console.log(`  Types: ${JSON.stringify(r.typeDistribution)}`);
      console.log(`  Sample text (first 200 chars): ${(r.sampleItems.find(i => i.type === 'text')?.text ?? '').slice(0, 200)}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
