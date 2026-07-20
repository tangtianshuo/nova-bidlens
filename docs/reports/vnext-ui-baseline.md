# VNext UI Baseline Report

> Generated: 2026-07-20 | Branch: `feature/vnext-ui-phase-0` | SHA: `3f17573`

## Commands

### Lint

```bash
pnpm --filter @bidlens/desktop lint
```

- **Exit code:** 2 (FAIL)
- **Errors:**
  - `src/renderer/stores/result-store.ts(351,50): error TS7006: Parameter 'item' implicitly has an 'any' type.`
  - `src/renderer/stores/result-store.ts(352,33): error TS7006: Parameter 'item' implicitly has an 'any' type.`
- **Status:** Pre-existing, not caused by VNext UI work.

### Tests

```bash
pnpm --filter @bidlens/desktop exec vitest run
```

- **Exit code:** 1 (FAIL)
- **Test files:** 7 failed | 24 passed (31 total)
- **Tests:** 321 passed (321 total)
- **Duration:** ~14s
- **Failure root cause:** Vite transform errors — `icon-button` import resolution. Pre-existing, not caused by VNext UI work.

### Build

```bash
pnpm --filter @bidlens/shared build && pnpm --filter @bidlens/desktop build
```

- **Exit code:** 0 (PASS) — after building shared first
- **Output:** `dist/renderer/index.html` (0.96 kB), `index-ChtRw3wC.css` (36.57 kB), `index-B82ggtw8.js` (509.89 kB)
- **Warning:** Chunk size >500 kB (code-splitting recommended, not blocking)
- **Note:** `@bidlens/shared` must be built before desktop; TS2307 errors occur if skipped.

## Theme System

### Current Token Scheme

CSS custom properties under `:root` (light) and `:root[data-theme="dark"]` (dark):

| Category | Tokens |
|----------|--------|
| Backgrounds | `--color-bg`, `--color-bg-subtle`, `--color-bg-muted`, `--color-bg-hover`, `--color-bg-input` |
| Borders | `--color-border`, `--color-border-strong` |
| Text | `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-disabled-bg`, `--color-disabled-text` |
| Accent | `--color-accent`, `--color-accent-hover`, `--color-accent-soft` |
| Diff semantic | `--color-added`, `--color-added-bg`, `--color-added-border`, `--color-deleted`, `--color-deleted-bg`, `--color-deleted-border`, `--color-modified`, `--color-modified-bg`, `--color-modified-border`, `--color-uncertain` |
| Table diff | `--color-span-bg`, `--color-span-border`, `--color-span-text` |
| Status | `--color-danger`, `--color-warning`, `--color-success` |
| Focus | `--color-ring` |
| Spacing | `--space-1` through `--space-8`, layout variables |
| Typography | `--font-sans`, `--font-mono` |
| Radius | `--radius-sm` (4px), `--radius-md` (4px), `--radius-lg` (6px) |
| Shadows | `--shadow-overlay`, `--shadow-dropdown`, `--shadow` |

### Tailwind CSS Version

Tailwind CSS 4 with `@theme` directive and `@import "tailwindcss"`.

### Dark Theme

Activated via `data-theme="dark"` attribute on `:root`.

## Known Pre-existing Failures

| Issue | Location | Type |
|-------|----------|------|
| TS7006 implicit any | `result-store.ts:351-352` | Lint/Build |
| Vite transform error | `icon-button` import in 7 test files | Test |
| TS2307 missing module | `@bidlens/shared/types-only` if shared not built | Build (ordering) |

## Screenshot Baseline

> TODO: Screenshots require running Electron dev server + Playwright. Deferred to implementation phase when app is running.

Target viewports:
- 1024x700
- 1280x800
- 1440x900
- 1920x1080
