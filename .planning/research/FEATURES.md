# V0.3.0 Feature Implementation Status

**Domain:** Bid document similarity risk review (投标文件雷同性风险审查)
**Researched:** 2026-07-22
**Confidence:** HIGH — based on actual source code inspection

## Executive Summary

V0.3.0 is **substantially implemented**, not just marked done in roadmap. The core pipeline (Rust engine with 4 detectors, sparse recall, aggregation, scoring) is real and wired end-to-end through TypeScript services to the Electron renderer. The SQLite v2 schema has 14 tables with encrypted persistence. The UI has a full review workbench with virtual lists, evidence viewport, relationship matrix, and report export.

However, some areas have gaps: no E2E tests with real fixture files for the risk pipeline, the `run_analysis` (legacy file-path) method is a stub/placeholder, and the table detector has a known issue where `source_submission_id`/`target_submission_id` are empty strings (ponytail comment says "filled by caller").

---

## Wave 0: Contract Gate

| Item | Status | Evidence |
|------|--------|----------|
| Shared contracts frozen | **FULLY IMPLEMENTED** | `packages/shared/src/risk-review.ts` — 330 lines, all types defined: `ReviewNode`, `Entity`, `KeyFact`, `Evidence`, `RiskFinding`, `FilePairAssessment`, `ProjectRiskAssessment`, `ReviewDecision`, `DetectorRun`, `AnalysisCheckpoint`, `AuditEvent`, `ExportedReport` |
| `risk:*` IPC contracts | **FULLY IMPLEMENTED** | `packages/shared/src/ipc.ts` lines 142-199 — `BidLensApi` includes `listProjects`, `getProject`, `createRiskProject`, `cancelRiskProject`, `resumeRiskProject`, `retryRiskSubmission`, `acceptPartial`, `deleteProject`, `saveRiskFindingReview`, `getAuditEvents`, `exportRiskReport`, `onRiskProgress`, `onDetectorProgress` |
| Rust types match TS types | **FULLY IMPLEMENTED** | `review-core/src/lib.rs` — all enums (`ProjectStatus`, `AnalysisPhase`, `SubmissionState`, `RiskLevel`, `DetectorType`, `RiskPreset`, etc.) and structs (`ReviewNode`, `Entity`, `KeyFact`, `Evidence`, `RiskFinding`, `FilePairAssessment`, `ProjectRiskAssessment`, etc.) use `#[serde(rename_all = "camelCase")]` for JS interop |

---

## Wave 1: Foundations

| Item | Status | Evidence |
|------|--------|----------|
| `review-core` crate exists | **FULLY IMPLEMENTED** | `bidlens-engine/crates/review-core/` — `Cargo.toml` depends on `document-ast`, `sha2`, `regex`, `uuid`. Exports `lib.rs`, `aggregation.rs`, `detectors/`, `scoring.rs`, `sparse_index.rs`, `tender.rs` |
| Stable node IDs | **FULLY IMPLEMENTED** | `review-core/src/lib.rs` `generate_node_id()` — SHA-256 of file_hash + node_path, deterministic, 32-char hex output. Tests verify determinism and collision resistance |
| AST Traverser | **FULLY IMPLEMENTED** | `review-core/src/lib.rs` `Traverser` struct — iterates `BlockNode[]` with section path tracking, heading detection (Chinese patterns: 第X章/节/条, numbered), page range extraction |
| Text normalization | **FULLY IMPLEMENTED** | `review-core/src/lib.rs` `normalize_text()` — strips CJK/ASCII punctuation, collapses whitespace, lowercases ASCII. Handles mixed Chinese/English |
| SQLite v2 migration | **FULLY IMPLEMENTED** | `apps/desktop/src/main/db/migrations.ts` — 14 V2 tables: `risk_projects`, `risk_submissions`, `document_versions`, `tender_baselines`, `risk_findings`, `risk_evidence`, `file_pair_assessments`, `project_risk_assessments`, `review_decisions`, `analysis_checkpoints`, `detector_runs`, `audit_events`, `exported_reports`. 18 indexes |
| Repository layer | **FULLY IMPLEMENTED** | `apps/desktop/src/main/db/repositories.ts` — 13 repository factories: `createProjectRepository`, `createSubmissionRepository`, `createDocumentVersionRepository`, `createFindingRepository`, `createEvidenceRepository`, `createReviewDecisionRepository`, `createCheckpointRepository`, `createAuditEventRepository`, `createExportedReportRepository`, `createFilePairAssessmentRepository`, `createTenderBaselineRepository`, `createDetectorRunRepository`, `createProjectRiskAssessmentRepository` |
| Renderer identity (Zustand store) | **FULLY IMPLEMENTED** | `apps/desktop/src/renderer/features/risk-review/risk-review-store.ts` — manages `projectId`, `selectedFindingId`, `filters`, `filePair` state |
| EngineManager JSON-RPC | **FULLY IMPLEMENTED** | `apps/desktop/src/main/services/engine-manager.ts` — spawns `bidlens-engine` child process, JSON-RPC over stdio, supports `risk.createProject`, `risk.analyzeWithAst`, `risk.cancelProject`, `risk.getProject` methods |

---

## Wave 2: Extraction / Recall

| Item | Status | Evidence |
|------|--------|----------|
| Entity extraction (strong) | **FULLY IMPLEMENTED** | `review-core/src/lib.rs` `extract_strong_entities()` — regex-based: credit codes (18-char), phone numbers (11-digit mobile), email addresses, ID cards (18-digit). Compiled via `LazyLock` |
| Entity extraction (weak) | **FULLY IMPLEMENTED** | `review-core/src/lib.rs` `extract_weak_entities()` — company names (X有限公司/集团/股份), person names (2-4 Chinese chars + role suffix). Confidence 0.6-0.7 |
| Key fact extraction | **FULLY IMPLEMENTED** | `review-core/src/lib.rs` `extract_key_facts()` — amounts (万元/元), percentages, dates (YYYY年MM月DD日, YYYY-MM-DD), periods (X天/个月/年). Normalization to canonical forms |
| Business labels | **PARTIALLY IMPLEMENTED** | Types defined (`BusinessLabel` enum in Rust and TS) but `ReviewNode.labels` is always `Vec::new()` in `build_review_nodes()`. No labeling logic implemented |
| Tender filter module | **FULLY IMPLEMENTED** | `review-core/src/tender.rs` — `build_baseline()` normalizes paragraphs, `filter_tender_content()` compares nodes against baseline set. Returns `TenderFilterResult` per node |
| Sparse recall indexes | **FULLY IMPLEMENTED** | `review-core/src/sparse_index.rs` — 5 indexes: `ExactHashIndex` (SHA-256 of normalized text), `CharNgramIndex` (3-gram Jaccard, threshold 0.5), `EntityIndex` (normalized entity values), `FactIndex` (normalized fact values), `TableSignatureIndex` (table row signatures). `RecallIndex` composite deduplicates and sorts by score |
| Main orchestration (risk.analyzeWithAst) | **FULLY IMPLEMENTED** | `bidlens-engine/src/risk_engine.rs` `run_analysis_with_ast()` — full pipeline: validate → parse AST → extract nodes → extract entities → filter tender → recall candidates → run 4 detectors → aggregate → compute file pairs → compute project risk. Progress callbacks at each phase |
| TS-side orchestration | **FULLY IMPLEMENTED** | `apps/desktop/src/main/services/risk-review-service.ts` `run()` method — validates files, parses DOCX/PDF, calls Rust engine via `riskAnalyzeWithAst`, persists findings/evidence/assessments to SQLite, handles cancellation/checkpoint/resume |

---

## Wave 3: Detectors

| Item | Status | Evidence |
|------|--------|----------|
| TextDetector | **FULLY IMPLEMENTED** | `review-core/src/detectors/text_detector.rs` — classifies pairs as Exact, NgramOverlap, LightEdit, or Structural. Uses char 3-gram Jaccard + Levenshtein (capped at 500 chars). Structural match: shared section path + position proximity. 8 tests |
| TableDetector | **FULLY IMPLEMENTED** | `review-core/src/detectors/table_detector.rs` — groups candidates by table index pair, deduplicates repeated rows, computes structural similarity (row/col coverage) + content similarity (avg row scores). Weighted: 30% structural + 70% content. 5 tests. **Known issue**: `source_submission_id`/`target_submission_id` are empty strings (ponytail: "filled by caller") |
| EntityDetector | **FULLY IMPLEMENTED** | `review-core/src/detectors/entity_detector.rs` — matches entities by normalized value across submissions. Strong entity match → Medium risk, Weak → Low risk. Context window extraction (50 chars before/after). 6 tests |
| FactDetector | **FULLY IMPLEMENTED** | `review-core/src/detectors/fact_detector.rs` — compares facts by type. Same fact → high similarity (0.9-1.0), conflicting fact → low similarity (0.3) with penalty. Penalty weights by fact type (Amount 0.15, Ratio 0.10, etc.). 5 tests |
| All detectors wired in pipeline | **FULLY IMPLEMENTED** | `risk_engine.rs` lines 447-512 — `run_detector_safe()` wraps each detector with panic catching and timing. Results collected as `DetectorRunResult` with status/candidate_count/hit_count/elapsed_ms |

---

## Wave 4: Aggregation / Risk

| Item | Status | Evidence |
|------|--------|----------|
| Finding aggregation | **FULLY IMPLEMENTED** | `review-core/src/aggregation.rs` `aggregate_findings()` — converts all evidence types to canonical `Evidence`, groups by unordered submission pair, deduplicates (same source_node+target_node+match_basis keeps highest score), generates deterministic finding IDs via SHA-256 |
| Directional coverage | **FULLY IMPLEMENTED** | `review-core/src/aggregation.rs` `compute_directional_coverage()` — asymmetric: fraction of evidence nodes from A that match B. Computed for all ordered pairs |
| File-pair assessment | **FULLY IMPLEMENTED** | `review-core/src/aggregation.rs` `assess_file_pairs()` — symmetric_similarity = max final_score, risk_level from preset thresholds, directional_coverage_ab/ba, top 5 finding IDs, finding counts by level |
| Project risk | **FULLY IMPLEMENTED** | `review-core/src/aggregation.rs` `compute_project_risk()` — weighted contribution (symilarity^2), Incomplete if any detector failed, top 10 contributing findings, high-value count, entity hit count, tender discount flag |
| Scoring formula | **FULLY IMPLEMENTED** | `review-core/src/scoring.rs` `compute_score()` — `raw = max(exact, lexical, structural)*0.5 + entity*0.25 + fact*0.25`, `adjusted = raw*(1-tender)*(1-template) - fact_penalty`, clamped [0,1]. 8 tests |
| Preset thresholds | **FULLY IMPLEMENTED** | `review-core/src/scoring.rs` `PresetConfig` — Strict (0.6/0.4/0.2), Standard (0.75/0.5/0.3), Loose (0.85/0.65/0.45) |
| Tender discount | **FULLY IMPLEMENTED** | `risk_engine.rs` `apply_tender_discount()` — computes fraction of evidence with filtered nodes, applies proportional discount, recalculates final score |
| Engine integration | **FULLY IMPLEMENTED** | `risk_engine.rs` `run_analysis_with_ast()` — full pipeline calling all 4 detectors, aggregation, file-pair assessment, project risk. `run_detector_safe()` catches panics. Results returned as `RiskAnalysisResult` |

---

## Wave 5: Review / Report

| Item | Status | Evidence |
|------|--------|----------|
| ReviewDecision persistence | **FULLY IMPLEMENTED** | `review_decisions` table in v2 schema, `createReviewDecisionRepository` in repositories.ts, `saveRiskFindingReview()` in RiskReviewService — upserts decision with status/important/note (encrypted) |
| Finding review save | **FULLY IMPLEMENTED** | `risk-review-service.ts` `saveRiskFindingReview()` — updates finding review_status, important, note (encrypted). Creates audit event. Returns reconstructed finding |
| Report generation | **FULLY IMPLEMENTED** | `apps/desktop/src/main/services/report-generator.ts` — `generateMarkdownReport()` and `generateHtmlReport()` with risk level labels, preset labels, finding tables, evidence detail, disclaimer. Scope filtering (all/confirmed/important/filtered) |
| PDF export | **FULLY IMPLEMENTED** | `risk-review-service.ts` `generatePdfFromHtml()` — creates hidden BrowserWindow, loads HTML, calls `printToPDF()` with A4 page size |
| Report hash | **FULLY IMPLEMENTED** | `report-generator.ts` `computeReportHash()` — SHA-256 of content for integrity verification |
| Audit events | **FULLY IMPLEMENTED** | `audit_events` table, `createAuditEventRepository`, events: project-created, analysis-completed, analysis-failed, analysis-cancelled, analysis-recovered, partial-accepted, review-changed, report-exported |
| Checkpoint/resume | **FULLY IMPLEMENTED** | `analysis_checkpoints` table, `checkpointRepo.save()` called at each phase, `resumeRiskProject()` reads latest checkpoint and resumes from that phase |
| Evidence workbench UI | **FULLY IMPLEMENTED** | Renderer components: `evidence-viewport.tsx`, `evidence-detail-tabs.tsx`, `evidence-review-controls.tsx`, `finding-filter-toolbar.tsx`, `finding-virtual-list.tsx`, `relationship-matrix.tsx`, `risk-result-toolbar.tsx`, `report-export-panel.tsx`, `risk-overview.tsx` |
| Zustand review store | **FULLY IMPLEMENTED** | `risk-review-store.ts` — manages projectId, selectedFindingId, filters (detectorType, riskLevel, reviewStatus, searchText), filePair selection |
| React Query integration | **FULLY IMPLEMENTED** | `risk-result-queries.ts` — `useRiskResultDetail()`, `useFindingCounts()`. `risk-review-mutations.ts` — `useSaveRiskFindingReview()`, `useDebouncedNoteSave()` |

---

## Wave 6: Quality

| Item | Status | Evidence |
|------|--------|----------|
| Rust unit tests | **FULLY IMPLEMENTED** | review-core has extensive tests: lib.rs (14 tests), aggregation.rs (8 tests), sparse_index.rs (8 tests), scoring.rs (8 tests), tender.rs (3 tests), text_detector.rs (8 tests), table_detector.rs (5 tests), entity_detector.rs (6 tests), fact_detector.rs (5 tests). risk_engine.rs has 6 tests |
| TS unit tests (renderer) | **FULLY IMPLEMENTED** | Test files exist for: `evidence-detail-tabs.test.tsx`, `evidence-review-controls.test.tsx`, `evidence-viewport.test.tsx`, `finding-filter-toolbar.test.tsx`, `finding-virtual-list.test.tsx`, `relationship-matrix.test.tsx`, `risk-overview.test.tsx`, `risk-result-page.test.tsx`, `risk-export-dialog.test.tsx`, `risk-review-performance.test.tsx`, `risk-review-store.test.ts`, `risk-result-queries.test.ts` |
| TS unit tests (services) | **FULLY IMPLEMENTED** | `engine-manager.test.ts`, `file-validator.test.ts`, `parser-service.test.ts`, `report-exporter.test.ts` |
| DB tests | **PARTIALLY IMPLEMENTED** | `apps/desktop/src/main/db/__tests__/` directory exists. Schema and migration code present but test coverage unknown |
| E2E tests (risk pipeline) | **PARTIALLY IMPLEMENTED** | `apps/desktop/tests/e2e/smoke.test.ts` — tests app launch, `window.bidlens` API exposure, IPC round-trip for `createRiskProject`. Uses fixture file paths that don't exist yet (expected failure). No full E2E with real DOCX files through the risk pipeline |
| Security tests | **NOT VERIFIED** | Encryption (AES-256-GCM) is implemented in `db/crypto.ts`. No dedicated security test files found |
| Performance tests | **PARTIALLY IMPLEMENTED** | `risk-review-performance.test.tsx` exists for renderer. No dedicated Rust performance benchmarks found for the risk pipeline |
| Integration tests | **NOT STARTED** (for risk pipeline) | Existing integration tests (`comparison-flow.test.ts`, `v02-full-fidelity.test.ts`, `resilience-stress.test.ts`) are for the V0.2 compare pipeline, not the V0.3 risk pipeline |

---

## Summary by Wave

| Wave | Status | Notes |
|------|--------|-------|
| **Wave 0** (Contracts) | **FULLY IMPLEMENTED** | All shared types, IPC contracts, Rust-TS type alignment |
| **Wave 1** (Foundations) | **FULLY IMPLEMENTED** | review-core crate, stable IDs, traverser, normalization, v2 schema, repositories, engine manager |
| **Wave 2** (Extraction/Recall) | **FULLY IMPLEMENTED** | Entity/fact extraction, tender filter, 5 sparse indexes, main orchestration (Rust + TS) |
| **Wave 3** (Detectors) | **FULLY IMPLEMENTED** | All 4 detectors real with tests. Table detector has empty submission_id issue |
| **Wave 4** (Aggregation/Risk) | **FULLY IMPLEMENTED** | Finding aggregation, directional coverage, file-pair assessment, project risk, scoring formula |
| **Wave 5** (Review/Report) | **FULLY IMPLEMENTED** | Review decisions, report generation (MD/HTML/PDF), audit events, checkpoint/resume, full UI workbench |
| **Wave 6** (Quality) | **PARTIALLY IMPLEMENTED** | Extensive unit tests (Rust + TS). E2E smoke test exists but no full risk pipeline E2E. No security or performance test suites |

---

## Known Gaps and Issues

1. **Table detector empty submission IDs**: `table_detector.rs` line 255-256 has `source_submission_id: String::new()` and `target_submission_id: String::new()` with ponytail comment "filled by caller". The aggregation layer handles this via `table_evidence_to_evidence()` but the original table evidence lacks this data.

2. **Business labels never populated**: `ReviewNode.labels` is always empty. The `BusinessLabel` enum exists but no labeling/classification logic is implemented.

3. **Legacy `run_analysis` is a stub**: `risk_engine.rs` `run_analysis()` (file-path based) just sleeps 10ms per phase. The real pipeline is `run_analysis_with_ast()`.

4. **No E2E with real files**: The smoke test uses non-existent fixture paths. No integration test exercises the full risk pipeline with actual DOCX files.

5. **Semantic matching deferred**: `MatchBasis::Semantic` exists in types but no semantic detector is implemented. The scoring formula treats semantic same as lexical. This is correctly scoped to V0.3.1 (BGE-M3).

6. **Template discount not applied**: `scoring.rs` `compute_score()` accepts `template_discount` but it's always passed as 0.0 from the aggregation layer. No template detection logic exists.

7. **No `detectorRuns` table population from Rust**: The TS service persists detector runs after receiving results from Rust, but the Rust `DetectorRunResult` doesn't include an `id` field — the TS side generates UUIDs.

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Rust engine pipeline | HIGH | Full source code inspected, tests verified |
| Shared contracts | HIGH | Types match between Rust and TS, serde camelCase confirmed |
| SQLite schema | HIGH | 14 tables verified in migrations.ts, repositories.ts has full CRUD |
| UI components | HIGH | All component files exist with test files |
| E2E coverage | MEDIUM | Smoke test exists but no full pipeline E2E with real files |
| Security/Performance | LOW | No dedicated test suites found |
