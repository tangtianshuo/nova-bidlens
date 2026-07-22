import { useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PersistentBanner } from '@/components/feedback/persistent-banner';
import { StatusBadge } from '@/components/feedback/status-badge';
import { useRiskResultDetail, useFindingCounts } from './risk-result-queries';
import { useRiskReviewStore, matchesFilter } from './risk-review-store';
import { FindingFilterToolbar } from './finding-filter-toolbar';
import { FindingVirtualList } from './finding-virtual-list';
import { EvidenceViewport } from './evidence-viewport';
import { EvidenceReviewControls } from './evidence-review-controls';
import { EvidenceDetailTabs } from './evidence-detail-tabs';
import { RelationshipMatrix } from './relationship-matrix';
import { ReportExportPanel } from './report-export-panel';
import { RiskResultToolbar } from './risk-result-toolbar';
import { useSaveRiskFindingReview, useDebouncedNoteSave } from './risk-review-mutations';
import type { FindingReviewStatus } from '@bidlens/shared/types-only';

interface RiskResultPageProps {
  onBack?: () => void;
}

const EMPTY_FINDINGS: never[] = [];

export function RiskResultPage({ onBack }: RiskResultPageProps) {
  const { projectId, selectedFindingId, selectFinding, setFilePair, filters } = useRiskReviewStore();
  const { data: project, isLoading, error } = useRiskResultDetail(projectId);
  const counts = useFindingCounts(project?.findings ?? EMPTY_FINDINGS);

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  // Build submission name map
  const submissionNames = useMemo(() => {
    const map = new Map<string, string>();
    if (project) {
      for (const sub of project.submissions) {
        map.set(sub.id, sub.fileName);
      }
    }
    return map;
  }, [project]);

  // Selected finding
  const selectedFinding = useMemo(
    () => project?.findings.find((f) => f.id === selectedFindingId) ?? null,
    [project, selectedFindingId],
  );

  // Filtered count for export scope
  const filteredFindings = useMemo(
    () => project ? project.findings.filter((f) => matchesFilter(f, filters)) : [],
    [project, filters],
  );

  // Mutations
  const saveReview = useSaveRiskFindingReview();
  const debouncedNoteSave = useDebouncedNoteSave(projectId ?? '', selectedFindingId ?? '');

  const handleStatusChange = useCallback(
    (id: string, status: FindingReviewStatus) => {
      if (!projectId) return;
      saveReview.mutate({ projectId, findingId: id, status });
    },
    [projectId, saveReview],
  );

  const handleImportantChange = useCallback(
    (id: string, important: boolean) => {
      if (!projectId) return;
      saveReview.mutate({ projectId, findingId: id, important });
    },
    [projectId, saveReview],
  );

  const handleNoteChange = useCallback(
    (_id: string, note: string) => {
      debouncedNoteSave(note);
    },
    [debouncedNoteSave],
  );

  const handleMatrixCellClick = useCallback(
    (fromId: string, toId: string) => {
      setFilePair([fromId, toId]);
    },
    [setFilePair],
  );

  // Loading
  if (isLoading || !projectId) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-[var(--radius)] bg-[var(--color-bg-subtle)]" />
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-[var(--color-danger)]">
          加载结果失败: {error instanceof Error ? error.message : '项目不存在'}
        </p>
        <Button variant="secondary" size="sm" onClick={handleBack}>
          返回项目列表
        </Button>
      </div>
    );
  }

  const isPartial = project.status === 'partial';
  const isDegraded = project.degradationReason !== null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header row */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-3">
        <button
          onClick={handleBack}
          className="mb-2 flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
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

        {/* Status banners */}
        {isPartial && (
          <div className="mt-2">
            <PersistentBanner variant="warning" title="结果不完整" dismissable={false}>
              分析未完成，当前结果可能不完整。
            </PersistentBanner>
          </div>
        )}
        {isDegraded && (
          <div className="mt-2">
            <PersistentBanner variant="warning" title="降级运行" dismissable={false}>
              {project.warnings[0] ?? '分析以降级模式完成。'}
            </PersistentBanner>
          </div>
        )}

        <div className="mt-2">
          <RiskResultToolbar counts={counts} />
        </div>

        {/* Risk assessment summary */}
        {project.assessment && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-muted)]">项目风险</span>
              <Badge variant={`risk-${project.assessment.level === 'incomplete' ? 'low' : project.assessment.level}`} className="text-[10px]">
                {project.assessment.level === 'high' ? '高' : project.assessment.level === 'medium' ? '中' : project.assessment.level === 'low' ? '低' : '不完整'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-muted)]">规则评分</span>
              <span className="font-medium text-[var(--color-text)]">{project.assessment.rawRuleScore}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--color-text-muted)]">实体命中</span>
              <span className="font-medium text-[var(--color-text)]">{project.assessment.strongEntityHitCount}</span>
            </div>
            {project.assessment.tenderDiscountApplied && (
              <span className="text-[var(--color-accent)]">已应用招标内容折扣</span>
            )}
          </div>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-2">
        <FindingFilterToolbar />
      </div>

      {/* Three-column workbench */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Finding list */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-[var(--color-border)] overflow-hidden">
          <div className="flex-1 overflow-auto p-3">
            <FindingVirtualList findings={project.findings} />
          </div>
        </div>

        {/* Middle: Evidence detail */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selectedFinding ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
              {/* Finding summary + evidence */}
              <EvidenceDetailTabs finding={selectedFinding} submissionNames={submissionNames} />
              <div className="border-t border-[var(--color-border)]" />
              <EvidenceViewport
                evidence={selectedFinding.evidence}
                submissionNames={submissionNames}
              />
              <div className="border-t border-[var(--color-border)]" />
              <EvidenceReviewControls
                findingId={selectedFinding.id}
                currentStatus={selectedFinding.reviewStatus}
                important={selectedFinding.important}
                reviewNote={selectedFinding.reviewNote}
                onStatusChange={handleStatusChange}
                onImportantChange={handleImportantChange}
                onNoteChange={handleNoteChange}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-muted)]">
              选择一个发现项查看证据详情
            </div>
          )}
        </div>

        {/* Right sidebar: Matrix + Export */}
        <div className="flex w-[260px] shrink-0 flex-col border-l border-[var(--color-border)] overflow-hidden">
          <div className="flex-1 overflow-auto">
            {/* File pair matrix */}
            <div className="border-b border-[var(--color-border)] p-3">
              <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">文件关系矩阵</h3>
              <RelationshipMatrix
                submissions={project.submissions}
                findings={project.findings}
                onCellClick={handleMatrixCellClick}
              />
            </div>

            {/* Export panel */}
            <div>
              <h3 className="text-xs font-medium text-[var(--color-text-muted)] px-3 pt-3 mb-1">导出报告</h3>
              <ReportExportPanel
                projectId={project.id}
                counts={counts}
                filteredCount={filteredFindings.length}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
