/**
 * P4-17: Keyboard commands and accessibility for the review workbench.
 *
 * Provides global keyboard shortcuts for diff navigation, review status marking,
 * F6 panel traversal, focus restoration, and screen reader live region announcements.
 * Shortcuts are disabled when focus is inside editable controls (input, textarea,
 * contentEditable).
 */

import { useCallback, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyboardHandlerProps {
  /** Navigate to the next diff item. */
  onSelectNext: () => void;
  /** Navigate to the previous diff item. */
  onSelectPrevious: () => void;
  /** Jump to the next unreviewed item. */
  onSelectNextUnreviewed: () => void;
  /** Mark the current item as confirmed. */
  onMarkConfirmed: () => void;
  /** Mark the current item as needs-confirmation. */
  onMarkNeedsConfirmation: () => void;
  /** Mark the current item as ignored. */
  onMarkIgnored: () => void;
  /** Toggle importance flag on the current item. */
  onToggleImportant: () => void;
  /** Deselect the current item. */
  onDeselect: () => void;
  /** Focus the search input. */
  onFocusSearch: () => void;
  /** Child content wrapped by the keyboard handler. */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Panel region aria-labels used for F6 traversal. */
const PANEL_LABELS = ['差异导航', '比对视图', '详情面板'] as const;

/**
 * Check whether the active element is an editable control where keyboard
 * shortcuts should NOT be triggered (text inputs, textareas, contentEditable).
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  // isContentEditable is the standard check; the contenteditable attribute
  // is a fallback for environments (like jsdom) that don't implement the
  // IDL property.
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true;

  // Also check for role="textbox" (e.g. some rich-text editors)
  if (target.getAttribute('role') === 'textbox') return true;

  return false;
}

/**
 * Find the panel region element matching the given label.
 */
function findPanelByLabel(label: string): HTMLElement | null {
  return document.querySelector(`[role="region"][aria-label="${label}"]`) as HTMLElement | null;
}

/**
 * Cycle focus through the three workbench panels (left, center, right).
 * Direction: 1 = forward, -1 = backward.
 */
function cyclePanelFocus(direction: 1 | -1): void {
  const panels = PANEL_LABELS.map(findPanelByLabel).filter(Boolean) as HTMLElement[];
  if (panels.length === 0) return;

  const activeEl = document.activeElement;
  const currentPanelIdx = panels.findIndex(
    (panel) => panel === activeEl || panel.contains(activeEl)
  );

  let nextIdx: number;
  if (currentPanelIdx === -1) {
    // No panel focused — focus the first (or last if going backward)
    nextIdx = direction === 1 ? 0 : panels.length - 1;
  } else {
    nextIdx = (currentPanelIdx + direction + panels.length) % panels.length;
  }

  const targetPanel = panels[nextIdx];

  // Focus the first focusable element within the panel, or the panel itself
  const focusable = targetPanel.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable) {
    focusable.focus();
  } else {
    targetPanel.setAttribute('tabindex', '-1');
    targetPanel.focus();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyboardHandler({
  onSelectNext,
  onSelectPrevious,
  onSelectNextUnreviewed,
  onMarkConfirmed,
  onMarkNeedsConfirmation,
  onMarkIgnored,
  onToggleImportant,
  onDeselect,
  onFocusSearch,
  children,
}: KeyboardHandlerProps) {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  /**
   * Announce a message to screen readers via the live region.
   * We set the text content, then clear it after a short delay so that
   * repeated identical messages are still announced.
   */
  const announce = useCallback((message: string) => {
    const el = liveRegionRef.current;
    if (!el) return;
    // Clear first to ensure re-announcement of the same text
    el.textContent = '';
    // Use requestAnimationFrame so the DOM clears before the new text is set
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Never interfere with modifier-key combos (Ctrl+C, Ctrl+V, Ctrl+Z, etc.)
      // Allow only plain F6 (no ctrl/alt/shift) for panel traversal.
      const hasModifier = e.ctrlKey || e.metaKey;

      // Ctrl+F → focus search (allow this even in editable targets)
      if (hasModifier && e.key === 'f') {
        e.preventDefault();
        onFocusSearch();
        announce('搜索输入框已聚焦');
        return;
      }

      // F6 → panel traversal (works everywhere, even in editable controls)
      if (e.key === 'F6' && !hasModifier && !e.altKey) {
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        cyclePanelFocus(direction as 1 | -1);
        return;
      }

      // All other shortcuts are disabled inside editable controls
      if (isEditableTarget(e.target)) return;

      switch (e.key) {
        // Navigation
        case 'ArrowUp':
          e.preventDefault();
          onSelectPrevious();
          announce('已选择上一项差异');
          break;
        case 'ArrowDown':
          e.preventDefault();
          onSelectNext();
          announce('已选择下一项差异');
          break;
        case 'j':
          onSelectNext();
          announce('已选择下一项差异');
          break;
        case 'k':
          onSelectPrevious();
          announce('已选择上一项差异');
          break;
        case 'n':
          onSelectNextUnreviewed();
          announce('已跳转到下一项未审核差异');
          break;

        // Review status
        case '1':
          onMarkConfirmed();
          announce('已标记为确认');
          break;
        case '2':
          onMarkNeedsConfirmation();
          announce('已标记为待确认');
          break;
        case '3':
          onMarkIgnored();
          announce('已标记为忽略');
          break;

        // Importance
        case 'f':
          onToggleImportant();
          announce('已切换重要标记');
          break;

        // Deselect
        case 'Escape':
          onDeselect();
          announce('已取消选择');
          break;

        // Search (plain / key, not inside editable)
        case '/':
          e.preventDefault();
          onFocusSearch();
          announce('搜索输入框已聚焦');
          break;

        default:
          // Let all other keys pass through
          break;
      }
    },
    [
      onSelectNext,
      onSelectPrevious,
      onSelectNextUnreviewed,
      onMarkConfirmed,
      onMarkNeedsConfirmation,
      onMarkIgnored,
      onToggleImportant,
      onDeselect,
      onFocusSearch,
      announce,
    ]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <>
      {children}
      {/* Screen reader live region — visually hidden, announced by assistive tech */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
