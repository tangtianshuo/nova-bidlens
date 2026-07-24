import { Badge } from '@/components/ui/badge';
import type { Evidence } from '@bidlens/shared/types-only';

interface EvidenceViewportProps {
  evidence: Evidence[];
  submissionNames: Map<string, string>;
  onOpenPdf?: (submissionId: string, page: number) => void;
}

export function EvidenceViewport({ evidence, submissionNames, onOpenPdf }: EvidenceViewportProps) {
  if (evidence.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[var(--color-text-muted)]">
        该发现项暂无证据
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5" role="region" aria-label="证据视图">
      <div className="text-[13px] font-semibold text-[var(--color-text)]">
        证据 <span className="ml-1 font-normal text-[var(--color-text-muted)]">{evidence.length} 条</span>
      </div>
      {evidence.map((ev) => (
        <EvidenceCard
          key={ev.id}
          evidence={ev}
          sourceName={submissionNames.get(ev.sourceSubmissionId) ?? ev.sourceSubmissionId}
          targetName={submissionNames.get(ev.targetSubmissionId) ?? ev.targetSubmissionId}
          onOpenPdf={onOpenPdf}
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
  onOpenPdf?: (submissionId: string, page: number) => void;
}

const MATCH_LABELS: Record<string, string> = {
  semantic: '语义', lexical: '词法', structural: '结构', entity: '实体', fact: '事实',
};

function EvidenceCard({ evidence, sourceName, targetName, onOpenPdf }: EvidenceCardProps) {
  const matchLabel = MATCH_LABELS[evidence.matchBasis] ?? evidence.matchBasis;
  const sectionPath = evidence.sourceSectionPath.join(' > ');
  const sourcePageLabel = evidence.sourcePageRange
    ? `P${evidence.sourcePageRange[0]}${evidence.sourcePageRange[1] !== evidence.sourcePageRange[0] ? `-${evidence.sourcePageRange[1]}` : ''}`
    : null;
  const targetPageLabel = evidence.targetPageRange
    ? `P${evidence.targetPageRange[0]}${evidence.targetPageRange[1] !== evidence.targetPageRange[0] ? `-${evidence.targetPageRange[1]}` : ''}`
    : null;

  return (
    <article className="rounded-[var(--radius)] border border-[var(--color-border)] p-4 text-[13px]">
      {/* Header: match type and score */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <Badge variant={evidence.matchBasis === 'semantic' ? 'accent' : 'default'} className="shrink-0">
          {matchLabel}
        </Badge>
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {(evidence.similarityScore * 100).toFixed(0)}%
        </span>
      </div>

      {/* File pair */}
      <div className="mb-3 flex min-w-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="truncate" title={sourceName}>
          {sourceName}
        </span>
        <span className="shrink-0">→</span>
        <span className="truncate" title={targetName}>
          {targetName}
        </span>
      </div>

      {/* Section path */}
      {sectionPath && (
        <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="truncate">{sectionPath}</span>
        </div>
      )}

      {/* Source text */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)]">
          <span>来源文本 · {sourceName}</span>
          {sourcePageLabel && onOpenPdf && (
            <Badge
              variant="accent"
              className="cursor-pointer hover:opacity-80"
              onClick={() => onOpenPdf(evidence.sourceSubmissionId, evidence.sourcePageRange![0])}
            >
              {sourcePageLabel}
            </Badge>
          )}
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-added-border)] bg-[var(--color-added-bg)] p-3">
          <p className="text-sm leading-6 text-[var(--color-text)]">{evidence.sourceOriginalText}</p>
        </div>
      </div>

      {/* Target text */}
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)]">
          <span>对照文本 · {targetName}</span>
          {targetPageLabel && onOpenPdf && (
            <Badge
              variant="accent"
              className="cursor-pointer hover:opacity-80"
              onClick={() => onOpenPdf(evidence.targetSubmissionId, evidence.targetPageRange![0])}
            >
              {targetPageLabel}
            </Badge>
          )}
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-modified-border)] bg-[var(--color-modified-bg)] p-3">
          <p className="text-sm leading-6 text-[var(--color-text)]">{evidence.targetOriginalText}</p>
        </div>
      </div>

      {/* Tender filter notice */}
      {evidence.tenderFiltered && (
        <p className="mt-3 text-xs text-[var(--color-modified)]">
          已过滤招标公共内容{evidence.tenderFilterReason ? `：${evidence.tenderFilterReason}` : ''}
        </p>
      )}
    </article>
  );
}
