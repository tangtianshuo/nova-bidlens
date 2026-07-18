import { createContext, useContext, useState, useCallback, type ReactNode, type ComponentType } from 'react';
import type { DiffItem } from '@bidlens/shared/types-only';

/**
 * View types that the viewport can render.
 * Extend this union to add new view types without changing navigation/review contracts.
 */
export type ViewportViewType = 'paragraph' | 'table';

/**
 * Props that every viewport view component must accept.
 */
export interface ViewportViewProps {
  item: DiffItem;
}

/**
 * A React component that renders a single DiffItem in the viewport.
 */
export type ViewportViewComponent = ComponentType<ViewportViewProps>;

interface ViewportState {
  /** Currently selected diff item, or null if nothing is selected. */
  selectedItem: DiffItem | null;
  /** Set the selected diff item. */
  setSelectedItem: (item: DiffItem | null) => void;
  /** Map of registered view components keyed by view type. */
  viewRegistry: Map<ViewportViewType, ViewportViewComponent>;
  /** Register a view component for a given view type. */
  registerView: (type: ViewportViewType, component: ViewportViewComponent) => void;
  /** Resolve the appropriate view component for a given DiffItem. */
  resolveView: (item: DiffItem) => ViewportViewComponent | null;
}

const ViewportContext = createContext<ViewportState | null>(null);

/**
 * Determine the viewport view type for a DiffItem.
 * Table items (blockType === 'table' with tableDiff) use the table view;
 * everything else uses the paragraph view.
 */
export function resolveViewType(item: DiffItem): ViewportViewType {
  if (item.blockType === 'table' && item.tableDiff !== undefined) {
    return 'table';
  }
  return 'paragraph';
}

export interface ViewportProviderProps {
  children: ReactNode;
  /** Pre-registered view components. */
  views?: Partial<Record<ViewportViewType, ViewportViewComponent>>;
}

export function ViewportProvider({ children, views: initialViews }: ViewportProviderProps) {
  const [selectedItem, setSelectedItem] = useState<DiffItem | null>(null);
  const [viewRegistry] = useState<Map<ViewportViewType, ViewportViewComponent>>(() => {
    const map = new Map<ViewportViewType, ViewportViewComponent>();
    if (initialViews) {
      for (const [key, component] of Object.entries(initialViews) as [ViewportViewType, ViewportViewComponent][]) {
        if (component) map.set(key, component);
      }
    }
    return map;
  });

  const registerView = useCallback((type: ViewportViewType, component: ViewportViewComponent) => {
    viewRegistry.set(type, component);
  }, [viewRegistry]);

  const resolveView = useCallback((item: DiffItem): ViewportViewComponent | null => {
    const viewType = resolveViewType(item);
    return viewRegistry.get(viewType) ?? null;
  }, [viewRegistry]);

  return (
    <ViewportContext.Provider value={{ selectedItem, setSelectedItem, viewRegistry, registerView, resolveView }}>
      {children}
    </ViewportContext.Provider>
  );
}

/**
 * Hook to access the viewport context.
 * Must be used within a ViewportProvider.
 */
export function useViewport() {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error('useViewport must be used within a ViewportProvider');
  }
  return ctx;
}
