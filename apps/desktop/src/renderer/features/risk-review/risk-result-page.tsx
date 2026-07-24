import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { PdfDrawer } from '../review/pdf-drawer';
import { DualPdfDrawer } from '../review/dual-pdf-drawer';
import type { HighlightRect } from '../review/highlight-overlay';
import type { FindingReviewStatus } from '@bidlens/shared/types-only';

interface RiskResultPageProps {
  onBack?: () => void;
}

const EMPTY_FINDINGS: never[] = [];

type PdfDrawerState =
  | { open: false }
  | { open: true; mode: 'single'; submissionId: string; fileName: string; initialPage: number }
  | { open: true; mode: 'dual'; source: { submissionId: string; fileName: string; initialPage: number }; target: { submissionId: string; fileName: string; initialPage: number } };

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

  useEffect(() => {
    if (!project) return;

    if (filteredFindings.length === 0) {
      if (selectedFindingId !== null) selectFinding(null);
      return;
    }

    const selectionIsVisible = filteredFindings.some((finding) => finding.id === selectedFindingId);
    if (!selectionIsVisible) selectFinding(filteredFindings[0].id);
  }, [filteredFindings, project, selectFinding, selectedFindingId]);

  // PDF drawer state
  const [pdfDrawer, setPdfDrawer] = useState<PdfDrawerState>({ open: false });

  // Stable submission IDs derived from drawer state (avoids object identity churn)
  const sourceSid = pdfDrawer.open ? (pdfDrawer.mode === 'single' ? pdfDrawer.submissionId : pdfDrawer.source.submissionId) : null;
  const targetSid = pdfDrawer.open && pdfDrawer.mode === 'dual' ? pdfDrawer.target.submissionId : null;

  // Compute highlight rects from selected finding's evidence
  const pdfSourceHighlights = useMemo<HighlightRect[]>(() => {
    if (!selectedFinding || !sourceSid) return [];
    return selectedFinding.evidence
      .filter((e) => e.sourceSubmissionId === sourceSid && e.sourceBbox && e.sourceBbox.page > 0)
      .map((e) => ({
        x1: e.sourceBbox!.x1, y1: e.sourceBbox!.y1, x2: e.sourceBbox!.x2, y2: e.sourceBbox!.y2,
        page: e.sourceBbox!.page,
        matchBasis: e.matchBasis,
        similarityScore: e.similarityScore,
        sectionPath: e.sourceSectionPath,
      }));
  }, [selectedFinding, sourceSid]);

  const pdfTargetHighlights = useMemo<HighlightRect[]>(() => {
    if (!selectedFinding || !targetSid) return [];
    return selectedFinding.evidence
      .filter((e) => e.targetSubmissionId === targetSid && e.targetBbox && e.targetBbox.page > 0)
      .map((e) => ({
        x1: e.targetBbox!.x1, y1: e.targetBbox!.y1, x2: e.targetBbox!.x2, y2: e.targetBbox!.y2,
        page: e.targetBbox!.page,
        matchBasis: e.matchBasis,
        similarityScore: e.similarityScore,
        sectionPath: e.targetSectionPath,
      }));
  }, [selectedFinding, targetSid]);

  const handleEvidencePageClick = useCallback(
    (submissionId: string, page: number) => {
      if (!project) return;
      const submission = project.submissions.find((s) => s.id === submissionId);
      if (!submission) return;

      // Find the first evidence involving this submission for dual-pane detection
      const ev = selectedFinding?.evidence.find(
        (e) => e.sourceSubmissionId === submissionId || e.targetSubmissionId === submissionId,
      );

      // Open dual pane if evidence links two different files
      if (ev && ev.sourceSubmissionId !== ev.targetSubmissionId) {
        const srcSub = project.submissions.find((s) => s.id === ev.sourceSubmissionId);
        const tgtSub = project.submissions.find((s) => s.id === ev.targetSubmissionId);
        if (srcSub && tgtSub) {
          const sourcePage = ev.sourceSubmissionId === submissionId ? page : (ev.sourcePageRange?.[0] ?? 1);
          const targetPage = ev.targetSubmissionId === submissionId ? page : (ev.targetPageRange?.[0] ?? 1);
          setPdfDrawer({
            open: true, mode: 'dual',
            source: { submissionId: srcSub.id, fileName: srcSub.fileName, initialPage: sourcePage },
            target: { submissionId: tgtSub.id, fileName: tgtSub.fileName, initialPage: targetPage },
          });
          return;
        }
      }

      // Single mode fallback
      setPdfDrawer((prev) => {
        if (prev.open && prev.mode === 'single' && prev.submissionId === submissionId) {
          return { ...prev, initialPage: page };
        }
        return { open: true, mode: 'single', submissionId, fileName: submission.fileName, initialPage: page };
      });
    },
    [project, selectedFinding],
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
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
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
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg-muted)]">
      {/* Header row */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="-ml-2 min-h-8 px-2 font-medium shadow-none"
        >
          <ArrowLeft data-icon="inline-start" />
          返回项目列表
        </Button>

        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-[18px] font-semibold leading-7 text-[var(--color-text)]">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
          </div>

          {project.assessment && (
            <div className="flex shrink-0 items-center gap-4 text-[13px]" aria-label="项目风险评估">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-muted)]">项目风险</span>
                <Badge variant={`risk-${project.assessment.level === 'incomplete' ? 'low' : project.assessment.level}`}>
                  {project.assessment.level === 'high' ? '高风险' : project.assessment.level === 'medium' ? '中风险' : project.assessment.level === 'low' ? '低风险' : '结果不完整'}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[var(--color-text-muted)]">规则评分</span>
                <strong className="text-base font-semibold text-[var(--color-text)]">{project.assessment.rawRuleScore}</strong>
              </div>
            </div>
          )}
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

        <div className="mt-3 pt-3">
          <Separator className="mb-3" />
          <RiskResultToolbar counts={counts} />
          {project.assessment?.tenderDiscountApplied && (
            <p className="mt-2 text-xs text-[var(--color-accent)]">已应用招标内容折扣</p>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="shrink-0 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-2.5">
        <FindingFilterToolbar />
      </div>

      {/* Three-column workbench */}
      <div className="risk-result-grid grid min-h-0 flex-1">
        {/* Left: Finding list */}
        <div className="flex min-w-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg)]">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
            <span className="text-[13px] font-semibold text-[var(--color-text)]">发现项</span>
            <span className="text-xs text-[var(--color-text-muted)]">显示 {filteredFindings.length} / {project.findings.length}</span>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <FindingVirtualList findings={project.findings} />
          </div>
        </div>

        {/* Middle: Evidence detail */}
        <div className="flex min-w-0 flex-col overflow-hidden bg-[var(--color-bg-muted)]">
          {selectedFinding ? (
            <div className="mx-auto flex min-h-0 w-full max-w-[960px] flex-1 flex-col overflow-auto border-x border-[var(--color-border)] bg-[var(--color-bg)]">
              {/* Finding summary + evidence */}
              <EvidenceDetailTabs finding={selectedFinding} submissionNames={submissionNames} />
              <Separator />
              <EvidenceViewport
                evidence={selectedFinding.evidence}
                submissionNames={submissionNames}
                onOpenPdf={handleEvidencePageClick}
              />
              <Separator />
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
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--color-text-muted)]">
              当前筛选条件下没有可复核的发现项
            </div>
          )}
        </div>

        {/* Right sidebar: Matrix + Export */}
        <div className="min-w-0 overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-bg)]">
          <Tabs defaultValue="matrix" className="flex h-full min-h-0 flex-col">
            <TabsList className="h-12 w-full shrink-0 px-2">
              <TabsTrigger value="matrix" className="h-12 flex-1 text-[13px]">关系矩阵</TabsTrigger>
              <TabsTrigger value="export" className="h-12 flex-1 text-[13px]">导出报告</TabsTrigger>
            </TabsList>
            <TabsContent value="matrix" className="min-h-0 flex-1 overflow-auto p-4 pt-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[var(--color-text)]">文件关系矩阵</h3>
              <RelationshipMatrix
                submissions={project.submissions}
                findings={project.findings}
                onCellClick={handleMatrixCellClick}
              />
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">选择单元格可按文件对筛选发现项。悬停可查看完整文件名。</p>
            </TabsContent>
            <TabsContent value="export" className="min-h-0 flex-1 overflow-auto pt-0">
              <ReportExportPanel
                projectId={project.id}
                counts={counts}
                filteredCount={filteredFindings.length}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {pdfDrawer.open && pdfDrawer.mode === 'single' && (
        <PdfDrawer
          open={true}
          onOpenChange={(open) => { if (!open) setPdfDrawer({ open: false }); }}
          projectId={project.id}
          submissionId={pdfDrawer.submissionId}
          fileName={pdfDrawer.fileName}
          initialPage={pdfDrawer.initialPage}
          highlights={pdfSourceHighlights}
        />
      )}
      {pdfDrawer.open && pdfDrawer.mode === 'dual' && (
        <DualPdfDrawer
          open={true}
          onOpenChange={(open) => { if (!open) setPdfDrawer({ open: false }); }}
          projectId={project.id}
          source={{ ...pdfDrawer.source, highlights: pdfSourceHighlights }}
          target={{ ...pdfDrawer.target, highlights: pdfTargetHighlights }}
        />
      )}
    </div>
  );
}
