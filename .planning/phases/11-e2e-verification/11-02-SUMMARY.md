---
phase: 11-e2e-verification
plan: 02
subsystem: testing
tags: [integration-test, mixed-format, risk-detection, rust-engine, docx, pdf, mineru]

requires:
  - phase: 11-e2e-verification
    provides: "MinerU PDF pipeline E2E test (11-01) for engine communication pattern"
provides:
  - "Mixed-format (DOCX + PDF) risk detection integration test"
  - "Cross-format file-pair assessment validation"
  - "Async engine protocol handling (status:started → result)"
affects: [12-bugfix, risk-detection]

tech-stack:
  added: []
  patterns: ["inline toEngineDocumentAst to avoid Electron import chain in tests", "async RPC protocol with ack skip"]

key-files:
  created:
    - tests/integration/mixed-format-risk.test.ts
  modified: []

key-decisions:
  - "Inlined toEngineDocumentAst in test file to avoid Electron ipcMain import chain"
  - "RPC helper skips {status:started} ack to wait for actual async result"

patterns-established:
  - "Engine test pattern: spawn binary, JSON-RPC over stdin/stdout, skip async ack"

requirements-completed: [E2E-03]

duration: 8min
completed: 2026-07-23
---

# Phase 11 Plan 02: Mixed Format Risk Detection Summary

**Cross-format (DOCX + PDF) risk detection verified: Rust engine produces valid file-pair assessments with symmetricSimilarity in [0,1] and correct submission ID references**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T07:37:33Z
- **Completed:** 2026-07-23T07:45:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Mixed-format integration test verifies DOCX + PDF submissions produce cross-format file-pair assessments
- Engine async protocol (status:started ack → actual result) handled correctly
- All 137 integration tests pass (9 test files)

## Task Commits

1. **Task 1: Mixed format integration test** - `6809bbc` (test)
2. **Task 2: Run verification and record findings** - no additional commit (verification only)

**Plan metadata:** pending (docs commit)

## Files Created/Modified
- `tests/integration/mixed-format-risk.test.ts` - 4 tests: DOCX/PDF AST construction, engine conversion, cross-format risk assessment, project risk computation

## Decisions Made
- Inlined `toEngineDocumentAst` function in test to avoid Electron `ipcMain` import chain (engine-manager.ts imports logger.ts which uses `ipcMain.handle`)
- RPC helper skips `{status: "started"}` ack response — Rust engine returns this immediately for async methods, then sends the actual result with the same request ID later

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Avoided Electron import chain in test**
- **Found during:** Task 1
- **Issue:** Importing `toEngineDocumentAst` from `engine-manager.ts` pulled in `logger.ts` which calls `ipcMain.handle()` — Electron-only API unavailable in vitest
- **Fix:** Inlined the pure `toEngineDocumentAst` conversion function directly in the test file
- **Files modified:** tests/integration/mixed-format-risk.test.ts
- **Verification:** Test imports resolve, all 4 tests pass
- **Committed in:** 6809bbc

**2. [Rule 1 - Bug] Fixed async engine RPC protocol handling**
- **Found during:** Task 1
- **Issue:** Engine returns `{status: "started"}` immediately for `risk.analyzeWithAst`, then sends the actual result later with the same request ID. Original RPC helper resolved on the first response.
- **Fix:** Added `ackReceived` flag to skip the initial ack and wait for the real result
- **Files modified:** tests/integration/mixed-format-risk.test.ts
- **Verification:** Engine tests pass (1.2s for risk analysis)
- **Committed in:** 6809bbc

---

**Total deviations:** 2 auto-fixed (1 blocking import chain, 1 async protocol bug)
**Impact on plan:** Both fixes necessary for test to function. No scope creep.

## Issues Encountered
None — all tests pass.

## Pipeline Issues for Phase 12
None discovered. Cross-format risk detection works correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Mixed-format risk detection verified end-to-end
- Engine async protocol pattern documented for future integration tests
- All integration tests green (137/137)

---
*Phase: 11-e2e-verification*
*Completed: 2026-07-23*

## Self-Check: PASSED

- [x] tests/integration/mixed-format-risk.test.ts exists
- [x] 11-02-SUMMARY.md exists
- [x] Commit 6809bbc exists in git log
