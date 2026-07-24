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
- ✓ MinerU risk pipeline integration — v0.3.4
- ✓ PDF 原文定位与数据提取 (17/17 requirements) — v0.3.6

### Active

- [ ] **设备特征比对** — 文件元数据 + 硬件指纹提取与比对 (v0.3.7)
- [ ] **图片查重** — 文档内图片提取 + 指纹比对 (v0.3.7)
- [ ] **经济标比对** — 清单报价/定额子目/人材机汇总解析与比对 (v0.3.7)
- [ ] **资信标矩阵展示** — N×N 特征矩阵表格 (v0.3.7)

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

**Shipped:** v0.3.6 PDF 原文定位与数据提取 (2026-07-24)
- 应内 PDF 阅读器 (react-pdf)，支持翻页、缩放、键盘快捷键
- Evidence 页码标签 → 点击打开 PDF 并定位到原文页
- bbox 高亮渲染 (canvas overlay) + zoom-to-fit + hover tooltip
- 双栏对比 Drawer (CSS grid) + PdfDrawerState union type
- 17/17 requirements complete, 33 commits, 62 files changed

**封存说明:** v0.3.1 (BGE-M3 semantic enhancement) 和 v0.3.2 (gold-set calibration) 计划封存

## Next Milestone: v0.3.7 全面追赶竞品 — 审查维度扩展

**Goal:** 补全设备特征比对、图片查重、经济标比对、资信标矩阵展示，全面追赶 bqpoint 竞品审查能力

**Target features:**
- **设备特征比对** — 文件元数据提取（作者/修改人/创建时间等 9 项）+ 硬件指纹（MAC/CPU/硬盘等 8 项）
- **图片查重** — 文档内图片提取 + 指纹比对 + 相似度展示
- **经济标比对** — 清单报价/定额子目/人材机汇总解析与比对
- **资信标矩阵展示** — N×N 特征矩阵表格，直观展示多文件交叉关系

**工作方式:** 基于竞品分析文档 (docs/competitor-bqpoint/) 定义需求，分阶段实现各检测维度

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
*Last updated: 2026-07-24 after v0.3.6 milestone completion*
