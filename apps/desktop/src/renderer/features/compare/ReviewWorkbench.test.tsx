import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewWorkbench } from './ReviewWorkbench';

describe('ReviewWorkbench', () => {
  it('renders navigation, document panes, and details', () => {
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
});
