---
phase: 14-pdf-viewer
plan: 01
subsystem: data-layer
tags: [bbox, ipc, pdf, mineru, types]

requires:
  - phase: 13
    provides: MinerU parser integration with content_list bbox data
provides:
  - bbox/pageIdx on ParagraphNode, TableNode, SectionNode
  - BboxRegion interface and sourceBbox/targetBbox on Evidence
  - risk:getPdfFile IPC endpoint with path traversal prevention
affects: [15-pdf-viewer-core, 16-highlight-overlay, 17-evidence-navigation]

tech-stack:
  added: []
  patterns: [optional-bbox-fields-for-backward-compat, path-resolve-traversal-prevention]

key-files:
  created: []
  modified:
    - packages/shared/src/document-ast.ts
    - packages/shared/src/risk-review.ts
    - packages/shared/src/parser/mineru/mapper.ts
    - packages/shared/src/ipc.ts
    - apps/desktop/src/main/ipc/risk-review-handlers.ts
    - apps/desktop/src/main/services/risk-review-service.ts
    - apps/desktop/src/preload/index.ts

key-decisions:
  - "SectionNode also gets bbox/pageIdx fields (Rule 3 auto-fix: mapper assigns them)"
  - "pageIdx uses 1-based indexing (MinerU page_idx is 0-based, +1 applied in mapper)"

patterns-established:
  - "Optional bbox fields on AST nodes for backward compatibility with pre-bbox data"

requirements-completed: [PDF-01, PDF-02, PDF-03, PDF-04]

duration: 2min
completed: 2026-07-24
---

# Phase 14 Plan 01: Data Layer for PDF Viewer Summary

**MinerU bbox preservation through DocumentAst pipeline + risk:getPdfFile IPC with path.resolve validation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-24T01:01:55Z
- **Completed:** 2026-07-24T01:04:04Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- DocumentAst nodes (paragraph, section, table) now carry optional bbox and pageIdx from MinerU output
- Evidence interface extended with BboxRegion for future PDF highlight overlay positioning
- risk:getPdfFile IPC endpoint returns decrypted, path-resolved PDF file path or null

## Task Commits

1. **Task 1: Extend DocumentAst and Evidence types + update mapper** - `7fca09c` (feat)
2. **Task 2: Add risk:getPdfFile IPC endpoint and preload bridge** - `2e02282` (feat)

## Files Created/Modified
- `packages/shared/src/document-ast.ts` - Added bbox/pageIdx to ParagraphNode, SectionNode, TableNode
- `packages/shared/src/risk-review.ts` - Added BboxRegion interface, sourceBbox/targetBbox to Evidence
- `packages/shared/src/parser/mineru/mapper.ts` - Preserves bbox/page_idx from MinerU content_list items
- `packages/shared/src/ipc.ts` - Added getPdfFile to BidLensApi interface
- `apps/desktop/src/main/ipc/risk-review-handlers.ts` - Registered risk:getPdfFile handler
- `apps/desktop/src/main/services/risk-review-service.ts` - getPdfFile method with path.resolve validation
- `apps/desktop/src/preload/index.ts` - Preload bridge for getPdfFile

## Decisions Made
- SectionNode also receives bbox/pageIdx fields (auto-fix: mapper assigns them, interface must match)
- pageIdx uses 1-based indexing (MinerU page_idx is 0-based, +1 applied consistently in mapper)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added bbox/pageIdx to SectionNode interface**
- **Found during:** Task 1 (mapper update)
- **Issue:** Mapper assigns bbox/pageIdx to section objects but SectionNode interface lacked those fields
- **Fix:** Added optional bbox and pageIdx to SectionNode in document-ast.ts
- **Files modified:** packages/shared/src/document-ast.ts
- **Verification:** shared build passes
- **Committed in:** 7fca09c (Task 1)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor scope extension — SectionNode needed the same fields for mapper consistency. No functional change to plan goals.

## Issues Encountered
None

## Known Stubs
None — all fields are optional and flow through the pipeline correctly. No hardcoded placeholder values.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- bbox/pageIdx data preserved through AST pipeline, ready for PDF highlight overlay (Phase 16)
- Evidence sourceBbox/targetBbox ready for evidence-to-PDF navigation (Phase 17)
- risk:getPdfFile IPC ready for PDF viewer file loading (Phase 15)

---
*Phase: 14-pdf-viewer*
*Completed: 2026-07-24*
