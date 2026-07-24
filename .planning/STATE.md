---
gsd_state_version: 1.0
milestone: v0.3.6
milestone_name: PDF 原文定位与数据提取
status: roadmap-ready
stopped_at: Roadmap created, ready for plan-phase
last_updated: "2026-07-24T00:00:00Z"
last_activity: 2026-07-24
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-23)

**Core value:** Deliver explainable, traceable risk evidence for bid document similarity
**Current focus:** v0.3.6 PDF 原文定位与数据提取

## Current Position

Phase: 14 of 17 (数据层扩展与 PDF 阅读器基础)
Plan: — (not yet planned)
Status: Roadmap ready, awaiting /gsd:plan-phase 14
Last activity: 2026-07-24 — Roadmap created (4 phases, 17 requirements mapped)

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

### Pending Todos

None

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-07-24
Stopped at: Roadmap created for v0.3.6, ready to plan Phase 14
