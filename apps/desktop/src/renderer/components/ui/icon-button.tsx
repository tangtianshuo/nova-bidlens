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
    const sizeClasses = size === 'sm' ? 'w-7 h-7' : 'w-[34px] h-[34px]';

    return (
      <Tooltip content={tooltip}>
        <button
          ref={ref}
          className={cn(
            'inline-grid place-items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
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
