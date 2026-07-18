import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as RadixProgress from '@radix-ui/react-progress';
import { cn } from '../../lib/utils';

export interface ProgressProps extends ComponentPropsWithoutRef<typeof RadixProgress.Root> {
  indicatorClassName?: string;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => (
    <RadixProgress.Root
      ref={ref}
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]',
        className
      )}
      {...props}
    >
      <RadixProgress.Indicator
        className={cn(
          'h-full rounded-full bg-[var(--color-accent)] transition-all duration-300 ease-in-out',
          indicatorClassName
        )}
        style={{ width: `${value ?? 0}%` }}
      />
    </RadixProgress.Root>
  )
);

Progress.displayName = 'Progress';
