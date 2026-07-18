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
      'inline-flex h-9 items-center gap-1 border-b border-[var(--color-border)]',
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
      'inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] data-[state=active]:text-[var(--color-accent)] data-[state=active]:shadow-[inset_0_-2px_0_0_var(--color-accent)]',
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
      'mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
