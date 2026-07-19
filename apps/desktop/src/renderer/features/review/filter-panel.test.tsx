/**
 * Tests for FilterBar and applyFilters logic.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FilterBar, applyFilters, DEFAULT_FILTERS, type FilterState } from './filter-panel';
import type { DiffItem, ReviewAnnotation } from '@bidlens/shared/types-only';

vi.mock('../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

function makeItem(overrides: Partial<DiffItem> = {}): DiffItem {
  return {
    matchId: 'm1',
    matchType: 'modified',
    confidence: 0.85,
    similarity: 0.72,
    sourceA: '基准文本',
    sourceB: '送审文本',
    nodeIdsA: ['a1'],
    nodeIdsB: ['b1'],
    diffDetail: [],
    summary: '文本修改',
    ...overrides,
  };
}

describe('applyFilters', () => {
  const items: DiffItem[] = [
    makeItem({ matchId: 'm1', matchType: 'modified', sourceA: '材料费说明' }),
    makeItem({ matchId: 'm2', matchType: 'added', sourceB: '新增条款' }),
    makeItem({ matchId: 'm3', matchType: 'deleted', sourceA: '已删除内容' }),
    makeItem({ matchId: 'm4', matchType: 'identical', sourceA: '相同文本' }),
    makeItem({ matchId: 'm5', matchType: 'moved', sourceA: '移动段落' }),
  ];

  it('hides identical items by default', () => {
    const result = applyFilters(items, DEFAULT_FILTERS, new Map());
    expect(result.length).toBe(4);
    expect(result.find((i) => i.matchId === 'm4')).toBeUndefined();
  });

  it('shows identical items when explicitly disabled', () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, hideIdentical: false };
    const result = applyFilters(items, filters, new Map());
    expect(result.length).toBe(5);
    expect(result.find((i) => i.matchId === 'm4')).toBeDefined();
  });

  it('filters by match type', () => {
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      hideIdentical: false,
      matchTypes: new Set(['modified', 'added']),
    };
    const result = applyFilters(items, filters, new Map());
    expect(result.length).toBe(2);
  });

  it('filters by review status', () => {
    const annotations = new Map<string, ReviewAnnotation>([
      ['m1', { id: 'am1', taskId: 't1', matchId: 'm1', status: 'confirmed', important: false, note: '', createdAt: '', updatedAt: '' }],
      ['m2', { id: 'a2', taskId: 't1', matchId: 'm2', status: 'unreviewed', important: false, note: '', createdAt: '', updatedAt: '' }],
    ]);
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      hideIdentical: false,
      reviewStatuses: new Set(['confirmed']),
    };
    const result = applyFilters(items, filters, annotations);
    expect(result.length).toBe(1);
    expect(result[0].matchId).toBe('m1');
  });

  it('filters by important only', () => {
    const annotations = new Map<string, ReviewAnnotation>([
      ['m1', { id: 'am1', taskId: 't1', matchId: 'm1', status: 'unreviewed', important: true, note: '', createdAt: '', updatedAt: '' }],
    ]);
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      hideIdentical: false,
      showImportantOnly: true,
    };
    const result = applyFilters(items, filters, annotations);
    expect(result.length).toBe(1);
    expect(result[0].matchId).toBe('m1');
  });

  it('filters by search query', () => {
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      hideIdentical: false,
      searchQuery: '材料',
    };
    const result = applyFilters(items, filters, new Map());
    expect(result.length).toBe(1);
    expect(result[0].matchId).toBe('m1');
  });

  it('combines multiple filters', () => {
    const annotations = new Map<string, ReviewAnnotation>([
      ['m1', { id: 'am1', taskId: 't1', matchId: 'm1', status: 'confirmed', important: true, note: '', createdAt: '', updatedAt: '' }],
    ]);
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      hideIdentical: false,
      matchTypes: new Set(['modified']),
      reviewStatuses: new Set(['confirmed']),
      showImportantOnly: true,
    };
    const result = applyFilters(items, filters, annotations);
    expect(result.length).toBe(1);
    expect(result[0].matchId).toBe('m1');
  });
});

describe('FilterBar', () => {
  beforeEach(cleanup);

  it('renders search input', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={{ ...DEFAULT_FILTERS, hideIdentical: false }}
        onFiltersChange={onChange}
        totalCount={10}
        filteredCount={8}
      />
    );
    expect(screen.getByLabelText('搜索差异')).toBeTruthy();
  });

  it('shows result count', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onFiltersChange={onChange}
        totalCount={10}
        filteredCount={10}
      />
    );
    expect(screen.getByText('10 / 10')).toBeTruthy();
  });

  it('shows filtered count when filters active', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onFiltersChange={onChange}
        totalCount={10}
        filteredCount={3}
      />
    );
    expect(screen.getByText('3 / 10')).toBeTruthy();
  });

  it('explains how many identical items are hidden', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={{ ...DEFAULT_FILTERS, hideIdentical: true }}
        onFiltersChange={onChange}
        totalCount={67}
        filteredCount={8}
        hiddenIdenticalCount={59}
      />
    );
    expect(screen.getByText('8 / 67（已隐藏 59 条相同项）')).toBeTruthy();
  });

  it('toggles the identical-item filter explicitly', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={{ ...DEFAULT_FILTERS, hideIdentical: false }}
        onFiltersChange={onChange}
        totalCount={67}
        filteredCount={67}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '隐藏相同项' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hideIdentical: true }));
  });

  it('makes the all filter restore identical items', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={{ ...DEFAULT_FILTERS, hideIdentical: true, matchTypes: new Set(['modified']) }}
        onFiltersChange={onChange}
        totalCount={67}
        filteredCount={8}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /全部/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      hideIdentical: false,
      matchTypes: expect.any(Set),
    }));
    expect(onChange.mock.calls[0][0].matchTypes.size).toBe(0);
  });

  it('calls onFiltersChange when search changes', () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={DEFAULT_FILTERS}
        onFiltersChange={onChange}
        totalCount={10}
        filteredCount={10}
      />
    );
    fireEvent.change(screen.getByLabelText('搜索差异'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalled();
  });
});
