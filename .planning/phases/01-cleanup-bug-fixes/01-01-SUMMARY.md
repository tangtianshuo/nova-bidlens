---
phase: 01-cleanup-bug-fixes
plan: 01
subsystem: engine
tags: [rust, dead-code, table-detector, review-core]

requires: []
provides:
  - "Clean RiskEngine with only run_analysis_with_ast entry point"
  - "Per-cell ReviewNode with populated TableLocation"
  - "TableEvidence with correct submission_id from CandidatePair"
affects: [02-domain-contracts, 03-rust-detectors]

tech-stack:
  added: []
  patterns: [per-cell table traversal, submission_id propagation]

key-files:
  created: []
  modified:
    - bidlens-engine/src/risk_engine.rs
    - bidlens-engine/src/main.rs
    - bidlens-engine/crates/review-core/src/detectors/table_detector.rs

key-decisions:
  - "Keep RiskEngine as empty unit struct (public API surface for main.rs)"
  - "Generate per-cell node_id via (file_hash, [node_index, row, col])"

patterns-established:
  - "Per-cell table ReviewNode: each cell gets its own ReviewNode with TableLocation"
  - "Submission ID propagation: detector groups carry source/target IDs from CandidatePair"

requirements-completed: [CLEAN-01, CLEAN-02, CLEAN-03]

duration: 8min
completed: 2026-07-22
---

# Phase 1 Plan 01: Rust Engine Cleanup Summary

**Removed dead code (ProjectState, 3 JSON-RPC methods, legacy run_analysis), wired per-cell table_location in build_review_nodes, and fixed empty submission_id in table detector output**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-22T07:56:40Z
- **Completed:** 2026-07-22T08:05:11Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Removed ~350 lines of dead code: ProjectState, RiskProjectRequest, 6 response types, create_project/cancel_project/get_project/run_analysis methods, Default impl, 4 test functions
- Changed build_review_nodes to create one ReviewNode per table cell with populated TableLocation (table_index, row_index, cell_index)
- Fixed table detector to propagate source_submission_id and target_submission_id from CandidatePair instead of empty strings

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove dead code from Rust engine** - `cde89fa` (chore)
2. **Task 2: Wire table_location in build_review_nodes** - `d29cea0` (feat)
3. **Task 3: Wire submission_id in table detector** - `3274f86` (fix)

## Files Created/Modified
- `bidlens-engine/src/risk_engine.rs` - Removed dead code, rewrote build_review_nodes for per-cell traversal
- `bidlens-engine/src/main.rs` - Removed risk.createProject/cancelProject/getProject JSON-RPC methods and TaskEvent::RiskCompleted
- `bidlens-engine/crates/review-core/src/detectors/table_detector.rs` - Added source/target_submission_id to TablePairGroup, propagated to TableEvidence

## Decisions Made
- Keep RiskEngine as empty unit struct rather than removing it entirely -- it's the public API surface that main.rs uses
- Generate per-cell node_id by extending the hash input with row and col indices: (file_hash, [node_index, row, col])
- Leave header_context as empty vec for now (header extraction deferred)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused MatchBasis import**
- **Found during:** Task 2 (table_location wiring)
- **Issue:** MatchBasis was imported but no longer used after dead code removal
- **Fix:** Removed from import list
- **Files modified:** bidlens-engine/src/risk_engine.rs
- **Verification:** cargo build produces no warnings
- **Committed in:** d29cea0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 unused import cleanup)
**Impact on plan:** Minimal -- just a leftover from Task 1 cleanup. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are wired end-to-end within the Rust engine.

## Next Phase Readiness
- Rust engine is clean and correct for subsequent detector and contract work
- Table cells now produce proper ReviewNodes with location data for the table detector
- TableEvidence contains real submission IDs for evidence traceability

---
*Phase: 01-cleanup-bug-fixes*
*Completed: 2026-07-22*

## Self-Check: PASSED
- All 3 modified files exist
- All 3 task commits verified in git log (cde89fa, d29cea0, 3274f86)
- cargo test passes (15/15 tests, 0 failures)
- cargo build produces 0 warnings
