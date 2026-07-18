import { type ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  delayDuration = 300,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={4}
            className={cn(
              'z-50 rounded-[var(--radius-sm)] bg-[var(--color-text)] px-2.5 py-1.5 text-xs text-[var(--color-bg)] shadow-[var(--shadow-dropdown)] animate-in fade-in-0 zoom-in-95'
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-[var(--color-text)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
