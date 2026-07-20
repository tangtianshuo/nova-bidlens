import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { SimpleTooltip } from '../ui/tooltip';

export interface WarningBannerProps {
  title: string;
  children?: ReactNode;
  details?: string;
  dismissable?: boolean;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Non-blocking warning banner with optional expandable details.
 */
export function WarningBanner({
  title,
  children,
  details,
  dismissable = false,
  onDismiss,
  className,
}: WarningBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-modified)]/30 bg-[var(--color-modified-bg)] p-3 text-sm',
        className
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-modified)]" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--color-modified)]">{title}</p>
        {children && <div className="mt-1 text-[var(--color-text-secondary)]">{children}</div>}
        {details && (
          <>
            <button
              className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? '收起详情' : '查看详情'}
            </button>
            {expanded && (
              <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">{details}</p>
            )}
          </>
        )}
      </div>
      {dismissable && (
        <SimpleTooltip content="关闭">
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7"
            onClick={handleDismiss}
            aria-label="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
      )}
    </div>
  );
}
