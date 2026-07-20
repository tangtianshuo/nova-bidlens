import { create } from 'zustand';

import type {
  AnalysisProjectStatus,
  RiskLevel,
} from '../../__fixtures__/risk-project';

// ─── Sort types ──────────────────────────────────────────────────────────

export type ProjectSortField = 'createdAt' | 'name' | 'status' | 'riskLevel';
export type SortOrder = 'asc' | 'desc';

// ─── Store shape ─────────────────────────────────────────────────────────

interface ProjectState {
  selectedProjectId: string | null;
  searchText: string;
  statusFilter: AnalysisProjectStatus | null;
  riskFilter: RiskLevel | null;
  sortBy: ProjectSortField;
  sortOrder: SortOrder;

  selectProject: (id: string) => void;
  clearSelection: () => void;
  setSearchText: (text: string) => void;
  setStatusFilter: (status: AnalysisProjectStatus | null) => void;
  setRiskFilter: (risk: RiskLevel | null) => void;
  setSort: (field: ProjectSortField) => void;
  clearFilters: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  selectedProjectId: null,
  searchText: '',
  statusFilter: null,
  riskFilter: null,
  sortBy: 'createdAt',
  sortOrder: 'desc',

  selectProject: (id: string) => set({ selectedProjectId: id }),
  clearSelection: () => set({ selectedProjectId: null }),
  setSearchText: (text: string) => set({ searchText: text }),
  setStatusFilter: (status: AnalysisProjectStatus | null) =>
    set({ statusFilter: status }),
  setRiskFilter: (risk: RiskLevel | null) => set({ riskFilter: risk }),
  setSort: (field: ProjectSortField) => {
    const { sortBy, sortOrder } = get();
    if (sortBy === field) {
      set({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortBy: field, sortOrder: 'asc' });
    }
  },
  clearFilters: () =>
    set({ searchText: '', statusFilter: null, riskFilter: null }),
}));
