import { create } from 'zustand';
import type {
  RiskLevel,
  DetectorType,
  FindingReviewStatus,
} from '@bidlens/shared/types-only';

// ─── Tab type ───────────────────────────────────────────────────────

export type ResultTab = 'overview' | 'matrix' | 'findings' | 'export';

// ─── Filter types ───────────────────────────────────────────────────

export interface FindingFilterState {
  riskLevels: Set<RiskLevel>;
  detectorTypes: Set<DetectorType>;
  reviewStatuses: Set<FindingReviewStatus>;
  filePair: [string, string] | null;
  searchText: string;
  showImportantOnly: boolean;
}

// ─── Store shape ────────────────────────────────────────────────────

interface RiskReviewState {
  // Navigation
  activeTab: ResultTab;
  setActiveTab: (tab: ResultTab) => void;

  // Selected project
  projectId: string | null;
  setProjectId: (id: string | null) => void;

  // Selected finding
  selectedFindingId: string | null;
  selectFinding: (id: string | null) => void;

  // Filters
  filters: FindingFilterState;
  setRiskFilter: (levels: RiskLevel[]) => void;
  setDetectorFilter: (types: DetectorType[]) => void;
  setReviewStatusFilter: (statuses: FindingReviewStatus[]) => void;
  setFilePair: (pair: [string, string] | null) => void;
  setSearchText: (text: string) => void;
  setShowImportantOnly: (show: boolean) => void;
  clearFilters: () => void;

  // Bulk review
  selectedFindingIds: Set<string>;
  toggleFindingSelection: (id: string) => void;
  selectAllFindings: (ids: string[]) => void;
  clearSelection: () => void;
}

const DEFAULT_FILTERS: FindingFilterState = {
  riskLevels: new Set(),
  detectorTypes: new Set(),
  reviewStatuses: new Set(),
  filePair: null,
  searchText: '',
  showImportantOnly: false,
};

export const useRiskReviewStore = create<RiskReviewState>((set, get) => ({
  // Navigation
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Selected project
  projectId: null,
  setProjectId: (id) => set({ projectId: id, selectedFindingId: null, filters: DEFAULT_FILTERS }),

  // Selected finding
  selectedFindingId: null,
  selectFinding: (id) => set({ selectedFindingId: id }),

  // Filters
  filters: { ...DEFAULT_FILTERS },
  setRiskFilter: (levels) =>
    set((s) => ({ filters: { ...s.filters, riskLevels: new Set(levels) } })),
  setDetectorFilter: (types) =>
    set((s) => ({ filters: { ...s.filters, detectorTypes: new Set(types) } })),
  setReviewStatusFilter: (statuses) =>
    set((s) => ({ filters: { ...s.filters, reviewStatuses: new Set(statuses) } })),
  setFilePair: (pair) => set((s) => ({ filters: { ...s.filters, filePair: pair } })),
  setSearchText: (text) => set((s) => ({ filters: { ...s.filters, searchText: text } })),
  setShowImportantOnly: (show) =>
    set((s) => ({ filters: { ...s.filters, showImportantOnly: show } })),
  clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  // Bulk review
  selectedFindingIds: new Set(),
  toggleFindingSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedFindingIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedFindingIds: next };
    }),
  selectAllFindings: (ids) => set({ selectedFindingIds: new Set(ids) }),
  clearSelection: () => set({ selectedFindingIds: new Set() }),
}));

// ─── Filter predicate ───────────────────────────────────────────────

export function matchesFilter(
  finding: { riskLevel: RiskLevel; detectorType: DetectorType; reviewStatus: FindingReviewStatus; involvedSubmissionIds: string[] },
  filters: FindingFilterState,
): boolean {
  if (filters.riskLevels.size > 0 && !filters.riskLevels.has(finding.riskLevel)) return false;
  if (filters.detectorTypes.size > 0 && !filters.detectorTypes.has(finding.detectorType)) return false;
  if (filters.reviewStatuses.size > 0 && !filters.reviewStatuses.has(finding.reviewStatus)) return false;
  if (filters.showImportantOnly && finding.reviewStatus !== 'important') return false;
  if (filters.filePair) {
    const [a, b] = filters.filePair;
    if (!finding.involvedSubmissionIds.includes(a) || !finding.involvedSubmissionIds.includes(b)) {
      return false;
    }
  }
  return true;
}
