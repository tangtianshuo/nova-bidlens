---
gsd_state_version: 1.0
milestone: v0.3.6
milestone_name: PDF 原文定位与数据提取
status: executing
stopped_at: Completed 14-01-PLAN.md
last_updated: "2026-07-24T01:05:02.192Z"
last_activity: 2026-07-24
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-23)

**Core value:** Deliver explainable, traceable risk evidence for bid document similarity
**Current focus:** Phase 14 — pdf-viewer

## Current Position

Phase: 14 (pdf-viewer) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-07-24

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v0.3.4):**

- Total plans completed: 8
- Total execution time: ~25 min
- Average duration: ~3 min/plan

**By Phase (v0.3.4):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 11. E2E 验证 | 4 | 15min | 4min |
| 12. 集成 Bug 修复 | 2 | 8min | 4min |
| 13. UX 打磨 | 2 | 7min | 3.5min |
| Phase 14 P01 | 2min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

- v0.3.3: MinerU 集成采用云端 API（mineru.net），不进行本地部署
- v0.3.3: PDF pre-detect routing: scanned→MinerU, digital→pdf-parse→fallback
- v0.3.3: Token 管理通过 safeStorage 加密 + IPC + Settings UI
- [Phase 11]: risk.analyzeWithAst is async: returns 'started' first, then actual result
- [Phase 12]: MINERU_HARD_TIMEOUT_MS = 300s, parserVersion dynamic from AST
- [Phase 13]: Max 2 concurrent MinerU requests, DNS offline check, error codes with Chinese messages
- [v0.3.6]: Digital PDF bbox 提取（pdf-parse 路径）延后到未来 milestone
- [v0.3.6]: 仅需 1 个新依赖 pdfjs-dist（react-pdf 已是间接依赖）
- [Phase 14]: SectionNode also gets bbox/pageIdx fields for mapper consistency
- [Phase 14]: pageIdx uses 1-based indexing (MinerU 0-based +1)

### Pending Todos

None

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-07-24T01:05:02.183Z
Stopped at: Completed 14-01-PLAN.md
