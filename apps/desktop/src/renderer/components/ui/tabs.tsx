import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-0',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] data-[state=active]:text-[var(--color-text)] data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-accent)]',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn(
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
