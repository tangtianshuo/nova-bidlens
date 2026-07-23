---
phase: 12-bug-fixes
plan: 01
subsystem: services
tags: [metadata, parser, validator, mineru]

requires:
  - phase: 07-mineru-feasibility
    provides: MinerU parser integration and token management
provides:
  - Dynamic parserVersion from parsed ASTs
  - Dynamic fileFormat from actual file extension
  - MinerU-aware file validation for PDFs
affects: [risk-review, file-validation, document-caching]

tech-stack:
  added: []
  patterns: [post-parse metadata update, capability-aware validation]

key-files:
  created: []
  modified:
    - apps/desktop/src/main/db/repositories.ts
    - apps/desktop/src/main/services/risk-review-service.ts
    - apps/desktop/src/main/services/file-validator.ts
    - apps/desktop/src/main/services/file-validator.test.ts

key-decisions:
  - "parserVersion initialized to empty string, updated from first parsed AST after parsing loop"
  - "MinerU availability checked via exported isMinerUAvailable() from parser-service"

patterns-established:
  - "Post-parse metadata update: project parserVersion set after parsing, not at creation"

requirements-completed: [FIX-01, FIX-02, FIX-03]

duration: 3min
completed: 2026-07-23
---

# Phase 12 Plan 01: Bug Fixes Summary

**Dynamic parserVersion/fileFormat from parsed ASTs, MinerU-aware PDF capability detection in file-validator**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-23T08:16:31Z
- **Completed:** 2026-07-23T08:19:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- parserVersion now reflects actual parser used (mineru-api-v4 or docx4js version) instead of hardcoded '0.2.2'
- fileFormat in AST cache uses path.extname() from actual filename instead of hardcoded 'docx'
- file-validator returns 'mineru-parser' parserId for PDFs when MinerU token is configured
- MinerU parser reports table capability as 'supported' (was 'degraded' for pdf-parser)

## Task Commits

1. **Task 1+2: Fix parserVersion, fileFormat, and MinerU capability detection** - `779965b` (fix)

## Files Created/Modified
- `apps/desktop/src/main/db/repositories.ts` - Added updateParserVersion method to ProjectRepository
- `apps/desktop/src/main/services/risk-review-service.ts` - Dynamic parserVersion update after parsing, dynamic fileFormat in cacheDocumentAst, MinerU-aware validation call
- `apps/desktop/src/main/services/file-validator.ts` - Added mineruAvailable option, mineru-parser capability detection
- `apps/desktop/src/main/services/file-validator.test.ts` - Added tests for MinerU-available and non-MinerU PDF validation

## Decisions Made
- parserVersion initialized to empty string at project creation (replaced hardcoded '0.2.2'), updated from first parsed AST after parsing loop completes
- MinerU availability checked via exported isMinerUAvailable() function from parser-service (already existed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bug fixes complete, metadata now reflects actual parser state
- file-validator correctly reports MinerU capabilities for PDF processing

---
*Phase: 12-bug-fixes*
*Completed: 2026-07-23*
