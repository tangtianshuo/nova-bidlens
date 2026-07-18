import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Tooltip } from './tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  tooltip: string;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, tooltip, size = 'md', className, ...props }, ref) => {
    const sizeClasses = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

    return (
      <Tooltip content={tooltip}>
        <button
          ref={ref}
          className={cn(
            'inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            sizeClasses,
            className
          )}
          aria-label={tooltip}
          {...props}
        >
          {icon}
        </button>
      </Tooltip>
    );
  }
);

IconButton.displayName = 'IconButton';
