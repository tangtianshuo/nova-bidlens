import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getResolvedTheme,
  getThemePreference,
  setThemePreference,
  applyTheme,
  watchSystemTheme,
} from './theme';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia with controllable dark-mode state
let matchesDark = false;
let mediaListeners: Array<(e: MediaQueryListEvent) => void> = [];

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && matchesDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
      if (query === '(prefers-color-scheme: dark)') {
        mediaListeners.push(listener);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
      mediaListeners = mediaListeners.filter((l) => l !== listener);
    }),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Theme utilities', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    matchesDark = false;
    mediaListeners = [];
  });

  // --- Preference CRUD ---

  it('returns system theme preference by default', () => {
    expect(getThemePreference()).toBe('system');
  });

  it('returns stored theme preference', () => {
    localStorageMock.setItem('bidlens-theme', 'dark');
    expect(getThemePreference()).toBe('dark');
  });

  it('sets theme preference in localStorage', () => {
    setThemePreference('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('bidlens-theme', 'dark');
  });

  // --- Resolution ---

  it('resolves system theme to light when matchMedia is false', () => {
    expect(getResolvedTheme()).toBe('light');
  });

  it('resolves system theme to dark when matchMedia is true', () => {
    matchesDark = true;
    expect(getResolvedTheme()).toBe('dark');
  });

  it('returns light when preference is light', () => {
    localStorageMock.setItem('bidlens-theme', 'light');
    expect(getResolvedTheme()).toBe('light');
  });

  it('returns dark when preference is dark', () => {
    localStorageMock.setItem('bidlens-theme', 'dark');
    expect(getResolvedTheme()).toBe('dark');
  });

  // --- applyTheme (DOM) ---

  it('applyTheme sets data-theme="light" on html element', () => {
    localStorageMock.setItem('bidlens-theme', 'light');
    applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applyTheme sets data-theme="dark" on html element', () => {
    localStorageMock.setItem('bidlens-theme', 'dark');
    applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applyTheme resolves system preference to light by default', () => {
    applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applyTheme resolves system preference to dark when matchMedia matches', () => {
    matchesDark = true;
    applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  // --- watchSystemTheme ---

  it('watchSystemTheme registers a listener on the media query', () => {
    const callback = vi.fn();
    watchSystemTheme(callback);
    expect(mediaListeners).toHaveLength(1);
  });

  it('watchSystemTheme returns an unsubscribe function', () => {
    const callback = vi.fn();
    const unsubscribe = watchSystemTheme(callback);
    expect(mediaListeners).toHaveLength(1);
    unsubscribe();
    expect(mediaListeners).toHaveLength(0);
  });

  // --- Light/dark token coverage ---
  // Verify applyTheme sets the attribute that CSS uses for token selection.

  it('light theme applies correct data-theme for light token set', () => {
    localStorageMock.setItem('bidlens-theme', 'light');
    applyTheme();
    const theme = document.documentElement.getAttribute('data-theme');
    // Light tokens live under :root (no data-theme) or :root[data-theme="light"]
    expect(theme === 'light' || theme === null).toBe(true);
  });

  it('dark theme applies data-theme="dark" for dark token set', () => {
    localStorageMock.setItem('bidlens-theme', 'dark');
    applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('each setThemePreference call is immediately reflected in getResolvedTheme', () => {
    setThemePreference('light');
    expect(getResolvedTheme()).toBe('light');

    setThemePreference('dark');
    expect(getResolvedTheme()).toBe('dark');

    setThemePreference('system');
    expect(getResolvedTheme()).toBe(matchesDark ? 'dark' : 'light');
  });

  // --- Determinism: no flash on load ---
  // applyTheme() must be synchronous — no async gap between reading and writing.

  it('applyTheme is synchronous (no flash on load)', () => {
    localStorageMock.setItem('bidlens-theme', 'dark');
    // applyTheme reads localStorage and writes DOM in the same tick
    applyTheme();
    // Check immediately — no await, no setTimeout
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
