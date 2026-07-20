# VNext UI Contract Checklist

> Generated: 2026-07-20 | Maps every UI-SPEC requirement to implementation task ID.

## Pages → Tasks

| Page / View | Primary Task | Supporting Tasks | UI-SPEC Section |
|-------------|-------------|-----------------|----------------|
| App Shell (top bar, dual-mode nav) | UI-105 | UI-102, UI-104 | §4 (App Bar) |
| Project List (default home) | UI-201, UI-202 | UI-103, UI-104, UI-200 | New (product design §12) |
| New Project (multi-file) | UI-203, UI-204, UI-205 | UI-103 | New (product design §12.1) |
| Project Processing | UI-206, UI-207 | UI-104, UI-200 | New (product design §12.2) |
| Risk Result Shell (4 tabs) | UI-301 | UI-104, UI-300 | New (product design §12.3) |
| Risk Overview | UI-302 | UI-301 | New (product design §12.3) |
| Relationship Matrix (8x8) | UI-303, UI-304 | UI-101, UI-301 | New (product design §12.3) |
| Finding List (virtual) | UI-305, UI-306, UI-307 | UI-300 | New (product design §12.3) |
| Evidence Review Workbench | UI-400, UI-401, UI-402, UI-403 | UI-102, UI-301 | §5 (Result/Workbench) |
| Version Diff — New Compare | UI-405 | UI-102-UI-105 | §4 (New Compare) |
| Version Diff — Processing | UI-405 | UI-104 | §4 (Processing) |
| Version Diff — History | UI-405 | UI-102-UI-105 | §4 (History) |
| Version Diff — Workbench | UI-404, UI-405 | UI-400 | §5 (Result/Workbench) |
| Settings Dialog | UI-406 | UI-103 | New (product design) |
| Export Dialog | UI-407 | UI-301 | §5 (Export) |

## States → Tasks

| State | Task | Pages Affected | UI-SPEC / Product Design Ref |
|-------|------|---------------|------------------------------|
| Loading (spinner) | UI-104 | All async pages | §4, §5 |
| Empty (no data) | UI-104, UI-202 | Project list, findings | §4 |
| Error (retry action) | UI-104, UI-207 | All async pages | §4, §5 |
| Degraded (model unavailable) | UI-104, UI-207 | Processing, result | Product design §14 |
| No baseline (warning banner) | UI-104, UI-203 | New project, processing, result | Product design §6 |
| Partial (incomplete results) | UI-104, UI-301 | Result shell, all tabs | Product design §14 |
| Interrupted (recoverable) | UI-104, UI-207 | Processing, project list | Product design §13 |
| Ready (normal) | UI-301-UI-307 | Result pages | Product design §12.3 |
| Review — pending | UI-307, UI-403 | Finding list, evidence detail | Product design §12.3 |
| Review — confirmed | UI-307, UI-403 | Finding list, evidence detail | Product design §12.3 |
| Review — ignored | UI-307, UI-403 | Finding list, evidence detail | Product design §12.3 |
| Review — important | UI-307, UI-403 | Finding list, evidence detail | Product design §12.3 |
| Dark theme | UI-101, UI-106 | All pages | §3 (Color Tokens) |
| Forced colors | UI-106, UI-501 | All pages | §5 (Accessibility) |
| Reduced motion | UI-106, UI-501 | All pages | §5 (Accessibility) |

## Viewports → Tasks

| Viewport | Task | Behavior | UI-SPEC Section |
|----------|------|----------|----------------|
| 1920x1080 | UI-500 | Full layout, all panels visible | §5 (Responsive) |
| 1440x900 | UI-500 | Full layout | §5 (Responsive) |
| 1280x800 | UI-500 | Detail panel may collapse, dimension filters hide | §5 (Responsive @1120px) |
| 1024x700 | UI-500 | Reduced padding, optional labels hide | §5 (Responsive @1024px) |
| 760px equivalent | UI-500 | Single-column file grid, Sheet for filters | §5 (Responsive @760px) |

## Color Tokens → Tasks

| Token Category | Task | UI-SPEC Section |
|---------------|------|----------------|
| shadcn standard (background, foreground, primary, etc.) | UI-100, UI-101 | §3 (Color Tokens) |
| Diff semantic (added, deleted, modified, uncertain) | UI-101 | §3 (Color Tokens) |
| Risk level (high, medium, low) | UI-101 | New (migration design) |
| Detector category (text, table, entity) | UI-101 | New (migration design) |
| Status (danger, warning, success) | UI-101 | §3 (Color Tokens) |

## Components → Tasks

| Component | Task | Replaces / Creates |
|-----------|------|--------------------|
| Button | UI-102 | Hand-rolled button.tsx |
| Badge | UI-102 | Hand-rolled badge.tsx + risk variants |
| Dialog | UI-102 | Hand-rolled dialog.tsx |
| DropdownMenu | UI-102 | Hand-rolled dropdown-menu.tsx |
| Input + Label | UI-102 | Hand-rolled input.tsx |
| Tabs | UI-102 | Hand-rolled tabs.tsx |
| Tooltip | UI-102 | Hand-rolled tooltip.tsx |
| Progress | UI-102 | Hand-rolled progress.tsx |
| ScrollArea | UI-102 | Hand-rolled scroll-area.tsx |
| Separator | UI-102 | Hand-rolled separator.tsx |
| Skeleton | UI-102 | New |
| Sheet | UI-103 | New (mobile filter panel) |
| Select | UI-103 | New (Radix wrapper) |
| Alert | UI-103 | Replaces warning-banner.tsx |
| AlertDialog | UI-103 | Replaces confirm-dialog.tsx |
| Checkbox | UI-103 | New |
| RadioGroup | UI-103 | New |
| Popover | UI-103 | New |
| Collapsible | UI-103 | New |
| Table | UI-103 | New |
| Pagination | UI-103 | New |
| FormMessage | UI-103 | Replaces field-error.tsx |
| StatusBadge | UI-104 | New |
| PersistentBanner | UI-104 | New |
| PageState | UI-104 | New |
| LoadingButton | UI-104 | New |
| IconButton | Removed | Replaced by Button size="icon" |

## Workbench Layout → Tasks

| Element | Task | Notes |
|---------|------|-------|
| ResizablePanelGroup | UI-400 | react-resizable-panels (keep, not shadcn Resizable) |
| NavPanel (finding list) | UI-401 | Reuse UI-306 virtual list |
| Evidence Viewport | UI-402 | Dual-document evidence view |
| Detail Tabs | UI-403 | Match basis, location, review controls |
| Format/Comment/Revision tabs | UI-404 | Gated to version-diff mode only |

## Cross-Cutting Concerns → Tasks

| Concern | Task | Notes |
|---------|------|-------|
| Keyboard navigation | UI-501 | All interactive elements |
| ARIA attributes | UI-501 | Matrix, finding list, tabs |
| Focus management | UI-106, UI-501 | Dialog, overlay focus trap |
| Live regions | UI-501 | Progress updates, error announcements |
| Forced colors | UI-501 | Diff markers get border fallback |
| Reduced motion | UI-501 | Scroll, animation, transition |
| 1000+ item performance | UI-502 | Virtual list, memoized selectors |
| Responsive layout | UI-500 | All viewports |
| Playwright visual regression | UI-503 | Light/dark + all viewports |
| E2E — risk review | UI-504 | Full primary mode flow |
| E2E — version diff | UI-505 | Full secondary mode flow |
| Documentation sync | UI-506 | UI-SPEC, AGENT.md, architecture |

## Verification

- [ ] Every UI-SPEC page has at least one task.
- [ ] Every UI-SPEC state has at least one task.
- [ ] Every viewport has a task.
- [ ] Every component maps to exactly one task (creation or migration).
- [ ] No task is orphaned (every task appears in at least one mapping).
