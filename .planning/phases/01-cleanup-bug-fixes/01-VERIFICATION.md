---
phase: 01-cleanup-bug-fixes
verified: 2026-07-22T12:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false

must_haves:
  truths:
    - "run_analysis method and ProjectState struct no longer exist in risk_engine.rs"
    - "risk.createProject, risk.cancelProject, risk.getProject JSON-RPC methods no longer exist in main.rs"
    - "Each table cell in build_review_nodes gets its own ReviewNode with populated table_location"
    - "TableEvidence contains correct source_submission_id and target_submission_id from CandidatePair"
    - "Engine fallback path (buildFindings) no longer exists in risk-review-service.ts"
    - "If engineManager is unavailable, the operation fails with a clear error instead of producing fake evidence"
    - "No file pair assessment or project risk fallback paths remain"
  artifacts:
    - path: "bidlens-engine/src/risk_engine.rs"
      provides: "Clean RiskEngine with only run_analysis_with_ast and helpers"
    - path: "bidlens-engine/src/main.rs"
      provides: "JSON-RPC dispatcher with only risk.analyzeWithAst (no create/cancel/get)"
    - path: "bidlens-engine/crates/review-core/src/detectors/table_detector.rs"
      provides: "Table detector with correct submission_id propagation"
    - path: "apps/desktop/src/main/services/risk-review-service.ts"
      provides: "Risk review service with engine as hard dependency"
  key_links:
    - from: "bidlens-engine/src/risk_engine.rs:build_review_nodes"
      to: "review-core TableLocation"
      via: "per-cell TableLocation construction"
    - from: "bidlens-engine/crates/review-core/src/detectors/table_detector.rs:to_evidence"
      to: "CandidatePair source_id/target_id"
      via: "group.source_submission_id / group.target_submission_id"
    - from: "apps/desktop/src/main/services/risk-review-service.ts"
      to: "EngineManager"
      via: "this.engineManager.riskAnalyzeWithAst()"

requirements:
  - id: CLEAN-01
    status: satisfied
    evidence: "Dead code (ProjectState, run_analysis, create/cancel/get_project, 3 JSON-RPC methods) fully removed"
  - id: CLEAN-02
    status: satisfied
    evidence: "table_detector.rs uses group.source_submission_id and group.target_submission_id, not String::new()"
  - id: CLEAN-03
    status: satisfied
    evidence: "build_review_nodes creates per-cell ReviewNodes with populated TableLocation (table_index, row_index, cell_index)"
  - id: CLEAN-04
    status: satisfied
    evidence: "buildFindings/normalize/blockText deleted, engineManager non-optional, clear errors on fallback paths"
---

# Phase 01: Cleanup & Bug Fixes Verification Report

**Phase Goal:** Codebase is clean and all detector outputs are correct — no dead code, no fake evidence, no missing data
**Verified:** 2026-07-22T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | run_analysis method and ProjectState struct no longer exist in risk_engine.rs | VERIFIED | Grep confirms no `fn run_analysis[^_]` or `struct ProjectState` in file |
| 2 | risk.createProject, risk.cancelProject, risk.getProject JSON-RPC methods no longer exist in main.rs | VERIFIED | Grep confirms no matches for any of the three method names |
| 3 | Each table cell in build_review_nodes gets its own ReviewNode with populated table_location | VERIFIED | Lines 464-517: iterates rows/cells, creates TableCell nodes with `table_location: Some(TableLocation{...})` |
| 4 | TableEvidence contains correct source_submission_id and target_submission_id from CandidatePair | VERIFIED | to_evidence uses `group.source_submission_id` (line 259) and `group.target_submission_id` (line 264); test asserts values match "sub-1"/"sub-2" |
| 5 | Engine fallback path (buildFindings) no longer exists in risk-review-service.ts | VERIFIED | Grep confirms no `buildFindings`, `normalize`, `blockText`, or `lexical-fallback` |
| 6 | If engineManager is unavailable, the operation fails with a clear error | VERIFIED | Line 70: non-optional `engineManager: EngineManager`; line 528: `throw new Error('分析引擎不可用')` |
| 7 | No file pair assessment or project risk fallback paths remain | VERIFIED | Lines 579-581 and 602-604: else branches throw errors, no local computation fallback |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bidlens-engine/src/risk_engine.rs` | Clean RiskEngine with only run_analysis_with_ast and helpers | VERIFIED | 719 lines, no dead code, contains fn build_review_nodes with per-cell traversal |
| `bidlens-engine/src/main.rs` | JSON-RPC dispatcher with only risk.analyzeWithAst | VERIFIED | 254 lines, only risk.analyzeWithAst plus compare/ping/shutdown |
| `bidlens-engine/crates/review-core/src/detectors/table_detector.rs` | Table detector with correct submission_id propagation | VERIFIED | 501 lines, TablePairGroup carries source/target IDs from CandidatePair |
| `apps/desktop/src/main/services/risk-review-service.ts` | Risk review service with engine as hard dependency | VERIFIED | 871 lines, engineManager non-optional, 3 error throws on fallback paths |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| risk_engine.rs:build_review_nodes | review-core TableLocation | per-cell TableLocation construction | WIRED | Line 507: `table_location: Some(TableLocation { table_index, row_index, cell_index })` |
| table_detector.rs:to_evidence | CandidatePair source_id/target_id | group.source_submission_id / group.target_submission_id | WIRED | Lines 259/264: uses group fields, not String::new() |
| risk-review-service.ts | EngineManager | this.engineManager.riskAnalyzeWithAst() | WIRED | Line 421: `await this.engineManager.riskAnalyzeWithAst(...)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| table_detector.rs:to_evidence | source_submission_id | group.source_submission_id (from CandidatePair) | Yes — propagated from candidate pair grouping | FLOWING |
| table_detector.rs:to_evidence | target_submission_id | group.target_submission_id (from CandidatePair) | Yes — propagated from candidate pair grouping | FLOWING |
| risk_engine.rs:build_review_nodes | table_location | TableLocation constructed per-cell with real indices | Yes — table_counter, r, c from iteration | FLOWING |
| risk-review-service.ts | findings | engineManager.riskAnalyzeWithAst() result | Yes — Rust engine returns real analysis | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust engine compiles | `cargo build --manifest-path bidlens-engine/Cargo.toml` | Finished with 0 warnings | PASS |
| All Rust tests pass | `cargo test --manifest-path bidlens-engine/Cargo.toml` | 75/75 passed, 0 failed | PASS |
| risk_engine unit tests | `cargo test -- risk_engine` | 5/5 passed | PASS |
| review-core tests (incl. table_detector) | `cargo test -p review-core` | 70/70 passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CLEAN-01 | 01-01 | Remove legacy run_analysis stub, ProjectState, and unused JSON-RPC methods | SATISFIED | All dead code removed from risk_engine.rs and main.rs |
| CLEAN-02 | 01-01 | Wire source_submission_id/target_submission_id in table detector output | SATISFIED | table_detector.rs uses group fields, not empty strings |
| CLEAN-03 | 01-01 | Wire table_location in build_review_nodes | SATISFIED | Per-cell ReviewNodes with populated TableLocation |
| CLEAN-04 | 01-02 | Remove or guard engine fallback path (buildFindings) | SATISFIED | buildFindings deleted, engine required, clear errors |

No orphaned requirements found — all 4 Phase 1 requirements from REQUIREMENTS.md are claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No anti-patterns detected |

No TODO/FIXME/PLACEHOLDER comments. No empty implementations. No hardcoded empty data flowing to output. No stub patterns detected.

### Human Verification Required

No human verification required — all truths are programmatically verifiable and all tests pass.

### Gaps Summary

No gaps found. All 7 observable truths verified. All 4 artifacts exist, are substantive, and are properly wired. All 4 requirements satisfied. All Rust tests pass (75/75). Cargo build produces 0 warnings.

---

_Verified: 2026-07-22T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
