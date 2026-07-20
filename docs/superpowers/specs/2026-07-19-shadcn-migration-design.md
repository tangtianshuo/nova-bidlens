# BidLens v0.2.3 — shadcn/ui Migration Design

> Revised: 2026-07-20 — Aligned to similarity risk review as default primary mode.

## Overview

Migrate BidLens's hand-rolled shadcn-style UI components to standard shadcn/ui components, adopting the shadcn token system. The default primary product mode is now **multi-bidder similarity risk review** (雷同性风险审查); the existing two-document version diff is the secondary辅助模式.

Scope: all components (`components/ui/`, `components/feedback/`, `components/layout/`, `features/*`).

## Approach

**Layered incremental migration (bottom-up):**

1. **Layer 0 — shadcn init + Theming + Risk Tokens**
2. **Layer 1 — UI primitives** (`components/ui/`)
3. **Layer 2 — Feedback + Layout + Data Surface primitives**
4. **Layer 3 — Features** (risk-review → compare → history → settings)

Each layer is a self-contained commit. Review workbench is last (most complex).

---

## Layer 0: Theming Migration

### Current State

`globals.css` defines CSS custom properties under `:root` and `:root[data-theme="dark"]`:
- `--color-accent`, `--color-text`, `--color-text-secondary`, `--color-text-muted`
- `--color-bg`, `--color-bg-subtle`, `--color-bg-muted`, `--color-bg-hover`, `--color-bg-input`
- `--color-border`, `--color-border-strong`
- `--color-danger`, `--color-success`, `--color-warning`
- `--color-added`, `--color-deleted`, `--color-modified`, `--color-uncertain` (+ bg/border variants)
- `--color-span-*` (table diff)

Components reference via `bg-[var(--color-accent)]` pattern.

### Target State

shadcn standard token system with risk review additions:

```css
@layer base {
  :root {
    /* shadcn standard */
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

    /* App-specific status */
    --success: <value>;
    --success-foreground: <value>;
    --warning: <value>;
    --warning-foreground: <value>;
    --info: <value>;
    --info-foreground: <value>;

    /* Diff semantic colors */
    --diff-added: <value>;
    --diff-added-bg: <value>;
    --diff-added-border: <value>;
    --diff-deleted: <value>;
    --diff-deleted-bg: <value>;
    --diff-deleted-border: <value>;
    --diff-modified: <value>;
    --diff-modified-bg: <value>;
    --diff-modified-border: <value>;
    --diff-uncertain: <value>;

    /* Risk review tokens (new) */
    --risk-high: <value>;
    --risk-high-bg: <value>;
    --risk-high-border: <value>;
    --risk-medium: <value>;
    --risk-medium-bg: <value>;
    --risk-medium-border: <value>;
    --risk-low: <value>;
    --risk-low-bg: <value>;
    --risk-low-border: <value>;

    /* Detector category tokens (new) */
    --detector-text: <value>;
    --detector-text-bg: <value>;
    --detector-table: <value>;
    --detector-table-bg: <value>;
    --detector-entity: <value>;
    --detector-entity-bg: <value>;
  }
}
```

### Mapping

| Current | shadcn Token |
|---------|-------------|
| `--color-accent` | `--primary` |
| `--color-text` | `--foreground` |
| `--color-text-secondary` | `--muted-foreground` |
| `--color-text-muted` | (keep as `--text-3` or map to `--muted-foreground` variant) |
| `--color-bg` | `--background` |
| `--color-bg-subtle` | `--card` |
| `--color-bg-muted` | `--muted` |
| `--color-border` | `--border` |
| `--color-danger` | `--destructive` |
| `--color-success` | `--success` (custom) |
| `--color-warning` | `--warning` (custom) |

### Steps

1. Run `npx shadcn@latest init` — generates `components.json` and base CSS variables in `globals.css`
2. Adjust generated CSS variables to match existing light/dark color values
3. Add app-specific variables (`--success`, `--warning`, `--info`, `--diff-*`, `--risk-*`, `--detector-*`)
4. Global search-replace: `bg-[var(--color-accent)]` → `bg-primary`, etc.
5. Verify all pages render correctly

---

## Layer 1: UI Primitives

### Component Mapping

| Current | shadcn Add Command | Notes |
|---------|-------------------|-------|
| `button.tsx` | `npx shadcn add button` | Keep custom `active` variant |
| `badge.tsx` | `npx shadcn add badge` | Keep `added`/`deleted`/`modified`/`uncertain` variants; add `risk-high`/`risk-medium`/`risk-low` |
| `dialog.tsx` | `npx shadcn add dialog` | 1:1 replacement |
| `dropdown-menu.tsx` | `npx shadcn add dropdown-menu` | 1:1 replacement |
| `input.tsx` | `npx shadcn add input` + `label` | Split label/error into separate `Label` + `FieldError` |
| `tabs.tsx` | `npx shadcn add tabs` | 1:1 replacement |
| `tooltip.tsx` | `npx shadcn add tooltip` | 1:1 replacement |
| `progress.tsx` | `npx shadcn add progress` | 1:1 replacement |
| `scroll-area.tsx` | `npx shadcn add scroll-area` | 1:1 replacement |
| `separator.tsx` | `npx shadcn add separator` | 1:1 replacement |
| `icon-button.tsx` | Remove | Use `Button` with `size="icon"` + `Tooltip` composition |

### New Components (for risk review + workbench)

| Component | Command | Purpose |
|-----------|---------|---------|
| Sheet | `npx shadcn add sheet` | Mobile filter panel slide-out |
| Select | `npx shadcn add select` | Already have Radix Select dep, add shadcn wrapper |
| Command | `npx shadcn add command` | Search / command palette |
| Skeleton | `npx shadcn add skeleton` | Loading states |
| Table | `npx shadcn add table` | Data tables for project list, findings |
| Pagination | `npx shadcn add pagination` | Project list pagination |
| Checkbox | `npx shadcn add checkbox` | Filter checkboxes, bulk review |
| RadioGroup | `npx shadcn add radio-group` | Detection preset selection |
| Popover | `npx shadcn add popover` | Matrix tooltips, filter popovers |
| Collapsible | `npx shadcn add collapsible` | Expandable finding details |
| Alert | `npx shadcn add alert` | Status banners (degraded, no-baseline, partial) |
| AlertDialog | `npx shadcn add alert-dialog` | Confirm dialogs (cancel analysis, delete project) |
| FormMessage | (inline) | Field validation messages |

### Resizable Panels

**Do NOT use `@radix-ui/react-resizable-panels`** — the shadcn `Resizable` component wraps this, but the project already has `react-resizable-panels` installed directly. Keep using `react-resizable-panels` as-is. The workbench layout depends on it and it works correctly.

### Steps

1. Add each shadcn component via CLI
2. Replace imports in all consuming files
3. Update `components/ui/index.ts` barrel export
4. Delete replaced hand-rolled files
5. Preserve app-specific variants (badge semantic colors, button active state, risk badges)

---

## Layer 2: Feedback + Layout + Data Surfaces

### Component Mapping

| Current | Target | Notes |
|---------|--------|-------|
| `error-boundary.tsx` | Keep as-is | React error boundary, not a UI component |
| `field-error.tsx` | Merge into shadcn `Label` error state | |
| `warning-banner.tsx` | shadcn `Alert` | Already added in Layer 1 |
| `confirm-dialog.tsx` | shadcn `AlertDialog` | Already added in Layer 1 |
| `top-bar.tsx` | Refactor internals | Replace `IconButton` → shadcn `Button`, keep structure |

### Data Surface Components (new for risk review)

| Component | Location | Purpose |
|-----------|----------|---------|
| `StatusBadge` | `components/feedback/status-badge.tsx` | Risk level, analysis status, review state badges |
| `PersistentBanner` | `components/feedback/persistent-banner.tsx` | Degraded/no-baseline/partial warnings that persist across tabs |
| `PageState` | `components/feedback/page-state.tsx` | Loading/empty/error/interrupt page-level states |
| `LoadingButton` | `components/feedback/loading-button.tsx` | Button with async loading state |

### Steps

1. Replace `warning-banner.tsx` with `Alert` component
2. Replace `confirm-dialog.tsx` with `AlertDialog` component
3. Refactor `top-bar.tsx` to use shadcn primitives
4. Delete `field-error.tsx`, integrate into `Label` usage pattern
5. Create data surface feedback components

---

## Layer 3: Features

### 3a. Risk Review (`features/risk-review/`) — NEW, primary mode

- `risk-overview.tsx` — Risk level card, detector summary, top findings
- `relationship-matrix.tsx` — 8x8 file pair matrix with keyboard navigation
- `finding-virtual-list.tsx` — Virtualized finding list with filters
- `finding-filter-toolbar.tsx` — Risk/detector/file/review/keyword filters
- `evidence-viewport.tsx` — Dual-document evidence view
- `evidence-detail-tabs.tsx` — Match basis, location, baseline filter
- `evidence-review-controls.tsx` — Human review status controls
- `risk-result-page.tsx` — Result shell with 4 tabs
- `risk-export-dialog.tsx` — PDF/HTML/Markdown export

### 3b. Project Management (`features/projects/`) — NEW

- `project-list-page.tsx` — Project data table with search, filters, pagination
- `new-project-page.tsx` — Multi-file project creation form
- `project-processing-page.tsx` — 9-stage progress with file-level status
- `submission-file-list.tsx` — 2-8 file upload with drag-drop
- `detection-preset.tsx` — Strict/standard/loose preset selector

### 3c. Compare (`features/compare/`) — secondary mode

- `new-compare-view.tsx` — Replace custom buttons/inputs with shadcn
- `processing-view.tsx` — Replace progress + text with shadcn

### 3d. History (`features/history/`)

- `history-view.tsx` — Replace buttons/badges with shadcn

### 3e. Settings (`features/settings/`)

- `settings-dialog.tsx` — Replace dialog internals with shadcn form components

### 3f. Review Workbench (`features/review/`) — shared by both modes

**Layout refactor:**

```
ResizablePanelGroup (react-resizable-panels)
├── ResizablePanel — DiffNavList / RiskFindingNav
│   ├── FilterPanel (inline on desktop, Sheet on mobile)
│   ├── Search input (shadcn Input)
│   └── VirtualList (@tanstack/react-virtual + shadcn Button items)
├── ResizablePanel — DiffViewport / EvidenceViewport
│   ├── ParagraphViewport / EvidenceParagraphView
│   └── TableViewport / EvidenceTableView
└── ResizablePanel — DetailTabs (shadcn Tabs)
    ├── Match basis / Format detail
    ├── Evidence location / Source comments
    └── Review controls (shadcn Button + Tooltip)
```

**Key changes:**
- `workbench-layout.tsx` — Keep `react-resizable-panels` (NOT shadcn Resizable)
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
- Risk badges and detector colors are distinguishable without color alone
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
- `react-resizable-panels` (keep, do NOT replace)
- All Radix UI primitives

### New (shadcn components will install)

- `@radix-ui/react-alert-dialog` (via `alert-dialog`)
- `@radix-ui/react-select` (already installed)
- `cmdk` (via `command`)
- `vaul` (via `drawer`, if needed for mobile sheet)

### NOT installing

- `@radix-ui/react-resizable-panels` — project uses `react-resizable-panels` directly

### Can Remove After Migration

- `icon-button.tsx` — replaced by `Button` composition

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Theming migration breaks visual consistency | Side-by-side screenshot comparison before/after each layer |
| Risk tokens confused with diff tokens | Separate namespace: `--risk-*` vs `--diff-*`, enforced by lint |
| Review workbench resize + virtual scroll regression | Manual test with 1000+ diff items after Layer 3f |
| shadcn CLI conflicts with existing Tailwind v4 config | shadcn supports Tailwind v4; verify `components.json` targets v4 |
| Mobile Sheet behavior differs from current filter panel | Test on actual window resize, not just devtools |
| Partial result displayed as low risk | `StatusBadge` + `PersistentBanner` always visible when state is not `ready` |
