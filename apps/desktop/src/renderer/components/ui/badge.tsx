import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]',
        accent:
          'bg-[var(--color-accent-light)] text-[var(--color-accent)]',
        added:
          'bg-[var(--color-added-bg)] text-[var(--color-added)]',
        deleted:
          'bg-[var(--color-deleted-bg)] text-[var(--color-deleted)]',
        modified:
          'bg-[var(--color-modified-bg)] text-[var(--color-modified)]',
        uncertain:
          'bg-[var(--color-bg-muted)] text-[var(--color-uncertain)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, className }))}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
