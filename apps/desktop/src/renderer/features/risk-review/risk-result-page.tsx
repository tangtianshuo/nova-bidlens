import { useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PersistentBanner } from '@/components/feedback/persistent-banner';
import { StatusBadge } from '@/components/feedback/status-badge';
import { useRiskResultDetail, useFindingCounts } from './risk-result-queries';
import { useRiskReviewStore, type ResultTab } from './risk-review-store';
import { RiskOverview } from './risk-overview';
import { RelationshipMatrix } from './relationship-matrix';
import { FindingFilterToolbar } from './finding-filter-toolbar';
import { FindingVirtualList } from './finding-virtual-list';
import { RiskResultToolbar } from './risk-result-toolbar';

interface RiskResultPageProps {
  onBack?: () => void;
}

export function RiskResultPage({ onBack }: RiskResultPageProps) {
  const { projectId, activeTab, setActiveTab } = useRiskReviewStore();
  const { data: project, isLoading, error } = useRiskResultDetail(projectId);

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  const handleTabChange = useCallback(
    (tab: string) => setActiveTab(tab as ResultTab),
    [setActiveTab],
  );

  // Loading
  if (isLoading || !projectId) {
    return (
      <div className="flex min-h-full flex-col" style={{ maxWidth: 1280, padding: '34px 36px 28px' }}>
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
      <div className="flex min-h-full flex-col items-center justify-center gap-3" style={{ maxWidth: 1280, padding: '34px 36px 28px' }}>
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
  const counts = useFindingCounts(project.findings);

  return (
    <div className="flex min-h-full flex-col" style={{ maxWidth: 1280, padding: '34px 36px 28px' }}>
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
      </div>

      {/* Persistent status banners */}
      {isPartial && (
        <div className="mb-3">
          <PersistentBanner variant="warning" title="结果不完整" dismissable={false}>
            分析未完成，当前结果可能不完整。部分检测可能未执行。
          </PersistentBanner>
        </div>
      )}

      {isDegraded && (
        <div className="mb-3">
          <PersistentBanner variant="warning" title="降级运行" dismissable={false}>
            {project.warnings[0] ?? '分析以降级模式完成，部分功能可能受限。'}
          </PersistentBanner>
        </div>
      )}

      {/* Toolbar */}
      <RiskResultToolbar counts={counts} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4 flex-1">
        <TabsList>
          <TabsTrigger value="overview">风险概览</TabsTrigger>
          <TabsTrigger value="matrix">关系矩阵</TabsTrigger>
          <TabsTrigger value="findings">发现项</TabsTrigger>
          <TabsTrigger value="export">导出</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <RiskOverview project={project} counts={counts} />
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <RelationshipMatrix
            submissions={project.submissions}
            findings={project.findings}
          />
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          <FindingFilterToolbar />
          <FindingVirtualList findings={project.findings} />
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-muted)]">
            导出功能将在 Phase 4 实现
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
