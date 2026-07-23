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

- [x] **MinerU risk pipeline integration** — wire MinerU parser into document import and risk detection flow (v0.3.4 shipped 2026-07-23)

### Deferred (from v0.3.0)

- [ ] V0.3.0 domain contracts (deferred)
- [ ] V0.3.0 SQLite v2 schema (deferred)
- [ ] V0.3.0 Rust analysis core (deferred)
- [ ] V0.3.0 Main orchestration (deferred)
- [ ] V0.3.0 Renderer real flow (deferred)
- [ ] V0.3.0 Quality gates (deferred)

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

## Current State

**Shipped:** v0.3.4 MinerU 接入风险检测流程 (2026-07-23)
- MinerU 云端 API 解析扫描版 PDF，mapper 产出 DocumentAst
- DocumentAst 流入 Rust 引擎风险检测 pipeline，产出 RiskFinding + filePairAssessment
- parserVersion/fileFormat 动态获取，AbortSignal 全链路传播，pollBatch 5 分钟硬超时
- 401 自动清除缓存、离线检测、友好中文错误、并发控制（max 2）、实时进度反馈
- 13/13 requirements complete, 137/137 integration tests pass

**封存说明:** v0.3.1 (BGE-M3 semantic enhancement) 和 v0.3.2 (gold-set calibration) 计划封存

## Next Milestone Goals

TBD — 运行 `/gsd:new-milestone` 开始下一个里程碑

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Contract-first gate for V0.3.0 | Prevents parallel workers from diverging on undefined interfaces | — Deferred |
| Four detectors (text/table/entity/key-fact) as separate modules | Independent test/disable/fail without affecting others | — Deferred |
| SQLite v2 forward-only migration | Preserve V0.2.2 compare database history | — Deferred |
| Evidence must include complete source location | Current Evidence lacks AST/page/table location, limits traceability | — Deferred |

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
*Last updated: 2026-07-23 after milestone v0.3.4 completion*
