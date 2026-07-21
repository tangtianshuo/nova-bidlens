import { Badge } from '@/components/ui/badge';
import type { Evidence } from '@bidlens/shared/types-only';

interface EvidenceViewportProps {
  evidence: Evidence[];
  submissionNames: Map<string, string>;
}

export function EvidenceViewport({ evidence, submissionNames }: EvidenceViewportProps) {
  if (evidence.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[var(--color-text-muted)]">
        该发现项暂无证据
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4" role="region" aria-label="证据视图">
      <div className="text-xs text-[var(--color-text-muted)]">
        {evidence.length} 条证据
      </div>
      {evidence.map((ev) => (
        <EvidenceCard
          key={ev.id}
          evidence={ev}
          sourceName={submissionNames.get(ev.sourceSubmissionId) ?? ev.sourceSubmissionId}
          targetName={submissionNames.get(ev.targetSubmissionId) ?? ev.targetSubmissionId}
        />
      ))}
    </div>
  );
}

// ─── EvidenceCard ───────────────────────────────────────────────────

interface EvidenceCardProps {
  evidence: Evidence;
  sourceName: string;
  targetName: string;
}

const MATCH_LABELS: Record<string, string> = {
  semantic: '语义', lexical: '词法', structural: '结构', entity: '实体', fact: '事实',
};

function EvidenceCard({ evidence, sourceName, targetName }: EvidenceCardProps) {
  const matchLabel = MATCH_LABELS[evidence.matchBasis] ?? evidence.matchBasis;
  const sectionPath = evidence.sourceSectionPath.join(' > ');
  const pageLabel = evidence.sourcePageRange
    ? `P${evidence.sourcePageRange[0]}${evidence.sourcePageRange[1] !== evidence.sourcePageRange[0] ? `-${evidence.sourcePageRange[1]}` : ''}`
    : null;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-3 text-xs">
      {/* Header: match type + files + score */}
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={evidence.matchBasis === 'semantic' ? 'accent' : 'default'} className="text-[10px]">
          {matchLabel}
        </Badge>
        <span className="text-[var(--color-text-muted)] truncate" title={sourceName}>
          {sourceName}
        </span>
        <span className="text-[var(--color-text-muted)]">→</span>
        <span className="text-[var(--color-text-muted)] truncate" title={targetName}>
          {targetName}
        </span>
        <span className="ml-auto font-medium text-[var(--color-text)]">
          {(evidence.similarityScore * 100).toFixed(0)}%
        </span>
      </div>

      {/* Section path + page */}
      {(sectionPath || pageLabel) && (
        <div className="flex items-center gap-2 mb-2 text-[10px] text-[var(--color-text-muted)]">
          {sectionPath && <span className="truncate">{sectionPath}</span>}
          {pageLabel && <span className="shrink-0">{pageLabel}</span>}
        </div>
      )}

      {/* Source text */}
      <div className="mb-2">
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">来源: {sourceName}</div>
        <div className="rounded-[var(--radius)] bg-[var(--color-added-bg)] border border-[var(--color-added-border)] p-2">
          <p className="text-[var(--color-text)] leading-relaxed">{evidence.sourceOriginalText}</p>
        </div>
      </div>

      {/* Target text */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">目标: {targetName}</div>
        <div className="rounded-[var(--radius)] bg-[var(--color-modified-bg)] border border-[var(--color-modified-border)] p-2">
          <p className="text-[var(--color-text)] leading-relaxed">{evidence.targetOriginalText}</p>
        </div>
      </div>

      {/* Tender filter notice */}
      {evidence.tenderFiltered && (
        <p className="mt-2 text-[10px] text-[var(--color-modified)]">
          已过滤招标公共内容{evidence.tenderFilterReason ? `：${evidence.tenderFilterReason}` : ''}
        </p>
      )}
    </div>
  );
}
