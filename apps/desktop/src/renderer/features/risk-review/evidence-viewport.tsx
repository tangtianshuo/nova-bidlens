import { Badge } from '@/components/ui/badge';
import type { Evidence } from '../../__fixtures__/risk-project';

interface EvidenceViewportProps {
  evidence: Evidence[];
  submissionNames: Map<string, string>;
}

export function EvidenceViewport({ evidence, submissionNames }: EvidenceViewportProps) {
  if (evidence.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
        选择一个发现项查看证据
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-auto h-full" role="region" aria-label="证据视图">
      <div className="text-xs text-[var(--color-text-muted)] mb-1">
        {evidence.length} 条证据
      </div>
      {evidence.map((ev) => (
        <EvidenceCard
          key={ev.id}
          evidence={ev}
          submissionName={submissionNames.get(ev.submissionId) ?? ev.submissionId}
        />
      ))}
    </div>
  );
}

// ─── EvidenceCard ───────────────────────────────────────────────────

interface EvidenceCardProps {
  evidence: Evidence;
  submissionName: string;
}

function EvidenceCard({ evidence, submissionName }: EvidenceCardProps) {
  const matchLabel =
    evidence.matchBasis === 'semantic' ? '语义' :
    evidence.matchBasis === 'lexical' ? '词法' :
    evidence.matchBasis === 'structural' ? '结构' : '实体';

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-3 text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={evidence.matchBasis === 'semantic' ? 'accent' : 'default'} className="text-[10px]">
          {matchLabel}
        </Badge>
        <span className="text-[var(--color-text-muted)] truncate" title={submissionName}>
          {submissionName}
        </span>
        <span className="ml-auto font-medium text-[var(--color-text)]">
          {(evidence.similarityScore * 100).toFixed(0)}%
        </span>
      </div>

      {/* Context before */}
      {evidence.contextBefore && (
        <p className="text-[var(--color-text-muted)] mb-1 truncate">{evidence.contextBefore}</p>
      )}

      {/* Original text */}
      <div className="rounded-[var(--radius)] bg-[var(--color-added-bg)] border border-[var(--color-added-border)] p-2 mb-1">
        <p className="text-[var(--color-text)] leading-relaxed">{evidence.originalText}</p>
      </div>

      {/* Context after */}
      {evidence.contextAfter && (
        <p className="text-[var(--color-text-muted)] mt-1 truncate">{evidence.contextAfter}</p>
      )}

      {/* Tender filter notice */}
      {evidence.tenderFiltered && (
        <p className="mt-2 text-[10px] text-[var(--color-modified)]">
          已过滤招标公共内容{evidence.tenderFilterReason ? `：${evidence.tenderFilterReason}` : ''}
        </p>
      )}
    </div>
  );
}
