import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/feedback/loading-button';
import { PersistentBanner } from '@/components/feedback/persistent-banner';
import { StatusBadge } from '@/components/feedback/status-badge';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useProjectDetail } from './project-queries';
import { useProgressSubscription } from '../../lib/progress-subscription';
import { useRiskReviewStore } from '../risk-review/risk-review-store';
import { AnalysisStageList, deriveStages } from './analysis-stage-list';
import { SubmissionProgressTable } from './submission-progress-table';
import { AnalysisRecoveryActions, type RecoveryAction } from './analysis-recovery-actions';
import type { AnalysisPhase, ProjectStatus } from '@bidlens/shared/types-only';
import type { RiskProgress } from '@bidlens/shared';
import { useAppStore } from '../../stores/app-store';

// ── Preset labels ─────────────────────────────────────────────────────

const PRESET_LABELS: Record<string, string> = {
  strict: '严格',
  standard: '标准',
  loose: '宽松',
};

// ── Component ─────────────────────────────────────────────────────────

export function ProjectProcessingPage() {
  const { projectId, setProjectId } = useRiskReviewStore();
  const setView = useAppStore((state) => state.setView);
  useProgressSubscription(projectId);
  const { data: project, isLoading, error } = useProjectDetail(projectId);

  // Real-time progress state from progress events (between query refreshes)
  const [liveProgress, setLiveProgress] = useState<RiskProgress | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<RecoveryAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    setCancelDialogOpen(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!projectId) return;
    setLoadingAction('cancel');
    setActionError(null);
    try {
      await window.bidlens.cancelRiskProject(projectId);
    } catch (err) {
      setActionError(`取消分析失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoadingAction(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    return window.bidlens.onRiskProgress((progress) => {
      if (progress.projectId !== projectId) return;
      setLiveProgress(progress);
      if (progress.status === 'ready') setView('project-result');
    });
  }, [projectId, setView]);

  // Clear live progress when project data refreshes
  useEffect(() => {
    if (project) setLiveProgress(null);
  }, [project]);

  const handleRecoveryAction = useCallback(
    async (action: RecoveryAction) => {
      if (!projectId) return;

      if (action === 'delete') {
        setDeleteDialogOpen(true);
        return;
      }

      setLoadingAction(action);
      setActionError(null);
      try {
        switch (action) {
          case 'resume':
            await window.bidlens.resumeRiskProject(projectId);
            break;
          case 'retry': {
            const failedSubmissions = (project?.submissions ?? []).filter(
              (s) => s.status === 'failed',
            );
            if (failedSubmissions.length === 0) {
              // No specific failed submissions, retry the whole project
              await window.bidlens.resumeRiskProject(projectId);
            } else {
              await Promise.all(
                failedSubmissions.map((s) =>
                  window.bidlens.retryRiskSubmission(projectId, s.id),
                ),
              );
            }
            break;
          }
          case 'accept-partial':
            await window.bidlens.acceptPartial(projectId);
            break;
          case 'cancel':
            setCancelDialogOpen(true);
            break;
        }
      } catch (err) {
        const label = action === 'resume' ? '恢复分析'
          : action === 'retry' ? '重试分析'
          : action === 'accept-partial' ? '接受部分结果'
          : '操作';
        setActionError(`${label}失败: ${err instanceof Error ? err.message : '未知错误'}`);
      } finally {
        setLoadingAction(null);
      }
    },
    [projectId, project],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!projectId) return;
    setLoadingAction('delete');
    setActionError(null);
    try {
      await window.bidlens.deleteProject(projectId);
      setProjectId(null);
      setView('project-list');
    } catch (err) {
      setActionError(`删除项目失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoadingAction(null);
    }
  }, [projectId, setProjectId, setView]);

  const handleBack = useCallback(() => {
    setProjectId(null);
    setView('project-list');
  }, [setProjectId, setView]);

  // Derive stages from real project phase + live progress
  const currentPhase: AnalysisPhase | null = liveProgress?.phase ?? project?.phase ?? null;
  const currentStatus: ProjectStatus = (liveProgress?.status as ProjectStatus) ?? project?.status ?? 'draft';
  const currentElapsedMs = liveProgress?.elapsedMs ?? project?.elapsedMs ?? 0;
  const currentWarnings = liveProgress?.warnings ?? project?.warnings ?? [];

  const stages = useMemo(() => {
    if (!project && !liveProgress) return [];
    return deriveStages(currentStatus, currentPhase);
  }, [currentStatus, currentPhase, project, liveProgress]);

  const isActive = !['ready', 'partial', 'interrupted', 'failed', 'cancelled'].includes(currentStatus);

  // ── Loading / No project selected ─────────────────────────────

  if (!projectId || isLoading) {
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
          <StatusBadge status={currentStatus} />
        </div>

        <div className="mt-1 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <span>{project.submissions.length} 个文件</span>
          <span>预设：{PRESET_LABELS[project.preset] ?? project.preset}</span>
          <span>耗时：{formatElapsedMs(currentElapsedMs)}</span>
          {liveProgress?.stageLabel && (
            <span className="text-[var(--color-accent)]">
              {liveProgress.stageLabel}
              {liveProgress.current != null && liveProgress.total != null && liveProgress.total > 0 && (
                <span className="ml-1 text-[var(--color-text-muted)]">({liveProgress.current}/{liveProgress.total})</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Warnings — from project data or live progress */}
      {currentWarnings.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {currentWarnings.map((w, i) => (
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

      {/* Stage list — derived from real phase */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
          分析阶段
        </h2>
        <AnalysisStageList stages={stages} />
      </div>

      {/* Recovery actions */}
      <AnalysisRecoveryActions
        status={currentStatus}
        degradationReason={project.degradationReason}
        warnings={currentWarnings}
        onAction={handleRecoveryAction}
        hasPartialResults={project.findings.length > 0}
        elapsedMs={currentElapsedMs}
        loadingAction={loadingAction}
        errorMessage={actionError}
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
          <LoadingButton variant="destructive" size="md" loading={loadingAction === 'cancel'} onClick={handleCancel}>
            <XCircle className="h-3.5 w-3.5" />
            取消分析
          </LoadingButton>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="取消分析"
        description="确定要取消当前分析任务吗？已处理的进度将丢失。"
        confirmLabel="取消分析"
        cancelLabel="继续分析"
        variant="destructive"
        onConfirm={() => { void handleConfirmCancel(); }}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="删除项目"
        description="确定要删除该项目吗？此操作不可撤销，所有分析数据将被永久删除。"
        confirmLabel="删除项目"
        cancelLabel="取消"
        variant="destructive"
        onConfirm={() => { void handleConfirmDelete(); }}
      />
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
