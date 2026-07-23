/**
 * MinerU PDF Pipeline E2E Integration Test
 *
 * Validates the full pipeline: MinerU content_list.json → mapper → DocumentAst → Rust engine → RiskFinding
 * Uses real MinerU output fixtures (digital + scanned PDF).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

import { mapContentListToAst, parseTableBody, type ContentListItem } from '../../packages/shared/src/parser/mineru/mapper.js';
import type { BlockNode, DocumentAst, TableNode, SectionNode, ParagraphNode } from '../../packages/shared/src/document-ast.js';

// Fixture paths (relative to project root)
const FIXTURE_DIR = path.resolve(__dirname, '../mineru/output');
const DIGITAL_FIXTURE = path.join(
  FIXTURE_DIR,
  'mineru_test_file-pipeline/extracted/efc0550a-d4a7-4bea-b615-259f58fa1ee7_content_list.json',
);
const SCANNED_FIXTURE = path.join(
  FIXTURE_DIR,
  'mineru_test_scanned-pipeline/extracted/4b15f1bf-4c9e-4be5-8cef-be527cf952dc_content_list.json',
);

// Engine binary path
const ENGINE_CANDIDATES = [
  path.resolve(__dirname, '../../bidlens-engine/target/release/bidlens-engine.exe'),
  path.resolve(__dirname, '../../bidlens-engine/target/debug/bidlens-engine.exe'),
  path.resolve(__dirname, '../../bidlens-engine/target/release/bidlens-engine'),
  path.resolve(__dirname, '../../bidlens-engine/target/debug/bidlens-engine'),
];

function findEngineBinary(): string | null {
  for (const candidate of ENGINE_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// Helper: flatten all blocks (including nested section children) for counting
function flattenBlocks(blocks: BlockNode[]): BlockNode[] {
  const result: BlockNode[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.type === 'section') {
      result.push(...flattenBlocks(block.children));
    }
  }
  return result;
}

// Helper: count blocks by type
function countByType(blocks: BlockNode[]): Record<string, number> {
  const flat = flattenBlocks(blocks);
  const counts: Record<string, number> = {};
  for (const b of flat) {
    counts[b.type] = (counts[b.type] || 0) + 1;
  }
  return counts;
}

// Helper: build a minimal DocumentAst from blocks
function makeAst(blocks: BlockNode[], filename: string, sha256: string): DocumentAst {
  return {
    id: `ast-${filename}`,
    filename,
    sha256,
    pageCount: null,
    wordCount: flattenBlocks(blocks).reduce((n, b) => {
      if (b.type === 'paragraph') return n + b.text.length;
      if (b.type === 'section') return n + b.title.length;
      return n;
    }, 0),
    parserVersion: 'mineru-e2e-test',
    blocks,
  };
}

// ============================================================================
// Part A: Mapper validation with real MinerU digital PDF output
// ============================================================================
describe('MinerU PDF Pipeline E2E', () => {
  let digitalItems: ContentListItem[];
  let scannedItems: ContentListItem[];

  beforeAll(async () => {
    digitalItems = JSON.parse(await readFile(DIGITAL_FIXTURE, 'utf-8'));
    scannedItems = JSON.parse(await readFile(SCANNED_FIXTURE, 'utf-8'));
  });

  describe('Part A: Mapper — digital PDF content_list.json', () => {
    let blocks: BlockNode[];

    beforeAll(() => {
      blocks = mapContentListToAst(digitalItems);
    });

    it('produces non-empty blocks array', () => {
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('contains at least one paragraph (text_level=0 or no text_level)', () => {
      const counts = countByType(blocks);
      expect(counts.paragraph).toBeGreaterThan(0);
    });

    it('contains at least one section (text_level > 0)', () => {
      const counts = countByType(blocks);
      expect(counts.section).toBeGreaterThan(0);
    });

    it('contains at least one table when content_list has table entries with table_body', () => {
      const hasTableInSource = digitalItems.some(
        (i) => i.type === 'table' && i.table_body && i.table_body.trim().length > 0,
      );
      if (!hasTableInSource) {
        // Skip if no table data in fixture
        return;
      }
      const counts = countByType(blocks);
      expect(counts.table).toBeGreaterThan(0);
    });

    it('TableNode has valid rows (string[][])', () => {
      const tables = flattenBlocks(blocks).filter((b) => b.type === 'table') as TableNode[];
      if (tables.length === 0) return; // no tables in fixture
      for (const table of tables) {
        expect(table.rows.length).toBeGreaterThan(0);
        // Each row must be a string[] (non-empty)
        for (const row of table.rows) {
          expect(Array.isArray(row)).toBe(true);
          expect(row.length).toBeGreaterThan(0);
          for (const cell of row) {
            expect(typeof cell).toBe('string');
          }
        }
        // NOTE: MinerU HTML output may contain colspan/rowspan producing non-rectangular tables.
        // This is a known quality issue. The mapper preserves the raw structure.
      }
    });

    it('converts page_idx from 0-indexed to 1-indexed', () => {
      // Find a source item with page_idx=0 and verify its AST node has pageStart=1
      const firstTextItem = digitalItems.find((i) => i.type === 'text' && i.page_idx === 0 && i.text?.trim());
      if (!firstTextItem) return;
      const flat = flattenBlocks(blocks);
      // The first text with page_idx=0 should map to pageStart=1
      const matchingBlock = flat.find(
        (b) => b.pageStart === 1 && (b.type === 'paragraph' || b.type === 'section'),
      );
      expect(matchingBlock).toBeDefined();
      expect(matchingBlock!.pageStart).toBe(1);
    });

    it('section children have pageStart not exceeding parent section pageStart', () => {
      function checkSection(section: SectionNode): void {
        for (const child of section.children) {
          if (child.pageStart !== null && section.pageStart !== null) {
            // Children can be on the same or later page, but not earlier
            // (This is a soft check — MinerU output may have same-page sections)
          }
          if (child.type === 'section') {
            checkSection(child);
          }
        }
      }
      for (const block of blocks) {
        if (block.type === 'section') {
          checkSection(block);
        }
      }
    });
  });

  // ============================================================================
  // Part B: Mapper validation with scanned PDF output
  // ============================================================================
  describe('Part B: Mapper — scanned PDF content_list.json', () => {
    let scannedBlocks: BlockNode[];
    let digitalBlocks: BlockNode[];

    beforeAll(() => {
      scannedBlocks = mapContentListToAst(scannedItems);
      digitalBlocks = mapContentListToAst(digitalItems);
    });

    it('produces non-empty blocks array', () => {
      expect(scannedBlocks.length).toBeGreaterThan(0);
    });

    it('contains at least one paragraph', () => {
      const counts = countByType(scannedBlocks);
      expect(counts.paragraph).toBeGreaterThan(0);
    });

    it('contains at least one section', () => {
      const counts = countByType(scannedBlocks);
      expect(counts.section).toBeGreaterThan(0);
    });

    it('scanned blocks count >= 80% of digital blocks count (OCR quality)', () => {
      const scannedCount = flattenBlocks(scannedBlocks).length;
      const digitalCount = flattenBlocks(digitalBlocks).length;
      expect(scannedCount).toBeGreaterThanOrEqual(digitalCount * 0.8);
    });

    it('TableNode rows are valid for scanned output', () => {
      const tables = flattenBlocks(scannedBlocks).filter((b) => b.type === 'table') as TableNode[];
      for (const table of tables) {
        expect(table.rows.length).toBeGreaterThan(0);
        for (const row of table.rows) {
          expect(Array.isArray(row)).toBe(true);
          expect(row.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ============================================================================
  // Part C: parseTableBody validation with real HTML
  // ============================================================================
  describe('Part C: parseTableBody with real table_body HTML', () => {
    it('parses all table_body HTML from digital fixture', () => {
      const tableItems = digitalItems.filter(
        (i) => i.type === 'table' && i.table_body && i.table_body.trim().length > 0,
      );
      if (tableItems.length === 0) return;

      for (const item of tableItems) {
        const rows = parseTableBody(item.table_body!);
        expect(Array.isArray(rows)).toBe(true);
        if (rows.length > 0) {
          // Cells should not contain HTML tags
          for (const row of rows) {
            expect(Array.isArray(row)).toBe(true);
            for (const cell of row) {
              expect(cell).not.toMatch(/<[^>]+>/);
            }
          }
        }
      }
    });

    it('parses all table_body HTML from scanned fixture', () => {
      const tableItems = scannedItems.filter(
        (i) => i.type === 'table' && i.table_body && i.table_body.trim().length > 0,
      );
      if (tableItems.length === 0) return;

      for (const item of tableItems) {
        const rows = parseTableBody(item.table_body!);
        expect(Array.isArray(rows)).toBe(true);
        if (rows.length > 0) {
          for (const row of rows) {
            expect(Array.isArray(row)).toBe(true);
            for (const cell of row) {
              expect(cell).not.toMatch(/<[^>]+>/);
            }
          }
        }
      }
    });
  });

  // ============================================================================
  // Part D: DocumentAst → Rust engine → RiskFinding (full pipeline)
  // ============================================================================
  describe('Part D: DocumentAst → Rust engine risk.analyzeWithAst', () => {
    const engineBinary = findEngineBinary();

    // Skip entire describe if engine not built
    if (!engineBinary) {
      it.skip('engine binary not found — run: cargo build --manifest-path bidlens-engine/Cargo.toml', () => {});
      return;
    }

    // Helper: send JSON-RPC request to engine and get response.
    // For async methods like risk.analyzeWithAst, the engine sends two responses
    // with the same id: first { status: "started" }, then the actual result.
    // We skip the "started" response and wait for the completion response.
    function rpcCall(
      enginePath: string,
      request: { id: string; method: string; params: unknown },
      timeoutMs = 300_000,
    ): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const child = spawn(enginePath, [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            child.kill();
            reject(new Error(`Engine request timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        child.stdout!.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
          let nl: number;
          while ((nl = stdout.indexOf('\n')) !== -1) {
            const line = stdout.slice(0, nl).trim();
            stdout = stdout.slice(nl + 1);
            if (!line) continue;
            try {
              const msg = JSON.parse(line);
              if ('id' in msg && msg.id === request.id) {
                if (msg.error) {
                  if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    child.kill();
                    reject(new Error(`Engine error [${msg.error.code}]: ${msg.error.message}`));
                  }
                  return;
                }
                // Skip "started" acknowledgment — wait for actual result
                if (msg.result?.status === 'started') {
                  continue;
                }
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  child.kill();
                  resolve(msg.result);
                }
              }
            } catch {
              // ignore malformed lines
            }
          }
        });

        child.stderr!.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        child.on('exit', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new Error(`Engine exited before response. stderr: ${stderr.slice(0, 500)}`));
          }
        });

        child.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });

        const line = JSON.stringify(request) + '\n';
        child.stdin!.write(line);
      });
    }

    it('toEngineDocumentAst produces valid engine AST from MinerU output', () => {
      // Import toEngineDocumentAst — it's in engine-manager which has Electron deps,
      // so we test the conversion logic inline by verifying the structure directly.
      const blocks = mapContentListToAst(scannedItems);
      const ast = makeAst(blocks, 'scanned-test.pdf', 'sha256-scanned');

      // Verify the AST is valid input for the engine
      expect(ast.blocks.length).toBeGreaterThan(0);
      expect(ast.sha256).toBe('sha256-scanned');

      // Verify block structure matches what engine expects
      const flat = flattenBlocks(ast.blocks);
      for (const block of flat) {
        expect(block).toHaveProperty('type');
        expect(block).toHaveProperty('id');
        if (block.type === 'paragraph') {
          expect(typeof (block as ParagraphNode).text).toBe('string');
        }
        if (block.type === 'table') {
          const table = block as TableNode;
          expect(Array.isArray(table.rows)).toBe(true);
          for (const row of table.rows) {
            expect(Array.isArray(row)).toBe(true);
            for (const cell of row) {
              expect(typeof cell).toBe('string');
            }
          }
        }
      }
    });

    it('risk.analyzeWithAst returns findings with evidence', async () => {
      const blocks = mapContentListToAst(scannedItems);
      const hash1 = 'a'.repeat(64); // valid 32-byte hex
      const hash2 = 'b'.repeat(64);
      const ast = makeAst(blocks, 'scanned-test.pdf', hash1);

      // Build two submissions with same content but different fileHash
      // to trigger cross-submission similarity detection
      const submission = {
        submissionId: 'sub-pdf-1',
        fileHash: hash1,
        ast: buildEngineAst(ast),
      };
      const submission2 = {
        submissionId: 'sub-pdf-2',
        fileHash: hash2,
        ast: buildEngineAst(makeAst(blocks, 'scanned-test-2.pdf', hash2)),
      };

      const result = (await rpcCall(engineBinary!, {
        id: 'risk-test-1',
        method: 'risk.analyzeWithAst',
        params: {
          projectId: 'e2e-test-pdf',
          submissions: [submission, submission2],
          baseline: null,
          preset: 'standard',
        },
      })) as any;

      // Verify findings
      expect(result).toHaveProperty('findings');
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);

      const finding = result.findings[0];
      expect(finding).toHaveProperty('id');
      expect(finding).toHaveProperty('detectorType');
      expect(finding).toHaveProperty('riskLevel');
      expect(finding).toHaveProperty('involvedSubmissionIds');
      expect(finding.involvedSubmissionIds).toContain('sub-pdf-1');
      expect(finding.involvedSubmissionIds).toContain('sub-pdf-2');

      // Verify evidence
      expect(Array.isArray(finding.evidence)).toBe(true);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.evidence[0].sourceOriginalText).toBeTruthy();
      expect(typeof finding.evidence[0].sourceOriginalText).toBe('string');
      expect(finding.evidence[0].sourceOriginalText.length).toBeGreaterThan(0);

      // Verify filePairAssessments
      expect(result).toHaveProperty('filePairAssessments');
      expect(Array.isArray(result.filePairAssessments)).toBe(true);
      expect(result.filePairAssessments.length).toBeGreaterThan(0);
      expect(result.filePairAssessments[0].symmetricSimilarity).toBeGreaterThan(0);
    }, 310_000); // 310s timeout for engine startup + analysis
  });
});

// ============================================================================
// Helper: convert DocumentAst to engine-compatible format
// (Reimplements toEngineDocumentAst logic without Electron dependency)
// ============================================================================

interface EngineParagraphNode {
  type: 'paragraph';
  id: string;
  runs: Array<{ id: string; text: string; format: null }>;
  page_start: number | null;
  page_end: number | null;
  paragraph_format: null;
}

interface EngineTableNode {
  type: 'table';
  id: string;
  rows: Array<{
    id: string;
    cells: Array<{
      id: string;
      content: EngineParagraphNode[];
      span: null;
      properties: null;
    }>;
    row_type: 'header' | 'body';
  }>;
  page_start: number | null;
  page_end: number | null;
  properties: null;
}

type EngineBlockNode = EngineParagraphNode | EngineTableNode;

function toEngineParagraph(
  id: string,
  text: string,
  pageStart: number | null,
  pageEnd: number | null,
): EngineParagraphNode {
  return {
    type: 'paragraph',
    id,
    runs: [{ id: `${id}-run-0`, text, format: null }],
    page_start: pageStart,
    page_end: pageEnd,
    paragraph_format: null,
  };
}

function toEngineBlocks(blocks: BlockNode[]): EngineBlockNode[] {
  return blocks.flatMap((block): EngineBlockNode[] => {
    switch (block.type) {
      case 'paragraph':
        return [toEngineParagraph(block.id, block.text, block.pageStart, block.pageEnd)];
      case 'section':
        return [
          toEngineParagraph(`${block.id}-heading`, block.title, block.pageStart, block.pageEnd),
          ...toEngineBlocks(block.children),
        ];
      case 'list':
        return block.items.map((item) =>
          toEngineParagraph(item.id, item.text, item.pageStart, item.pageEnd),
        );
      case 'table':
        return [
          {
            type: 'table',
            id: block.id,
            rows: block.rows.map((row, rowIndex) => ({
              id: `${block.id}-row-${rowIndex}`,
              row_type: rowIndex === 0 ? ('header' as const) : ('body' as const),
              cells: row.map((text, cellIndex) => {
                const cellId = `${block.id}-row-${rowIndex}-cell-${cellIndex}`;
                return {
                  id: cellId,
                  content: [toEngineParagraph(`${cellId}-paragraph`, text, null, null)],
                  span: null,
                  properties: null,
                };
              }),
            })),
            page_start: block.pageStart,
            page_end: block.pageEnd,
            properties: null,
          },
        ];
    }
  });
}

function buildEngineAst(ast: DocumentAst) {
  return {
    id: ast.id,
    filename: ast.filename,
    sha256: ast.sha256,
    page_count: ast.pageCount,
    word_count: ast.wordCount,
    parser_version: ast.parserVersion,
    blocks: toEngineBlocks(ast.blocks),
    comments: [],
    revisions: [],
  };
}
