---
phase: 06-nzbtf-file-support
plan: 02
subsystem: parser
tags: [nzbtf, xml, zip, fast-xml-parser, jszip, document-ast]

requires:
  - phase: 06-nzbtf-file-support
    provides: "Type system update (RiskFileFormat.nzbtf) and UI file selection support"
provides:
  - "NzbtfParser class implementing DocumentParser for .nzbtf files"
  - "TB.xml parser extracting project info, bid key points, personnel"
  - "Echo.xml parser extracting bidder info and cost summary table"
  - "hyChoose.xml parser extracting evaluation/qualification data"
  - "Parser registered in globalRegistry for automatic discovery"
affects: [risk-detection, similarity-analysis]

tech-stack:
  added: []
  patterns: ["ZIP+XML multi-file parser pattern with partial path matching"]

key-files:
  created:
    - packages/shared/src/parser/nzbtf/index.ts
    - packages/shared/src/parser/nzbtf/tb-parser.ts
    - packages/shared/src/parser/nzbtf/echo-parser.ts
    - packages/shared/src/parser/nzbtf/hy-parser.ts
  modified:
    - packages/shared/src/parser/index.ts

key-decisions:
  - "Used partial path matching (includes) for ZIP entry lookup — handles \\ vs / separator issues"
  - "Skipped deep UnitWorks/DivisionalWorks nesting in Echo.xml — too large, low value for risk detection"
  - "All pageStart/pageEnd = null — nZBTF has no page concept"

patterns-established:
  - "Multi-XML parser pattern: each XML gets its own module, main parser orchestrates ZIP extraction"

requirements-completed: [NZBTF-01, NZBTF-02, NZBTF-03]

duration: 5min
completed: 2026-07-22
---

# Phase 6: nZBTF File Support — Plan 02 Summary

**NzbtfParser extracts ZIP archives, parses TB/Echo/hyChoose XML into DocumentAst blocks, registered in globalRegistry**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- NzbtfParser class implements DocumentParser, handles .nzbtf ZIP extraction via jszip
- Three XML parsers (TB, Echo, hyChoose) convert metadata to paragraph/section/table BlockNodes
- Parser auto-registered in globalRegistry for seamless integration with existing pipeline

## Files Created/Modified
- `packages/shared/src/parser/nzbtf/index.ts` — NzbtfParser class, ZIP extraction, DocumentAst construction
- `packages/shared/src/parser/nzbtf/tb-parser.ts` — TB.xml: project info, bid key points, personnel
- `packages/shared/src/parser/nzbtf/echo-parser.ts` — Echo.xml: bidder info, cost summary table
- `packages/shared/src/parser/nzbtf/hy-parser.ts` — hyChoose.xml: evaluation/qualification data
- `packages/shared/src/parser/index.ts` — Added nzbtfParser registration and exports

## Decisions Made
- Used partial path matching for ZIP entries (handles path separator issues across OS)
- Skipped deep Echo.xml nesting (UnitWorks/DivisionalWorks) — too large, low risk-detection value
- HTML entity decoding deferred to runtime (fast-xml-parser handles standard entities)

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None — shared build passes clean.

## Next Phase Readiness
- nZBTF parsing fully integrated — files can be selected, parsed, and fed into risk detection
- Desktop build has 2 pre-existing TS errors unrelated to nZBTF (in risk-pipeline.test.ts and RelationshipMatrix)
- Phase 6 verification pending

---
*Phase: 06-nzbtf-file-support*
*Completed: 2026-07-22*
