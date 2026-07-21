import { Badge } from '@/components/ui/badge';
import type { AnalysisProjectDetail } from '@bidlens/shared/types-only';
import type { FindingCounts } from './risk-result-queries';

interface RiskOverviewProps {
  project: AnalysisProjectDetail;
  counts: FindingCounts;
}

export function RiskOverview({ project, counts }: RiskOverviewProps) {
  const assessment = project.assessment;

  return (
    <div className="flex flex-col gap-5">
      {/* Risk summary card */}
      <div className="panel-card">
        <h2 className="panel-card-header">项目风险</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">风险等级</span>
            <div className="flex items-center gap-2">
              {assessment ? (
                <Badge variant={`risk-${assessment.level === 'incomplete' ? 'medium' : assessment.level}`} className="text-sm">
                  {assessment.level === 'high' ? '高' : assessment.level === 'medium' ? '中' : assessment.level === 'low' ? '低' : '不完整'}
                </Badge>
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">无数据</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">规则得分</span>
            <span className="text-lg font-semibold text-[var(--color-text)]">
              {assessment ? assessment.rawRuleScore.toFixed(1) : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">分析状态</span>
            <span className="text-sm text-[var(--color-text)]">
              {assessment?.analysisStatus === 'complete' ? '完整' :
               assessment?.analysisStatus === 'partial' ? '部分' :
               assessment?.analysisStatus === 'degraded' ? '降级' : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Detector summary */}
      <DetectorSummary counts={counts} />

      {/* Top findings */}
      <TopFindings findings={project.findings} />
    </div>
  );
}

// ─── DetectorSummary ────────────────────────────────────────────────

function DetectorSummary({ counts }: { counts: FindingCounts }) {
  const detectors = [
    { type: 'text' as const, label: '文本语义', color: 'var(--detector-text)' },
    { type: 'table' as const, label: '表格雷同', color: 'var(--detector-table)' },
    { type: 'entity' as const, label: '实体重复', color: 'var(--detector-entity)' },
  ];

  return (
    <div className="panel-card">
      <h2 className="panel-card-header">检测器摘要</h2>
      <div className="grid grid-cols-3 gap-4">
        {detectors.map((d) => (
          <div key={d.type} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-[var(--color-text-muted)]">{d.label}</span>
            </div>
            <span className="text-lg font-semibold text-[var(--color-text)]">
              {counts.byDetector[d.type]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TopFindings ────────────────────────────────────────────────────

function TopFindings({ findings }: { findings: AnalysisProjectDetail['findings'] }) {
  const topFindings = [...findings]
    .sort((a, b) => b.symmetricSimilarity - a.symmetricSimilarity)
    .slice(0, 5);

  if (topFindings.length === 0) {
    return (
      <div className="panel-card">
        <h2 className="panel-card-header">主要发现</h2>
        <p className="text-xs text-[var(--color-text-muted)]">暂无发现项</p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <h2 className="panel-card-header">主要发现</h2>
      <div className="flex flex-col gap-1.5">
        {topFindings.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            <Badge variant={`risk-${f.riskLevel}`} className="text-[10px] shrink-0">
              {f.riskLevel === 'high' ? '高' : f.riskLevel === 'medium' ? '中' : '低'}
            </Badge>
            <span className="text-xs text-[var(--color-text-muted)]">
              {f.detectorType === 'text' ? '文本' : f.detectorType === 'table' ? '表格' : '实体'}
            </span>
            <span className="flex-1 text-xs text-[var(--color-text)] truncate">
              {f.involvedSubmissionIds.length} 个文件 · 相似度 {(f.symmetricSimilarity * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              置信度 {(f.confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
