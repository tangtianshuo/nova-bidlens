import { useMemo, useCallback } from 'react';
import { MoreHorizontal, Eye, Trash2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { StatusBadge, RiskBadge } from '@/components/feedback/status-badge';
import { useProjectStore } from './project-store';
import type { ProjectSortField } from './project-store';
import type { AnalysisProjectSummary } from '../../__fixtures__/risk-project';

// ─── Column definitions ─────────────────────────────────────────────

interface Column {
  key: string;
  label: string;
  width: string;
  sortable?: ProjectSortField;
}

const COLUMNS: Column[] = [
  { key: 'name', label: '项目名称', width: '34%', sortable: 'name' },
  { key: 'status', label: '状态', width: '10%', sortable: 'status' },
  { key: 'risk', label: '风险等级', width: '12%', sortable: 'riskLevel' },
  { key: 'submissions', label: '投标文件', width: '10%' },
  { key: 'elapsed', label: '耗时', width: '12%', sortable: 'createdAt' },
  { key: 'created', label: '创建时间', width: '16%', sortable: 'createdAt' },
  { key: 'actions', label: '', width: '46px' },
];

// ─── Helpers ────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Props ──────────────────────────────────────────────────────────

export interface ProjectTableProps {
  projects: AnalysisProjectSummary[];
  onRowClick: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onResume: (projectId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function ProjectTable({ projects, onRowClick, onDelete, onResume }: ProjectTableProps) {
  const { sortBy, sortOrder, setSort } = useProjectStore();

  // Sort indicator
  const SortIcon = useCallback(
    ({ field }: { field: ProjectSortField }) => {
      if (sortBy !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
      return sortOrder === 'asc' ? (
        <ArrowUp className="ml-1 h-3 w-3" />
      ) : (
        <ArrowDown className="ml-1 h-3 w-3" />
      );
    },
    [sortBy, sortOrder],
  );

  // Column header with sort
  const renderHeader = useCallback(
    (col: Column) => {
      if (!col.sortable) {
        return (
          <TableHead key={col.key} style={{ width: col.width }}>
            {col.label}
          </TableHead>
        );
      }
      return (
        <TableHead key={col.key} style={{ width: col.width }}>
          <button
            className="inline-flex items-center text-[11px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            onClick={() => setSort(col.sortable!)}
          >
            {col.label}
            <SortIcon field={col.sortable} />
          </button>
        </TableHead>
      );
    },
    [setSort, SortIcon],
  );

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)]">
      <Table style={{ tableLayout: 'fixed' }}>
        <TableHeader>
          <TableRow className="hover:bg-transparent" style={{ height: 38 }}>
            {COLUMNS.map(renderHeader)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                暂无匹配的项目
              </TableCell>
            </TableRow>
          ) : (
            projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onRowClick={onRowClick}
                onDelete={onDelete}
                onResume={onResume}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: AnalysisProjectSummary;
  onRowClick: (id: string) => void;
  onDelete: (id: string) => void;
  onResume: (id: string) => void;
}

function ProjectRow({ project, onRowClick, onDelete, onResume }: ProjectRowProps) {
  const canResume = project.status === 'interrupted';

  return (
    <TableRow
      className="cursor-pointer"
      style={{ height: 64 }}
      onClick={() => onRowClick(project.id)}
    >
      {/* Name */}
      <TableCell>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[var(--color-text)]">
            {project.name}
          </div>
          <div className="truncate text-xs text-[var(--color-text-muted)]">
            {project.submissionCount} 份文件 · {project.preset}
          </div>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge status={project.status} />
      </TableCell>

      {/* Risk */}
      <TableCell>
        {project.riskLevel && project.riskLevel !== 'incomplete' ? (
          <RiskBadge level={project.riskLevel} />
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">--</span>
        )}
      </TableCell>

      {/* Submissions */}
      <TableCell className="text-sm text-[var(--color-text-secondary)]">
        {project.submissionCount}
      </TableCell>

      {/* Elapsed */}
      <TableCell className="text-sm text-[var(--color-text-muted)]">
        {formatElapsed(project.elapsedMs)}
      </TableCell>

      {/* Created */}
      <TableCell className="text-sm text-[var(--color-text-muted)]">
        {formatDate(project.createdAt)}
      </TableCell>

      {/* Actions */}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
              aria-label="操作"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRowClick(project.id);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              查看详情
            </DropdownMenuItem>
            {canResume && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume(project.id);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  恢复分析
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
