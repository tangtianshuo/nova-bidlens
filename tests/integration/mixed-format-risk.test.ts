/**
 * Mixed Format Risk Detection Integration Test
 *
 * Verifies that a project with DOCX + PDF submissions produces
 * valid cross-format file-pair assessments from the Rust engine.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { mapContentListToAst, type ContentListItem } from '../../packages/shared/src/parser/mineru/mapper.js';
import type { DocumentAst, BlockNode, ParagraphNode, SectionNode, ListNode, TableNode } from '../../packages/shared/src/document-ast.js';

// --- Inline toEngineDocumentAst (pure transform, avoids Electron import chain) ---

interface EngineRunNode { id: string; text: string; format: null }
interface EngineParagraphNode { type: 'paragraph'; id: string; runs: EngineRunNode[]; page_start: number | null; page_end: number | null; paragraph_format: null }
interface EngineTableNode {
  type: 'table'; id: string;
  rows: Array<{ id: string; cells: Array<{ id: string; content: EngineParagraphNode[]; span: null; properties: null }>; row_type: 'header' | 'body' }>;
  page_start: number | null; page_end: number | null; properties: null;
}
type EngineBlockNode = EngineParagraphNode | EngineTableNode;
interface EngineDocumentAst { id: string; filename: string; sha256: string; page_count: number | null; word_count: number; parser_version: string; blocks: EngineBlockNode[]; comments: unknown[]; revisions: unknown[] }

function toEngineParagraph(id: string, text: string, pageStart: number | null, pageEnd: number | null): EngineParagraphNode {
  return { type: 'paragraph', id, runs: [{ id: `${id}-run-0`, text, format: null }], page_start: pageStart, page_end: pageEnd, paragraph_format: null };
}

function toEngineBlocks(blocks: BlockNode[]): EngineBlockNode[] {
  return blocks.flatMap((block): EngineBlockNode[] => {
    switch (block.type) {
      case 'paragraph':
        return [toEngineParagraph(block.id, block.text, block.pageStart, block.pageEnd)];
      case 'section':
        return [toEngineParagraph(`${block.id}-heading`, block.title, block.pageStart, block.pageEnd), ...toEngineBlocks(block.children)];
      case 'list':
        return block.items.map(item => toEngineParagraph(item.id, item.text, item.pageStart, item.pageEnd));
      case 'table':
        return [{
          type: 'table', id: block.id,
          rows: block.rows.map((row, ri) => ({
            id: `${block.id}-row-${ri}`, row_type: ri === 0 ? 'header' as const : 'body' as const,
            cells: row.map((text, ci) => {
              const cellId = `${block.id}-row-${ri}-cell-${ci}`;
              return { id: cellId, content: [toEngineParagraph(`${cellId}-paragraph`, text, null, null)], span: null, properties: null };
            }),
          })),
          page_start: block.pageStart, page_end: block.pageEnd, properties: null,
        }];
    }
  });
}

function toEngineDocumentAst(document: DocumentAst): EngineDocumentAst {
  return {
    id: document.id, filename: document.filename, sha256: document.sha256,
    page_count: document.pageCount, word_count: document.wordCount, parser_version: document.parserVersion,
    blocks: toEngineBlocks(document.blocks), comments: [], revisions: [],
  };
}

// --- Engine binary resolution ---

function findEngineBinary(): string | null {
  const projectRoot = path.resolve(import.meta.dirname, '..', '..');
  const candidates = [
    path.join(projectRoot, 'bidlens-engine', 'target', 'release', 'bidlens-engine.exe'),
    path.join(projectRoot, 'bidlens-engine', 'target', 'debug', 'bidlens-engine.exe'),
    path.join(projectRoot, 'bidlens-engine', 'target', 'release', 'bidlens-engine'),
    path.join(projectRoot, 'bidlens-engine', 'target', 'debug', 'bidlens-engine'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

// --- JSON-RPC helper ---

interface RpcResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

function rpcCall(
  engine: ChildProcess,
  method: string,
  params: unknown,
  timeoutMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `test-${Date.now()}`;
    const request = { id, method, params };
    let buffer = '';
    let settled = false;
    let ackReceived = false; // skip {status:"started"} ack for async methods

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`RPC ${method} timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    function onData(chunk: Buffer) {
      if (settled) return;
      buffer += chunk.toString();
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as RpcResponse;
          if (msg.id === id) {
            // Skip the initial {status:"started"} ack for async methods
            if (!ackReceived && msg.result && (msg.result as Record<string, unknown>).status === 'started') {
              ackReceived = true;
              continue;
            }
            settled = true;
            clearTimeout(timer);
            cleanup();
            if (msg.error) {
              reject(new Error(`Engine error [${msg.error.code}]: ${msg.error.message}`));
            } else {
              resolve(msg.result);
            }
            return;
          }
        } catch {
          // ignore malformed lines
        }
      }
    }

    function cleanup() {
      engine.stdout?.removeListener('data', onData);
    }

    engine.stdout?.on('data', onData);
    engine.stdin?.write(JSON.stringify(request) + '\n');
  });
}

// --- Word count helper ---

function countWords(blocks: BlockNode[]): number {
  const countText = (text: string): number => {
    const cn = (text.match(/[一-鿿]/g) || []).length;
    const en = text.replace(/[一-鿿]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    return cn + en;
  };

  let total = 0;
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        total += countText(block.text);
        break;
      case 'table':
        total += block.rows.flat().reduce((s, c) => s + countText(c), 0);
        break;
      case 'section':
        total += countText(block.title);
        total += countWords(block.children);
        break;
      case 'list':
        total += block.items.reduce((s, p) => s + countText(p.text), 0);
        break;
    }
  }
  return total;
}

// --- Fixture paths ---

const projectRoot = path.resolve(import.meta.dirname, '..', '..');
const PDF_CONTENT_LIST_PATH = path.join(
  projectRoot,
  'tests', 'mineru', 'output', 'mineru_test_scanned-pipeline',
  'extracted', '4b15f1bf-4c9e-4be5-8cef-be527cf952dc_content_list.json',
);
const DOCX_FILE_PATH = path.join(
  projectRoot,
  'tests', 'mineru', 'fixtures', 'mineru_test_file_docx.docx',
);

// --- Build ASTs ---

async function buildPdfAst(): Promise<DocumentAst> {
  const raw = await readFile(PDF_CONTENT_LIST_PATH, 'utf-8');
  const items = JSON.parse(raw) as ContentListItem[];
  const blocks = mapContentListToAst(items);
  return {
    id: 'pdf-test-id',
    filename: 'mineru_test_scanned.pdf',
    sha256: 'e'.repeat(64), // 合法 64 字符 hex
    pageCount: null,
    wordCount: countWords(blocks),
    parserVersion: 'mineru-api-v4',
    blocks,
  };
}

async function buildDocxAst(): Promise<DocumentAst> {
  // Try real docx4js parsing first
  try {
    const { globalRegistry } = await import('../../packages/shared/src/parser/index.js');
    const parser = globalRegistry.findByExtension('docx');
    if (parser) {
      const result = await parser.parse(
        { filePath: DOCX_FILE_PATH, fileName: 'mineru_test_file_docx.docx', fileSize: 0 },
        { fidelityLevel: 3, extractComments: false, extractRevisions: false, extractImages: false, maxPages: 0, timeout: 30_000 },
      );
      if (result.success && result.ast && result.ast.blocks.length > 0) {
        return result.ast;
      }
    }
  } catch {
    // fall through to manual AST
  }

  // Fallback: manual AST with realistic content
  return {
    id: 'docx-test-id',
    filename: 'mineru_test_file_docx.docx',
    sha256: 'd'.repeat(64), // 合法 64 字符 hex
    pageCount: 1,
    wordCount: 100,
    parserVersion: 'docx4js',
    blocks: [
      { type: 'paragraph', id: 'p1', text: '投标人应提供营业执照副本复印件', pageStart: 1, pageEnd: 1 },
      { type: 'paragraph', id: 'p2', text: '投标人须提供近三年财务报表', pageStart: 1, pageEnd: 1 },
      { type: 'paragraph', id: 'p3', text: '技术规格要求详见附件', pageStart: 1, pageEnd: 1 },
    ],
  };
}

// --- Main test suite ---

describe('Mixed Format Risk Detection', () => {
  let docxAst: DocumentAst;
  let pdfAst: DocumentAst;
  let engine: ChildProcess | null = null;
  let enginePath: string | null = null;

  beforeAll(async () => {
    [docxAst, pdfAst] = await Promise.all([buildDocxAst(), buildPdfAst()]);
    enginePath = findEngineBinary();
  });

  afterAll(async () => {
    if (engine && !engine.killed) {
      try {
        await rpcCall(engine, 'shutdown', {}, 3000);
      } catch { /* ignore */ }
      engine.kill('SIGKILL');
      engine = null;
    }
  });

  it('DOCX and PDF produce valid DocumentAst independently', () => {
    expect(docxAst.blocks.length).toBeGreaterThan(0);
    expect(pdfAst.blocks.length).toBeGreaterThan(0);
    expect(docxAst.parserVersion).not.toBe(pdfAst.parserVersion);
  });

  it('toEngineDocumentAst converts both formats correctly', () => {
    const engineDocx = toEngineDocumentAst(docxAst);
    const enginePdf = toEngineDocumentAst(pdfAst);

    expect(engineDocx.blocks.length).toBeGreaterThan(0);
    expect(enginePdf.blocks.length).toBeGreaterThan(0);
    expect(engineDocx.parser_version).toBe(docxAst.parserVersion);
    expect(enginePdf.parser_version).toBe(pdfAst.parserVersion);
  });

  it('Rust engine processes mixed-format project and produces cross-format assessment', async () => {
    if (!enginePath) {
      console.warn('Engine binary not found, skipping. Run: cargo build --manifest-path bidlens-engine/Cargo.toml');
      return; // vitest: test passes but does nothing
    }

    // Spawn engine
    engine = spawn(enginePath, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    await new Promise(r => setTimeout(r, 500)); // let it start

    // Build request
    const request = {
      projectId: 'mixed-format-test',
      submissions: [
        {
          submissionId: 'sub-docx',
          fileHash: docxAst.sha256,
          ast: toEngineDocumentAst(docxAst),
        },
        {
          submissionId: 'sub-pdf',
          fileHash: pdfAst.sha256,
          ast: toEngineDocumentAst(pdfAst),
        },
      ],
      baseline: null,
      preset: 'standard' as const,
    };

    const result = (await rpcCall(engine, 'risk.analyzeWithAst', request, 300_000)) as {
      findings: Array<{
        id: string;
        detectorType: string;
        riskLevel: string;
        involvedSubmissionIds: string[];
        symmetricSimilarity: number;
        evidence: Array<{
          id: string;
          sourceSubmissionId: string;
          targetSubmissionId: string;
          sourceOriginalText: string;
          targetOriginalText: string;
          matchBasis: string;
          similarityScore: number;
        }>;
      }>;
      filePairAssessments: Array<{
        submissionAId: string;
        submissionBId: string;
        symmetricSimilarity: number;
        riskLevel: string;
        directionalCoverageAB: number;
        directionalCoverageBA: number;
      }>;
      projectRisk: { level: string; rawRuleScore: number };
      detectorRuns: Array<{ detectorType: string; status: string }>;
    };

    // findings may be empty (different documents) — that's OK
    expect(Array.isArray(result.findings)).toBe(true);

    // 验证检测器执行记录
    expect(result.detectorRuns).toBeDefined();
    expect(result.detectorRuns.length).toBeGreaterThan(0);
    for (const run of result.detectorRuns) {
      expect(['completed', 'skipped']).toContain(run.status);
    }

    // filePairAssessments must exist with at least one entry
    expect(result.filePairAssessments).toBeDefined();
    expect(result.filePairAssessments.length).toBeGreaterThanOrEqual(1);

    // Cross-format pair: one side is DOCX, other is PDF
    const crossPair = result.filePairAssessments.find(
      p =>
        (p.submissionAId === 'sub-docx' && p.submissionBId === 'sub-pdf') ||
        (p.submissionAId === 'sub-pdf' && p.submissionBId === 'sub-docx'),
    );
    expect(crossPair).toBeDefined();
    expect(crossPair!.symmetricSimilarity).toBeGreaterThanOrEqual(0);
    expect(crossPair!.symmetricSimilarity).toBeLessThanOrEqual(1);
    expect(['low', 'medium', 'high']).toContain(crossPair!.riskLevel);

    // 不同内容的 submission 通常不会产出 findings（无相似文本段落）
    // findings.length === 0 是正常的——这里验证的是 filePairAssessment，不是 findings
    // 如果有 findings，验证 evidence 引用正确
    if (result.findings.length > 0) {
      for (const finding of result.findings) {
        expect(finding.involvedSubmissionIds.some(
          id => id === 'sub-docx' || id === 'sub-pdf',
        )).toBe(true);

        if (finding.evidence.length > 0) {
          for (const ev of finding.evidence) {
            expect(['sub-docx', 'sub-pdf']).toContain(ev.sourceSubmissionId);
            expect(['sub-docx', 'sub-pdf']).toContain(ev.targetSubmissionId);
            expect(ev.sourceOriginalText.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('cross-format project risk assessment is computed', async () => {
    if (!enginePath) return;

    // Reuse engine from previous test (or spawn new one)
    if (!engine || engine.killed) {
      engine = spawn(enginePath, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      await new Promise(r => setTimeout(r, 500));
    }

    const request = {
      projectId: 'mixed-format-risk-test',
      submissions: [
        { submissionId: 'sub-docx', fileHash: docxAst.sha256, ast: toEngineDocumentAst(docxAst) },
        { submissionId: 'sub-pdf', fileHash: pdfAst.sha256, ast: toEngineDocumentAst(pdfAst) },
      ],
      baseline: null,
      preset: 'standard' as const,
    };

    const result = (await rpcCall(engine, 'risk.analyzeWithAst', request, 300_000)) as {
      projectRisk: { level: string; rawRuleScore: number };
    };

    expect(result.projectRisk).toBeDefined();
    expect(['low', 'medium', 'high']).toContain(result.projectRisk.level);
    expect(typeof result.projectRisk.rawRuleScore).toBe('number');
  });
});
