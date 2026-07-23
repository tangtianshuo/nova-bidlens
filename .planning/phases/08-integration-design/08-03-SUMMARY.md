---
phase: 08-integration-design
plan: 03
subsystem: parser
tags: [mineru, pdf, ocr, cloud-api, document-ast]

requires:
  - phase: 07-mineru-feasibility
    provides: MinerU API validation, content_list.json schema, mapper function
  - phase: 08-integration-design
    provides: DocumentParser interface, parser registry pattern

provides:
  - MinerUParser class implementing DocumentParser interface
  - Scanned PDF detection heuristic via pdf-parse text density
  - Batch upload + poll + ZIP extraction pipeline for MinerU API
  - Export from parser module (consumer instantiates with API token)

affects: [risk-analysis, parser-registry, ipc-handlers]

tech-stack:
  added: []
  patterns: [cloud-api-parser, batch-upload-poll, scanned-pdf-detection]

key-files:
  created:
    - packages/shared/src/parser/mineru/index.ts
  modified:
    - packages/shared/src/parser/index.ts

key-decisions:
  - "MinerU parser uses batch upload API (file-urls/batch) for local files, not URL mode"
  - "Not auto-registered in globalRegistry — requires API token at instantiation"
  - "Scanned PDF detection: avg <50 chars/page in first 3 pages via pdf-parse"

patterns-established:
  - "Cloud API parser pattern: upload → poll → download → extract → map to AST"

requirements-completed: [INTEG-01, INTEG-03]

duration: 2min
completed: 2026-07-23
---

# Phase 08 Plan 03: MinerU Parser Summary

**MinerU parser implementing DocumentParser with batch upload API, scanned PDF detection, and ZIP content_list.json extraction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-23T04:45:53Z
- **Completed:** 2026-07-23T04:47:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- MinerUParser class with full DocumentParser interface compliance (id='mineru-parser', priority=2)
- Scanned PDF detection using pdf-parse text density heuristic (avg <50 chars/page)
- Complete API flow: batch upload → signed URL PUT → poll → ZIP download → content_list.json extraction → mapContentListToAst
- Exported from parser module for consumer-side registration with API token

## Task Commits

1. **Task 1: Implement MinerU parser** - `0c45f5a` (feat)
2. **Task 2: Export MinerUParser from parser module** - `0c45f5a` (feat, same commit)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/shared/src/parser/mineru/index.ts` - MinerU parser: batch upload API, poll, ZIP extraction, content_list.json mapping
- `packages/shared/src/parser/index.ts` - Added MinerUParser export (not auto-registered)

## Decisions Made
- Used batch upload API (file-urls/batch) instead of URL mode — matches local file use case from Phase 7 research
- Not auto-registered because MinerU requires an API token; consumer instantiates with `new MinerUParser(token)` and registers manually
- Scanned PDF detection: reads first 3 pages via pdf-parse, checks avg chars/page < 50

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pdf-parse import (named export, not default)**
- **Found during:** Task 1
- **Issue:** Plan skeleton used `import pdfParse from 'pdf-parse'` but pdf-parse exports `PDFParse` as named export
- **Fix:** Changed to `import { PDFParse } from 'pdf-parse'` with class instantiation pattern
- **Files modified:** packages/shared/src/parser/mineru/index.ts
- **Verification:** Build passes
- **Committed in:** 0c45f5a

**2. [Rule 1 - Bug] Fixed Buffer type for fetch body**
- **Found during:** Task 1
- **Issue:** Node.js TypeScript types don't accept `Buffer` directly as fetch body
- **Fix:** Wrapped in `new Uint8Array(fileBuffer)` for type compatibility
- **Files modified:** packages/shared/src/parser/mineru/index.ts
- **Verification:** Build passes
- **Committed in:** 0c45f5a

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes required for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - API token is passed at instantiation time by the consumer.

## Known Stubs
None - parser is fully wired to MinerU API and mapper.

## Next Phase Readiness
- MinerU parser ready for integration into IPC handlers and risk analysis pipeline
- Consumer code needs to instantiate with API token and register in globalRegistry
- Phase 08 plan 04 can wire this into the risk analysis flow

---
*Phase: 08-integration-design*
*Completed: 2026-07-23*
