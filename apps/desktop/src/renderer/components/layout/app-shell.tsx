import type { ReactNode } from 'react';
import { TopBar } from './top-bar';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Application shell providing the page grid structure.
 * Layout: top bar (56px) + content area (flex-1).
 * Follows UI-SPEC App Shell grid: grid-template-rows: 56px minmax(0, 1fr)
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div
      className="grid h-full overflow-hidden"
      style={{ gridTemplateRows: '56px minmax(0, 1fr)' }}
    >
      <TopBar />
      <main className="overflow-auto">{children}</main>
    </div>
  );
}
