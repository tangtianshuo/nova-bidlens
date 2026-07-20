import { Badge } from '@/components/ui/badge';
import type { RiskFinding, RiskLevel } from '../../__fixtures__/risk-project';

interface EvidenceDetailTabsProps {
  finding: RiskFinding;
  submissionNames: Map<string, string>;
}

export function EvidenceDetailTabs({ finding, submissionNames }: EvidenceDetailTabsProps) {
  return (
    <div className="flex flex-col gap-4 p-4 text-xs" role="region" aria-label="发现项详情">
      {/* Finding summary */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={`risk-${finding.riskLevel}`} className="text-[10px]">
            {riskLabel(finding.riskLevel)}
          </Badge>
          <span className="text-[var(--color-text-muted)]">
            {finding.detectorType === 'text' ? '文本语义' : finding.detectorType === 'table' ? '表格雷同' : '实体重复'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[var(--color-text-muted)]">相似度</span>
            <span className="ml-1 font-medium">{(finding.symmetricSimilarity * 100).toFixed(0)}%</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">置信度</span>
            <span className="ml-1 font-medium">{(finding.confidenceScore * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Involved files */}
      <div>
        <h3 className="text-[var(--color-text-muted)] mb-2 font-medium">涉及文件</h3>
        <div className="flex flex-col gap-1">
          {finding.involvedSubmissionIds.map((subId) => (
            <div key={subId} className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1.5">
              <span className="text-[var(--color-text)] truncate">
                {submissionNames.get(subId) ?? subId}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Directional coverage */}
      {finding.directionalCoverage.length > 0 && (
        <div>
          <h3 className="text-[var(--color-text-muted)] mb-2 font-medium">方向覆盖率</h3>
          <div className="flex flex-col gap-1">
            {finding.directionalCoverage.map((cov, i) => (
              <div key={i} className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <span className="truncate">{submissionNames.get(cov.fromId) ?? cov.fromId}</span>
                <span>→</span>
                <span className="truncate">{submissionNames.get(cov.toId) ?? cov.toId}</span>
                <span className="ml-auto font-medium text-[var(--color-text)]">
                  {(cov.coverage * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule version */}
      <div className="text-[10px] text-[var(--color-text-muted)]">
        规则版本: {finding.ruleVersion}
      </div>
    </div>
  );
}

function riskLabel(level: RiskLevel): string {
  return level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险';
}
