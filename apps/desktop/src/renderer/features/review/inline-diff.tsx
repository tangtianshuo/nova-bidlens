/**
 * P4-06: Fine-grained inline diff token rendering.
 * Renders TextDiffToken[] with color-coded added/removed/same spans.
 * Supports hide-details mode, long-paragraph fallback, and accessibility.
 */

import { useState, useMemo } from 'react';
import type { TextDiffToken } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

// Threshold for "long paragraph" fallback (character count)
const LONG_PARAGRAPH_THRESHOLD = 2000;

interface InlineDiffProps {
  tokens: TextDiffToken[];
  className?: string;
  /** Initial hide-details state */
  defaultHideDetails?: boolean;
}

/**
 * Count non-whitespace characters in a token array.
 */
function countChars(tokens: TextDiffToken[]): number {
  return tokens.reduce((sum, t) => sum + t.text.replace(/\s/g, '').length, 0);
}

/**
 * Compute summary counts for the hide-details badge.
 */
function computeSummary(tokens: TextDiffToken[]): { added: number; removed: number; same: number } {
  let added = 0;
  let removed = 0;
  let same = 0;
  for (const token of tokens) {
    const len = token.text.replace(/\s/g, '').length;
    if (token.kind === 'added') added += len;
    else if (token.kind === 'removed') removed += len;
    else same += len;
  }
  return { added, removed, same };
}

/**
 * Render a single diff token span with appropriate styling.
 */
function DiffTokenSpan({ token }: { token: TextDiffToken }) {
  if (token.kind === 'same') {
    return <span>{token.text}</span>;
  }

  return (
    <span
      className={cn(
        'px-0.5 rounded-sm',
        token.kind === 'added' && 'bg-[var(--color-added-bg)] text-[var(--color-added)]',
        token.kind === 'removed' && 'bg-[var(--color-deleted-bg)] text-[var(--color-deleted)] line-through'
      )}
    >
      {token.text}
    </span>
  );
}

function DiffTokenLine({
  tokens,
  side,
}: {
  tokens: TextDiffToken[];
  side: 'baseline' | 'review';
}) {
  const excludedKind = side === 'baseline' ? 'added' : 'removed';

  return (
    <div
      className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed font-[var(--font-body)]"
      aria-label={side === 'baseline' ? '基准文本' : '送审文本'}
    >
      {tokens.map((token, i) => (
        token.kind === excludedKind ? null : <DiffTokenSpan key={i} token={token} />
      ))}
    </div>
  );
}

/**
 * Compact summary view when details are hidden.
 */
function DiffSummaryBadge({ tokens }: { tokens: TextDiffToken[] }) {
  const summary = useMemo(() => computeSummary(tokens), [tokens]);

  if (summary.added === 0 && summary.removed === 0) {
    return (
      <Badge variant="default" className="text-xs">
        无差异
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {summary.added > 0 && (
        <Badge variant="default" className="bg-[var(--color-added-bg)] text-xs text-[var(--color-added)]">
          +{summary.added}
        </Badge>
      )}
      {summary.removed > 0 && (
        <Badge variant="default" className="bg-[var(--color-deleted-bg)] text-xs text-[var(--color-deleted)]">
          -{summary.removed}
        </Badge>
      )}
    </div>
  );
}

/**
 * Full inline diff with token-level rendering.
 * Supports hide-details toggle and long-paragraph fallback.
 */
export function InlineDiff({ tokens, className, defaultHideDetails = false }: InlineDiffProps) {
  const [hideDetails, setHideDetails] = useState(defaultHideDetails);
  const isLong = useMemo(() => countChars(tokens) > LONG_PARAGRAPH_THRESHOLD, [tokens]);
  const summary = useMemo(() => computeSummary(tokens), [tokens]);
  const isReplacement = summary.added > 0 && summary.removed > 0;

  if (!tokens || tokens.length === 0) {
    return (
      <div className={cn('text-sm text-[var(--color-text-muted)]', className)}>
        无差异详情
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHideDetails(!hideDetails)}
          aria-label={hideDetails ? '显示差异详情' : '隐藏差异详情'}
          className="h-6 px-2 text-xs"
        >
          {hideDetails ? '显示详情' : '隐藏详情'}
        </Button>
        {isLong && (
          <Badge variant="accent" className="text-xs">
            长段落
          </Badge>
        )}
        <DiffSummaryBadge tokens={tokens} />
      </div>

      {/* Token rendering */}
      {hideDetails ? (
        <div className="text-sm text-[var(--color-text-muted)]">
          <DiffSummaryBadge tokens={tokens} />
        </div>
      ) : isReplacement ? (
        <div
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-sm border border-[var(--color-border)] p-3"
          role="group"
          aria-label="替换差异"
        >
          <span className="text-xs font-medium text-[var(--color-text-muted)]">基准</span>
          <DiffTokenLine tokens={tokens} side="baseline" />
          <span className="text-xs font-medium text-[var(--color-text-muted)]">送审</span>
          <DiffTokenLine tokens={tokens} side="review" />
        </div>
      ) : (
        <div
          className={cn(
            'text-sm leading-relaxed whitespace-pre-wrap break-words',
            'font-[var(--font-body)]'
          )}
          role="text"
          aria-label="差异文本"
        >
          {tokens.map((token, i) => (
            <DiffTokenSpan key={i} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
