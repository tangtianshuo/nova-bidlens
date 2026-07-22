# Phase 2: Integration Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-07-22
**Phase:** 02-Integration Hardening
**Areas discussed:** Renderer identity, Checkpoint resume, detectorProgress, Hook/logging

---

## Renderer Identity Unification

| Option | Description | Selected |
|--------|-------------|----------|
| 单一 store 为源头 (推荐) | 删除 useProjectStore 和 useAppStore 中的 projectId/taskId，全部用 useRiskReviewStore.projectId | ✓ |
| 保留但同步 | 保留三个 store 但确保所有导航路径都同步更新 | |
| 包装 hook | 创建新的 useCurrentProject hook 包装三个 store 的读写 | |

**User's choice:** 单一 store 为源头 (推荐)

---

## Checkpoint Resume

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过已完成 (推荐) | 检查 completedDetectors，只运行未完成的检测器。节省时间。 | ✓ |
| 全部重跑 | 2-8 个文件，重跑开销不大，保持简单 | |

**User's choice:** 跳过已完成 (推荐)

---

## Detector Progress Channel

| Option | Description | Selected |
|--------|-------------|----------|
| 删除 (推荐) | 删除 preload 中的死代码，简化 IPC 接口 | ✓ |
| 实现它 | 实现每个检测器的独立进度推送（更细粒度） | |

**User's choice:** 删除 (推荐)

---

## Hook and Logging Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| 全部清理 (推荐) | 删除 console.log 存根，修复 hook 排序 | ✓ |
| 只清日志 | 只删除 console.log，hook 排序问题不紧急 | |

**User's choice:** 全部清理 (推荐)

---

## Claude's Discretion

No areas deferred to Claude.

## Deferred Ideas

None.
