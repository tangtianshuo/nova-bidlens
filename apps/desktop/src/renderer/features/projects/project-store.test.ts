import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './project-store';

describe('Project Store', () => {
  beforeEach(() => {
    useProjectStore.setState({
      selectedProjectId: null,
      searchText: '',
      statusFilter: null,
      riskFilter: null,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it('starts with default state', () => {
    const state = useProjectStore.getState();
    expect(state.selectedProjectId).toBeNull();
    expect(state.searchText).toBe('');
    expect(state.statusFilter).toBeNull();
    expect(state.riskFilter).toBeNull();
    expect(state.sortBy).toBe('createdAt');
    expect(state.sortOrder).toBe('desc');
  });

  it('selects and clears project', () => {
    useProjectStore.getState().selectProject('proj-001');
    expect(useProjectStore.getState().selectedProjectId).toBe('proj-001');

    useProjectStore.getState().clearSelection();
    expect(useProjectStore.getState().selectedProjectId).toBeNull();
  });

  it('sets search text', () => {
    useProjectStore.getState().setSearchText('道路');
    expect(useProjectStore.getState().searchText).toBe('道路');
  });

  it('sets and clears status filter', () => {
    useProjectStore.getState().setStatusFilter('ready');
    expect(useProjectStore.getState().statusFilter).toBe('ready');

    useProjectStore.getState().setStatusFilter(null);
    expect(useProjectStore.getState().statusFilter).toBeNull();
  });

  it('sets and clears risk filter', () => {
    useProjectStore.getState().setRiskFilter('high');
    expect(useProjectStore.getState().riskFilter).toBe('high');

    useProjectStore.getState().setRiskFilter(null);
    expect(useProjectStore.getState().riskFilter).toBeNull();
  });

  it('toggles sort order on same field', () => {
    useProjectStore.getState().setSort('createdAt');
    expect(useProjectStore.getState().sortBy).toBe('createdAt');
    expect(useProjectStore.getState().sortOrder).toBe('asc');

    useProjectStore.getState().setSort('createdAt');
    expect(useProjectStore.getState().sortOrder).toBe('desc');
  });

  it('switches sort field and resets to asc', () => {
    useProjectStore.getState().setSort('name');
    expect(useProjectStore.getState().sortBy).toBe('name');
    expect(useProjectStore.getState().sortOrder).toBe('asc');
  });

  it('clears all filters', () => {
    useProjectStore.getState().setSearchText('test');
    useProjectStore.getState().setStatusFilter('ready');
    useProjectStore.getState().setRiskFilter('high');

    useProjectStore.getState().clearFilters();
    expect(useProjectStore.getState().searchText).toBe('');
    expect(useProjectStore.getState().statusFilter).toBeNull();
    expect(useProjectStore.getState().riskFilter).toBeNull();
  });
});
