# Research Summary: BidLens V0.3.0

**Date:** 2026-07-22
**Confidence:** HIGH — based on actual source code inspection across all 4 dimensions

## Key Finding

V0.3.0 is **substantially implemented**. The task breakdown document's ~60 tasks describe work that is largely done. The roadmap marking V0.3.0 as ✅ is accurate for the core pipeline.

## What's Built (Waves 0-5 complete)

- **Contracts (Wave 0):** Shared types frozen, `risk:*` IPC typed, Rust-TS serde alignment
- **Foundations (Wave 1):** review-core crate (1,224 lines), stable SHA-256 node IDs, SQLite v2 (14 tables, 13 repos), EngineManager JSON-RPC
- **Extraction/Recall (Wave 2):** Strong/weak entity extraction, key-fact extraction, tender filter, 5 sparse indexes (hash/ngram/entity/fact/table-signature)
- **Detectors (Wave 3):** TextDetector, TableDetector, EntityDetector, FactDetector — all real with unit tests
- **Aggregation/Risk (Wave 4):** Finding dedup, directional coverage, file-pair assessment, project risk, 3 preset configs
- **Review/Report (Wave 5):** ReviewDecision persistence, MD/HTML/PDF reports, audit events, checkpoint/resume, full UI workbench

## What Needs Work

| Gap | Severity | Effort |
|-----|----------|--------|
| Table detector empty submission_id | Medium | S |
| Business labels never populated | Low | M (can defer) |
| Legacy `run_analysis` dead code | Low | S (delete) |
| No E2E with real DOCX files | High | L |
| Renderer identity split (3 stores) | Medium | M |
| Table location not wired in Rust | Medium | S |
| Engine fallback produces fake evidence | Medium | S |
| Checkpoint resume re-runs all detectors | Low | M |
| Security/performance test suites | High | L |

## Roadmap Implications

The original task breakdown (~60 tasks, 7 waves) should be **rescoped** to focus on:
1. **Bug fixes and cleanup** — table detector submission_id, dead code removal, table_location wiring
2. **Integration hardening** — E2E tests, renderer identity unification, engine fallback removal
3. **Quality gates** — security tests, performance benchmarks, Diff regression

The ~60 task IDs from the breakdown still serve as traceability references, but most map to completed work.
