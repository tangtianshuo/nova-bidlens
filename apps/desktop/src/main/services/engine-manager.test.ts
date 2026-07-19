/**
 * Unit tests for engine-manager (P1-06 through P1-12)
 *
 * These tests focus on the EngineManager's public API and JSON-RPC protocol.
 * Integration tests with a real engine binary should be done separately.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock Electron (needed by resolveEnginePath)
vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

describe('engine-manager', async () => {
  const { EngineManager, toEngineDocumentAst } = await import('./engine-manager.js');

  it('creates an instance', () => {
    const manager = new EngineManager('/mock/engine');
    expect(manager).toBeDefined();
    expect(manager.isRunning()).toBe(false);
  });

  it('accepts enginePath override in constructor', () => {
    const manager = new EngineManager('/custom/path/to/engine');
    expect(manager).toBeDefined();
  });

  it('isRunning returns false before start', () => {
    const manager = new EngineManager('/mock/engine');
    expect(manager.isRunning()).toBe(false);
  });

  it('stop is safe to call when not started', async () => {
    const manager = new EngineManager('/mock/engine');
    // Should not throw
    await manager.stop();
    expect(manager.isRunning()).toBe(false);
  });

  it('setProgressCallback does not throw', () => {
    const manager = new EngineManager('/mock/engine');
    expect(() => manager.setProgressCallback(null)).not.toThrow();
    expect(() => manager.setProgressCallback(() => {})).not.toThrow();
  });

  it('adapts the shared AST to the Rust transport contract', () => {
    const result = toEngineDocumentAst({
      id: 'doc-1',
      filename: 'contract.docx',
      sha256: 'abc123',
      pageCount: 2,
      wordCount: 12,
      parserVersion: 'test',
      blocks: [
        {
          type: 'section',
          id: 'section-1',
          title: '付款条款',
          level: 1,
          pageStart: 1,
          pageEnd: 1,
          children: [{
            type: 'paragraph',
            id: 'paragraph-1',
            text: '首付款为合同金额的 10%',
            pageStart: 1,
            pageEnd: 1,
          }],
        },
        {
          type: 'table',
          id: 'table-1',
          rows: [['甲方', '乙方'], ['上海', '张家港']],
          pageStart: 2,
          pageEnd: 2,
        },
      ],
      comments: [{
        id: 'comment-1',
        author: 'Reviewer',
        date: '2026-07-19',
        content: '请核对',
        range: {
          startNodeId: 'paragraph-1',
          startOffset: 0,
          endNodeId: 'paragraph-1',
          endOffset: 3,
        },
        replies: [],
        resolved: false,
      }],
      revisions: [{
        id: 'revision-1',
        author: 'Editor',
        date: '2026-07-19',
        revisionType: 'formatChange',
        content: {
          text: '',
          position: { nodeId: 'paragraph-1', offset: 0 },
        },
      }],
    });

    expect(result).toMatchObject({
      page_count: 2,
      word_count: 12,
      parser_version: 'test',
      comments: [{ range: { start_node_id: 'paragraph-1' } }],
      revisions: [{
        revision_type: 'format_change',
        accepted: null,
        content: { position: { node_id: 'paragraph-1' } },
      }],
    });
    expect(result.blocks[0]).toMatchObject({
      type: 'paragraph',
      id: 'section-1-heading',
      runs: [{ text: '付款条款' }],
    });
    const table = result.blocks[2];
    expect(table.type).toBe('table');
    if (table.type !== 'table') throw new Error('Expected an engine table block');
    expect(table.rows[0].row_type).toBe('header');
    expect(table.rows[0].cells[0].content[0].runs[0].text).toBe('甲方');
    expect(table.rows[1].row_type).toBe('body');
  });
});
