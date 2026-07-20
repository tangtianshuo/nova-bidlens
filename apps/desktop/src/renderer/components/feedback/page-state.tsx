import { AlertTriangle, FileQuestion, RefreshCw, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

export interface PageStateProps {
  /** Which state to render. */
  variant: 'loading' | 'empty' | 'error' | 'interrupt';
  /** Title text. Defaults are provided per variant. */
  title?: string;
  /** Description text below the title. */
  description?: string;
  /** Primary action button label. */
  actionLabel?: string;
  /** Primary action handler. */
  onAction?: () => void;
  /** Extra content below the description. */
  children?: ReactNode;
  className?: string;
}

const DEFAULTS: Record<
  PageStateProps['variant'],
  { title: string; icon: React.ElementType }
> = {
  loading: { title: '加载中...', icon: RefreshCw },
  empty: { title: '暂无数据', icon: FileQuestion },
  error: { title: '加载失败', icon: XCircle },
  interrupt: { title: '分析已中断', icon: AlertTriangle },
};

/**
 * Full-page state overlay for loading / empty / error / interrupt.
 * Renders a centered icon + title + description + optional action button.
 */
export function PageState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  children,
  className,
}: PageStateProps) {
  const defaults = DEFAULTS[variant];
  const Icon = defaults.icon;

  if (variant === 'loading') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-4 py-16',
          className
        )}
        role="status"
        aria-label={title ?? defaults.title}
      >
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  const ICON_COLOR: Record<string, string> = {
    empty: 'text-[var(--color-text-muted)]',
    error: 'text-[var(--color-deleted)]',
    interrupt: 'text-[var(--color-modified)]',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className
      )}
      role="status"
    >
      <Icon
        className={`h-10 w-10 ${ICON_COLOR[variant]}`}
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-[var(--color-text)]">
        {title ?? defaults.title}
      </p>
      {description && (
        <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
          {description}
        </p>
      )}
      {children}
      {(actionLabel || variant === 'interrupt') && (
        <Button
          variant="primary"
          size="sm"
          onClick={onAction}
          className="mt-2"
        >
          {variant === 'interrupt' && (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {actionLabel ?? '恢复分析'}
        </Button>
      )}
    </div>
  );
}
