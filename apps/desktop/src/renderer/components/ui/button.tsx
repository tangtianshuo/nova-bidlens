import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[var(--color-border-strong)] disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-text)] disabled:opacity-100',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-accent)] border border-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] hover:border-[var(--color-accent-hover)]',
        secondary:
          'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]',
        ghost:
          'bg-transparent border border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
        destructive:
          'bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-danger)] hover:bg-[var(--color-deleted-bg)] hover:border-[var(--color-deleted-border)]',
        active:
          'bg-[var(--color-accent-soft)] border border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] text-[var(--color-accent)]',
      },
      size: {
        sm: 'min-h-[28px] px-2 py-1 text-xs font-semibold rounded-[var(--radius-sm)]',
        md: 'min-h-[34px] px-3 py-1.5 text-[13px] font-semibold rounded-[var(--radius-sm)]',
        lg: 'min-h-[38px] px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)]',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
