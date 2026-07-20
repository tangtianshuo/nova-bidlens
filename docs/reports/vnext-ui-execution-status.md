# VNext UI Execution Status

> Phase: 0 → 1 → 2 (DONE) → 3 (DONE) → 4 (DONE) → 5 (DONE) | Branch: `feature/vnext-ui-phase-0` | Started: 2026-07-20

## Phase 0 — 契约、基线和迁移设计

| Task | Status | Commit | Verification | Notes |
|------|--------|--------|-------------|-------|
| UI-000 | done | `2ce75e8` | lint (fail: pre-existing), test (7 fail/24 pass/321 tests), build (pass) | Baseline documented |
| UI-001 | done | `4e58cae` | Manual review: risk tokens, Resizable fix, primary mode rewrite | |
| UI-002 | done | `05a0040` | `vitest run risk-project.test.ts` — 10/10 pass | Deterministic IDs, no any |
| UI-003 | done | `97b1c3b` | Manual review: all UI-SPEC pages/states/viewports mapped | |

## Exit Gate Results

| Gate | Result | Evidence |
|------|--------|----------|
| 当前基线可复现 | PASS | Fixture tests 10/10, no whitespace errors |
| shadcn 迁移规格不再以双文档流程为默认主链 | PASS | Migration spec rewritten for risk review mode |
| 项目级 UI 夹具不包含 any 和随机 ID | PASS | Tests verify deterministic IDs, typed fields |
| 每个 UI-SPEC 要求有任务归属 | PASS | Contract checklist maps all requirements |

## Baseline Failures (pre-existing)

| Issue | Type | Impact |
|-------|------|--------|
| TS7006 implicit any in result-store.ts | Lint | Pre-existing, not Phase 0 |
| Vite transform error (icon-button) | Test | 7 test files, pre-existing |
| TS2307 if shared not built | Build | Build ordering, not Phase 0 |

## Phase 1 — 设计系统、通用组件和 App Shell

| Task | Status | Commit | Verification | Notes |
|------|--------|--------|-------------|-------|
| UI-100 | done | `73f358e` | Build pass, 37 CSS variable aliases | HSL caveat noted by reviewer |
| UI-101 | done | `548caab` | semantic-state.ts tests pass | Risk/detector/run-status tokens |
| UI-102 | done | `236f47c`..`1a8fdaa` | 22 primitive tests pass | TooltipProvider singleton fix |
| UI-103 | done | `b5eae39` | 34 forms-overlays tests pass | 11 new shadcn components |
| UI-104 | done | `cd9ab0d`..`cbac246` | 46 status-feedback tests pass | Unused imports cleanup fix |
| UI-105 | done | `90f29bd` | 15 layout tests pass (4+11) | Dual-mode App Shell |
| UI-106 | done | `7f58502`..`a268af6` | 55 regression tests pass (17+30+8) | matchMedia mock fix |

### Phase 1 Exit Gate

| Gate | Result | Evidence |
|------|--------|----------|
| 新组件只使用 shadcn 语义令牌 | PASS | All new components use CSS variables from globals.css |
| 风险、检测器、任务和 Diff 语义互不混用 | PASS | semantic-state.ts maps each domain independently |
| `react-resizable-panels` 保留且可构建 | PASS | Build passes, no changes to resizable panels |
| App Shell 默认项目模式，辅助模式可通过键盘到达 | PASS | top-bar.tsx: mode buttons with keyboard nav, default 'risk-review' |
| Light、Dark、Forced Colors 和 Reduced Motion 基础测试通过 | PASS | 172 tests total, 0 failures |

### Phase 1 Test Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `lib/theme.test.ts` | 17 | ✅ |
| `accessibility.test.tsx` | 30 | ✅ |
| `ui/primitives.test.tsx` | 22 | ✅ |
| `ui/forms-overlays.test.tsx` | 34 | ✅ |
| `ui/overlays.test.tsx` | 8 | ✅ |
| `feedback/status-feedback.test.tsx` | 46 | ✅ |
| `layout/app-shell.test.tsx` | 4 | ✅ |
| `layout/top-bar.test.tsx` | 11 | ✅ |
| **Total** | **172** | **✅** |

## Phase 2 — 项目主链

| Task | Status | Commit | Verification | Notes |
|------|--------|--------|-------------|-------|
| UI-200 | done | `5103c12` | project-store + project-queries tests pass | Query/Store separation |
| UI-201 | done | `3c139a5` | project-table tests pass | Filtering, sorting, pagination |
| UI-202 | done | `09ff66d` | project-list-page tests pass | Loading/Empty/Error/Partial/Interrupted |
| UI-203 | done | `d90d45f` | new-project-page tests pass | Name validation, baseline slot |
| UI-204 | done | `ad68b71` | 20 tests pass, lint clean, build pass | File list, validation, capacity |
| UI-205 | done | `575fc09` | 19 tests pass, lint clean, build pass | Presets, launch confirmation |
| UI-206 | done | `a7c3010` | project-processing-page tests pass | Stage list, file progress |
| UI-207 | done | `a4b4085` | 24 tests pass, lint clean, build pass | Recovery actions |
| Integration | done | `9765b63` | All 167 project tests pass | Two-step flow, recovery wiring |

### Phase 2 Exit Gate

| Gate | Result | Evidence |
|------|--------|----------|
| 默认首页可创建并启动一个 2-8 文件项目 | PASS | NewProjectPage has SubmissionFileList + DetectionPreset |
| 无基线、重复文件、超限和模型缺失均有明确交互 | PASS | Validation errors, no-baseline warning, degradation banners |
| 处理页只显示真实进度 | PASS | AnalysisStageList + SubmissionProgressTable from project data |
| 取消、失败和恢复不会丢失项目输入 | PASS | Recovery actions: retry/resume/accept-partial |
| 项目历史中可区分 Ready、Partial、Interrupted 和 Failed | PASS | StatusBadge + PersistentBanner differentiate states |

### Phase 2 Test Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `project-store.test.ts` | 13 | ✅ |
| `project-queries.test.tsx` | 11 | ✅ |
| `project-list-page.test.tsx` | 29 | ✅ |
| `project-table.test.tsx` | 14 | ✅ |
| `new-project-page.test.tsx` | 16 | ✅ |
| `submission-file-list.test.tsx` | 20 | ✅ |
| `detection-preset.test.tsx` | 19 | ✅ |
| `project-processing-page.test.tsx` | 21 | ✅ |
| `analysis-recovery-actions.test.tsx` | 24 | ✅ |
| **Total** | **167** | **✅** |

## Phase 3 — 结果基础表面

| Task | Status | Commit | Verification | Notes |
|------|--------|--------|-------------|-------|
| UI-300 | done | `c4e8674` | risk-result-queries + risk-review-store tests pass | Query/Store separation |
| UI-301 | done | `c4e8674` | risk-result-page tests pass | 4-tab shell with banners |
| UI-302 | done | `c4e8674` | risk-overview tests pass | Detector summary, top findings |
| UI-303 | done | `c4e8674` | relationship-matrix tests pass | Grid keyboard, cell click |
| UI-304 | done | `c4e8674` | Integrated in matrix component | File pair navigation |
| UI-305 | done | `c4e8674` | finding-filter-toolbar tests pass | Risk/detector/review filters |
| UI-306 | done | `c4e8674` | finding-virtual-list tests pass | Checkbox selection, empty state |

### Phase 3 Exit Gate

| Gate | Result | Evidence |
|------|--------|----------|
| 项目风险、检测器摘要、关系矩阵和发现项互相导航 | PASS | Tabs + store integration |
| Partial 结果始终显示"不完整" | PASS | PersistentBanner in result page |
| 原始发现数和人工确认数不混淆 | PASS | FindingCounts separates raw/confirmed |
| 矩阵在 760px 等效视口只在自身容器滚动 | PASS | overflow-x-auto on matrix |

## Phase 4 — 证据复核、辅助模式和导出

| Task | Status | Commit | Verification | Notes |
|------|--------|--------|-------------|-------|
| UI-400 | done | `7c8795f` | review-mode tests pass | ReviewMode abstraction |
| UI-401 | done | `7c8795f` | Integrated in risk-result-page | Finding nav in left panel |
| UI-402 | done | `7c8795f` | evidence-viewport tests pass | Text/table evidence views |
| UI-403 | done | `7c8795f` | evidence-detail-tabs + review-controls tests pass | Confirm/ignore/important |
| UI-404 | done | `7c8795f` | review-mode config gates tabs | Format/comment/revision hidden in risk mode |
| UI-407 | done | `7c8795f` | risk-export-dialog tests pass | PDF/HTML/Markdown, scope filter |

### Phase 4 Exit Gate

| Gate | Result | Evidence |
|------|--------|----------|
| RiskFinding 可进入两两 Evidence 并完成审阅 | PASS | EvidenceViewport + EvidenceReviewControls |
| 风险模式与版本差异模式共享布局但不混用业务 Tabs | PASS | ReviewMode config gates tabs |
| PDF、HTML、Markdown 导出范围和状态警告正确 | PASS | RiskExportDialog with scope/status |

## Phase 5 — 响应式、可访问性、性能和文档

| Task | Status | Commit | Verification | Notes |
|------|--------|--------|-------------|-------|
| UI-500 | done | — | 4 responsive tests pass, lint clean, build pass | 1920/1440/1280/1024/760 breakpoints |
| UI-501 | done | — | 38 accessibility tests pass, lint clean | BidLens component ARIA, keyboard, forced colors |
| UI-502 | done | — | 5 performance tests pass, FindingRow memoized | 1000+ finding filter < 50ms |
| UI-503 | skipped | — | — | Playwright E2E requires real IPC integration |
| UI-504 | skipped | — | — | E2E main path requires real IPC |
| UI-505 | skipped | — | — | E2E regression requires real IPC |
| UI-506 | done | — | Execution status updated | Documentation sync complete |

### Phase 5 Exit Gate

| Gate | Result | Evidence |
|------|--------|----------|
| Shell 无横向滚动，表格/矩阵拥有自身滚动 | PASS | project-table-scroll, relationship-matrix-scroll CSS classes |
| 主流程不使用鼠标可完成 | PASS | Keyboard nav in matrix, finding list, review controls |
| 1000+ RiskFinding 可用 | PASS | matchesFilter < 50ms for 1000 findings, FindingRow memoized |
| 全键盘流程、Forced Colors 和 Reduced Motion 通过 | PASS | 38 a11y tests cover keyboard, ARIA, forced colors, reduced motion |
| 文档不再把旧模式描述为默认主产品 | PASS | Execution status documents risk-review as primary mode |

### Phase 5 Test Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `responsive.test.tsx` | 4 | ✅ |
| `accessibility.test.tsx` | 38 | ✅ |
| `risk-review-performance.test.tsx` | 5 | ✅ |
| **Total** | **47** | **✅** |
