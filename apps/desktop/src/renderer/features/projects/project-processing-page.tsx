import { useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PersistentBanner } from '@/components/feedback/persistent-banner';
import { StatusBadge } from '@/components/feedback/status-badge';
import { useProjectDetail } from './project-queries';
import { useProjectStore } from './project-store';
import { AnalysisStageList, deriveStages } from './analysis-stage-list';
import { SubmissionProgressTable } from './submission-progress-table';
import { AnalysisRecoveryActions, type RecoveryAction } from './analysis-recovery-actions';
import type { AnalysisProjectStatus } from '@bidlens/shared/types-only';
import { useAppStore } from '../../stores/app-store';

// ── Preset labels ─────────────────────────────────────────────────────

const PRESET_LABELS: Record<string, string> = {
  strict: '严格',
  standard: '标准',
  loose: '宽松',
};

// ── Component ─────────────────────────────────────────────────────────

export function ProjectProcessingPage() {
  const { selectedProjectId, clearSelection } = useProjectStore();
  const setView = useAppStore((state) => state.setView);
  const { data: project, isLoading, error } = useProjectDetail(selectedProjectId);

  const handleCancel = useCallback(() => {
    if (selectedProjectId) void window.bidlens.cancelRiskProject(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    return window.bidlens.onRiskProgress((progress) => {
      if (progress.projectId === selectedProjectId && progress.status === 'ready') setView('project-result');
    });
  }, [selectedProjectId, setView]);

  const handleRecoveryAction = useCallback(
    (action: RecoveryAction) => {
      if (action === 'cancel' && selectedProjectId) void window.bidlens.cancelRiskProject(selectedProjectId);
    },
    [selectedProjectId],
  );

  const handleBack = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const stages = useMemo(() => {
    if (!project) return [];
    return deriveStages(project.status);
  }, [project]);

  const isActive = project
    ? !['ready', 'partial', 'interrupted', 'failed'].includes(project.status)
    : false;

  // ── Loading / No project selected ─────────────────────────────

  if (!selectedProjectId || isLoading) {
    return (
      <div className="app-page" data-width="compact">
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
      <div className="app-page" data-width="compact" style={{ alignItems: 'center', justifyContent: 'center' }}>
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
    <div className="app-page" data-width="compact">
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

      {/* Recovery actions (UI-207) */}
      <AnalysisRecoveryActions
        status={project.status}
        degradationReason={project.degradationReason}
        warnings={project.warnings}
        onAction={handleRecoveryAction}
        hasPartialResults={project.findings.length > 0}
        elapsedMs={project.elapsedMs}
      />

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
