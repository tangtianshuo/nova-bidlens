---
phase: 13-ux-polish
plan: 01
subsystem: parser
tags: [mineru, error-handling, ux, concurrency]

requires:
  - phase: 12-bug-fixes
    provides: MinerU parser integration and metadata fixes
provides:
  - MinerU 401 auto-cache-reset with AUTH_EXPIRED error code
  - Offline detection for cloud-dependent PDF parsing
  - Friendly Chinese error messages for all MinerU API errors
  - Concurrency limiter (max 2) for MinerU cloud requests
affects: [parser-service, mineru-parser]

tech-stack:
  added: []
  patterns: [error-code propagation, DNS offline check, promise-based semaphore]

key-files:
  created: []
  modified:
    - packages/shared/src/parser/mineru/index.ts
    - apps/desktop/src/main/services/parser-service.ts

key-decisions:
  - "Error codes thrown via Object.assign on Error, preserved through catch chain"
  - "Offline detection uses node:dns/promises lookup('mineru.net') - lightweight, no external deps"
  - "Concurrency limiter uses simple counter + queue, not a library"
  - "Max concurrent set to 2 - balances throughput vs API politeness"

patterns-established:
  - "parseWithMinerU helper: single call site for offline check + concurrency + 401 reset"
  - "Error code map in catch block for friendly Chinese messages"

requirements-completed: [UX-02, UX-03, UX-04, UX-05]

duration: 5min
completed: 2026-07-23
---

# Phase 13 Plan 01: UX Polish Summary

**MinerU 401 auto-reset, offline detection, friendly error messages, concurrency control**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-23T08:27:09Z
- **Completed:** 2026-07-23T08:32:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- MinerU 401 errors now produce AUTH_EXPIRED code and auto-clear the cached parser instance
- Offline state detected via DNS lookup before cloud parse attempts
- All MinerU errors (401, timeout, rate limit, offline) mapped to user-friendly Chinese messages
- MinerU API requests queued with max 2 concurrent, preventing API overload

## Task Commits

1. **Task 1: MinerU 401 detection and friendly error codes** - `bfa9a80` (feat)
2. **Task 2: Offline detection, 401 cache reset, concurrency limiter** - `87b3f90` (feat)

## Files Created/Modified

- `packages/shared/src/parser/mineru/index.ts` - AUTH_EXPIRED/MINERU_TIMEOUT/MINERU_OFFLINE error codes, friendly Chinese messages, 401 detection in uploadFile and pollBatch
- `apps/desktop/src/main/services/parser-service.ts` - parseWithMinerU helper, isOnline DNS check, acquireMinerUSlot/releaseMinerUSlot concurrency limiter, resetMinerUParser on 401

## Decisions Made

- Error codes propagated via `Object.assign(err, { code })` to preserve through catch chain
- Offline detection via `node:dns/promises lookup('mineru.net')` - no external deps, fast
- Concurrency limiter is a simple counter + callback queue (ponytail: global limit, per-account limits if throughput matters)
- Max concurrent = 2 balances throughput vs API rate limits

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all error codes are functional and wired to actual error paths.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- UX-02/03/04/05 complete
- Remaining: UX-01 (real-time progress display with elapsed seconds) if not already covered by existing emitProgress

---
*Phase: 13-ux-polish*
*Completed: 2026-07-23*
