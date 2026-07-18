import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import { cn } from '../../lib/utils';

export interface ScrollAreaProps extends ComponentPropsWithoutRef<typeof RadixScrollArea.Root> {
  orientation?: 'vertical' | 'horizontal' | 'both';
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = 'vertical', ...props }, ref) => (
    <RadixScrollArea.Root
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <RadixScrollArea.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </RadixScrollArea.Viewport>
      {(orientation === 'vertical' || orientation === 'both') && (
        <ScrollBar orientation="vertical" />
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <ScrollBar orientation="horizontal" />
      )}
      <RadixScrollArea.Corner />
    </RadixScrollArea.Root>
  )
);

ScrollArea.displayName = 'ScrollArea';

export const ScrollBar = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixScrollArea.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <RadixScrollArea.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' &&
        'h-full w-1.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' &&
        'h-1.5 flex-col border-t border-t-transparent p-[1px]',
      className
    )}
    {...props}
  >
    <RadixScrollArea.ScrollAreaThumb className="relative flex-1 rounded-full bg-[var(--color-border-strong)]" />
  </RadixScrollArea.ScrollAreaScrollbar>
));

ScrollBar.displayName = 'ScrollBar';
