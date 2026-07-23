---
phase: 13-ux-polish
plan: 02
subsystem: parser
tags: [mineru, progress, ux, ipc]

requires:
  - phase: 13-ux-polish
    plan: 01
    provides: MinerU error handling, offline detection, concurrency control
provides:
  - Real-time progress feedback during MinerU cloud parsing via risk:progress IPC
  - UI shows "MinerU 解析中 (已等待 Xs)" during cloud parsing
affects: [parser-service, risk-review-service]

tech-stack:
  added: []
  patterns: [periodic progress callback, setInterval timer cleanup]

key-files:
  created: []
  modified:
    - apps/desktop/src/main/services/parser-service.ts
    - apps/desktop/src/main/services/risk-review-service.ts

key-decisions:
  - "onProgress callback added to ParserServiceOptions — minimal interface change"
  - "Timer in parseWithMinerU fires every 1 second, cleaned up in finally block"
  - "Callback captures fileIndex in closure for correct current/total display"

patterns-established:
  - "onProgress callback pattern for long-running parser operations"

requirements-completed: [UX-01]

duration: 2min
completed: 2026-07-23
---

# Phase 13 Plan 02: UX Polish Summary

**Real-time progress feedback during MinerU cloud parsing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-23T08:31:44Z
- **Completed:** 2026-07-23T08:33:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- MinerU parsing now emits periodic progress updates (every 1 second) via risk:progress IPC
- UI shows "MinerU 解析中 (已等待 Xs)" during cloud parsing instead of static "正在解析投标文件..."
- Progress timer is properly cleaned up when parsing completes or is cancelled (try/finally)
- onProgress callback pattern established for future long-running parser operations

## Task Commits

1. **Task 1: Add onProgress callback to ParserServiceOptions** - `1d72681` (feat)
2. **Task 2: Wire onProgress callback from risk-review-service** - `21a3c2c` (feat)

## Files Created/Modified

- `apps/desktop/src/main/services/parser-service.ts` - Added onProgress to ParserServiceOptions, started/cleared interval timer in parseWithMinerU
- `apps/desktop/src/main/services/risk-review-service.ts` - Passed onProgress callback to parseDocumentFile in both parsing and resume paths

## Decisions Made

- onProgress callback added to ParserServiceOptions (minimal interface change, not ParseOptions in shared)
- Timer fires every 1 second — frequent enough for UX, not so frequent as to spam IPC
- Timer cleanup in finally block prevents leaks on success, error, or abort

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all progress feedback is functional and wired to actual parsing paths.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- All Phase 13 requirements (UX-01 through UX-05) are now complete
- Phase 13 is complete

---
*Phase: 13-ux-polish*
*Completed: 2026-07-23*
