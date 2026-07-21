# BidLens VNext UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 BidLens Renderer 从双文档比对主界面演进为以多投标文件雷同性风险审查为默认入口的数据密集型桌面工作台，同时保留版本差异辅助模式。

**Architecture:** 保持 React Renderer、Electron Main、Shared 契约和 Rust Engine 的现有边界。UI 通过 `@bidlens/shared/types-only` 消费项目级只读视图模型，使用 Zustand 保存本地交互状态，使用 TanStack Query 管理 IPC 异步状态；风险概览、矩阵、发现项和证据复核由独立 Feature 模块组成。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS 4、shadcn/ui、Radix UI、Lucide、Zustand、TanStack Query、TanStack Virtual、react-resizable-panels、Vitest、Testing Library、Playwright。

---

## 1. 权威文档

- 产品规格：`docs/superpowers/specs/2026-07-20-bidlens-similarity-risk-product-design.md`
- UI 契约：`apps/desktop/UI-SPEC.md`
- 待修订迁移设计：`docs/superpowers/specs/2026-07-19-shadcn-migration-design.md`
- Renderer 约束：`apps/desktop/AGENT.md`
- 架构约束：`docs/architecture.md`

实现与本计划冲突时，先修订计划或 UI 契约，不得在代码中形成未记录的第三种设计。

## 2. 范围和外部前置条件

### 2.1 本计划负责

- shadcn 基础令牌与组件；
- 应用壳层和双模式导航；
- 项目列表、新建项目和项目处理；
- 风险概览、关系矩阵、风险发现和证据复核；
- 版本差异辅助模式迁移；
- UI 状态、响应式、可访问性、视觉回归和性能测试；
- UI 相关文档同步。

### 2.2 本计划不负责

- Rust 检测器、Embedding、召回、风险规则实现；
- Shared 项目领域契约的业务定义；
- SQLite Schema、迁移和加密存储实现；
- Electron Main 项目编排与报告生成；
- 图片/OCR、设备指纹、经济标和 LLM 对话功能。

### 2.3 必须冻结的外部契约

Phase 2 开始前必须存在并通过类型检查：

- `AnalysisProjectSummary`；
- `AnalysisProjectDetail`；
- `SubmissionSummary`；
- `AnalysisProgress`；
- `RiskFinding`；
- `Evidence`；
- `RiskAssessment`；
- 项目列表、新建、验证、启动、取消、恢复、结果、审阅和导出 IPC。

在契约冻结前，UI 组件只允许使用 `src/renderer/__fixtures__/risk-project.ts` 中的固定类型化夹具；生产代码不得创建 `any`、本地重复接口或可达 Mock IPC。

## 3. 任务规则

- 每项任务包含失败测试、最小实现、Focused Test、Type Check 和独立提交；
- Renderer 新增共享导入必须来自 `@bidlens/shared/types-only`；
- 页面组件只编排，不承载检测、风险计算或持久化逻辑；
- 复杂表面拆为 Feature 组件，单文件超过约 300 行时优先按职责拆分；
- 所有 UI 状态必须覆盖 Loading、Empty、Error 和业务特定降级状态；
- 不允许用颜色作为风险、任务或检测类型的唯一表达；
- 不允许迁移任务顺带重构无关 Main、Rust 或数据库代码；
- 每阶段完成后更新 `apps/desktop/UI-SPEC.md` 和迁移设计中的实际偏差；
- 现有工作区用户改动不得被恢复或纳入任务提交。

## 4. 交付依赖图

```text
Phase 0: 契约、基线和迁移设计
    |
    v
Phase 1: 设计系统、通用组件和 App Shell
    |
    +-------------------+
    v                   v
Phase 2: 项目主链     Phase 3: 结果基础表面
    |                   |
    +---------+---------+
              v
Phase 4: 证据复核与辅助模式
              |
              v
Phase 5: 响应式、可访问性、性能和 E2E
```

Phase 2 与 Phase 3 可在 Shared 只读契约冻结后并行。Phase 4 必须等待 RiskFinding、Evidence 和审阅 IPC 稳定。

## 5. Phase 0 - 契约、基线和迁移设计

**目标：** 在修改生产组件前建立可复核基线，并把旧 shadcn 迁移规格对齐新产品模式。

| ID | Pri | Task | Files | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| UI-000 | P0 | 记录当前 Renderer 构建、测试、主题和关键页面截图基线 | Create `docs/reports/vnext-ui-baseline.md`; Create `.artifacts/ui-baseline/1024x700.png`, `1280x800.png`, `1440x900.png`, `1920x1080.png` | - | 1d | 报告记录命令、SHA、视口、已知失败和截图路径 |
| UI-001 | P0 | 重写 shadcn 迁移规格的范围、组件、依赖、阶段和验收 | Modify `docs/superpowers/specs/2026-07-19-shadcn-migration-design.md` | UI-000 | 1d | 默认主模式、风险令牌、数据表面和正确 Resizable 依赖全部写入 |
| UI-002 | P0 | 建立项目 UI 类型夹具和 Scenario Builder | Create `apps/desktop/src/renderer/__fixtures__/risk-project.ts`; Create `apps/desktop/src/renderer/__fixtures__/risk-project.test.ts` | Shared 类型草案 | 1d | Ready、No baseline、Degraded、Partial、Interrupted、Empty 场景均可重复生成 |
| UI-003 | P0 | 增加 UI 契约静态检查清单 | Create `docs/reports/vnext-ui-contract-checklist.md` | UI-001 | 0.5d | UI-SPEC 每个页面、状态和视口映射到后续任务 ID |

### Phase 0 执行步骤

- [ ] 运行 `pnpm --filter @bidlens/desktop lint`，记录退出码和错误摘要。
- [ ] 运行 `pnpm --filter @bidlens/desktop exec vitest run`，记录通过/失败数量。
- [ ] 运行 `pnpm --filter @bidlens/desktop build`，记录 Renderer 与 Main 构建状态。
- [ ] 在 1024x700、1280x800、1440x900 和 1920x1080 捕获当前页面基线。
- [ ] 修订 shadcn 迁移规格，删除不存在的 `@radix-ui/react-resizable-panels`，保留 `react-resizable-panels`。
- [ ] 创建类型化场景夹具，不接入生产 IPC。
- [ ] 运行 `git diff --check`。
- [ ] 提交 `docs(ui): align vnext UI migration contracts`。

### Phase 0 Exit Gate

- 当前基线可复现；
- shadcn 迁移规格不再以双文档流程为默认主链；
- 项目级 UI 夹具不包含 `any` 和随机 ID；
- 每个 UI-SPEC 要求有任务归属。

## 6. Phase 1 - 设计系统、组件和 App Shell

**目标：** 建立只包含一套语义令牌和一套基础组件的稳定 UI 底座。

| ID | Pri | Task | Files | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| UI-100 | P0 | 初始化并校正 shadcn/Tailwind 4 配置 | Create `apps/desktop/components.json`; Modify `apps/desktop/src/renderer/styles/globals.css`; Modify `apps/desktop/src/renderer/lib/utils.ts` | UI-001 | 1d | `base: './'`、5173 strictPort 和 Renderer types-only 约束不变 |
| UI-101 | P0 | 实现基础、风险、检测器、运行状态和 Diff 令牌 | Modify `apps/desktop/src/renderer/styles/globals.css`; Create `apps/desktop/src/renderer/lib/semantic-state.ts`; Create `apps/desktop/src/renderer/lib/semantic-state.test.ts` | UI-100 | 1.5d | Light/Dark/Forced Colors 下所有语义同时有图标、文字和颜色 |
| UI-102 | P0 | 迁移 Button、Badge、Tooltip、Tabs、Dialog、Dropdown、Progress、ScrollArea、Separator、Skeleton | Modify `apps/desktop/src/renderer/components/ui/button.tsx`, `badge.tsx`, `tooltip.tsx`, `tabs.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `progress.tsx`, `scroll-area.tsx`, `separator.tsx`; Create `apps/desktop/src/renderer/components/ui/skeleton.tsx`; Modify `apps/desktop/src/renderer/components/ui/index.ts`; Create `apps/desktop/src/renderer/components/ui/primitives.test.tsx` | UI-100, UI-101 | 3d | 无第二套平行原语，键盘和焦点测试通过 |
| UI-103 | P0 | 实现 FormMessage、Alert、AlertDialog、Sheet、Popover、Checkbox、RadioGroup、Select、Collapsible、Pagination、Table | Create `apps/desktop/src/renderer/components/ui/form-message.tsx`, `alert.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `popover.tsx`, `checkbox.tsx`, `radio-group.tsx`, `select.tsx`, `collapsible.tsx`, `pagination.tsx`, `table.tsx`; Modify `apps/desktop/src/renderer/components/feedback/field-error.tsx` and `index.ts`; Create `apps/desktop/src/renderer/components/ui/forms-overlays.test.tsx` | UI-102 | 3d | `FieldError` 能力由 FormMessage 等价接管，错误仍可播报 |
| UI-104 | P0 | 实现 StatusBadge、PersistentBanner、PageState 和 LoadingButton 业务组合 | Create `apps/desktop/src/renderer/components/feedback/status-badge.tsx`, `persistent-banner.tsx`, `page-state.tsx`, `loading-button.tsx`, `status-feedback.test.tsx`; Modify `apps/desktop/src/renderer/components/feedback/index.ts` | UI-101-UI-103 | 2d | Degraded、No baseline、Partial、Interrupted 状态可独立渲染 |
| UI-105 | P0 | 重构顶栏和双模式 App Shell | Modify `apps/desktop/src/renderer/components/layout/top-bar.tsx`, `top-bar.test.tsx`, `apps/desktop/src/renderer/app/App.tsx`; Create `apps/desktop/src/renderer/components/layout/app-shell.tsx`, `app-shell.test.tsx` | UI-102, UI-104 | 2.5d | 默认进入项目模式，辅助模式可达，窗口命令始终可见 |
| UI-106 | P1 | 建立主题、覆盖层、Toast 和焦点恢复回归测试 | Modify `apps/desktop/src/renderer/lib/theme.ts`, `theme.test.ts`, `apps/desktop/src/renderer/accessibility.test.tsx`; Create `apps/desktop/src/renderer/components/ui/overlays.test.tsx` | UI-102-UI-105 | 1.5d | 无主题闪烁，覆盖层关闭恢复焦点，Toast 不承担持续警告 |

### Phase 1 Focused Commands

```powershell
pnpm --filter @bidlens/desktop exec vitest run src/renderer/components src/renderer/lib/theme.test.ts
pnpm --filter @bidlens/desktop lint
pnpm --filter @bidlens/desktop build
```

Expected：所有命令退出码为 0；Vite 输出不包含 Node externalization 警告。

### Phase 1 Exit Gate

- 新组件只使用 shadcn 语义令牌；
- 风险、检测器、任务和 Diff 语义互不混用；
- `react-resizable-panels` 保留且可构建；
- App Shell 默认项目模式，辅助模式可通过键盘到达；
- Light、Dark、Forced Colors 和 Reduced Motion 基础测试通过。

## 7. Phase 2 - 项目主链

**目标：** 交付从项目列表到新建、处理、取消和恢复的可运行主流程。

| ID | Pri | Task | Files | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| UI-200 | P0 | 建立项目 Query、Store 和页面路由状态 | Create `apps/desktop/src/renderer/features/projects/project-queries.ts`, `project-queries.test.ts`, `project-store.ts`, `project-store.test.ts`; Modify `apps/desktop/src/renderer/stores/app-store.ts`, `app-store.test.ts` | Shared 项目 IPC, UI-105 | 2d | Query 管服务状态，Store 只管选择、筛选和本地视图状态 |
| UI-201 | P0 | 实现项目列表 DataTable | Create `apps/desktop/src/renderer/features/projects/project-list-page.tsx`, `project-table.tsx`, `project-list-page.test.tsx`, `project-table.test.tsx` | UI-103, UI-104, UI-200 | 3d | 搜索、风险/状态筛选、排序、分页和行菜单工作 |
| UI-202 | P0 | 实现项目列表 Loading、Empty、Error、Partial、Interrupted 状态 | Modify `apps/desktop/src/renderer/features/projects/project-list-page.tsx`, `project-table.tsx`, `project-list-page.test.tsx`, `project-table.test.tsx` | UI-201 | 1.5d | Partial 不显示低风险，Interrupted 提供恢复命令 |
| UI-203 | P0 | 实现新建项目表单和招标基线槽 | Create `apps/desktop/src/renderer/features/projects/new-project-page.tsx`, `project-name-field.tsx`, `tender-baseline-slot.tsx`, `new-project-page.test.tsx` | UI-103, Shared validation IPC | 2.5d | 基线明确可选，无基线警告与字段错误可播报 |
| UI-204 | P0 | 实现 2-8 文件 SubmissionFileList、拖拽和容量摘要 | Create `apps/desktop/src/renderer/features/projects/submission-file-list.tsx`, `capacity-summary.tsx`, `submission-file-list.test.tsx` | UI-203 | 3d | 重复 Hash、数量、格式、页数和累计容量错误阻止开始 |
| UI-205 | P0 | 实现严格/标准/宽松预设和启动确认 | Create `apps/desktop/src/renderer/features/projects/detection-preset.tsx`, `detection-preset.test.tsx`; Modify `apps/desktop/src/renderer/features/projects/new-project-page.tsx`, `new-project-page.test.tsx` | UI-203, UI-204 | 1.5d | 默认标准，strict > standard > loose 语义有明确说明 |
| UI-206 | P0 | 实现项目处理页和真实阶段列表 | Create `apps/desktop/src/renderer/features/projects/project-processing-page.tsx`, `analysis-stage-list.tsx`, `submission-progress-table.tsx`, `project-processing-page.test.tsx` | Shared progress IPC, UI-104, UI-200 | 3d | 九阶段、文件级状态、耗时和警告来自真实事件 |
| UI-207 | P0 | 实现模型缺失、降级、取消、错误和恢复交互 | Create `apps/desktop/src/renderer/features/projects/analysis-recovery-actions.tsx`, `analysis-recovery-actions.test.tsx`; Modify `apps/desktop/src/renderer/features/projects/project-processing-page.tsx`, `project-processing-page.test.tsx` | UI-206 | 2.5d | 无静默降级，取消无报告，错误均提供下一步 |

### Phase 2 Integration Commands

```powershell
pnpm --filter @bidlens/desktop exec vitest run src/renderer/features/projects
pnpm test:integration
pnpm --filter @bidlens/desktop lint
```

Expected：所有命令退出码为 0；生产页面不引用风险项目测试夹具。

### Phase 2 Exit Gate

- 默认首页可创建并启动一个 2-8 文件项目；
- 无基线、重复文件、超限和模型缺失均有明确交互；
- 处理页只显示真实进度；
- 取消、失败和恢复不会丢失项目输入；
- 项目历史中可区分 Ready、Partial、Interrupted 和 Failed。

## 8. Phase 3 - 结果基础表面

**目标：** 交付项目风险概览、关系矩阵和风险发现项的完整浏览与筛选能力。

| ID | Pri | Task | Files | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| UI-300 | P0 | 建立项目结果 Query、Store、稳定选择和派生计数 | Create `apps/desktop/src/renderer/features/risk-review/risk-result-queries.ts`, `risk-result-queries.test.ts`, `risk-review-store.ts`, `risk-review-store.test.ts` | Shared result IPC, UI-200 | 2.5d | 原始发现、人工确认和过滤计数分离且确定 |
| UI-301 | P0 | 实现项目结果壳层和持久状态 Banner | Create `apps/desktop/src/renderer/features/risk-review/risk-result-page.tsx`, `risk-result-toolbar.tsx`, `risk-result-page.test.tsx` | UI-104, UI-300 | 2d | 四个一级 Tab 可达，状态 Banner 在全部 Tab 持续可见 |
| UI-302 | P0 | 实现风险概览 | Create `apps/desktop/src/renderer/features/risk-review/risk-overview.tsx`, `detector-summary.tsx`, `top-findings.tsx`, `risk-overview.test.tsx` | UI-301 | 2.5d | 30 秒扫描信息完整，不显示串标概率 |
| UI-303 | P0 | 实现可访问的 8x8 RelationshipMatrix | Create `apps/desktop/src/renderer/features/risk-review/relationship-matrix.tsx`, `relationship-matrix.test.tsx` | UI-101, UI-301 | 3.5d | Grid 键盘、对角线、方向覆盖率 Tooltip、横向滚动通过 |
| UI-304 | P0 | 实现文件对摘要和矩阵到发现项导航 | Create `apps/desktop/src/renderer/features/risk-review/file-pair-summary.tsx`, `file-pair-summary.test.tsx`; Modify `apps/desktop/src/renderer/features/risk-review/relationship-matrix.tsx`, `relationship-matrix.test.tsx`, `risk-review-store.ts`, `risk-review-store.test.ts` | UI-303 | 1.5d | Enter/点击同一单元格产生相同文件对筛选 |
| UI-305 | P0 | 实现 RiskFinding 过滤模型和工具栏 | Create `apps/desktop/src/renderer/features/risk-review/finding-filters.ts`, `finding-filters.test.ts`, `finding-filter-toolbar.tsx`, `finding-filter-toolbar.test.tsx` | UI-300 | 2d | 风险、检测器、文件、审阅、重要、关键词、过滤状态可组合 |
| UI-306 | P0 | 实现 FindingVirtualList、稳定选择和空筛选状态 | Create `apps/desktop/src/renderer/features/risk-review/finding-virtual-list.tsx`, `finding-row.tsx`, `finding-virtual-list.test.tsx` | UI-305 | 3d | 1000+ 项滚动、筛选、键盘选择和 aria 数量正确 |
| UI-307 | P1 | 实现批量人工裁决工具栏 | Create `apps/desktop/src/renderer/features/risk-review/bulk-review-bar.tsx`, `bulk-review-bar.test.tsx`; Modify `apps/desktop/src/renderer/features/risk-review/finding-virtual-list.tsx`, `finding-virtual-list.test.tsx` | Review IPC, UI-306 | 2d | 批量状态不修改算法分数，失败不显示成功 |

### Phase 3 Focused Commands

```powershell
pnpm --filter @bidlens/desktop exec vitest run src/renderer/features/risk-review
pnpm --filter @bidlens/desktop lint
pnpm --filter @bidlens/desktop build
```

Expected：所有命令退出码为 0；1000 项测试在 CI 超时内完成。

### Phase 3 Exit Gate

- 项目风险、检测器摘要、关系矩阵和发现项互相导航；
- Partial 结果始终显示“不完整”；
- 原始发现数和人工确认数不混淆；
- 1000+ 项筛选和键盘操作稳定；
- 矩阵在 760px 等效视口只在自身容器滚动。

## 9. Phase 4 - 证据复核、辅助模式和导出

**目标：** 复用现有三栏工作台完成 RiskFinding 到 Evidence 的人工闭环，并保留双文档辅助模式。

| ID | Pri | Task | Files | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| UI-400 | P0 | 将 WorkbenchLayout 抽象为风险和 Diff 可共享布局 | Modify `apps/desktop/src/renderer/features/review/workbench-layout.tsx`, `workbench-layout.test.tsx`; Create `apps/desktop/src/renderer/features/review/review-mode.ts`, `review-mode.test.ts` | UI-102, UI-301 | 2.5d | 两种模式通过显式 mode 配置，不在组件内猜业务类型 |
| UI-401 | P0 | 将左栏适配 RiskFinding Navigation | Create `apps/desktop/src/renderer/features/risk-review/risk-finding-nav.tsx`, `risk-finding-nav.test.tsx`; Reuse `apps/desktop/src/renderer/features/risk-review/finding-virtual-list.tsx` | UI-306, UI-400 | 2d | 过滤、选择、重要和审阅状态与结果列表一致 |
| UI-402 | P0 | 实现双文档 Evidence Viewport | Create `apps/desktop/src/renderer/features/risk-review/evidence-viewport.tsx`, `evidence-paragraph-view.tsx`, `evidence-table-view.tsx`, `evidence-viewport.test.tsx` | Shared Evidence contract, UI-400 | 4d | AST 定位、方向覆盖率、文本和表格证据可追溯 |
| UI-403 | P0 | 实现 Evidence Details 和人工复核 | Create `apps/desktop/src/renderer/features/risk-review/evidence-detail-tabs.tsx`, `evidence-review-controls.tsx`, `evidence-detail-tabs.test.tsx`, `evidence-review-controls.test.tsx` | Review IPC, UI-402 | 3d | 匹配依据、位置、基线过滤和人工状态清楚分离 |
| UI-404 | P0 | 将格式/批注/修订 Tabs 限定到版本差异模式 | Modify `apps/desktop/src/renderer/features/review/detail-tabs.tsx`, `detail-tabs.test.tsx`, `review-workbench.tsx`; Create `apps/desktop/src/renderer/features/review/review-workbench.test.tsx` | UI-400, UI-403 | 1.5d | 风险模式不显示无关 Diff 维度，辅助模式无回归 |
| UI-405 | P0 | 迁移版本差异新建、处理、历史和工作台到统一组件 | Modify `apps/desktop/src/renderer/features/compare/new-compare-view.tsx`, `new-compare-view.test.tsx`, `processing-view.tsx`, `ReviewWorkbench.tsx`, `ReviewWorkbench.test.tsx`, `apps/desktop/src/renderer/features/history/history-view.tsx`, `history-view.test.tsx` | UI-102-UI-105, UI-404 | 4d | 辅助模式功能、过滤、标注和导出保持可用 |
| UI-406 | P1 | 扩展设置中的模型和缓存状态 | Modify `apps/desktop/src/renderer/features/settings/settings-dialog.tsx`; Create `apps/desktop/src/renderer/features/settings/settings-dialog.test.tsx` | Model settings IPC, UI-103 | 2d | 只显示本地模型、校验、替换、删除和缓存清理 |
| UI-407 | P0 | 实现 PDF/HTML/Markdown 项目报告导出 Dialog | Modify `apps/desktop/src/renderer/features/review/export-dialog.tsx`; Create `apps/desktop/src/renderer/features/review/export-dialog.test.tsx`, `apps/desktop/src/renderer/features/risk-review/risk-export-dialog.tsx`, `risk-export-dialog.test.tsx` | Export IPC, UI-301 | 2.5d | 默认 PDF，范围正确，Partial/Degraded 警告不可移除 |

### Phase 4 Exit Gate

- RiskFinding 可进入两两 Evidence 并完成审阅；
- 风险模式与版本差异模式共享布局但不混用业务 Tabs；
- 注释保存失败有重试且不产生假成功；
- PDF、HTML、Markdown 导出范围和状态警告正确；
- 原版本差异关键路径回归通过。

## 10. Phase 5 - 响应式、可访问性、性能和 E2E

**目标：** 在支持的 Windows 视口和输入规模下证明主流程可用、稳定且可访问。

| ID | Pri | Task | Files | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| UI-500 | P0 | 完成 1920/1440/1280/1024/760 等效视口响应式规则 | Modify `apps/desktop/src/renderer/styles/globals.css`, `apps/desktop/src/renderer/components/layout/app-shell.tsx`, `apps/desktop/src/renderer/features/projects/project-table.tsx`, `apps/desktop/src/renderer/features/risk-review/relationship-matrix.tsx`, `apps/desktop/src/renderer/features/review/workbench-layout.tsx`; Create `apps/desktop/src/renderer/responsive.test.tsx` | UI-200-UI-407 | 3d | Shell 无横向滚动，表格/矩阵拥有自身滚动，详情正确 Sheet 化 |
| UI-501 | P0 | 完成键盘、ARIA、焦点、Live Region 和 Forced Colors 审计 | Modify `apps/desktop/src/renderer/accessibility.test.tsx`, `apps/desktop/src/renderer/components/layout/app-shell.tsx`, `apps/desktop/src/renderer/features/projects/project-table.tsx`, `apps/desktop/src/renderer/features/projects/new-project-page.tsx`, `apps/desktop/src/renderer/features/risk-review/relationship-matrix.tsx`, `apps/desktop/src/renderer/features/risk-review/finding-virtual-list.tsx`, `apps/desktop/src/renderer/features/risk-review/evidence-detail-tabs.tsx`, `apps/desktop/src/renderer/styles/globals.css` | UI-500 | 3d | 主流程不使用鼠标可完成，颜色非唯一编码 |
| UI-502 | P0 | 优化 1000+ Finding、日志和状态更新渲染 | Modify `apps/desktop/src/renderer/features/risk-review/finding-virtual-list.tsx`, `apps/desktop/src/renderer/features/risk-review/finding-filters.ts`, `apps/desktop/src/renderer/features/risk-review/risk-review-store.ts`, `apps/desktop/src/renderer/features/projects/project-store.ts`, `apps/desktop/src/renderer/features/projects/project-processing-page.tsx`; Create `apps/desktop/src/renderer/features/risk-review/risk-review-performance.test.tsx`, `apps/desktop/src/renderer/features/projects/project-processing-performance.test.tsx` | UI-306, UI-402 | 2.5d | 滚动和筛选无明显阻塞，日志更新不重渲染整个页面 |
| UI-503 | P0 | 建立 Playwright 视觉矩阵 | Modify `apps/desktop/package.json`; Create `apps/desktop/playwright.config.ts`, `tests/e2e/vnext-ui-visual.spec.ts`, `tests/e2e/__screenshots__/vnext-ui-visual/README.md`; Update `pnpm-lock.yaml` | UI-500, UI-501 | 3d | Light/Dark 和关键异常状态覆盖全部目标视口，首次运行生成平台基线 PNG |
| UI-504 | P0 | 建立雷同性 UI E2E 主路径 | Create `tests/e2e/similarity-risk-review.spec.ts`, `tests/e2e/fixtures/similarity-risk-project.ts` | 真实 IPC 主链, UI-407 | 4d | 新建、处理、取消、恢复、矩阵、筛选、审阅、历史、导出通过 |
| UI-505 | P0 | 建立版本差异辅助模式 E2E 回归 | Create `tests/e2e/version-diff-regression.spec.ts` | UI-405 | 2d | 双文件选择、处理、审阅和导出通过 |
| UI-506 | P1 | 同步 UI、架构、API 和路线图文档 | Modify `apps/desktop/UI-SPEC.md`, `apps/desktop/AGENT.md`, `docs/architecture.md`, `docs/api/ipc.md`, `docs/api/types.md`, `docs/roadmap.md` | UI-503-UI-505 | 1.5d | 文档不再把旧模式描述为默认主产品 |

### Phase 5 Verification Commands

```powershell
pnpm --filter @bidlens/desktop exec vitest run
pnpm test:integration
pnpm test:e2e
pnpm --filter @bidlens/desktop lint
pnpm --filter @bidlens/desktop build
git diff --check
```

Expected：所有命令退出码为 0；Playwright 截图无重叠、空白 Canvas、截断按钮或 Shell 横向滚动。

### Phase 5 Exit Gate

- UI-SPEC 第 15 节全部通过；
- 2-8 文件主流程可在生产 IPC 上完成；
- Partial/Degraded/No baseline/Interrupted 状态端到端持续可见；
- 1000+ RiskFinding 可用；
- 全键盘流程、Forced Colors 和 Reduced Motion 通过；
- 版本差异辅助模式无 P0/P1 回归。

## 11. 建议 PR 切片

| PR | Content | Tasks |
|---|---|---|
| UI-PR-01 | 基线、迁移规格和场景夹具 | UI-000-UI-003 |
| UI-PR-02 | shadcn 配置、令牌和基础原语 | UI-100-UI-103 |
| UI-PR-03 | 反馈组件、App Shell 和主题回归 | UI-104-UI-106 |
| UI-PR-04 | 项目 Query、列表和状态 | UI-200-UI-202 |
| UI-PR-05 | 新建项目、多文件和预设 | UI-203-UI-205 |
| UI-PR-06 | 项目处理、取消和恢复 | UI-206-UI-207 |
| UI-PR-07 | 结果壳层、概览和矩阵 | UI-300-UI-304 |
| UI-PR-08 | 发现项筛选、虚拟列表和批量审阅 | UI-305-UI-307 |
| UI-PR-09 | 共享工作台和 Evidence Viewport | UI-400-UI-403 |
| UI-PR-10 | 辅助模式、设置和导出 | UI-404-UI-407 |
| UI-PR-11 | 响应式、可访问性和性能 | UI-500-UI-502 |
| UI-PR-12 | Playwright、E2E 和文档闭环 | UI-503-UI-506 |

## 12. 估算汇总

| Phase | Estimate |
|---|---:|
| Phase 0 | 3.5 engineer-days |
| Phase 1 | 13 engineer-days |
| Phase 2 | 16 engineer-days |
| Phase 3 | 17 engineer-days |
| Phase 4 | 19.5 engineer-days |
| Phase 5 | 19 engineer-days |
| **Total** | **88 engineer-days** |

估算不包含 Shared/Rust/DB/Main 项目主链、金标标注和报告生成器工作。Phase 2、Phase 3 的日历时间可在契约冻结后通过独立所有权并行缩短；Phase 4 和 Phase 5 是依赖收敛阶段。

## 13. 风险登记

| Risk | Impact | Early task | Mitigation |
|---|---|---|---|
| Shared 项目契约未冻结 | UI 重复返工 | UI-002 | 夹具与生产 IPC 隔离，Phase 2 前冻结 types-only |
| shadcn 令牌迁移改变现有 Diff 语义 | 辅助模式视觉回归 | UI-101 | 风险与 Diff 独立令牌，截图对照 |
| 多文件列表错误状态过密 | 新建项目难以扫描 | UI-204 | 行内错误 + 汇总 Alert + 稳定列宽 |
| Matrix 仅靠颜色表达 | 可访问性和误判风险 | UI-303 | 数值、标签、图标、Grid 键盘并用 |
| 1000+ Finding 导致主线程阻塞 | 审阅不可用 | UI-306, UI-502 | Virtual、memoized selectors、性能门槛 |
| 三栏工作台同时服务两种模式后职责纠缠 | 难测试和高回归 | UI-400 | 显式 ReviewMode 和独立业务适配器 |
| Partial 结果被误显示为低风险 | 严重业务误导 | UI-104, UI-301 | 状态组合测试和 E2E 阻断门槛 |
| 1024/760 高缩放产生 Shell 横向滚动 | 核心控件不可达 | UI-500 | 表面自有滚动、Sheet 化和截图检查 |

## 14. 完成清单

- [ ] UI-SPEC 页面和状态全部映射到任务。
- [ ] shadcn 迁移规格已按新主模式重写。
- [ ] 所有 Renderer 共享导入来自 `@bidlens/shared/types-only`。
- [ ] 项目主链不使用可达 Mock 数据。
- [ ] 风险、检测器、任务和 Diff 令牌互不混用。
- [ ] Partial 结果不会显示正常低风险。
- [ ] 全部目标视口截图通过。
- [ ] 主模式和辅助模式 E2E 通过。
- [ ] 文档、实现和测试描述一致。
