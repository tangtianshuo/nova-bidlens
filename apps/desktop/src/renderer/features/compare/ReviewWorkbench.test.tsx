import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewWorkbench } from './ReviewWorkbench';

describe('ReviewWorkbench', () => {
  it('renders navigation, document panes, and details for text diff', () => {
    render(<ReviewWorkbench result={{
      taskId: 't1',
      docA: { id: 'a', filename: 'a.docx', sha256: 'a', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      docB: { id: 'b', filename: 'b.docx', sha256: 'b', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      diffAst: {
        taskId: 't1',
        docAId: 'a',
        docBId: 'b',
        generatedAt: '2026-07-15T00:00:00.000Z',
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [{ matchId: 'm1', matchType: 'modified', confidence: 0.8, similarity: 0.8, sourceA: '旧条款', sourceB: '新条款', nodeIdsA: ['a1'], nodeIdsB: ['b1'], diffDetail: [], summary: 'changed' }]
      },
      annotations: []
    }} />);

    expect(screen.getAllByText('modified')).toHaveLength(2);
    expect(screen.getByText('旧条款')).toBeTruthy();
    expect(screen.getByText('新条款')).toBeTruthy();
    expect(screen.getByText('confidence 0.80')).toBeTruthy();
  });

  it('renders table diff view for table items', () => {
    render(<ReviewWorkbench result={{
      taskId: 't1',
      docA: { id: 'a', filename: 'a.docx', sha256: 'a', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      docB: { id: 'b', filename: 'b.docx', sha256: 'b', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      diffAst: {
        taskId: 't1',
        docAId: 'a',
        docBId: 'b',
        generatedAt: '2026-07-15T00:00:00.000Z',
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [{
          matchId: 'm1',
          matchType: 'modified',
          confidence: 0.8,
          similarity: 0.8,
          sourceA: null,
          sourceB: null,
          nodeIdsA: ['t1'],
          nodeIdsB: ['t2'],
          diffDetail: [],
          summary: 'table changed',
          blockType: 'table',
          tableA: { id: 't1', rows: [['Header', 'Value A']] },
          tableB: { id: 't2', rows: [['Header', 'Value B']] },
          tableDiff: {
            tableMatchType: 'content_changed',
            structuralChanges: [],
            cellDiffs: [{
              position: [0, 1],
              changeType: 'modified',
              oldContent: 'Value A',
              newContent: 'Value B',
              similarity: 0.5,
            }],
            confidence: 0.8,
          },
        }]
      },
      annotations: []
    }} />);

    // Should render table diff view
    expect(screen.getAllByText('原始文档表格').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('新文档表格').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Value A')).toBeTruthy();
    expect(screen.getByText('Value B')).toBeTruthy();
    
    // Should show table icon in navigation
    expect(screen.getByText('📊')).toBeTruthy();
  });

  it('renders table diff statistics in detail panel', () => {
    render(<ReviewWorkbench result={{
      taskId: 't1',
      docA: { id: 'a', filename: 'a.docx', sha256: 'a', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      docB: { id: 'b', filename: 'b.docx', sha256: 'b', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      diffAst: {
        taskId: 't1',
        docAId: 'a',
        docBId: 'b',
        generatedAt: '2026-07-15T00:00:00.000Z',
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [{
          matchId: 'm1',
          matchType: 'modified',
          confidence: 0.8,
          similarity: 0.8,
          sourceA: null,
          sourceB: null,
          nodeIdsA: ['t1'],
          nodeIdsB: ['t2'],
          diffDetail: [],
          summary: 'table changed',
          blockType: 'table',
          tableA: { id: 't1', rows: [['A', 'B'], ['C', 'D']] },
          tableB: { id: 't2', rows: [['A', 'B'], ['C', 'D'], ['E', 'F']] },
          tableDiff: {
            tableMatchType: 'structure_changed',
            structuralChanges: [{ type: 'rows_added', count: 1, position: 2 }],
            cellDiffs: [],
            confidence: 0.5,
          },
        }]
      },
      annotations: []
    }} />);

    // Should show structural changes in detail panel
    expect(screen.getAllByText(/表格差异统计/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/差异单元格数: 0/)).toBeTruthy();
    expect(screen.getByText(/结构变化: 1/)).toBeTruthy();
    // "新增 1 行" appears in both the table summary and detail panel
    expect(screen.getAllByText(/新增 1 行/).length).toBeGreaterThanOrEqual(1);
  });
});
