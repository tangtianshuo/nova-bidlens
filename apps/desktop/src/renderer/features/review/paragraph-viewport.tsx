import type { DiffItem } from '@bidlens/shared/types-only';
import type { ViewportViewProps } from './viewport-provider';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';

/**
 * Paragraph dual-pane viewport (stub).
 * Displays baseline (sourceA) and review (sourceB) text side by side.
 * P4-05 will replace this with the full implementation including
 * inline diff highlighting, line-level alignment, and comment overlays.
 */
export function ParagraphViewport({ item }: ViewportViewProps) {
  return (
    <div className="flex h-full gap-4">
      <DocumentPane label="基准文档" text={item.sourceA} side="baseline" />
      <DocumentPane label="送审文档" text={item.sourceB} side="review" />
    </div>
  );
}

interface DocumentPaneProps {
  label: string;
  text: string | null;
  side: 'baseline' | 'review';
}

function DocumentPane({ label, text, side }: DocumentPaneProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[var(--color-border)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
        <Badge variant={side === 'baseline' ? 'deleted' : 'added'}>
          {side === 'baseline' ? 'A' : 'B'}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
            {text ?? '(无文本)'}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
