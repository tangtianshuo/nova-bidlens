import { describe, expect, it } from 'vitest';
import { renderMarkdownReport } from './report-exporter';

describe('renderMarkdownReport', () => {
  it('renders metadata, diff list, and annotations', () => {
    const markdown = renderMarkdownReport({
      taskId: 't1',
      generatedAt: '2026-07-15T00:00:00.000Z',
      docA: { filename: 'a.docx', sha256: 'a', pageCount: 1, wordCount: 10 },
      docB: { filename: 'b.docx', sha256: 'b', pageCount: 1, wordCount: 12 },
      options: { mode: 'standard', embeddingProvider: 'local', embeddingModel: 'test', topK: 5, similarityThreshold: 0.45 },
      diffAst: {
        taskId: 't1',
        docAId: 'a',
        docBId: 'b',
        generatedAt: '2026-07-15T00:00:00.000Z',
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [{ matchId: 'm1', matchType: 'modified', confidence: 0.8, similarity: 0.8, sourceA: '旧条款', sourceB: '新条款', nodeIdsA: ['a1'], nodeIdsB: ['b1'], diffDetail: [], summary: 'changed' }]
      },
      annotations: [{ id: 'ann1', taskId: 't1', matchId: 'm1', status: 'important', note: '关键条款变更', updatedAt: '2026-07-15T00:00:00.000Z' }]
    });

    expect(markdown).toContain('# BidLens 比对报告');
    expect(markdown).toContain('a.docx');
    expect(markdown).toContain('important');
  });
});
