# Research Summary: v0.3.4 MinerU 接入风险检测流程

**Date:** 2026-07-23
**Confidence:** HIGH

## Executive Summary

v0.3.4 is a wiring milestone, not a building milestone. The entire risk detection pipeline — MinerU cloud PDF parsing, DocumentAst conversion, Rust engine analysis, SQLite persistence, UI result display — is already implemented end-to-end. The work is fixing integration bugs, verifying the chain with real PDFs, and polishing the UX around long-running cloud parses.

No new dependencies are needed. The stack (MinerU API v4, pdf-parse, Rust review-core engine, SQLite + better-sqlite3, Electron + React + Zustand) is fully in place. The ParserRegistry, parser-service fallback chain, EngineManager AST conversion, and RiskReviewService orchestration all exist and are wired together. What remains are targeted fixes: hardcoded parserVersion, stale fileFormat in AST cache, file-validator not reflecting MinerU capability, AbortSignal not propagated through the MinerU code path, and no progress feedback during the 1-3 minute cloud parse.

The main risk is that the pipeline has never been tested end-to-end with real scanned PDFs. The plumbing looks correct on code review, but the actual MinerU API response shape, the mapper's output quality, and the Rust engine's handling of MinerU-produced ASTs (especially table blocks) are unverified. Phase 1 should be a single real-PDF integration test that validates the entire chain before any bug-fix work begins.

## Key Findings

### Stack

No additions. MinerU API v4, pdf-parse, Rust review-core engine, SQLite + better-sqlite3, Electron safeStorage — all already installed and integrated.

### Features

**Table stakes:**
- PDF auto-routed to MinerU
- Token config persisted
- DocumentAst flows to engine
- Table blocks reach detector
- Valid evidence from PDFs
- Progress events during parse
- Meaningful failure warnings

**Differentiators:**
- PDF page number in evidence
- Parser version in report
- Mixed DOCX+PDF relationship matrix

**Defer:**
- Table cell-level evidence location
- Scanned PDF quality warning
- Batch import UX with MinerU stage labels

### Architecture

Linear flow: Renderer -> IPC -> RiskReviewService -> parser-service -> DocumentAst -> EngineManager -> Rust engine -> SQLite. MinerU enters at parser-service via PDF-specific fallback bypassing ParserRegistry (by design — needs token at construction).

### Top Pitfalls

1. **AbortSignal dead code in PDF path** — MinerU polling is uncancellable
2. **No progress feedback during 1-3 min parse** — frozen spinner
3. **Offline-first contradiction** — cloud API in "offline-first" product
4. **Stale token cache on 401** — cached parser holds expired token forever
5. **Hardcoded metadata** — parserVersion: '0.2.2' and fileFormat: 'docx'

## Roadmap Implications

Suggested phases: **4**

1. **End-to-End Verification** — Run a real scanned PDF through MinerU -> mapper -> engine -> DB -> UI. Validates all assumptions before fixing anything. Highest priority.
2. **Wiring Bug Fixes** — Fix hardcoded parserVersion, stale fileFormat, file-validator MinerU awareness, AbortSignal propagation. Small targeted changes in 3-4 files.
3. **UX Hardening** — Progress feedback during MinerU parse, user-friendly zh-CN error messages, token 401 recovery, offline network check. Prevents support tickets.
4. **Edge Cases and Polish** — Partial result handling, MinerU timeout tuning, pollBatch retry logic, concurrent request queue. Lowest impact, highest uncertainty.

## Confidence

Overall: **HIGH**
- Stack: HIGH — all technologies already installed and integrated
- Features: HIGH — pipeline components verified in source code, data flow traced
- Architecture: HIGH — all integration points mapped and verified against actual code
- Pitfalls: HIGH — all 12 pitfalls derived from code inspection

## Gaps

- Real MinerU API response validation (content_list.json schema for Chinese bid docs)
- Rust engine table detector behavior with MinerU-produced ASTs
- MinerU rate limits (undocumented)
- Token expiration behavior (no API docs)

---

**Research files:**
- `STACK.md` — 零新依赖，仅需修复集成 bug
- `FEATURES.md` — 功能全景、table stakes vs differentiators
- `ARCHITECTURE.md` — 数据流、集成点、组件边界
- `PITFALLS.md` — 12 个陷阱、严重程度、缓解措施
