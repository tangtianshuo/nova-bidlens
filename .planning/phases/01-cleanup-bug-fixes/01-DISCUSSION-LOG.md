# Phase 1: Cleanup & Bug Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 01-Cleanup & Bug Fixes
**Areas discussed:** Fallback strategy, Table submission_id, Dead code scope, table_location completeness

---

## Fallback Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 完全移除 (推荐) | engine 不可用时报错，不生成结果。保证所有证据都是真实的。 | ✓ |
| 保留但加固 | 保留降级路径但改进证据质量，比如用真实 AST 节点但跳过检测器 | |
| 用户确认后降级 | 弹窗告知用户 engine 不可用，让用户选择是否继续（降级模式） | |

**User's choice:** 完全移除 (推荐)
**Notes:** Engine becomes a hard dependency. If it fails, operation fails with clear error.

---

## Table Submission ID

| Option | Description | Selected |
|--------|-------------|----------|
| 检测器内部填充 (推荐) | detector 接收 candidate 时就知道 submission 来源，直接在 detector 内部填充 | ✓ |
| 调用方/聚合层填充 | detector 输出空值，aggregation 层根据上下文填充 | |

**User's choice:** 检测器内部填充 (推荐)
**Notes:** Detector receives candidates with submission context, should propagate directly.

---

## Dead Code Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 全部删除 (推荐) | 删除 run_analysis + ProjectState + 3个未使用的 JSON-RPC 方法 | ✓ |
| 只删 Rust 内部 | 只删 run_analysis 和 ProjectState，保留 JSON-RPC 方法以防将来需要 | |
| 删除但留注释 | 删除但在 main.rs 保留方法签名注释，记录为什么移除 | |

**User's choice:** 全部删除 (推荐)
**Notes:** Remove run_analysis, ProjectState, risk.createProject, risk.cancelProject, risk.getProject.

---

## table_location Completeness

| Option | Description | Selected |
|--------|-------------|----------|
| 完整实现 (推荐) | 从 AST 的 table block 中提取 table_index 和行列范围，填充到 ReviewNode | ✓ |
| 最小实现 | 只接线 table_index，行/列范围留空 | |
| 延后 | 保持 None，V0.3.1 再做 | |

**User's choice:** 完整实现 (推荐)
**Notes:** Extract table_index, start_row, end_row, start_col, end_col from AST table block.

---

## Claude's Discretion

No areas deferred to Claude — all decisions were made by user.

## Deferred Ideas

None — all discussion stayed within Phase 1 scope.
