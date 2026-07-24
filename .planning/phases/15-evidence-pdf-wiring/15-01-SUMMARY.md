---
phase: 15-evidence-pdf-wiring
plan: 01
subsystem: ui
tags: [react, pdf, electron, evidence, drawer]

requires:
  - phase: 14-pdf-viewer
    provides: PdfDrawer and PdfViewer components with page tracking
provides:
  - Evidence-to-PDF navigation: clickable page badges open drawer to correct file+page
  - Multi-file switching without closing drawer
  - Auto-scroll to evidence start page after PDF load
affects: []

tech-stack:
  added: []
  patterns: [initialPage prop chain, pendingScrollRef for post-load scroll]

key-files:
  created: []
  modified:
    - apps/desktop/src/renderer/features/review/pdf-drawer.tsx
    - apps/desktop/src/renderer/features/review/pdf-viewer.tsx
    - apps/desktop/src/renderer/features/risk-review/evidence-viewport.tsx
    - apps/desktop/src/renderer/features/risk-review/risk-result-page.tsx

key-decisions:
  - "Used requestAnimationFrame for post-load scroll (waits for DOM render)"
  - "Removed standalone PDF button — replaced by per-evidence page badges"

patterns-established:
  - "initialPage prop chain: PdfDrawer → PdfViewer → pendingScrollRef → scrollIntoView"

requirements-completed: [PDF-09, PDF-10, PDF-11]

duration: 3min
completed: 2026-07-24
---

# Phase 15 Plan 01: Evidence PDF Wiring Summary

**Evidence card page badges (P1-2 format) wired to open PDF Drawer at correct file and page, with multi-file switching support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-24T01:33:47Z
- **Completed:** 2026-07-24T01:37:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PdfDrawer/PdfViewer accept initialPage prop and auto-scroll after document load
- Evidence cards show clickable page badges for both source and target submissions
- Drawer supports file switching without closing (same submission = re-scroll, different = file switch)
- Removed standalone "查看原文 PDF" button — replaced by per-evidence page navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add initialPage prop to PdfDrawer and PdfViewer** - `a350b3a` (feat)
2. **Task 2: Wire evidence page labels to open PDF Drawer** - `d515860` (feat)

## Files Created/Modified
- `apps/desktop/src/renderer/features/review/pdf-drawer.tsx` - Added initialPage prop, forwards to PdfViewer
- `apps/desktop/src/renderer/features/review/pdf-viewer.tsx` - Added initialPage prop, pendingScrollRef, post-load scroll effect
- `apps/desktop/src/renderer/features/risk-review/evidence-viewport.tsx` - Clickable page badges for source/target, onOpenPdf callback
- `apps/desktop/src/renderer/features/risk-review/risk-result-page.tsx` - handleEvidencePageClick, initialPage in drawer state, removed standalone PDF button

## Decisions Made
- Used requestAnimationFrame for post-load scroll — ensures DOM pages are rendered before querying data-pdf-page attribute
- Removed standalone "查看原文 PDF" button — per-evidence page badges provide more precise navigation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Evidence-to-PDF navigation loop complete
- Ready for PDF highlight overlay (future phase)

---
*Phase: 15-evidence-pdf-wiring*
*Completed: 2026-07-24*

## Self-Check: PASSED
All files exist. All commits verified (a350b3a, d515860).
