/**
 * Theme management for BidLens.
 * Reads theme preference from localStorage and applies data-theme attribute.
 */

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'bidlens-theme';

/**
 * Get the resolved theme (light or dark) based on preference and system.
 */
export function getResolvedTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  const preference: Theme = stored ?? 'system';

  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return preference;
}

/**
 * Get the stored theme preference (may be 'system').
 */
export function getThemePreference(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored ?? 'system';
}

/**
 * Set theme preference and apply it.
 */
export function setThemePreference(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme();
}

/**
 * Apply the current theme to the document element.
 */
export function applyTheme(): void {
  const resolved = getResolvedTheme();
  document.documentElement.setAttribute('data-theme', resolved);
}

/**
 * Listen for system theme changes.
 */
export function watchSystemTheme(callback: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}
