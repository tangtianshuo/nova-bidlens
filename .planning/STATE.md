---
gsd_state_version: 1.0
milestone: v0.3.3
milestone_name: MinerU PDF 解析集成调研
status: verifying
stopped_at: Completed 10-01-PLAN.md
last_updated: "2026-07-23T05:19:07.407Z"
last_activity: 2026-07-23
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22)

**Core value:** Deliver explainable, traceable risk evidence for bid document similarity
**Current focus:** Phase 10 — node-pdf-evaluation

## Current Position

Phase: 10 (node-pdf-evaluation) — EXECUTING
Plan: 1 of 1
Status: Phase complete — ready for verification
Last activity: 2026-07-23

Progress: [██░░░░░░░░] 25%

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 7. MinerU 可行性验证 | 1 | — | — |

**Recent Trend:**

- Last 5 plans: 07-01
- Trend: —

*Updated after each plan completion*
| Phase 08 P01 | 2min | 1 tasks | 1 files |
| Phase 08 P02 | 2min | 1 tasks | 2 files |
| Phase 08 P03 | 2min | 2 tasks | 2 files |
| Phase 08 P04 | 3min | 2 tasks | 4 files |
| Phase 09 P01 | 2min | 2 tasks | 4 files |
| Phase 09 P02 | 2min | 2 tasks | 5 files |
| Phase 10 P01 | 5min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v0.3.3: MinerU 集成采用云端 API（mineru.net），不进行本地部署
- v0.3.3: 推荐使用 pipeline 后端（延迟更低，支持更多语言）
- v0.3.3: content_list.json → DocumentAst 映射路径已明确
- v0.3.3: 扫描版 PDF 需异步处理（1-3 分钟）
- [Phase 08]: page_idx 0-indexed → 1-indexed conversion for BidLens convention
- [Phase 08]: MinerU parser uses batch upload API for local files, not auto-registered (needs API token)
- [Phase 08]: Export detectPdfType from @bidlens/shared main entry for desktop main process compatibility
- [Phase 09]: Token validation uses actual batch API call (401=invalid, code 0=valid)
- [Phase 09]: Retry only on transient network errors, not business logic errors
- [Phase 09]: Parser service reads MinerU token from MineruConfigService with env var fallback
- [Phase 10]: node-pdf-to-markdown conditionally recommended as pdf-parse replacement, NOT MinerU replacement

### Pending Todos

None yet.

### Blockers/Concerns

None — Phase 7 验证完成，MinerU 可行性已确认

## Session Continuity

Last session: 2026-07-23T05:19:07.402Z
Stopped at: Completed 10-01-PLAN.md
Resume file: None
