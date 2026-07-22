---
phase: 01-cleanup-bug-fixes
plan: 02
subsystem: engine
tags: [rust-engine, fallback-removal, risk-review, evidence-traceability]

requires:
  - phase: none
    provides: baseline risk-review-service with fallback path
provides:
  - "Engine as hard dependency — no fallback producing fake evidence"
  - "Clear error messages when engine unavailable"
affects: [02-risk-engine, 03-persistence]

tech-stack:
  added: []
  patterns: [throw-on-missing-dependency instead of fallback]

key-files:
  created: []
  modified:
    - apps/desktop/src/main/services/risk-review-service.ts

key-decisions:
  - "Keep if-check with else-throw instead of removing if-wrapper — handles runtime null edge case"
  - "Removed unused BlockNode import after deleting blockText helper"

patterns-established:
  - "Engine dependency pattern: required constructor param + runtime guard with throw"

requirements-completed: [CLEAN-04]

duration: 8min
completed: 2026-07-22
---

# Phase 1 Plan 2: Remove Engine Fallback Summary

**Removed buildFindings fallback that produced untraceable evidence with synthetic node-N IDs; Rust engine is now a hard dependency**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-22T08:00:00Z
- **Completed:** 2026-07-22T08:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Deleted buildFindings, normalize, blockText helper functions that generated fake evidence
- Made engineManager a required (non-optional) constructor parameter
- Added clear error throws for all three fallback paths (engine unavailable, no file pair results, no project risk)
- Changed modelVersion from 'lexical-fallback' to 'rust-engine'

## Task Commits

1. **Task 1: Remove engine fallback path** - `8316339` (fix)

## Files Created/Modified
- `apps/desktop/src/main/services/risk-review-service.ts` - Removed fallback paths, made engine required

## Decisions Made
- Kept `if (this.engineManager)` check with `else throw` rather than removing the wrapper — handles edge case where engineManager becomes null at runtime
- Removed unused `BlockNode` import after deleting `blockText` helper

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in renderer files (table-viewport, diff-viewport, project-processing-page, new-compare-view) — unrelated to this change. TypeScript compilation for main process passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Engine is now a hard dependency; future detector work can assume engine availability
- `buildAssessment` method retained for `reconstructDetail` fallback when DB has no assessment row (different from analysis-time fallback)

---
*Phase: 01-cleanup-bug-fixes*
*Completed: 2026-07-22*
