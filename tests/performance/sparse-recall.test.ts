/**
 * 04-02: Sparse recall performance tests on large document ASTs.
 *
 * Simulates 4000-page documents (~16000-20000 paragraph blocks)
 * and verifies generation, filtering, serialization, and deserialization
 * all complete within budget.
 */

import { describe, it, expect } from 'vitest';
import { BenchmarkRunner } from '../benchmark/benchmark-harness';

// ---------------------------------------------------------------------------
// Large Document AST generator
// ---------------------------------------------------------------------------

interface BlockNode {
  id: string;
  type: 'paragraph' | 'section' | 'list' | 'table';
  text: string;
  level?: number;
  children?: BlockNode[];
}

interface DocumentAst {
  id: string;
  filename: string;
  sha256: string;
  pageCount: number;
  wordCount: number;
  blocks: BlockNode[];
}

function generateLargeDocumentAst(sectionCount: number): DocumentAst {
  const blocks: BlockNode[] = [];

  for (let s = 0; s < sectionCount; s++) {
    // Each section = ~1 page equivalent
    blocks.push({
      id: `sec-${s}`,
      type: 'section',
      text: `第${s + 1}章 项目技术方案 — ${s % 2 === 0 ? '施工组织设计' : '质量保证措施'}`,
      level: 1,
    });

    // 3-5 paragraphs per section
    const paraCount = 3 + (s % 3);
    for (let p = 0; p < paraCount; p++) {
      const textVariants = [
        `本项目拟投入技术人员共计${15 + (s % 20)}人，其中高级工程师${3 + (s % 5)}人，中级工程师${5 + (s % 8)}人。`,
        `施工工期计划为${180 + (s % 60)}个日历天，分三个阶段实施：准备阶段、施工阶段、验收阶段。`,
        `质量目标：确保工程质量达到国家现行验收标准的合格等级，争创优良工程。`,
        `安全目标：杜绝重大安全事故，一般事故频率控制在${1.5 + (s % 3) * 0.5}‰以内。`,
        `本工程采用${s % 2 === 0 ? '钢筋混凝土框架结构' : '钢结构'}，基础形式为${s % 3 === 0 ? '独立基础' : '筏板基础'}。`,
      ];

      for (let p2 = 0; p2 < paraCount; p2++) {
        blocks.push({
          id: `sec-${s}-p-${p2}`,
          type: 'paragraph',
          text: textVariants[(s + p2) % textVariants.length],
        });
      }
    }
  }

  const wordCount = blocks.reduce((sum, b) => sum + b.text.length, 0);

  return {
    id: `large-doc-${sectionCount}`,
    filename: `大型投标文件_${sectionCount}章.docx`,
    sha256: 'a'.repeat(64),
    pageCount: sectionCount,
    wordCount,
    blocks,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sparse Recall — Large Document AST', () => {
  const SECTION_COUNT = 4000;

  it('generates 4000-page document AST within 5s', async () => {
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('generate-4000-page-ast', (tracker) => {
      tracker.startPhase('generate');
      const ast = generateLargeDocumentAst(SECTION_COUNT);
      tracker.endPhase();

      // Sanity: verify the AST is actually large
      expect(ast.blocks.length).toBeGreaterThan(10000);
      expect(ast.pageCount).toBe(SECTION_COUNT);
    });

    const genPhase = result.phases.find((p) => p.name === 'generate')!;
    expect(genPhase.durationMs).toBeLessThan(5000);
  });

  it('filters large document AST by section within 500ms', async () => {
    const ast = generateLargeDocumentAst(SECTION_COUNT);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('filter-4000-page-ast-by-section', (tracker) => {
      tracker.startPhase('filter');
      const sections = ast.blocks.filter((b) => b.type === 'section');
      tracker.endPhase();

      expect(sections.length).toBe(SECTION_COUNT);
    });

    const filterPhase = result.phases.find((p) => p.name === 'filter')!;
    expect(filterPhase.durationMs).toBeLessThan(500);
  });

  it('serializes large document AST to JSON within 2s', async () => {
    const ast = generateLargeDocumentAst(SECTION_COUNT);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('serialize-4000-page-ast', (tracker) => {
      tracker.startPhase('serialize');
      const json = JSON.stringify(ast);
      tracker.endPhase();

      expect(json.length).toBeGreaterThan(100000);
    });

    const serPhase = result.phases.find((p) => p.name === 'serialize')!;
    expect(serPhase.durationMs).toBeLessThan(2000);
  });

  it('deserializes large document AST from JSON within 2s', async () => {
    const ast = generateLargeDocumentAst(SECTION_COUNT);
    const json = JSON.stringify(ast);
    const runner = new BenchmarkRunner('tests/benchmark/results');

    const result = await runner.run('deserialize-4000-page-ast', (tracker) => {
      tracker.startPhase('deserialize');
      const parsed = JSON.parse(json) as DocumentAst;
      tracker.endPhase();

      expect(parsed.blocks.length).toBe(ast.blocks.length);
      expect(parsed.pageCount).toBe(SECTION_COUNT);
    });

    const deserPhase = result.phases.find((p) => p.name === 'deserialize')!;
    expect(deserPhase.durationMs).toBeLessThan(2000);
  });
});
