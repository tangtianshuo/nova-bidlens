# Quick Task 260723-tfs: 项目列表增加重新对比功能

## Goal
在项目列表（risk-review）的每行操作菜单中，"查看详情"下方增加"重新对比"按钮。点击后弹出 confirm 对话框告知风险，确认后重新执行分析。

## Tasks

### Task 1: Backend — 添加 `risk:reanalyzeProject` IPC
- **Files:** `apps/desktop/src/main/services/risk-review-service.ts`, `apps/desktop/src/main/ipc/risk-review-handlers.ts`
- **Action:** 在 RiskReviewService 中添加 `reanalyzeProject(projectId)` 方法：
  - 从 audit event 重建 `CreateRiskProjectRequest`
  - 清除旧的 findings、evidence、detector runs、file pair assessments、checkpoints
  - 重置 project status 为 `draft`
  - 调用 `this.run()` 重新执行分析
- 在 handlers 中注册 `risk:reanalyzeProject` IPC channel

### Task 2: Frontend — 项目列表 UI 增加重新对比
- **Files:** `apps/desktop/src/renderer/features/projects/project-table.tsx`, `apps/desktop/src/renderer/features/projects/project-list-page.tsx`
- **Action:**
  - `ProjectTableProps` 增加 `onReanalyze` 回调
  - `ProjectRow` 下拉菜单中"查看详情"下方添加"重新对比"菜单项（RefreshCw 图标）
  - 仅在 `status === 'ready' || status === 'partial' || status === 'failed'` 时显示
  - 点击时调用 `onReanalyze(project.id)`
  - `ProjectListPage` 中添加 `handleReanalyze`：弹出 `window.confirm()` 警告，确认后调用 `window.bidlens.reanalyzeProject(id)`

### Task 3: Preload bridge — 暴露 reanalyzeProject
- **Files:** `apps/desktop/src/preload/index.ts`, `packages/shared/src/ipc.ts`
- **Action:** 在 `BidLensApi` 接口添加 `reanalyzeProject(projectId: string)` 方法，preload 中桥接 IPC 调用

## Verification
- 项目列表中已完成/失败项目显示"重新对比"菜单项
- 点击后弹出 confirm 对话框
- 确认后项目状态变为 running，分析重新执行
