# VNext UI Execution Status

> Phase: 0 → 1 | Branch: `feature/vnext-ui-phase-0` | Started: 2026-07-20

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
