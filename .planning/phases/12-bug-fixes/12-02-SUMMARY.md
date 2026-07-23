---
phase: 12-bug-fixes
plan: 02
subsystem: parser
tags: [AbortSignal, fetch, timeout, MinerU, cancellation]

requires:
  - phase: 07-mineru-feasibility
    provides: MinerU parser implementation
provides:
  - AbortSignal propagation through MinerU parser pipeline
  - Hard timeout safety net on pollBatch (5 min max)
affects: [parser-service, MinerU parsing]

tech-stack:
  added: []
  patterns: [AbortSignal propagation through async call chain]

key-files:
  created: []
  modified:
    - packages/shared/src/parser/types.ts
    - packages/shared/src/parser/mineru/index.ts
    - apps/desktop/src/main/services/parser-service.ts

key-decisions:
  - "MINERU_HARD_TIMEOUT_MS set to 300s (5 min) as safety ceiling"

patterns-established:
  - "Signal propagation: parser-service → ParseOptions → all fetch calls"

requirements-completed: [FIX-04, FIX-05]

duration: 5min
completed: 2026-07-23
---

# Phase 12 Plan 02: AbortSignal and Hard Timeout Summary

**AbortSignal propagated from parser-service through MinerU parser to all fetch calls, with 5-minute hard timeout on pollBatch**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-23T08:17:54Z
- **Completed:** 2026-07-23T08:18:30Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- AbortSignal now reaches all fetch() calls in MinerU parser (upload, poll, download)
- pollBatch enforces 5-minute hard timeout regardless of options.timeout value
- Cancellation terminates MinerU parse within one poll interval (3 seconds)

## Task Commits

1. **Task 1: Propagate AbortSignal and add hard timeout** - `38fb1e2` (fix)

## Files Created/Modified
- `packages/shared/src/parser/types.ts` - Added `signal?: AbortSignal` to `ParseOptions`
- `packages/shared/src/parser/mineru/index.ts` - Signal propagation to uploadFile/pollBatch/downloadAndParseZip, MINERU_HARD_TIMEOUT_MS constant, throwIfAborted in poll loop
- `apps/desktop/src/main/services/parser-service.ts` - Forward `opts.signal` into ParseOptions

## Decisions Made
- MINERU_HARD_TIMEOUT_MS = 300_000ms (5 minutes): conservative ceiling for a cloud API call that typically takes 1-3 minutes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MinerU parsing is now cancelable and has a safety timeout
- Pre-existing test failure in parser-service.test.ts (ipcMain not mocked) is unrelated

---
*Phase: 12-bug-fixes*
*Completed: 2026-07-23*
