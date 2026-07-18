/**
 * P4-18: Tests for detail tabs with capability-aware rendering.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DetailTabs } from './detail-tabs';
import type { DiffItem, CapabilityResult } from '@bidlens/shared/types-only';

// Mock Radix Tabs to render all content (no conditional hiding)
vi.mock('../../components/ui/tabs', () => ({
  Tabs: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, value, disabled, ...props }: any) => (
    <button data-value={value} disabled={disabled} {...props}>{children}</button>
  ),
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('./inline-diff', () => ({
  InlineDiff: ({ tokens }: any) => <div data-testid="inline-diff">{tokens?.length ?? 0} tokens</div>,
}));

function makeItem(overrides: Partial<DiffItem> = {}): DiffItem {
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
    summary: '测试摘要',
    ...overrides,
  };
}

const FULL_CAPABILITIES: CapabilityResult[] = [
  { dimension: 'content', state: 'supported', reason: '' },
  { dimension: 'format', state: 'supported', reason: '' },
  { dimension: 'comment', state: 'supported', reason: '' },
  { dimension: 'revision', state: 'supported', reason: '' },
];

describe('DetailTabs', () => {
  beforeEach(cleanup);

  it('renders all four tab labels', () => {
    render(<DetailTabs item={makeItem()} capabilities={FULL_CAPABILITIES} />);
    expect(screen.getByText('详情')).toBeTruthy();
    expect(screen.getByText('格式')).toBeTruthy();
    expect(screen.getByText('批注')).toBeTruthy();
    expect(screen.getByText('修订')).toBeTruthy();
  });

  it('renders detail content with summary', () => {
    const item = makeItem({
      diffDetail: [{ kind: 'same', text: 'hello' }],
      summary: '测试摘要',
    });
    const { container } = render(<DetailTabs item={item} capabilities={FULL_CAPABILITIES} />);
    expect(container.textContent).toContain('测试摘要');
  });

  it('shows empty message when diffDetail is empty', () => {
    render(<DetailTabs item={makeItem({ diffDetail: [] })} capabilities={FULL_CAPABILITIES} />);
    expect(screen.getByText('无详细差异信息')).toBeTruthy();
  });

  it('renders inline diff when tokens exist', () => {
    const item = makeItem({
      diffDetail: [
        { kind: 'same', text: 'hello' },
        { kind: 'added', text: ' world' },
      ],
    });
    render(<DetailTabs item={item} capabilities={FULL_CAPABILITIES} />);
    expect(screen.getByTestId('inline-diff')).toBeTruthy();
  });

  it('shows "不支持" badge for unsupported capabilities', () => {
    const caps: CapabilityResult[] = [
      { dimension: 'content', state: 'supported', reason: '' },
      { dimension: 'format', state: 'unsupported', reason: '' },
      { dimension: 'comment', state: 'unsupported', reason: '' },
      { dimension: 'revision', state: 'unsupported', reason: '' },
    ];
    render(<DetailTabs item={makeItem()} capabilities={caps} />);
    expect(screen.getAllByText('不支持').length).toBe(3);
  });

  it('shows "降级" badge for degraded capabilities', () => {
    const caps: CapabilityResult[] = [
      { dimension: 'content', state: 'supported', reason: '' },
      { dimension: 'format', state: 'degraded', reason: '' },
      { dimension: 'comment', state: 'unsupported', reason: '' },
      { dimension: 'revision', state: 'unsupported', reason: '' },
    ];
    render(<DetailTabs item={makeItem()} capabilities={caps} />);
    expect(screen.getByText('降级')).toBeTruthy();
  });

  it('renders format content placeholder when no formatDiff', () => {
    render(<DetailTabs item={makeItem()} capabilities={FULL_CAPABILITIES} />);
    expect(screen.getByText('无格式差异')).toBeTruthy();
  });

  it('renders comments placeholder', () => {
    render(<DetailTabs item={makeItem()} capabilities={FULL_CAPABILITIES} />);
    expect(screen.getByText('源文档批注将在后续版本中显示')).toBeTruthy();
  });

  it('renders revisions placeholder', () => {
    render(<DetailTabs item={makeItem()} capabilities={FULL_CAPABILITIES} />);
    expect(screen.getByText('修订记录将在后续版本中显示')).toBeTruthy();
  });
});
