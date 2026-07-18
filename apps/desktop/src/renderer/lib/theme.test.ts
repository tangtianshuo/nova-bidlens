import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getResolvedTheme, getThemePreference, setThemePreference, applyTheme } from './theme';

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

// Default matchMedia: dark mode NOT preferred
let matchesDark = false;
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && matchesDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Theme utilities', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    matchesDark = false;
  });

  it('returns system theme preference by default', () => {
    expect(getThemePreference()).toBe('system');
  });

  it('returns stored theme preference', () => {
    localStorageMock.setItem('bidlens-theme', 'dark');
    expect(getThemePreference()).toBe('dark');
  });

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

  it('sets theme preference in localStorage', () => {
    setThemePreference('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('bidlens-theme', 'dark');
  });

  it('applyTheme sets data-theme attribute on html element', () => {
    localStorageMock.setItem('bidlens-theme', 'dark');
    applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applyTheme resolves system theme', () => {
    applyTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
