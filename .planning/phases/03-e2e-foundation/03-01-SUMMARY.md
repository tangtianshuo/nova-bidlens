---
phase: 03-e2e-foundation
plan: 01
subsystem: testing
tags: [playwright, e2e, electron, test-isolation]

requires:
  - phase: 02-integration-hardening
    provides: "Working IPC handlers and renderer identity unification"
provides:
  - "E2E harness with isolated DB via BIDLENS_TEST_DATA_DIR env var"
  - "Smoke tests verifying app launch, IPC exposure, DB isolation, and project list"
affects: [03-02, 04-quality-gates]

tech-stack:
  added: []
  patterns: ["env-var-based test isolation for Electron apps"]

key-files:
  created: []
  modified:
    - apps/desktop/src/main/index.ts
    - apps/desktop/package.json
    - apps/desktop/tests/e2e/setup.ts
    - apps/desktop/tests/e2e/smoke.test.ts

key-decisions:
  - "Rely on test:e2e npm script for build step instead of playwright webServer config (Electron has no web server)"

patterns-established:
  - "BIDLENS_TEST_DATA_DIR env var overrides userData for test isolation"

requirements-completed: [QA-01]

duration: 1min
completed: 2026-07-22
---

# Phase 03 Plan 01: E2E Harness Hardening Summary

**BIDLENS_TEST_DATA_DIR env var wired to PersistenceManager for test isolation; smoke tests verify DB isolation, IPC round-trip, and empty project list on fresh DB**

## Performance

- **Duration:** 1 min
- **Started:** 2026-07-22T09:09:34Z
- **Completed:** 2026-07-22T09:10:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Main process respects BIDLENS_TEST_DATA_DIR env var, passing it to PersistenceManager for isolated DB in E2E tests
- test:e2e script now compiles TS before running Playwright
- Smoke tests verify DB file is created in isolated temp directory, not real userData
- Smoke tests verify fresh DB returns empty project list
- Create project test strengthened to verify error is file validation, not missing IPC handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire BIDLENS_TEST_DATA_DIR and E2E build script** - `a9a937c` (feat)
2. **Task 2: Harden smoke tests with DB isolation verification** - `c61c62e` (test)

**Plan metadata:** (docs: complete plan)

## Files Created/Modified
- `apps/desktop/src/main/index.ts` - Reads BIDLENS_TEST_DATA_DIR and passes to PersistenceManager
- `apps/desktop/package.json` - test:e2e script now includes tsc build step
- `apps/desktop/tests/e2e/setup.ts` - Added getDbPath and verifyDbExists helpers
- `apps/desktop/tests/e2e/smoke.test.ts` - Added DB isolation and empty list tests, strengthened create project test

## Decisions Made
- Rely on test:e2e npm script for build step instead of playwright webServer config (Electron is not a web server, no auto-start mechanism needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- E2E harness is ready for full pipeline tests with real DOCX fixtures (03-02)
- Smoke tests prove app launches, IPC works, and DB is isolated

---
*Phase: 03-e2e-foundation*
*Completed: 2026-07-22*
