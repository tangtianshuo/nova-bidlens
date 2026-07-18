/**
 * P4-12: Source comment and revision views.
 * Read-only display of document-embedded comments and revision history.
 * These are distinct from review annotations (which are reviewer notes).
 */

import { MessageSquare, GitBranch, Clock, User } from 'lucide-react';
import type { DiffItem } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';

interface SourceCommentsProps {
  item: DiffItem;
  className?: string;
}

interface SourceRevisionsProps {
  item: DiffItem;
  className?: string;
}

/**
 * Display source document comments associated with a diff item.
 * Comments are read-only and come from the original DOCX/PDF.
 */
export function SourceCommentsView({ item, className }: SourceCommentsProps) {
  // Comments would come from the DocumentAst's comments array
  // For now, show a placeholder indicating the feature is available
  // when comments are extracted during parsing
  const hasComments = false; // Will be populated when parser extracts comments

  if (!hasComments) {
    return (
      <div className={cn('p-4 text-sm text-[var(--color-text-muted)]', className)}>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4" />
          <span>源文档批注</span>
        </div>
        <p>此段落无源文档批注</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-medium">源文档批注</span>
          <Badge variant="accent" className="text-xs h-4 px-1">
            {/* count */}0
          </Badge>
        </div>
        {/* Comment items would be rendered here */}
      </div>
    </ScrollArea>
  );
}

/**
 * Display revision history associated with a diff item.
 * Shows tracked changes from the original document.
 */
export function SourceRevisionsView({ item, className }: SourceRevisionsProps) {
  // Revisions would come from the DocumentAst's revisions array
  const hasRevisions = false; // Will be populated when parser extracts revisions

  if (!hasRevisions) {
    return (
      <div className={cn('p-4 text-sm text-[var(--color-text-muted)]', className)}>
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="h-4 w-4" />
          <span>修订记录</span>
        </div>
        <p>此段落无修订记录</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="h-4 w-4" />
          <span className="text-sm font-medium">修订记录</span>
          <Badge variant="accent" className="text-xs h-4 px-1">
            {/* count */}0
          </Badge>
        </div>
        {/* Revision items would be rendered here */}
      </div>
    </ScrollArea>
  );
}
