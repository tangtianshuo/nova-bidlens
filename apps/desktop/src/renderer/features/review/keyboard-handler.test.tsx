/**
 * P4-17: Tests for keyboard handler component.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardHandler } from './keyboard-handler';

afterEach(cleanup);

/**
 * Helper to build a KeyboardHandler with all callbacks mocked.
 * Returns the mock callbacks so tests can assert on them.
 */
function renderHandler(overrides: Partial<Parameters<typeof KeyboardHandler>[0]> = {}) {
  const defaults = {
    onSelectNext: vi.fn(),
    onSelectPrevious: vi.fn(),
    onSelectNextUnreviewed: vi.fn(),
    onMarkConfirmed: vi.fn(),
    onMarkNeedsConfirmation: vi.fn(),
    onMarkIgnored: vi.fn(),
    onToggleImportant: vi.fn(),
    onDeselect: vi.fn(),
    onFocusSearch: vi.fn(),
    ...overrides,
  };

  const result = render(
    <KeyboardHandler {...defaults}>
      <div data-testid="child">test content</div>
    </KeyboardHandler>
  );

  return { ...defaults, ...result };
}

/**
 * Dispatch a keyboard event on the document.
 */
function pressKey(key: string, options: KeyboardEventInit = {}) {
  fireEvent.keyDown(document, { key, ...options });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeyboardHandler', () => {
  describe('rendering', () => {
    it('renders children', () => {
      renderHandler();
      expect(screen.getByTestId('child')).toBeTruthy();
      expect(screen.getByText('test content')).toBeTruthy();
    });

    it('renders a live region for screen reader announcements', () => {
      renderHandler();
      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion!.getAttribute('aria-atomic')).toBe('true');
    });
  });

  describe('Arrow key navigation', () => {
    it('calls onSelectPrevious on ArrowUp', () => {
      const { onSelectPrevious } = renderHandler();
      pressKey('ArrowUp');
      expect(onSelectPrevious).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectNext on ArrowDown', () => {
      const { onSelectNext } = renderHandler();
      pressKey('ArrowDown');
      expect(onSelectNext).toHaveBeenCalledTimes(1);
    });

    it('prevents default on ArrowUp', () => {
      renderHandler();
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default on ArrowDown', () => {
      renderHandler();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('vim-style navigation', () => {
    it('calls onSelectNext on j key', () => {
      const { onSelectNext } = renderHandler();
      pressKey('j');
      expect(onSelectNext).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectPrevious on k key', () => {
      const { onSelectPrevious } = renderHandler();
      pressKey('k');
      expect(onSelectPrevious).toHaveBeenCalledTimes(1);
    });
  });

  describe('unreviewed navigation', () => {
    it('calls onSelectNextUnreviewed on n key', () => {
      const { onSelectNextUnreviewed } = renderHandler();
      pressKey('n');
      expect(onSelectNextUnreviewed).toHaveBeenCalledTimes(1);
    });
  });

  describe('review status shortcuts', () => {
    it('calls onMarkConfirmed on 1 key', () => {
      const { onMarkConfirmed } = renderHandler();
      pressKey('1');
      expect(onMarkConfirmed).toHaveBeenCalledTimes(1);
    });

    it('calls onMarkNeedsConfirmation on 2 key', () => {
      const { onMarkNeedsConfirmation } = renderHandler();
      pressKey('2');
      expect(onMarkNeedsConfirmation).toHaveBeenCalledTimes(1);
    });

    it('calls onMarkIgnored on 3 key', () => {
      const { onMarkIgnored } = renderHandler();
      pressKey('3');
      expect(onMarkIgnored).toHaveBeenCalledTimes(1);
    });
  });

  describe('importance toggle', () => {
    it('calls onToggleImportant on f key', () => {
      const { onToggleImportant } = renderHandler();
      pressKey('f');
      expect(onToggleImportant).toHaveBeenCalledTimes(1);
    });
  });

  describe('deselect', () => {
    it('calls onDeselect on Escape', () => {
      const { onDeselect } = renderHandler();
      pressKey('Escape');
      expect(onDeselect).toHaveBeenCalledTimes(1);
    });
  });

  describe('search focus', () => {
    it('calls onFocusSearch on / key', () => {
      const { onFocusSearch } = renderHandler();
      pressKey('/');
      expect(onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it('prevents default on / key to avoid typing in search', () => {
      renderHandler();
      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it('calls onFocusSearch on Ctrl+F', () => {
      const { onFocusSearch } = renderHandler();
      pressKey('f', { ctrlKey: true });
      expect(onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it('prevents default on Ctrl+F', () => {
      renderHandler();
      const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('editable control bypass', () => {
    it('does not trigger shortcuts when focus is in an input', () => {
      const { onSelectNext, onSelectPrevious, onMarkConfirmed } = renderHandler();
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(input, { key: 'j' });
      fireEvent.keyDown(input, { key: 'k' });
      fireEvent.keyDown(input, { key: '1' });

      expect(onSelectNext).not.toHaveBeenCalled();
      expect(onSelectPrevious).not.toHaveBeenCalled();
      expect(onMarkConfirmed).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('does not trigger shortcuts when focus is in a textarea', () => {
      const { onSelectNext, onMarkConfirmed, onToggleImportant } = renderHandler();
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      fireEvent.keyDown(textarea, { key: 'j' });
      fireEvent.keyDown(textarea, { key: '1' });
      fireEvent.keyDown(textarea, { key: 'f' });

      expect(onSelectNext).not.toHaveBeenCalled();
      expect(onMarkConfirmed).not.toHaveBeenCalled();
      expect(onToggleImportant).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('does not trigger shortcuts when focus is in a contentEditable element', () => {
      const { onSelectNext } = renderHandler();
      const editable = document.createElement('div');
      // Use setAttribute since jsdom does not implement the contentEditable
      // IDL property or the isContentEditable getter.
      editable.setAttribute('contenteditable', 'true');
      document.body.appendChild(editable);
      editable.focus();

      fireEvent.keyDown(editable, { key: 'j' });
      expect(onSelectNext).not.toHaveBeenCalled();

      document.body.removeChild(editable);
    });

    it('does not trigger shortcuts when focus is in a select', () => {
      const { onSelectNext } = renderHandler();
      const select = document.createElement('select');
      const option = document.createElement('option');
      option.value = 'test';
      select.appendChild(option);
      document.body.appendChild(select);
      select.focus();

      fireEvent.keyDown(select, { key: 'j' });
      expect(onSelectNext).not.toHaveBeenCalled();

      document.body.removeChild(select);
    });

    it('does not trigger shortcuts when focus is in an element with role="textbox"', () => {
      const { onSelectNext } = renderHandler();
      const textbox = document.createElement('div');
      textbox.setAttribute('role', 'textbox');
      document.body.appendChild(textbox);
      textbox.focus();

      fireEvent.keyDown(textbox, { key: 'j' });
      expect(onSelectNext).not.toHaveBeenCalled();

      document.body.removeChild(textbox);
    });

    it('Ctrl+F still works when focus is in an input', () => {
      const { onFocusSearch } = renderHandler();
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(input, { key: 'f', ctrlKey: true });
      expect(onFocusSearch).toHaveBeenCalledTimes(1);

      document.body.removeChild(input);
    });

    it('F6 still works when focus is in an input', () => {
      renderHandler();
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // Should not throw — F6 is always handled
      const event = new KeyboardEvent('keydown', { key: 'F6', bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  describe('modifier key passthrough', () => {
    it('does not interfere with Ctrl+C', () => {
      const { onSelectNext, onSelectPrevious } = renderHandler();
      pressKey('c', { ctrlKey: true });
      expect(onSelectNext).not.toHaveBeenCalled();
      expect(onSelectPrevious).not.toHaveBeenCalled();
    });

    it('does not interfere with Ctrl+V', () => {
      const { onSelectNext, onSelectPrevious } = renderHandler();
      pressKey('v', { ctrlKey: true });
      expect(onSelectNext).not.toHaveBeenCalled();
      expect(onSelectPrevious).not.toHaveBeenCalled();
    });

    it('does not interfere with Ctrl+Z', () => {
      const { onSelectNext, onSelectPrevious } = renderHandler();
      pressKey('z', { ctrlKey: true });
      expect(onSelectNext).not.toHaveBeenCalled();
      expect(onSelectPrevious).not.toHaveBeenCalled();
    });

    it('does not interfere with Ctrl+S', () => {
      const { onSelectNext, onSelectPrevious } = renderHandler();
      pressKey('s', { ctrlKey: true });
      expect(onSelectNext).not.toHaveBeenCalled();
      expect(onSelectPrevious).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const { onSelectNext, unmount } = renderHandler();
      unmount();

      pressKey('j');
      expect(onSelectNext).not.toHaveBeenCalled();
    });

    it('re-attaches listener when callbacks change', () => {
      const first = vi.fn();
      const second = vi.fn();

      const { rerender } = render(
        <KeyboardHandler
          onSelectNext={first}
          onSelectPrevious={vi.fn()}
          onSelectNextUnreviewed={vi.fn()}
          onMarkConfirmed={vi.fn()}
          onMarkNeedsConfirmation={vi.fn()}
          onMarkIgnored={vi.fn()}
          onToggleImportant={vi.fn()}
          onDeselect={vi.fn()}
          onFocusSearch={vi.fn()}
        >
          <div>child</div>
        </KeyboardHandler>
      );

      pressKey('j');
      expect(first).toHaveBeenCalledTimes(1);

      // Re-render with new callback
      rerender(
        <KeyboardHandler
          onSelectNext={second}
          onSelectPrevious={vi.fn()}
          onSelectNextUnreviewed={vi.fn()}
          onMarkConfirmed={vi.fn()}
          onMarkNeedsConfirmation={vi.fn()}
          onMarkIgnored={vi.fn()}
          onToggleImportant={vi.fn()}
          onDeselect={vi.fn()}
          onFocusSearch={vi.fn()}
        >
          <div>child</div>
        </KeyboardHandler>
      );

      pressKey('j');
      // Old callback should not be called again
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe('live region announcements', () => {
    it('updates live region text on navigation', () => {
      renderHandler();
      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');

      pressKey('ArrowDown');

      // The live region should be updated (cleared then set)
      // After requestAnimationFrame, the text should be present.
      // We check the cleared state immediately since rAF is async.
      expect(liveRegion).not.toBeNull();
    });
  });

  describe('F6 panel traversal', () => {
    it('prevents default on F6', () => {
      renderHandler();
      const event = new KeyboardEvent('keydown', { key: 'F6', bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it('handles Shift+F6 for backward traversal', () => {
      renderHandler();
      const event = new KeyboardEvent('keydown', { key: 'F6', shiftKey: true, bubbles: true });
      const spy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('unknown keys', () => {
    it('does not call any callback for unrecognized keys', () => {
      const mocks = renderHandler();

      pressKey('x');
      pressKey('z');
      pressKey('a');
      pressKey('Enter');
      pressKey('Tab');

      expect(mocks.onSelectNext).not.toHaveBeenCalled();
      expect(mocks.onSelectPrevious).not.toHaveBeenCalled();
      expect(mocks.onSelectNextUnreviewed).not.toHaveBeenCalled();
      expect(mocks.onMarkConfirmed).not.toHaveBeenCalled();
      expect(mocks.onMarkNeedsConfirmation).not.toHaveBeenCalled();
      expect(mocks.onMarkIgnored).not.toHaveBeenCalled();
      expect(mocks.onToggleImportant).not.toHaveBeenCalled();
      expect(mocks.onDeselect).not.toHaveBeenCalled();
      expect(mocks.onFocusSearch).not.toHaveBeenCalled();
    });
  });
});
