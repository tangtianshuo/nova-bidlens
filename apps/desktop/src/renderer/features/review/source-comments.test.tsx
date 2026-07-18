/**
 * P4-18: Tests for source comments and revisions views.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SourceCommentsView, SourceRevisionsView } from './source-comments';
import type { DiffItem } from '@bidlens/shared/types-only';

vi.mock('../../components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('../../components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

function makeItem(): DiffItem {
  return {
    matchId: 'm1',
    matchType: 'modified',
    confidence: 0.85,
    similarity: 0.72,
    sourceA: '基准',
    sourceB: '送审',
    nodeIdsA: ['a1'],
    nodeIdsB: ['b1'],
    diffDetail: [],
    summary: '',
  };
}

describe('SourceCommentsView', () => {
  beforeEach(cleanup);

  it('renders empty state when no comments', () => {
    render(<SourceCommentsView item={makeItem()} />);
    expect(screen.getByText('源文档批注')).toBeTruthy();
    expect(screen.getByText('此段落无源文档批注')).toBeTruthy();
  });
});

describe('SourceRevisionsView', () => {
  beforeEach(cleanup);

  it('renders empty state when no revisions', () => {
    render(<SourceRevisionsView item={makeItem()} />);
    expect(screen.getByText('修订记录')).toBeTruthy();
    expect(screen.getByText('此段落无修订记录')).toBeTruthy();
  });
});
