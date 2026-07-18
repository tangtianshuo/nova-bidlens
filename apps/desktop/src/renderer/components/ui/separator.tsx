import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as RadixSeparator from '@radix-ui/react-separator';
import { cn } from '../../lib/utils';

export const Separator = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixSeparator.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <RadixSeparator.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-[var(--color-border)]',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    {...props}
  />
));

Separator.displayName = 'Separator';
