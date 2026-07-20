import type { ReactNode } from 'react';
import { TopBar } from './top-bar';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Application shell providing the page grid structure.
 * Layout: top bar (56px) + content area (1fr).
 * Follows UI-SPEC App Shell grid: grid-template-rows: 56px minmax(0, 1fr)
 *
 * Content area uses overflow-hidden so the workbench's three columns
 * can each scroll independently. Non-workbench views (NewCompare, History)
 * carry their own overflow-auto on their outer container.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div
      className="grid h-full overflow-hidden"
      style={{ gridTemplateRows: '56px minmax(0, 1fr)' }}
    >
      <TopBar />
      <main className="min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
