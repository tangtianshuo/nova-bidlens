import { useCallback, useMemo } from 'react';
import { ArrowLeft, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PersistentBanner } from '@/components/feedback/persistent-banner';
import { StatusBadge } from '@/components/feedback/status-badge';
import { useProjectDetail } from './project-queries';
import { useProjectStore } from './project-store';
import { AnalysisStageList, deriveStages } from './analysis-stage-list';
import { SubmissionProgressTable } from './submission-progress-table';
import type { AnalysisProjectStatus } from '../../__fixtures__/risk-project';

// ── Fixture per-stage timings (replaced by real IPC later) ────────────

const FIXTURE_STAGE_TIMINGS: Record<string, Partial<Record<string, number>>> = {
  'proj-fixture-001': { validating: 2, parsing: 8, filtering: 3, embedding: 12, retrieving: 5, detecting: 7, aggregating: 4, ready: 1 },
  'proj-fixture-002': { validating: 2, parsing: 7, filtering: 3, embedding: 10, retrieving: 5, detecting: 6, aggregating: 3, ready: 1 },
  'proj-fixture-003': { validating: 2, parsing: 9, filtering: 4, embedding: 14, retrieving: 6, detecting: 8, aggregating: 5, ready: 1 },
  'proj-fixture-004': { validating: 2, parsing: 6, filtering: 3, embedding: 8 },
  'proj-fixture-005': { validating: 2, parsing: 5 },
  'proj-fixture-006': { validating: 2, parsing: 8, filtering: 3, embedding: 5 },
};

// ── Preset labels ─────────────────────────────────────────────────────

const PRESET_LABELS: Record<string, string> = {
  strict: '严格',
  standard: '标准',
  loose: '宽松',
};

// ── Component ─────────────────────────────────────────────────────────

export function ProjectProcessingPage() {
  const { selectedProjectId, clearSelection } = useProjectStore();
  const { data: project, isLoading, error } = useProjectDetail(selectedProjectId);

  const handleCancel = useCallback(() => {
    // IPC not wired yet — stub
    console.log('[ProjectProcessing] cancel analysis for:', selectedProjectId);
  }, [selectedProjectId]);

  const handleBack = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const stages = useMemo(() => {
    if (!project) return [];
    const timings = FIXTURE_STAGE_TIMINGS[project.id];
    return deriveStages(project.status, timings);
  }, [project]);

  const isActive = project
    ? !['ready', 'partial', 'interrupted', 'failed'].includes(project.status)
    : false;

  // ── Loading / No project selected ─────────────────────────────

  if (!selectedProjectId || isLoading) {
    return (
      <div className="flex min-h-full flex-col" style={{ maxWidth: 960, padding: '34px 36px 28px' }}>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-[var(--radius)] bg-[var(--color-bg-subtle)]"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────

  if (error || !project) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3" style={{ maxWidth: 960, padding: '34px 36px 28px' }}>
        <p className="text-sm text-[var(--color-danger)]">
          加载项目详情失败: {error instanceof Error ? error.message : '项目不存在'}
        </p>
        <Button variant="secondary" size="sm" onClick={handleBack}>
          返回项目列表
        </Button>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex min-h-full flex-col" style={{ maxWidth: 960, padding: '34px 36px 28px' }}>
      {/* Back + Header */}
      <div className="mb-4">
        <button
          onClick={handleBack}
          className="mb-3 flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回项目列表
        </button>

        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--color-text)] truncate">
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
        </div>

        <div className="mt-1 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <span>{project.submissions.length} 个文件</span>
          <span>预设：{PRESET_LABELS[project.preset] ?? project.preset}</span>
          <span>耗时：{formatElapsedMs(project.elapsedMs)}</span>
        </div>
      </div>

      {/* Warnings */}
      {project.warnings.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {project.warnings.map((w, i) => (
            <PersistentBanner
              key={i}
              variant="warning"
              title={w}
              dismissable={false}
            />
          ))}
        </div>
      )}

      {/* Degraded state */}
      {project.degradationReason && (
        <div className="mb-4">
          <PersistentBanner
            variant="warning"
            title="传统匹配/模型降级"
            dismissable={false}
          >
            本地 Embedding 模型不可用，已使用传统匹配
          </PersistentBanner>
        </div>
      )}

      {/* Stage list */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
          分析阶段
        </h2>
        <AnalysisStageList stages={stages} />
      </div>

      {/* Failed state recovery placeholder (UI-207) */}
      {project.status === 'failed' && (
        <div
          role="status"
          className="mb-6 rounded-[var(--radius)] border border-[var(--color-danger)] bg-[var(--color-danger)]/5 p-4"
        >
          <p className="text-sm font-medium text-[var(--color-danger)] mb-3">
            分析失败，可尝试重新分析
          </p>
          <Button variant="secondary" size="sm" disabled>
            <RotateCcw className="h-3.5 w-3.5" />
            重试分析
          </Button>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            恢复功能将在 UI-207 中实现
          </p>
        </div>
      )}

      {/* File progress table */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
          文件进度
        </h2>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
          <SubmissionProgressTable submissions={project.submissions} />
        </div>
      </div>

      {/* Cancel button */}
      {isActive && (
        <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
          <Button variant="destructive" size="md" onClick={handleCancel}>
            <XCircle className="h-3.5 w-3.5" />
            取消分析
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatElapsedMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
