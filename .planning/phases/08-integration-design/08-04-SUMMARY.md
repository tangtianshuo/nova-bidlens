---
phase: 08-integration-design
plan: 04
subsystem: parser
tags: [pdf, mineru, fallback, type-detection]

requires:
  - phase: 08-integration-design
    provides: "MinerU parser with DocumentParser interface (08-03)"
provides:
  - "PDF type detector (digital vs scanned) based on text density"
  - "Parser-service fallback: scanned→MinerU, digital→pdf-parse→MinerU"
affects: [parser, desktop-main]

tech-stack:
  added: []
  patterns: ["PDF pre-detect routing", "Lazy-init singleton for API-token-dependent services"]

key-files:
  created:
    - packages/shared/src/parser/mineru/pdf-type-detector.ts
    - packages/shared/src/parser/mineru/pdf-type-detector.test.ts
  modified:
    - apps/desktop/src/main/services/parser-service.ts
    - packages/shared/src/parser/index.ts

key-decisions:
  - "Export detectPdfType from @bidlens/shared main entry (not deep path import)"
  - "PDF fallback logic runs before timeout/cancellation race for PDF files"

patterns-established:
  - "PDF type detection: read first 3 pages, threshold 50 chars/page"

requirements-completed: ["INTEG-04"]

duration: 3min
completed: 2026-07-23
---

# Phase 08 Plan 04: PDF Type Detection and MinerU Fallback Summary

**PDF pre-detect routing: scanned PDFs go directly to MinerU, digital PDFs use pdf-parse with MinerU fallback on failure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-23T04:49:24Z
- **Completed:** 2026-07-23T04:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PDF type detector module with threshold-based classification (50 chars/page)
- Parser-service fallback strategy: scanned→MinerU, digital→pdf-parse→MinerU
- Lazy MinerU parser initialization via MINERU_API_TOKEN env var

## Task Commits

1. **Task 1: PDF type detector module** - `5ec059e` (test)
2. **Task 2: Parser-service fallback logic** - `431e3e3` (feat)

## Files Created/Modified
- `packages/shared/src/parser/mineru/pdf-type-detector.ts` - detectPdfType function, reads first 3 pages
- `packages/shared/src/parser/mineru/pdf-type-detector.test.ts` - 4 unit tests (digital, scanned, corrupted, empty)
- `apps/desktop/src/main/services/parser-service.ts` - PDF fallback branch with MinerU lazy-init
- `packages/shared/src/parser/index.ts` - Export detectPdfType and PdfType

## Decisions Made
- Export detectPdfType from main @bidlens/shared entry instead of deep path import (tsconfig main.json doesn't resolve deep paths)
- PDF fallback logic runs inline before timeout/cancellation race — the race only applies to non-PDF files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed import path for desktop main process**
- **Found during:** Task 2
- **Issue:** Desktop tsconfig.main.json couldn't resolve `@bidlens/shared/dist/parser/mineru/pdf-type-detector.js` deep path
- **Fix:** Export detectPdfType from parser/index.ts, import via `@bidlens/shared` main entry
- **Files modified:** packages/shared/src/parser/index.ts, apps/desktop/src/main/services/parser-service.ts
- **Verification:** `tsc -p tsconfig.main.json` passes clean
- **Committed in:** 431e3e3

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Import path fix required for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
Set `MINERU_API_TOKEN` environment variable for MinerU fallback to work. Without it, only pdf-parse will be used for digital PDFs.

## Known Stubs
None — all code is functional.

## Next Phase Readiness
- PDF type detection and fallback strategy complete
- Ready for E2E testing with real scanned/digital PDFs
- MinerU parser requires API token to be operational

---
*Phase: 08-integration-design*
*Completed: 2026-07-23*
