---
gsd_state_version: 1.0
milestone: v0.3.6
milestone_name: PDF 原文定位与数据提取
status: executing
stopped_at: Completed 15-01-PLAN.md
last_updated: "2026-07-24T14:19:26.783Z"
last_activity: 2026-07-24
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-23)

**Core value:** Deliver explainable, traceable risk evidence for bid document similarity
**Current focus:** Phase 17 — dual-pane-compare

## Current Position

Phase: 17
Plan: Not started
Status: Executing Phase 17
Last activity: 2026-07-24

Progress: [██████████] 100%

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
| Phase 14 P02 | 3min | 2 tasks | 7 files |
| Phase 15 P01 | 3min | 2 tasks | 4 files |

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
- [Phase 14]: Used plain overflow-auto div instead of ScrollArea for direct scroll event access
- [Phase 14]: Integrated PdfDrawer into risk-result-page.tsx instead of review-workbench.tsx (compare flow)
- [Phase 15]: Used requestAnimationFrame for post-load scroll instead of setTimeout
- [Phase 15]: Removed standalone PDF button — replaced by per-evidence page badges
- [Phase 16]: Canvas overlay approach for highlight rendering (DPR-aware)
- [Phase 16]: Plain div tooltip instead of shadcn Tooltip (simpler positioning)
- [Phase 16]: computeHighlightZoom makes first highlight fill 80% viewport width
- [Phase 16]: Opacity cycling (0.2, 0.3, 0.4) for multi-evidence on same page
- [Phase 17]: DualPdfDrawer with bottom Sheet (h-[90vh]) and CSS grid 2-col layout
- [Phase 17]: PdfDrawerState union type for single/dual mode state management
- [Phase 17]: Auto-detect dual mode when evidence has different source/target submissionIds

### Pending Todos

None

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-07-24T01:38:06.813Z
Stopped at: Completed 15-01-PLAN.md
