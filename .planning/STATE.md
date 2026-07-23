---
gsd_state_version: 1.0
milestone: v0.3.6
milestone_name: PDF 原文定位与数据提取
status: defining-requirements
stopped_at: Milestone initialized, defining requirements
last_updated: "2026-07-23T18:00:00Z"
last_activity: 2026-07-23
progress:
  total_phases: 0
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

Phase: Not started (research complete, defining requirements)
Plan: —
Status: Research phase complete (4/4 agents), synthesizer pending, then define requirements
Last activity: 2026-07-23

Progress: [▓▓▓▓░░░░░░] 40%

### Research Status

| Agent | Status | File |
|-------|--------|------|
| Stack | ✓ Complete | .planning/research/STACK.md |
| Features | ✓ Complete | .planning/research/FEATURES.md |
| Architecture | ✓ Complete | .planning/research/ARCHITECTURE.md |
| Pitfalls | ✓ Complete | .planning/research/PITFALLS.md |
| Synthesizer | Pending | .planning/research/SUMMARY.md |

### Key Research Findings (pre-synthesis)

- **MinerU bbox 数据已存在** — mapper 丢弃了，零成本保留
- **仅需 1 个新依赖** — `react-pdf` ^10.4.1，pdfjs-dist 已是间接依赖
- **Evidence 模型扩展** — 添加 `sourceBBox/targetBBox` 可选字段，向后兼容
- **缺少 PDF 文件访问 IPC** — 需新增 `risk:getPdfFile` 端点
- **坐标系兼容** — MinerU 和 PDF.js 均使用 PDF 点坐标（原点左上）

### Next Steps

1. 运行 synthesizer 生成 SUMMARY.md
2. 定义需求 REQUIREMENTS.md
3. 创建路线图 ROADMAP.md

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

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v0.3.3: MinerU 集成采用云端 API（mineru.net），不进行本地部署
- v0.3.3: PDF pre-detect routing: scanned→MinerU, digital→pdf-parse→fallback
- v0.3.3: Token 管理通过 safeStorage 加密 + IPC + Settings UI
- [Phase 11]: risk.analyzeWithAst is async: returns 'started' first, then actual result
- [Phase 12]: MINERU_HARD_TIMEOUT_MS = 300s, parserVersion dynamic from AST
- [Phase 13]: Max 2 concurrent MinerU requests, DNS offline check, error codes with Chinese messages
- [v0.3.5]: 人机协同方式 — 用户测试 + 登记 bug，Claude 读取 bug tracker 并修复

### Pending Todos

- Define v0.3.6 requirements
- Create v0.3.6 roadmap

### Blockers/Concerns

None

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260723-tfs | 项目列表增加重新对比功能 | 2026-07-23 | 1e2d231 | [260723-tfs-recompare](./quick/260723-tfs-recompare/) |
| 260723-uxu | renderer全局错误捕获转发到日志查看器 | 2026-07-23 | 1186a4d | [260723-uxu-renderer](./quick/260723-uxu-renderer/) |

## Session Continuity

Last session: 2026-07-23T14:20:00Z
Stopped at: Completed quick task 260723-uxu
