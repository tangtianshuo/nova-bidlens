/**
 * P4-06: Tests for inline diff token rendering.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InlineDiff } from './inline-diff';
import type { TextDiffToken } from '@bidlens/shared/types-only';

// Mock the UI components
vi.mock('../../components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('../../components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('InlineDiff', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders empty state when no tokens', () => {
    render(<InlineDiff tokens={[]} />);
    expect(screen.getByText('无差异详情')).toBeDefined();
  });

  it('renders same tokens as plain text', () => {
    const tokens: TextDiffToken[] = [
      { kind: 'same', text: 'Hello' },
      { kind: 'same', text: ' World' },
    ];
    render(<InlineDiff tokens={tokens} />);
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('World', { exact: false })).toBeDefined();
  });

  it('renders added tokens with diff-added styling', () => {
    const tokens: TextDiffToken[] = [
      { kind: 'same', text: 'text ' },
      { kind: 'added', text: 'new' },
    ];
    render(<InlineDiff tokens={tokens} />);
    const added = screen.getByText('new');
    expect(added.className).toContain('bg-[var(--color-added-bg)]');
    expect(added.className).toContain('text-[var(--color-added)]');
  });

  it('renders removed tokens with line-through', () => {
    const tokens: TextDiffToken[] = [
      { kind: 'removed', text: 'old' },
      { kind: 'same', text: ' text' },
    ];
    render(<InlineDiff tokens={tokens} />);
    const removed = screen.getByText('old');
    expect(removed.className).toContain('line-through');
  });

  it('toggles hide-details mode', () => {
    const tokens: TextDiffToken[] = [
      { kind: 'same', text: 'Hello' },
      { kind: 'added', text: 'World' },
    ];
    render(<InlineDiff tokens={tokens} />);

    // Initially shows tokens
    expect(screen.getAllByText('Hello').length).toBeGreaterThan(0);

    // Click hide
    const toggle = screen.getByLabelText('隐藏差异详情');
    fireEvent.click(toggle);

    // Should show summary instead
    expect(screen.getByLabelText('显示差异详情')).toBeDefined();
  });

  it('starts with details hidden when defaultHideDetails is true', () => {
    const tokens: TextDiffToken[] = [
      { kind: 'same', text: 'Hello' },
      { kind: 'added', text: 'World' },
    ];
    render(<InlineDiff tokens={tokens} defaultHideDetails />);

    // Should show the toggle to show details
    expect(screen.getByLabelText('显示差异详情')).toBeDefined();
  });

  it('shows long paragraph badge for large content', () => {
    const longText = 'a'.repeat(2001);
    const tokens: TextDiffToken[] = [
      { kind: 'same', text: longText },
    ];
    render(<InlineDiff tokens={tokens} />);
    expect(screen.getByText('长段落')).toBeDefined();
  });

  it('shows summary badges with correct counts', () => {
    const tokens: TextDiffToken[] = [
      { kind: 'same', text: 'abc' },
      { kind: 'added', text: 'de' },
      { kind: 'removed', text: 'fgh' },
    ];
    render(<InlineDiff tokens={tokens} />);
    expect(screen.getAllByText('+2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('-3').length).toBeGreaterThanOrEqual(1);
  });

  it('separates replacement text into baseline and review rows', () => {
    const tokens: TextDiffToken[] = [
      { kind: 'same', text: '签约日期：202' },
      { kind: 'removed', text: '6' },
      { kind: 'added', text: '5' },
      { kind: 'same', text: '-5-21' },
    ];

    render(<InlineDiff tokens={tokens} />);

    expect(screen.getByLabelText('基准文本').textContent).toBe('签约日期：2026-5-21');
    expect(screen.getByLabelText('送审文本').textContent).toBe('签约日期：2025-5-21');
  });
});
