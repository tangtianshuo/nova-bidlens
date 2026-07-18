/**
 * P6-01/P6-02/P6-03/P6-04: Performance benchmark tests.
 *
 * Tests performance of:
 * - Document parsing (P6-03)
 * - Diff computation (P6-02)
 * - Filtering and selection (P6-04)
 * - Report generation (P6-03)
 */

import { describe, it, expect } from 'vitest';
import { benchmark, BenchmarkRunner } from './benchmark-harness';
import { parseDocumentXmlToAst } from '../../apps/desktop/src/main/parser/docx-parser';
import { createFullFidelityReport, generateMarkdownReport, generateHtmlReport } from '../../packages/shared/src/report-export';
import type { DiffAst, DiffItem, DocumentAst } from '../../packages/shared/src';

// ---------------------------------------------------------------------------
// Fixture generators
// ---------------------------------------------------------------------------

function generateLargeDocxXml(paragraphCount: number): string {
  const paragraphs = Array.from({ length: paragraphCount }, (_, i) => {
    const text = `段落 ${i + 1}: 这是用于性能测试的示例文本内容，包含中文和English混合。数字：${i * 17 % 1000}。`;
    return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  }).join('\n');
  return `<w:document><w:body>${paragraphs}</w:body></w:document>`;
}

function generateLargeDiffAst(itemCount: number): DiffAst {
  const items: DiffItem[] = Array.from({ length: itemCount }, (_, i) => {
    const matchTypes = ['identical', 'modified', 'added', 'deleted', 'moved'] as const;
    const matchType = matchTypes[i % matchTypes.length];
    return {
      matchId: `m${i}`,
      matchType,
      confidence: 0.8 + (i % 20) * 0.01,
      similarity: 0.7 + (i % 30) * 0.01,
      sourceA: matchType === 'added' ? null : `源文本A-${i}: ${'x'.repeat(50 + (i % 100))}`,
      sourceB: matchType === 'deleted' ? null : `源文本B-${i}: ${'y'.repeat(50 + (i % 100))}`,
      nodeIdsA: [`a-${i}`],
      nodeIdsB: [`b-${i}`],
      diffDetail: matchType === 'modified' ? [
        { kind: 'same', text: '相同部分' },
        { kind: 'removed', text: '旧文本' },
        { kind: 'added', text: '新文本' },
      ] : [],
      summary: `差异项 ${i}: ${matchType}`,
    };
  });

  return {
    taskId: 'bench-task',
    docAId: 'docA',
    docBId: 'docB',
    generatedAt: new Date().toISOString(),
    summary: {
      identical: Math.floor(itemCount * 0.4),
      modified: Math.floor(itemCount * 0.3),
      added: Math.floor(itemCount * 0.15),
      deleted: Math.floor(itemCount * 0.1),
      moved: Math.floor(itemCount * 0.05),
      split: 0,
      merged: 0,
      uncertain: 0,
    },
    items,
  };
}

// ---------------------------------------------------------------------------
// Benchmark Tests
// ---------------------------------------------------------------------------

describe('Performance Benchmarks', () => {
  describe('P6-03: Document Parsing', () => {
    it('parses small document (10 paragraphs) within budget', async () => {
      const xml = generateLargeDocxXml(10);
      const result = await benchmark('parse-small-10', (tracker) => {
        tracker.startPhase('parse');
        parseDocumentXmlToAst(xml, { filename: 'small.docx', sha256: 'sha-small' });
        tracker.endPhase();
      });

      const parsePhase = result.phases.find((p) => p.name === 'parse')!;
      expect(parsePhase.durationMs).toBeLessThan(100); // < 100ms
    });

    it('parses medium document (100 paragraphs) within budget', async () => {
      const xml = generateLargeDocxXml(100);
      const result = await benchmark('parse-medium-100', (tracker) => {
        tracker.startPhase('parse');
        parseDocumentXmlToAst(xml, { filename: 'medium.docx', sha256: 'sha-medium' });
        tracker.endPhase();
      });

      const parsePhase = result.phases.find((p) => p.name === 'parse')!;
      expect(parsePhase.durationMs).toBeLessThan(500); // < 500ms
    });

    it('parses large document (1000 paragraphs) within budget', async () => {
      const xml = generateLargeDocxXml(1000);
      const result = await benchmark('parse-large-1000', (tracker) => {
        tracker.startPhase('parse');
        parseDocumentXmlToAst(xml, { filename: 'large.docx', sha256: 'sha-large' });
        tracker.endPhase();
      });

      const parsePhase = result.phases.find((p) => p.name === 'parse')!;
      expect(parsePhase.durationMs).toBeLessThan(2000); // < 2s
    });
  });

  describe('P6-02: Diff Computation', () => {
    it('generates report for small diff (100 items) within budget', async () => {
      const diffAst = generateLargeDiffAst(100);
      const result = await benchmark('report-small-100', (tracker) => {
        tracker.startPhase('create-report');
        const report = createFullFidelityReport(diffAst);
        tracker.endPhase();

        tracker.startPhase('generate-markdown');
        generateMarkdownReport(report);
        tracker.endPhase();

        tracker.startPhase('generate-html');
        generateHtmlReport(report);
        tracker.endPhase();
      });

      const mdPhase = result.phases.find((p) => p.name === 'generate-markdown')!;
      const htmlPhase = result.phases.find((p) => p.name === 'generate-html')!;
      expect(mdPhase.durationMs).toBeLessThan(50); // < 50ms
      expect(htmlPhase.durationMs).toBeLessThan(50); // < 50ms
    });

    it('generates report for medium diff (1000 items) within budget', async () => {
      const diffAst = generateLargeDiffAst(1000);
      const result = await benchmark('report-medium-1000', (tracker) => {
        tracker.startPhase('create-report');
        const report = createFullFidelityReport(diffAst);
        tracker.endPhase();

        tracker.startPhase('generate-markdown');
        generateMarkdownReport(report);
        tracker.endPhase();

        tracker.startPhase('generate-html');
        generateHtmlReport(report);
        tracker.endPhase();
      });

      const mdPhase = result.phases.find((p) => p.name === 'generate-markdown')!;
      const htmlPhase = result.phases.find((p) => p.name === 'generate-html')!;
      expect(mdPhase.durationMs).toBeLessThan(200); // < 200ms
      expect(htmlPhase.durationMs).toBeLessThan(200); // < 200ms
    });

    it('generates report for large diff (10000 items) within budget', async () => {
      const diffAst = generateLargeDiffAst(10000);
      const result = await benchmark('report-large-10000', (tracker) => {
        tracker.startPhase('create-report');
        const report = createFullFidelityReport(diffAst);
        tracker.endPhase();

        tracker.startPhase('generate-markdown');
        generateMarkdownReport(report);
        tracker.endPhase();

        tracker.startPhase('generate-html');
        generateHtmlReport(report);
        tracker.endPhase();
      });

      const mdPhase = result.phases.find((p) => p.name === 'generate-markdown')!;
      const htmlPhase = result.phases.find((p) => p.name === 'generate-html')!;
      expect(mdPhase.durationMs).toBeLessThan(1000); // < 1s
      expect(htmlPhase.durationMs).toBeLessThan(1000); // < 1s
    });
  });

  describe('P6-04: Filtering and Selection', () => {
    it('filters 50000 items within budget', async () => {
      const items = generateLargeDiffAst(50000).items;

      const result = await benchmark('filter-50000', (tracker) => {
        tracker.startPhase('filter-by-type');
        const modified = items.filter((i) => i.matchType === 'modified');
        tracker.endPhase();

        tracker.startPhase('filter-by-search');
        const query = '测试';
        const searched = items.filter(
          (i) => i.sourceA?.includes(query) || i.sourceB?.includes(query)
        );
        tracker.endPhase();

        tracker.startPhase('filter-combined');
        const combined = items.filter(
          (i) => i.matchType === 'modified' && i.confidence > 0.9
        );
        tracker.endPhase();
      });

      for (const phase of result.phases) {
        expect(phase.durationMs).toBeLessThan(100); // < 100ms per filter
      }
    });

    it('sorts 50000 items within budget', async () => {
      const items = [...generateLargeDiffAst(50000).items];

      const result = await benchmark('sort-50000', (tracker) => {
        tracker.startPhase('sort-by-confidence');
        items.sort((a, b) => b.confidence - a.confidence);
        tracker.endPhase();

        tracker.startPhase('sort-by-match-type');
        items.sort((a, b) => a.matchType.localeCompare(b.matchType));
        tracker.endPhase();
      });

      for (const phase of result.phases) {
        expect(phase.durationMs).toBeLessThan(200); // < 200ms per sort
      }
    });
  });

  describe('P6-01: Benchmark Runner', () => {
    it('tracks phase timing accurately', async () => {
      const runner = new BenchmarkRunner('tests/benchmark/results');

      const result = await runner.run('timing-test', async (tracker) => {
        tracker.startPhase('phase-1');
        await new Promise((resolve) => setTimeout(resolve, 50));
        tracker.endPhase();

        tracker.startPhase('phase-2');
        await new Promise((resolve) => setTimeout(resolve, 30));
        tracker.endPhase();
      });

      expect(result.phases).toHaveLength(2);
      expect(result.phases[0].name).toBe('phase-1');
      expect(result.phases[0].durationMs).toBeGreaterThanOrEqual(45);
      expect(result.phases[0].durationMs).toBeLessThan(100);
      expect(result.phases[1].name).toBe('phase-2');
      expect(result.phases[1].durationMs).toBeGreaterThanOrEqual(25);
      expect(result.phases[1].durationMs).toBeLessThan(80);
    });

    it('records memory snapshots', async () => {
      const runner = new BenchmarkRunner('tests/benchmark/results');

      const result = await runner.run('memory-test', (tracker) => {
        tracker.startPhase('allocate');
        const arrays: number[][] = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new Array(10000).fill(i));
        }
        tracker.endPhase();
      });

      expect(result.memory.heapUsedMb).toBeGreaterThan(0);
      expect(result.memory.heapTotalMb).toBeGreaterThan(0);
      expect(result.memory.rssMb).toBeGreaterThan(0);
    });

    it('records machine metadata', async () => {
      const runner = new BenchmarkRunner('tests/benchmark/results');

      const result = await runner.run('metadata-test', () => {
        // No-op
      });

      expect(result.machine.platform).toBeDefined();
      expect(result.machine.arch).toBeDefined();
      expect(result.machine.cpus).toBeGreaterThan(0);
      expect(result.machine.nodeVersion).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });
});
