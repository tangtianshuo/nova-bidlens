import { useEffect } from 'react';
import type { DiffItem } from '@bidlens/shared/types-only';
import { useViewport, ViewportProvider, resolveViewType } from './viewport-provider';
import { ParagraphViewport } from './paragraph-viewport';
import { TableViewport } from './table-viewport';

export interface DiffViewportProps {
  /** The currently selected diff item, or null if nothing is selected. */
  selectedItem: DiffItem | null;
}

/**
 * Inner viewport that reads context and dispatches to the appropriate view.
 */
function DiffViewportInner({ selectedItem }: DiffViewportProps) {
  const { setSelectedItem, resolveView } = useViewport();

  // Sync the externally-provided selected item into context.
  useEffect(() => {
    setSelectedItem(selectedItem);
  }, [selectedItem, setSelectedItem]);

  // Empty state
  if (!selectedItem) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
        <svg
          className="h-10 w-10 opacity-40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">请在左侧导航中选择一条差异</p>
      </div>
    );
  }

  // Try the registered view first, fall back to built-in views.
  const RegisteredView = resolveView(selectedItem);
  if (RegisteredView) {
    return <RegisteredView item={selectedItem} />;
  }

  // Built-in fallback dispatch.
  const viewType = resolveViewType(selectedItem);
  if (viewType === 'table') {
    return <TableViewport item={selectedItem} />;
  }
  return <ParagraphViewport item={selectedItem} />;
}

/**
 * The main diff viewport component.
 *
 * Wraps DiffViewportInner in a ViewportProvider pre-loaded with the
 * built-in paragraph and table views. Consumers can register additional
 * views via `useViewport().registerView()` without modifying this component.
 */
export function DiffViewport({ selectedItem }: DiffViewportProps) {
  return (
    <ViewportProvider views={{ paragraph: ParagraphViewport, table: TableViewport }}>
      <DiffViewportInner selectedItem={selectedItem} />
    </ViewportProvider>
  );
}
