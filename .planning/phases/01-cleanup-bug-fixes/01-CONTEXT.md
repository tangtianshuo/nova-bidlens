# Phase 1: Cleanup & Bug Fixes - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove dead code and fix known data issues in the Rust engine and detectors. The codebase has a legacy `run_analysis` stub, empty submission IDs in table detector output, unpopulated `table_location` fields, and a fallback path that produces untraceable evidence. This phase cleans all of these so subsequent phases build on a solid foundation.

</domain>

<decisions>
## Implementation Decisions

### Fallback Strategy (CLEAN-04)
- **D-01:** Completely remove the engine fallback path (`buildFindings` in `risk-review-service.ts`). The Rust engine becomes a hard dependency — if it fails to start, the operation fails with a clear error. No degraded mode, no fake evidence.

### Table Submission ID (CLEAN-02)
- **D-02:** Fill `source_submission_id` and `target_submission_id` inside the table detector itself, not by the caller. The detector receives candidates that already carry submission context, so it should propagate this data directly.

### Dead Code Scope (CLEAN-01)
- **D-03:** Delete all identified dead code:
  - Rust: `run_analysis()` method, `ProjectState` struct
  - JSON-RPC: `risk.createProject`, `risk.cancelProject`, `risk.getProject` methods in `main.rs`
  - These are never called by TypeScript — the real pipeline uses `risk.analyzeWithAst`

### Table Location Completeness (CLEAN-03)
- **D-04:** Fully implement `table_location` in `build_review_nodes`. Extract `table_index`, `start_row`, `end_row`, `start_col`, `end_col` from the AST's table block data during traversal. This completes the evidence traceability contract.

### Claude's Discretion
- Cleanup commit strategy: single commit per logical change (one for dead code removal, one per bug fix) or one combined commit — planner's choice
- Whether to update related tests after each fix — yes, keep tests passing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Task Breakdown
- `docs/superpowers/plans/2026-07-21-bidlens-v03-implementation-task-breakdown.md` — Original task IDs V3-101, V3-103, V3-302, V3-411 map to this phase

### Research
- `.planning/research/FEATURES.md` — Wave-by-wave implementation status, gap #1 (table detector empty submission IDs), gap #3 (legacy stub), gap #6 (template discount)
- `.planning/research/PITFALLS.md` — Gap 4 (table_location not wired), Pitfall 8 (two parallel Rust paths), Pitfall 10 (fallback fake evidence)
- `.planning/research/ARCHITECTURE.md` — IPC flow, Rust integration details

### Code (key files to modify)
- `bidlens-engine/src/risk_engine.rs` — Legacy `run_analysis`, `ProjectState`, `build_review_nodes` table_location
- `bidlens-engine/crates/review-core/src/detectors/table_detector.rs` — Empty submission_id fields
- `bidlens-engine/src/main.rs` — Unused JSON-RPC methods
- `apps/desktop/src/main/services/risk-review-service.ts` — Fallback `buildFindings()` path

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `review-core/src/lib.rs` `Traverser` — Already tracks section_path and page_range; extend to track table_index and row/col ranges
- `RiskEngine.run_analysis_with_ast()` — The real pipeline; remains after dead code removal
- Table detector's `TableEvidence` struct — Has submission_id fields, just not populated

### Established Patterns
- Rust `#[serde(rename_all = "camelCase")]` — All Rust types use this for JS interop
- TypeScript side is persistence source of truth — Rust is stateless, returns results
- `run_detector_safe()` wraps each detector with panic catching — pattern to preserve

### Integration Points
- `build_review_nodes()` in `risk_engine.rs:700-750` — Where table_location needs to be wired
- `table_detector.rs:250-260` — Where submission_id needs to be filled
- `risk-review-service.ts` fallback section — Where `buildFindings()` needs removal

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the four decisions above — straightforward cleanup and bug fixes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-cleanup-bug-fixes*
*Context gathered: 2026-07-22*
