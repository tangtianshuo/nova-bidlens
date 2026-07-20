# VNext UI Execution Status

> Phase: 0 | Branch: `feature/vnext-ui-phase-0` | Started: 2026-07-20

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
