/**
 * P4-18: Tests for task toolbar with statistics and navigation.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TaskToolbar } from './task-toolbar';
import type { DiffItem, ReviewAnnotation } from '@bidlens/shared/types-only';

vi.mock('../../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('../../components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('../../components/ui/separator', () => ({
  Separator: (props: any) => <hr {...props} />,
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

function makeItem(id: string): DiffItem {
  return {
    matchId: id,
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

describe('TaskToolbar', () => {
  beforeEach(cleanup);

  it('renders total count', () => {
    const items = [makeItem('m1'), makeItem('m2'), makeItem('m3')];
    render(
      <TaskToolbar
        items={items}
        selectedItemId={null}
        annotations={[]}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders reviewed count', () => {
    const items = [makeItem('m1'), makeItem('m2')];
    const annotations: ReviewAnnotation[] = [
      { id: 'a1', taskId: 't1', matchId: 'm1', status: 'confirmed', important: false, note: '', createdAt: '', updatedAt: '' },
    ];
    render(
      <TaskToolbar
        items={items}
        selectedItemId={null}
        annotations={annotations}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    expect(screen.getByText('1')).toBeTruthy(); // reviewed
  });

  it('renders important count', () => {
    const items = [makeItem('m1'), makeItem('m2'), makeItem('m3')];
    const annotations: ReviewAnnotation[] = [
      { id: 'a1', taskId: 't1', matchId: 'm1', status: 'unreviewed', important: true, note: '', createdAt: '', updatedAt: '' },
      { id: 'a2', taskId: 't1', matchId: 'm2', status: 'confirmed', important: true, note: '', createdAt: '', updatedAt: '' },
    ];
    const { container } = render(
      <TaskToolbar
        items={items}
        selectedItemId={null}
        annotations={annotations}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    // Total=3, reviewed=1, important=2 — check important count exists
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows unreviewed badge when there are unreviewed items', () => {
    const items = [makeItem('m1'), makeItem('m2')];
    render(
      <TaskToolbar
        items={items}
        selectedItemId={null}
        annotations={[]}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    expect(screen.getByText('2 待审')).toBeTruthy();
  });

  it('shows current position when item selected', () => {
    const items = [makeItem('m1'), makeItem('m2'), makeItem('m3')];
    render(
      <TaskToolbar
        items={items}
        selectedItemId="m2"
        annotations={[]}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('calls onSelectNext when next button clicked', () => {
    const onSelectNext = vi.fn();
    render(
      <TaskToolbar
        items={[makeItem('m1')]}
        selectedItemId={null}
        annotations={[]}
        onSelect={vi.fn()}
        onSelectNext={onSelectNext}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('下一项'));
    expect(onSelectNext).toHaveBeenCalled();
  });

  it('calls onSelectPrevious when previous button clicked', () => {
    const onSelectPrevious = vi.fn();
    render(
      <TaskToolbar
        items={[makeItem('m1')]}
        selectedItemId={null}
        annotations={[]}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={onSelectPrevious}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('上一项'));
    expect(onSelectPrevious).toHaveBeenCalled();
  });

  it('calls onSelectNextUnreviewed when button clicked', () => {
    const onSelectNextUnreviewed = vi.fn();
    render(
      <TaskToolbar
        items={[makeItem('m1')]}
        selectedItemId={null}
        annotations={[]}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={onSelectNextUnreviewed}
      />
    );
    fireEvent.click(screen.getByLabelText('下一项未审核'));
    expect(onSelectNextUnreviewed).toHaveBeenCalled();
  });

  it('disables next-unreviewed when all items reviewed', () => {
    const items = [makeItem('m1')];
    const annotations: ReviewAnnotation[] = [
      { id: 'a1', taskId: 't1', matchId: 'm1', status: 'confirmed', important: false, note: '', createdAt: '', updatedAt: '' },
    ];
    render(
      <TaskToolbar
        items={items}
        selectedItemId={null}
        annotations={annotations}
        onSelect={vi.fn()}
        onSelectNext={vi.fn()}
        onSelectPrevious={vi.fn()}
        onSelectNextUnreviewed={vi.fn()}
      />
    );
    const btn = screen.getByLabelText('下一项未审核');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});
