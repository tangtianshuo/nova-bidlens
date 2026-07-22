# BidLens

## What This Is

BidLens is a local Electron desktop app for bid document similarity risk review (投标文件雷同性风险审查). It imports 2-8 bid documents per project, performs explainable text/table/entity/key-fact detection, and outputs traceable risk evidence. Target users are bid reviewers who need to identify suspicious similarities across submissions.

## Core Value

Deliver explainable, traceable risk evidence for bid document similarity — every finding must link back to specific document locations and detection basis.

## Requirements

### Validated

- V0.2.2 DOCX/text-PDF parsing pipeline
- V0.2.2 Diff engine (table-diff, semantic diff)
- V0.2.2 SQLite persistence with encryption
- V0.2.2 Review and report UI foundations
- VNext project, matrix, finding and evidence UI components
- Initial Shared risk types and `risk:*` IPC contracts

### Active

- [ ] **V0.3.0 domain contracts** — ReviewNode, Entity, KeyFact, Evidence, RiskFinding, state machines, IPC typed commands
- [ ] **SQLite v2 schema** — forward-only migration, encrypted AST/ReviewNode/checkpoints, retention
- [ ] **Rust analysis core** — ReviewNode extraction, sparse recall (hash/n-gram/entity/table-signature), four detectors, aggregation, risk assessment
- [ ] **Main orchestration** — repository-backed project lifecycle, checkpoints, recovery, cancel/interrupt/resume
- [ ] **Renderer real flow** — file import, processing progress, evidence workbench, report export
- [ ] **Quality gates** — real-file E2E, security tests, performance benchmarks, Diff regression

### Out of Scope

- BGE-M3 semantic embedding enhancement — deferred to V0.3.1
- Gold-set calibration and threshold tuning — deferred to V0.3.2
- Standalone version-diff product flow — retiring; Diff remains as evidence tooling only
- Cloud/network features — product is local-only by design

## Context

- **Tech stack:** Electron + React 19 + Vite + Tailwind 4 + Radix UI (renderer), TypeScript main process, Rust workspace (bidlens-engine)
- **Monorepo:** pnpm workspace with `packages/shared`, `apps/desktop`, `bidlens-engine`
- **V0.2.2 baseline:** Dual-document comparison pipeline fully functional as capability prototype
- **Known issues:** Risk projects live only in Main-process Map; project/analysis/submission status conflated; ReviewDecision embedded in RiskFinding; Evidence lacks complete location info; no risk-project DB schema
- **Language:** UI in Chinese (zh-CN), code/commits in English

## Constraints

- **Offline-first:** No network calls during analysis — all processing is local
- **Encrypted persistence:** AST, ReviewNode, Evidence, checkpoints must be encrypted at rest
- **Contract-first gate:** No detector/persistence/Renderer mutation merges before V0.3.0 contract gate
- **File ownership:** Hotspot files have single owners until gate merge
- **Rust edition 2024:** Must align CI and toolchain to compatible compiler

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Contract-first gate for V0.3.0 | Prevents parallel workers from diverging on undefined interfaces | — Pending |
| Four detectors (text/table/entity/key-fact) as separate modules | Independent test/disable/fail without affecting others | — Pending |
| SQLite v2 forward-only migration | Preserve V0.2.2 compare database history | — Pending |
| Evidence must include complete source location | Current Evidence lacks AST/page/table location, limits traceability | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-22 after milestone v0.3.0 initialization*
