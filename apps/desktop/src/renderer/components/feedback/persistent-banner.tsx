import { AlertTriangle, Info, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

export type BannerVariant = 'warning' | 'info';

export interface PersistentBannerProps {
  /** Banner variant — warning uses yellow/orange tokens, info uses accent tokens. */
  variant?: BannerVariant;
  /** Bold title line. */
  title: string;
  /** Optional body content below the title. */
  children?: ReactNode;
  /** When true, the user can dismiss the banner. */
  dismissable?: boolean;
  /** Called when the user dismisses the banner. */
  onDismiss?: () => void;
  /** Optional external control — when true, the banner is hidden regardless of internal state. */
  hidden?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<BannerVariant, string> = {
  warning:
    'border-[var(--color-modified)]/30 bg-[var(--color-modified-bg)] text-[var(--color-modified)]',
  info:
    'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
};

const VARIANT_ICON: Record<BannerVariant, React.ElementType> = {
  warning: AlertTriangle,
  info: Info,
};

/**
 * Persistent banner for degraded / no-baseline / partial warnings.
 * Persists across tab switches — parent controls visibility via `hidden` prop
 * or the user dismisses it locally when `dismissable` is true.
 */
export function PersistentBanner({
  variant = 'warning',
  title,
  children,
  dismissable = false,
  onDismiss,
  hidden = false,
  className,
}: PersistentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (hidden || dismissed) return null;

  const Icon = VARIANT_ICON[variant];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--radius-md)] border p-3 text-sm',
        VARIANT_STYLES[variant],
        className
      )}
      role="alert"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        {children && (
          <div className="mt-1 opacity-80">{children}</div>
        )}
      </div>
      {dismissable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDismiss}
          aria-label="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
