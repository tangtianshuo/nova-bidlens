import { create } from 'zustand';

import type {
  AnalysisProjectStatus,
  RiskLevel,
} from '@bidlens/shared/types-only';

// ─── Sort types ──────────────────────────────────────────────────────────

export type ProjectSortField = 'createdAt' | 'name' | 'status' | 'riskLevel' | 'elapsedTime';
export type SortOrder = 'asc' | 'desc';

// ─── Store shape ─────────────────────────────────────────────────────────

interface ProjectState {
  selectedProjectId: string | null;
  searchText: string;
  statusFilter: AnalysisProjectStatus | null;
  riskFilter: RiskLevel | null;
  sortBy: ProjectSortField;
  sortOrder: SortOrder;
  page: number;
  pageSize: number;

  selectProject: (id: string) => void;
  clearSelection: () => void;
  setSearchText: (text: string) => void;
  setStatusFilter: (status: AnalysisProjectStatus | null) => void;
  setRiskFilter: (risk: RiskLevel | null) => void;
  setSort: (field: ProjectSortField) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  clearFilters: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  selectedProjectId: null,
  searchText: '',
  statusFilter: null,
  riskFilter: null,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 10,

  selectProject: (id: string) => set({ selectedProjectId: id }),
  clearSelection: () => set({ selectedProjectId: null }),
  setSearchText: (text: string) => set({ searchText: text, page: 1 }),
  setStatusFilter: (status: AnalysisProjectStatus | null) =>
    set({ statusFilter: status, page: 1 }),
  setRiskFilter: (risk: RiskLevel | null) => set({ riskFilter: risk, page: 1 }),
  setSort: (field: ProjectSortField) => {
    const { sortBy, sortOrder } = get();
    if (sortBy === field) {
      set({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortBy: field, sortOrder: 'asc' });
    }
    set({ page: 1 });
  },
  setPage: (page: number) => set({ page }),
  setPageSize: (size: number) => set({ pageSize: size, page: 1 }),
  clearFilters: () =>
    set({ searchText: '', statusFilter: null, riskFilter: null, page: 1 }),
}));
