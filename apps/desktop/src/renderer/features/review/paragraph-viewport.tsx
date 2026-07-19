import type { DiffItem } from '@bidlens/shared/types-only';
import type { ViewportViewProps } from './viewport-provider';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';

/**
 * Paragraph dual-pane viewport.
 * Displays baseline (sourceA) and review (sourceB) text side by side.
 */
export function ParagraphViewport({ item }: ViewportViewProps) {
  return (
    <div className="grid min-h-full" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
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
    <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3" style={{ height: 42 }}>
        <span className="text-xs font-bold text-[var(--color-text-secondary)]">{label}</span>
        <Badge variant={side === 'baseline' ? 'deleted' : 'added'}>
          {side === 'baseline' ? 'A' : 'B'}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div style={{ padding: '18px 18px 28px' }}>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]" style={{ lineHeight: 1.9 }}>
            {text ?? '(无文本)'}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
