import { useMemo, useCallback } from 'react';
import { Search, X, Plus, RefreshCw, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { PersistentBanner } from '@/components/feedback/persistent-banner';
import { useProjectList } from './project-queries';
import { useProjectStore } from './project-store';
import { ProjectTable } from './project-table';
import type { AnalysisProjectStatus, RiskLevel } from '../../__fixtures__/risk-project';

// ─── Filter options ─────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'ready', label: '已完成' },
  { value: 'partial', label: '部分结果' },
  { value: 'interrupted', label: '已中断' },
  { value: 'failed', label: '失败' },
];

const RISK_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部风险' },
  { value: 'high', label: '高风险' },
  { value: 'medium', label: '中风险' },
  { value: 'low', label: '低风险' },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'name', label: '项目名称' },
  { value: 'riskLevel', label: '风险等级' },
  { value: 'elapsedTime', label: '耗时' },
];

const PAGE_SIZE_OPTIONS = ['5', '10', '20'];

// ─── Component ──────────────────────────────────────────────────────

export function ProjectListPage() {
  const { data: projects, isLoading, error, refetch } = useProjectList();

  const {
    searchText, setSearchText,
    statusFilter, setStatusFilter,
    riskFilter, setRiskFilter,
    sortBy, setSort, sortOrder,
    page, pageSize, setPage, setPageSize,
    clearFilters,
  } = useProjectStore();

  // ── Filter + sort pipeline ──────────────────────────────────────

  const hasPartial = projects?.some((p) => p.status === 'partial') ?? false;
  const hasInterrupted = projects?.some((p) => p.status === 'interrupted') ?? false;

  const filtered = useMemo(() => {
    if (!projects) return [];
    let result = [...projects];

    // Search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Risk filter
    if (riskFilter) {
      result = result.filter((p) => p.riskLevel === riskFilter);
    }

    // Hide low-risk when partial results exist
    if (hasPartial && !riskFilter) {
      result = result.filter((p) => p.riskLevel !== 'low');
    }

    // Sort
    const dir = sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return dir * a.name.localeCompare(b.name, 'zh-CN');
        case 'status':
          return dir * a.status.localeCompare(b.status);
        case 'riskLevel': {
          const order = { high: 3, medium: 2, low: 1, incomplete: 0 };
          const av = order[(a.riskLevel ?? 'incomplete') as keyof typeof order] ?? 0;
          const bv = order[(b.riskLevel ?? 'incomplete') as keyof typeof order] ?? 0;
          return dir * (av - bv);
        }
        case 'elapsedTime':
          return dir * (a.elapsedMs - b.elapsedMs);
        case 'createdAt':
        default:
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    });

    return result;
  }, [projects, searchText, statusFilter, riskFilter, sortBy, sortOrder]);

  // ── Pagination ──────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  // ── Actions ─────────────────────────────────────────────────────

  const handleRowClick = useCallback((id: string) => {
    // Navigate to project detail — will be wired to app store in UI-206
    console.log('[ProjectList] navigate to project:', id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    // TODO: wire delete confirmation dialog
    console.log('[ProjectList] delete project:', id);
  }, []);

  const handleResume = useCallback((id: string) => {
    // TODO: wire resume analysis
    console.log('[ProjectList] resume project:', id);
  }, []);

  const hasFilters = searchText || statusFilter || riskFilter;

  // ── Loading ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col" style={{ maxWidth: 1240, padding: '34px 36px 28px' }}>
        <Skeleton className="mb-4 h-7 w-32" />
        <Skeleton className="mb-3 h-9 w-full max-w-xs" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center" style={{ maxWidth: 1240, padding: '34px 36px 28px' }}>
        <p className="text-sm text-[var(--color-danger)]">
          加载项目列表失败: {error instanceof Error ? error.message : '未知错误'}
        </p>
        <Button variant="primary" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          重试
        </Button>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────

  if (!projects || projects.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center" style={{ maxWidth: 1240, padding: '34px 36px 28px' }}>
        <FileQuestion className="h-10 w-10 text-[var(--color-text-muted)]" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-[var(--color-text)]">暂无项目</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">创建一个新项目开始分析</p>
        <Button size="sm" variant="primary" className="mt-3" onClick={() => console.log('[ProjectList] new project')}>
          <Plus className="h-3.5 w-3.5" />
          新建项目
        </Button>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex min-h-full flex-col" style={{ maxWidth: 1240, padding: '34px 36px 28px' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          项目列表
        </h1>
        <Button size="sm" variant="primary" onClick={() => console.log('[ProjectList] new project')}>
          <Plus className="h-3.5 w-3.5" />
          新建项目
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex items-center gap-2">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="搜索项目名称..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-9 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-8 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]/20"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="清除搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select
          value={statusFilter ?? 'all'}
          onValueChange={(v) => setStatusFilter(v === 'all' ? null : v as AnalysisProjectStatus)}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Risk filter */}
        <Select
          value={riskFilter ?? 'all'}
          onValueChange={(v) => setRiskFilter(v === 'all' ? null : v as RiskLevel)}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RISK_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={sortBy}
          onValueChange={(v) => setSort(v as 'createdAt' | 'name' | 'riskLevel' | 'elapsedTime')}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[var(--color-text-muted)]">
            <X className="h-3.5 w-3.5" />
            清除筛选
          </Button>
        )}
      </div>

      {/* Result count */}
      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
        {hasFilters
          ? `显示 ${filtered.length} / ${projects?.length ?? 0} 个项目`
          : `共 ${filtered.length} 个项目`}
      </div>

      {/* Banners */}
      {hasPartial && (
        <PersistentBanner
          variant="warning"
          title="分析结果不完整，低风险项已隐藏"
          className="mt-2"
          dismissable
        />
      )}
      {hasInterrupted && (
        <PersistentBanner
          variant="warning"
          title="分析已中断"
          className="mt-2"
        >
          部分项目的分析过程中断，可在项目菜单中恢复分析
        </PersistentBanner>
      )}

      {/* Table */}
      <div className="mt-2">
        <ProjectTable
          projects={paged}
          onRowClick={handleRowClick}
          onDelete={handleDelete}
          onResume={handleResume}
        />
      </div>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger className="h-7 w-[60px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>条</span>
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage(Math.max(1, safePage - 1)); }}
                  className={safePage <= 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {renderPageLinks(safePage, totalPages, setPage)}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, safePage + 1)); }}
                  className={safePage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

// ─── Page link helpers ──────────────────────────────────────────────

function renderPageLinks(
  current: number,
  total: number,
  onPage: (p: number) => void,
) {
  const pages: number[] = [];
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push(-1); // ellipsis
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push(-1); // ellipsis
    pages.push(total);
  }

  return pages.map((p, i) =>
    p === -1 ? (
      <PaginationItem key={`e${i}`}>
        <PaginationEllipsis />
      </PaginationItem>
    ) : (
      <PaginationItem key={p}>
        <PaginationLink
          href="#"
          isActive={p === current}
          onClick={(e) => { e.preventDefault(); onPage(p); }}
        >
          {p}
        </PaginationLink>
      </PaginationItem>
    ),
  );
}
