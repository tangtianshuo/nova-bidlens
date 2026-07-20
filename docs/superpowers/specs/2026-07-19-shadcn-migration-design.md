# BidLens v0.2.3 — shadcn/ui Migration Design

## Overview

Migrate BidLens's hand-rolled shadcn-style UI components to standard shadcn/ui components, adopting the shadcn token system. Scope: all components (`components/ui/`, `components/feedback/`, `components/layout/`, `features/*`).

## Approach

**Layered incremental migration (bottom-up):**

1. **Layer 0 — shadcn init + Theming**
2. **Layer 1 — UI primitives** (`components/ui/`)
3. **Layer 2 — Feedback + Layout**
4. **Layer 3 — Features** (compare → history → settings → review)

Each layer is a self-contained commit. Review workbench is last (most complex).

---

## Layer 0: Theming Migration

### Current State

`globals.css` defines CSS custom properties under `:root` and `:root[data-theme="dark"]`:
- `--color-accent`, `--color-text-primary`, `--color-text-secondary`
- `--color-bg-primary`, `--color-bg-secondary`, `--color-border`
- `--color-error`, `--color-success`, `--color-warning`, `--color-info`

Components reference via `bg-[var(--color-accent)]` pattern.

### Target State

shadcn standard token system:

```css
@layer base {
  :root {
    --background: <value>;
    --foreground: <value>;
    --card: <value>;
    --card-foreground: <value>;
    --popover: <value>;
    --popover-foreground: <value>;
    --primary: <value>;
    --primary-foreground: <value>;
    --secondary: <value>;
    --secondary-foreground: <value>;
    --muted: <value>;
    --muted-foreground: <value>;
    --accent: <value>;
    --accent-foreground: <value>;
    --destructive: <value>;
    --destructive-foreground: <value>;
    --border: <value>;
    --input: <value>;
    --ring: <value>;
    --radius: <value>;

    /* App-specific (shadcn does not cover) */
    --success: <value>;
    --warning: <value>;
    --info: <value>;

    /* Diff semantic colors */
    --diff-added: <value>;
    --diff-deleted: <value>;
    --diff-modified: <value>;
    --diff-uncertain: <value>;
  }
}
```

### Mapping

| Current | shadcn Token |
|---------|-------------|
| `--color-accent` | `--primary` |
| `--color-text-primary` | `--foreground` |
| `--color-text-secondary` | `--muted-foreground` |
| `--color-bg-primary` | `--background` |
| `--color-bg-secondary` | `--card` |
| `--color-border` | `--border` |
| `--color-error` | `--destructive` |
| `--color-success` | `--success` (custom) |
| `--color-warning` | `--warning` (custom) |
| `--color-info` | `--info` (custom) |

### Steps

1. Run `npx shadcn@latest init` — generates `components.json` and base CSS variables in `globals.css`
2. Adjust generated CSS variables to match existing light/dark color values
3. Add app-specific variables (`--success`, `--warning`, `--info`, `--diff-*`)
4. Global search-replace: `bg-[var(--color-accent)]` → `bg-primary`, etc.
5. Verify all pages render correctly

---

## Layer 1: UI Primitives

### Component Mapping

| Current | shadcn Add Command | Notes |
|---------|-------------------|-------|
| `button.tsx` | `npx shadcn add button` | Keep custom `active` variant |
| `badge.tsx` | `npx shadcn add badge` | Keep `added`/`deleted`/`modified`/`uncertain` variants |
| `dialog.tsx` | `npx shadcn add dialog` | 1:1 replacement |
| `dropdown-menu.tsx` | `npx shadcn add dropdown-menu` | 1:1 replacement |
| `input.tsx` | `npx shadcn add input` + `label` | Split label/error into separate `Label` + `FieldError` |
| `tabs.tsx` | `npx shadcn add tabs` | 1:1 replacement |
| `tooltip.tsx` | `npx shadcn add tooltip` | 1:1 replacement |
| `progress.tsx` | `npx shadcn add progress` | 1:1 replacement |
| `scroll-area.tsx` | `npx shadcn add scroll-area` | 1:1 replacement |
| `separator.tsx` | `npx shadcn add separator` | 1:1 replacement |
| `icon-button.tsx` | Remove | Use `Button` with `size="icon"` + `Tooltip` composition |

### New Components (for review workbench)

| Component | Command | Purpose |
|-----------|---------|---------|
| Resizable | `npx shadcn add resizable` | Replace `react-resizable-panels` direct usage |
| Sheet | `npx shadcn add sheet` | Mobile filter panel slide-out |
| Select | `npx shadcn add select` | Already have Radix Select dep, add shadcn wrapper |
| Command | `npx shadcn add command` | Search / command palette |
| Skeleton | `npx shadcn add skeleton` | Loading states |

### Steps

1. Add each shadcn component via CLI
2. Replace imports in all consuming files
3. Update `components/ui/index.ts` barrel export
4. Delete replaced hand-rolled files
5. Preserve app-specific variants (badge semantic colors, button active state)

---

## Layer 2: Feedback + Layout

### Component Mapping

| Current | Target | Notes |
|---------|--------|-------|
| `error-boundary.tsx` | Keep as-is | React error boundary, not a UI component |
| `field-error.tsx` | Merge into shadcn `Label` error state | |
| `warning-banner.tsx` | shadcn `Alert` | `npx shadcn add alert` |
| `confirm-dialog.tsx` | shadcn `AlertDialog` | `npx shadcn add alert-dialog` |
| `top-bar.tsx` | Refactor internals | Replace `IconButton` → shadcn `Button`, keep structure |

### Steps

1. `npx shadcn add alert alert-dialog`
2. Replace `warning-banner.tsx` with `Alert` component
3. Replace `confirm-dialog.tsx` with `AlertDialog` component
4. Refactor `top-bar.tsx` to use shadcn primitives
5. Delete `field-error.tsx`, integrate into `Label` usage pattern

---

## Layer 3: Features

### 3a. Compare (`features/compare/`)

- `new-compare-view.tsx` — Replace custom buttons/inputs with shadcn
- `processing-view.tsx` — Replace progress + text with shadcn

### 3b. History (`features/history/`)

- `history-view.tsx` — Replace buttons/badges with shadcn

### 3c. Settings (`features/settings/`)

- `settings-dialog.tsx` — Replace dialog internals with shadcn form components

### 3d. Review Workbench (`features/review/`)

**Layout refactor:**

```
ResizablePanelGroup (shadcn)
├── ResizablePanel — DiffNavList
│   ├── FilterPanel (inline on desktop, Sheet on mobile)
│   ├── Search input (shadcn Input)
│   └── VirtualList (@tanstack/react-virtual + shadcn Button items)
├── ResizablePanel — DiffViewport
│   ├── ParagraphViewport
│   └── TableViewport
└── ResizablePanel — DetailTabs (shadcn Tabs)
    ├── Format detail
    ├── Source comments
    └── Review controls (shadcn Button + Tooltip)
```

**Key changes:**
- `workbench-layout.tsx` — `react-resizable-panels` → shadcn `Resizable`
- `diff-nav-list.tsx` — Keep `@tanstack/react-virtual`, replace item UI with shadcn `Button`
- `filter-panel.tsx` — Desktop: inline; Mobile: shadcn `Sheet`
- `detail-tabs.tsx` — shadcn `Tabs`
- `review-controls.tsx` — shadcn `Button` + `Tooltip`
- `task-toolbar.tsx` — shadcn `Button` + `Breadcrumb`
- `export-dialog.tsx` — shadcn `Dialog`

**Preserved logic (no UI changes):**
- `viewport-provider.tsx` — Context provider
- `keyboard-handler.tsx` — Keyboard shortcuts
- `diff-presentation.ts` — Diff formatting logic
- `inline-diff.tsx` — Pure diff rendering (only token changes)

### Testing

After each layer, verify:
- Light/dark theme renders correctly
- All interactive components work (dialog open/close, dropdown select, tab switch)
- Review workbench: virtual scroll performance with 1000+ items
- Review workbench: resize panels, filter panel mobile/desktop toggle

---

## Dependencies

### Existing (already installed)

- `tailwindcss` v4.3.3
- `@tailwindcss/vite` v4.3.3
- `class-variance-authority` ^0.7.1
- `clsx` ^2.1.1
- `tailwind-merge` ^3.6.0
- `lucide-react` ^1.25.0
- All Radix UI primitives

### New (shadcn components will install)

- `@radix-ui/react-alert-dialog` (via `alert-dialog`)
- `@radix-ui/react-resizable-panels` (shadcn `resizable` wraps this — already have `react-resizable-panels`)
- `@radix-ui/react-select` (already installed)
- `cmdk` (via `command`)
- `vaul` (via `drawer`, if needed for mobile sheet)

### Can Remove After Migration

- `react-resizable-panels` — replaced by shadcn `Resizable` (same underlying lib, but unified API)
- `icon-button.tsx` — replaced by `Button` composition

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Theming migration breaks visual consistency | Side-by-side screenshot comparison before/after each layer |
| Review workbench resize + virtual scroll regression | Manual test with 1000+ diff items after Layer 3d |
| shadcn CLI conflicts with existing Tailwind v4 config | shadcn supports Tailwind v4; verify `components.json` targets v4 |
| Mobile Sheet behavior differs from current filter panel | Test on actual window resize, not just devtools |
