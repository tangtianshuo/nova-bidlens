import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-hover)]',
        secondary:
          'bg-[var(--color-bg-muted)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-border)]',
        ghost:
          'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]',
        destructive:
          'bg-[var(--color-deleted)] text-white hover:bg-[var(--color-deleted)]/90',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-[var(--radius-sm)]',
        md: 'h-9 px-4 text-sm rounded-[var(--radius-md)]',
        lg: 'h-10 px-6 text-sm rounded-[var(--radius-md)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
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
