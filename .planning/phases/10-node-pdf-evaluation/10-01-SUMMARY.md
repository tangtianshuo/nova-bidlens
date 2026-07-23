---
phase: 10-node-pdf-evaluation
plan: 01
subsystem: testing
tags: [pdf, evaluation, node-pdf-to-markdown, pdf-parse, comparison]

requires:
  - phase: 07-mineru-feasibility
    provides: "MinerU baseline data (860 blocks, 21 tables, 3.5s) and test PDF fixtures"
provides:
  - "node-pdf-to-markdown evaluation data and feasibility conclusion"
  - "Comparison test script for PDF parser benchmarking"
affects: [10-node-pdf-evaluation, parser-selection]

tech-stack:
  added: [node-pdf-to-markdown@1.2.5]
  patterns: [child-process-isolation for conflicting pdfjs-dist versions]

key-files:
  created:
    - tests/nodepdf/nodepdf-compare.test.ts
    - tests/nodepdf/pdfparse-worker.ts
    - tests/nodepdf/RESULTS.md
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "node-pdf-to-markdown conditionally recommended as pdf-parse replacement, NOT MinerU replacement"
  - "Child process isolation required to avoid pdfjs-dist version conflict (3.11 vs 5.4)"

patterns-established:
  - "pdfjs-dist conflict workaround: run conflicting parsers in separate processes"

requirements-completed: [NODEPDF-01, NODEPDF-02, NODEPDF-03]

duration: 5min
completed: 2026-07-23
---

# Phase 10 Plan 1: node-pdf-to-markdown Evaluation Summary

**node-pdf-to-markdown is conditionally recommended as pdf-parse replacement for text extraction; table recognition and OCR remain unimplemented roadmap items, so it cannot replace MinerU.**

## Performance

- **Duration:** 5min
- **Started:** 2026-07-23T05:15:00Z
- **Completed:** 2026-07-23T05:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

### Task 1: Install and run comparison test (c280fc1)
- Installed node-pdf-to-markdown@1.2.5 as devDependency
- Created comparison test: node-pdf-to-markdown vs pdf-parse on 76-page Chinese PDF
- Results: ~500ms each, 100% Chinese accuracy, node-pdf-to-markdown adds 3% more text and 38 headings
- Used child process isolation to work around pdfjs-dist version conflict

### Task 2: Create evaluation report (b283920)
- NODEPDF-01: Text quality excellent, 100% Chinese char match, heading detection bonus
- NODEPDF-02: Conditionally recommended — good for text-only, not for table/structure extraction
- NODEPDF-03: Table recognition and OCR both "planned" with no timeline

## Decisions Made

1. **node-pdf-to-markdown is NOT a MinerU replacement.** It lacks table recognition (MinerU found 21 tables), structured output (content_list.json with bbox/page_idx), and OCR. It is a better pdf-parse with Markdown structure.
2. **Child process isolation** is needed when running both parsers in the same test due to pdfjs-dist version conflict (node-pdf-to-markdown uses 3.11, pdf-parse uses 5.4).

## Deviations from Plan

None — plan executed as written.

## Known Stubs

None — all tests produce real data.

## Self-Check: PASSED
