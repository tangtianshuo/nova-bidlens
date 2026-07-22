---
phase: 02-integration-hardening
plan: 02
subsystem: engine
tags: [rust, checkpoint-resume, ipc-cleanup, serde]

requires:
  - phase: 02-integration-hardening
    provides: "Rust engine analysis pipeline, detector_runs persistence"
provides:
  - "Checkpoint resume via skipDetectors in Rust engine and TS service"
  - "Clean preload without dead detectorProgress wiring"
affects: [risk-review-service, engine-manager, risk_engine]

tech-stack:
  added: []
  patterns: ["serde(default) for backward-compatible optional fields"]

key-files:
  created: []
  modified:
    - bidlens-engine/src/risk_engine.rs
    - apps/desktop/src/main/services/engine-manager.ts
    - apps/desktop/src/main/services/risk-review-service.ts
    - apps/desktop/src/preload/index.ts
    - packages/shared/src/ipc.ts
    - packages/shared/src/types-only.ts

key-decisions:
  - "Used serde(default) on skip_detectors for backward compat with old requests"

patterns-established:
  - "Detector skip pattern: check skip list, push Skipped status, return empty vec"

requirements-completed: [HARDEN-02, HARDEN-03]

duration: 6min
completed: 2026-07-22
---

# Phase 02 Plan 02: Checkpoint Resume and Dead Code Cleanup Summary

**Checkpoint resume skipping completed detectors via Rust skipDetectors + dead detectorProgress wiring removed**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-22T08:47:48Z
- **Completed:** 2026-07-22T08:53:60Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Rust engine accepts skipDetectors list and skips already-completed detectors with Skipped status
- TS risk-review-service queries detector_runs for completed detectors before engine call
- Dead risk:detectorProgress IPC channel removed from preload, shared types, and BidLensApi

## Task Commits

Each task was committed atomically:

1. **Task 1: Add skipDetectors to Rust engine and TS IPC layer** - `e5a361a` (feat)
2. **Task 2: Remove dead risk:detectorProgress wiring** - `cbe412f` (refactor)

## Files Created/Modified
- `bidlens-engine/src/risk_engine.rs` - Added skip_detectors field to RiskAnalysisInput, skip guards on all 4 detectors
- `apps/desktop/src/main/services/engine-manager.ts` - Added skipDetectors to RiskAnalyzeRequest interface
- `apps/desktop/src/main/services/risk-review-service.ts` - Query completed detectors before engine call, pass as skipDetectors
- `apps/desktop/src/preload/index.ts` - Removed onDetectorProgress dead wiring
- `packages/shared/src/ipc.ts` - Removed DetectorProgress interface and onDetectorProgress from BidLensApi
- `packages/shared/src/types-only.ts` - Removed DetectorProgress re-export

## Decisions Made
- Used serde(default) on skip_detectors field for backward compatibility with old requests that omit the field
- Cleaned unused DetectorType import from ipc.ts after removing DetectorProgress

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleaned unused DetectorType import from ipc.ts**
- **Found during:** Task 2
- **Issue:** Removing DetectorProgress left DetectorType unused in the import
- **Fix:** Removed DetectorType from the import statement
- **Files modified:** packages/shared/src/ipc.ts
- **Verification:** Shared package builds clean
- **Committed in:** cbe412f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Checkpoint resume is wired end-to-end: DB query -> skipDetectors -> Rust skip guards
- Dead preload code removed, cleaner IPC surface

---
*Phase: 02-integration-hardening*
*Completed: 2026-07-22*

## Self-Check: PASSED

All files found. All commits verified:
- `e5a361a` feat(02-02): add skipDetectors for checkpoint resume
- `cbe412f` refactor(02-02): remove dead risk:detectorProgress wiring
- `64beb91` docs(02-02): complete plan metadata
