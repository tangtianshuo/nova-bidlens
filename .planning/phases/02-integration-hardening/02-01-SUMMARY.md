---
phase: 02-integration-hardening
plan: 01
subsystem: ui
tags: [zustand, react-hooks, state-management, electron]

requires:
  - phase: 01-cleanup-bug-fixes
    provides: cleaned-up store interfaces
provides:
  - unified project identity via useRiskReviewStore.projectId
  - correct React hook ordering in RiskResultPage
  - App.tsx cleaned of taskId usage for risk flow
affects: [risk-review, projects, app-shell]

tech-stack:
  added: []
  patterns: [single-source-of-truth for project identity, hook-before-early-return]

key-files:
  created: []
  modified:
    - apps/desktop/src/renderer/features/projects/project-processing-page.tsx
    - apps/desktop/src/renderer/features/projects/project-processing-page.test.tsx
    - apps/desktop/src/renderer/app/App.tsx
    - apps/desktop/src/renderer/features/risk-review/risk-result-page.tsx

key-decisions:
  - "useRiskReviewStore.projectId is the single source of truth for project identity (D-01)"
  - "App.tsx uses setView directly instead of startTask to avoid setting taskId in useAppStore"

patterns-established:
  - "Project identity lives in useRiskReviewStore, not useProjectStore or useAppStore"
  - "All React hooks must be called before any conditional returns"

requirements-completed: [HARDEN-01, HARDEN-04]

duration: 5min
completed: 2026-07-22
---

# Phase 2 Plan 1: Unify Project Identity & Fix Hook Ordering Summary

**Eliminated triple-store identity split by routing project identity through useRiskReviewStore.projectId, and fixed React hook ordering violation in RiskResultPage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-22T08:47:49Z
- **Completed:** 2026-07-22T08:52:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ProjectProcessingPage now reads projectId from useRiskReviewStore (single source of truth)
- RiskResultPage calls useFindingCounts before conditional returns (React rules of hooks)
- App.tsx startRiskProject uses setView instead of startTask, avoiding taskId pollution
- Test file updated to use useRiskReviewStore.setState

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate project identity** - `ab04421` (feat)
2. **Task 2: Fix hook ordering in RiskResultPage** - `8281631` (fix)

## Files Created/Modified
- `apps/desktop/src/renderer/features/projects/project-processing-page.tsx` - Switched from useProjectStore to useRiskReviewStore for projectId
- `apps/desktop/src/renderer/features/projects/project-processing-page.test.tsx` - Updated test to use useRiskReviewStore.setState
- `apps/desktop/src/renderer/app/App.tsx` - Replaced startTask(projectId) with setView('project-processing')
- `apps/desktop/src/renderer/features/risk-review/risk-result-page.tsx` - Moved useFindingCounts before early returns with EMPTY_FINDINGS fallback

## Decisions Made
- useRiskReviewStore.projectId is the single source of truth for project identity (per D-01)
- App.tsx uses setView directly instead of startTask to avoid setting taskId in useAppStore (per D-01)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks applied cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Project identity is now unified, ready for further integration hardening
- Pre-existing test failures (stage count mismatch, fixture data) are out of scope for this plan

---
*Phase: 02-integration-hardening*
*Completed: 2026-07-22*
