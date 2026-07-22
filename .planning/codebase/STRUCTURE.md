# 代码库结构

**分析日期：** 2026-07-22

## 目录布局

```
nova-bidlens/
├── apps/
│   └── desktop/               # Electron 应用（React + Vite 渲染器，TS 主进程）
│       ├── src/
│       │   ├── main/          # 主进程（Node.js，CommonJS）
│       │   ├── preload/       # IPC 桥接（单文件）
│       │   └── renderer/      # 渲染器进程（Vite + React）
│       ├── build/             # Electron builder 资源（图标）
│       ├── scripts/           # 构建辅助脚本
│       └── tests/             # E2E 测试（Playwright）
├── packages/
│   └── shared/                # 共享 TypeScript 库（类型、解析器、IPC 契约）
│       └── src/
├── bidlens-engine/            # Rust 工作区（文档解析和差异引擎）
│   ├── src/                   # 根 crate（main.rs、risk_engine.rs、task_service.rs）
│   └── crates/
│       ├── common/            # 共享错误类型
│       ├── document-ast/      # AST 数据结构
│       ├── diff-engine/       # 语义差异算法
│       ├── table-diff/        # 表格级差异
│       └── review-core/       # 风险检测（text、table、entity、fact 检测器）
├── docs/                      # 文档（架构、API、产品）
├── tests/                     # 根级测试套件（integration、e2e、benchmark、v03）
├── scripts/                   # 根级脚本（v03 模型可行性）
├── demo/                      # 演示/原型素材
├── package.json               # 根工作区 package.json
├── pnpm-workspace.yaml        # pnpm 工作区配置
├── CLAUDE.md                  # AI 助手项目指引
└── AGENTS.md                  # 多智能体协调文档
```

## 目录职责

**`apps/desktop/src/main/`：**
- 职责：Electron 主进程 — 业务逻辑、持久化、引擎管理
- 包含：IPC 处理器、服务、数据库层、仓库、worker
- 关键文件：`index.ts`（入口）、`ipc/risk-review-handlers.ts`、`services/risk-review-service.ts`

**`apps/desktop/src/main/ipc/`：**
- 职责：IPC 处理器注册 — 每个领域一个文件
- 包含：`compare-handlers.ts`、`risk-review-handlers.ts`、`history-handlers.ts`、`settings-handlers.ts`、`annotation-handlers.ts`
- 关键文件：每个文件导出一个 `register*Handlers()` 函数，从 `index.ts` 调用

**`apps/desktop/src/main/services/`：**
- 职责：业务逻辑服务
- 包含：`risk-review-service.ts`（49KB，核心 V0.3 逻辑）、`engine-manager.ts`（Rust 引擎生命周期）、`persistence.ts`（门面）、`task-orchestrator.ts`（V0.2 比对流水线）、`parser-service.ts`、`file-validator.ts`、`encryption.ts`、`backup.ts`、`recovery.ts`、`retention.ts`、`report-generator.ts`、`report-exporter.ts`
- 关键文件：`risk-review-service.ts`、`engine-manager.ts`、`persistence.ts`

**`apps/desktop/src/main/db/`：**
- 职责：数据库层 — schema、迁移、加密、仓库
- 包含：`database.ts`（DatabaseManager）、`schema.ts`（表定义）、`migrations.ts`、`repositories.ts`（V0.3 仓库）、`crypto.ts`（AES 加密）、`database-worker.ts`（worker 线程）、`database-worker-client.ts`
- 关键文件：`database.ts`、`repositories.ts`、`schema.ts`

**`apps/desktop/src/main/repositories/`：**
- 职责：V0.2 数据访问对象（遗留，仍被比对流程使用）
- 包含：`task-repository.ts`、`snapshot-repository.ts`、`annotation-repository.ts`

**`apps/desktop/src/main/workers/`：**
- 职责：Worker 线程，用于主进程外的操作
- 包含：`database-worker.ts` — 在独立线程中处理持久化/加载操作

**`apps/desktop/src/preload/`：**
- 职责：渲染器和主进程之间的安全 IPC 桥接
- 包含：单个 `index.ts`，将 `BidLensApi` 接口映射到 `ipcRenderer.invoke()` 调用
- 关键文件：`index.ts`

**`apps/desktop/src/renderer/`：**
- 职责：React UI — 整个前端
- 包含：应用外壳、功能页面、store、组件、样式、worker

**`apps/desktop/src/renderer/app/`：**
- 职责：根应用组件和路由
- 包含：`App.tsx` — 基于 Zustand store 的视图路由、QueryClient provider

**`apps/desktop/src/renderer/features/`：**
- 职责：按功能组织的页面和组件（feature-sliced 设计）
- 包含：`projects/`（V0.3 项目管理）、`risk-review/`（V0.3 结果）、`compare/`（V0.2 比对）、`review/`（V0.2 审查工作台）、`history/`（任务历史）、`settings/`（应用设置）

**`apps/desktop/src/renderer/features/projects/`：**
- 职责：V0.3 项目创建、列表和处理页面
- 包含：`project-list-page.tsx`、`new-project-page.tsx`、`project-processing-page.tsx`、`project-store.ts`、`project-queries.ts`、`project-table.tsx`、`submission-file-list.tsx`、`detection-preset.tsx`、`file-import.tsx`、`tender-baseline-slot.tsx`、`analysis-recovery-actions.tsx`、`stage-labels.ts`

**`apps/desktop/src/renderer/features/risk-review/`：**
- 职责：V0.3 风险审查结果 — 发现项、证据、导出
- 包含：`risk-result-page.tsx`、`risk-review-store.ts`、`risk-result-queries.ts`、`risk-review-mutations.ts`、`finding-virtual-list.tsx`、`finding-filter-toolbar.tsx`、`evidence-viewport.tsx`、`evidence-detail-tabs.tsx`、`evidence-review-controls.tsx`、`relationship-matrix.tsx`、`risk-overview.tsx`、`report-export-panel.tsx`、`risk-export-dialog.tsx`、`risk-result-toolbar.tsx`

**`apps/desktop/src/renderer/stores/`：**
- 职责：全局 Zustand store
- 包含：`app-store.ts`（导航状态机、模式切换）、`result-store.ts`（V0.2 比对结果）

**`apps/desktop/src/renderer/components/`：**
- 职责：共享可复用组件
- 包含：`ui/`（shadcn 风格原语）、`layout/`（AppShell、TopBar）、`feedback/`（ErrorBoundary、加载状态、横幅）

**`apps/desktop/src/renderer/components/ui/`：**
- 职责：设计系统原语（shadcn/ui 模式）
- 包含：`button.tsx`、`dialog.tsx`、`select.tsx`、`tabs.tsx`、`table.tsx`、`badge.tsx`、`input.tsx`、`tooltip.tsx`、`dropdown-menu.tsx`、`alert-dialog.tsx`、`sheet.tsx`、`progress.tsx`、`scroll-area.tsx` 等
- 关键文件：`index.ts`（桶导出）

**`apps/desktop/src/renderer/lib/`：**
- 职责：渲染器工具函数
- 包含：`theme.ts`（深色/浅色模式）、`utils.ts`（类名辅助）、`semantic-state.ts`（语义差异状态）、`progress-subscription.ts`、`project-router.ts`、`query-keys.ts`

**`apps/desktop/src/renderer/styles/`：**
- 职责：全局 CSS
- 包含：`globals.css` — Tailwind 4 导入、主题 CSS 自定义属性

**`packages/shared/src/`：**
- 职责：共享 TypeScript 库 — 类型、IPC 契约、解析器、差异工具
- 包含：`ipc.ts`（BidLensApi 接口）、`risk-review.ts`（V0.3 领域类型）、`compare-task.ts`（V0.2 类型）、`document-ast.ts`、`diff-ast.ts`、`format-diff.ts`、`comment-diff.ts`、`table-diff.ts`、`report.ts`、`report-export.ts`、`errors.ts`、`state-machine.ts`、`field-mapping.ts`、`version.ts`、`types-only.ts`
- 关键文件：`ipc.ts`、`risk-review.ts`、`index.ts`（桶导出）

**`packages/shared/src/parser/`：**
- 职责：文档解析器（DOCX、PDF）
- 包含：`registry.ts`（解析器注册表）、`docx/`（docx4js 解析器）、`pdf/`（pdf-parse 解析器）、`types.ts`、`docx-comments.ts`、`docx-revisions.ts`

**`packages/shared/src/types/`：**
- 职责：额外的共享类型定义

**`bidlens-engine/src/`：**
- 职责：根 Rust crate — 二进制入口和编排
- 包含：`main.rs`（基于 stdio 的 JSON-RPC 服务器）、`risk_engine.rs`（36KB，风险分析流水线）、`task_service.rs`（比对任务执行）

**`bidlens-engine/crates/document-ast/src/`：**
- 职责：已解析文档的 AST 数据结构
- 包含：`lib.rs`（42KB — 段落、章节、列表、表格、批注、修订）

**`bidlens-engine/crates/diff-engine/src/`：**
- 职责：语义差异算法
- 包含：`lib.rs`（差异计算）、`optimized.rs`（性能优化变体）

**`bidlens-engine/crates/table-diff/src/`：**
- 职责：表格级差异（单元格变更、结构变更）
- 包含：`lib.rs`（64KB — 表格比较逻辑）

**`bidlens-engine/crates/review-core/src/`：**
- 职责：V0.3 的风险检测和聚合
- 包含：`lib.rs`（编排）、`aggregation.rs`、`scoring.rs`、`sparse_index.rs`、`tender.rs`、`detectors/`（text、table、entity、fact 检测器）

**`bidlens-engine/crates/review-core/src/detectors/`：**
- 职责：独立的风险检测器
- 包含：`text_detector.rs`、`table_detector.rs`、`entity_detector.rs`、`fact_detector.rs`、`mod.rs`

**`bidlens-engine/crates/common/src/`：**
- 职责：跨 Rust crate 的共享错误类型
- 包含：`error.rs`、`lib.rs`

**`docs/`：**
- 职责：项目文档
- 包含：`architecture.md`、`coding_style.md`、`getting-started.md`、`roadmap.md`、`api/`（IPC、parser、rust、types 文档）、`product/`（PRD）、`v03/`（V0.3 规划文档）、`reports/`

**`tests/`：**
- 职责：根级测试套件
- 包含：`integration/`、`e2e/`、`accessibility/`、`benchmark/`、`v03/`

## 关键文件位置

**入口点：**
- `apps/desktop/src/main/index.ts`：Electron 主进程入口 — 创建窗口、初始化持久化、注册 IPC 处理器
- `apps/desktop/src/renderer/index.html` → `main.tsx`：渲染器入口 — 挂载 React 应用
- `apps/desktop/src/preload/index.ts`：预加载入口 — 暴露 `window.bidlens` API
- `bidlens-engine/src/main.rs`：Rust 引擎入口 — 基于 stdio 的 JSON-RPC 服务器

**配置文件：**
- `package.json`：根工作区配置（脚本、devDependencies）
- `pnpm-workspace.yaml`：工作区包（`apps/*`、`packages/*`）
- `apps/desktop/package.json`：桌面应用配置（dependencies、scripts、Electron builder）
- `apps/desktop/vite.config.ts`：渲染器 Vite 配置（端口 5173、Tailwind、路径别名）
- `apps/desktop/tsconfig.json`：渲染器 TypeScript 配置（ESNext、Bundler resolution）
- `apps/desktop/tsconfig.main.json`：主进程/预加载 TypeScript 配置（CommonJS、Node resolution）
- `apps/desktop/electron-builder.yml`：Electron builder 配置（NSIS、resources、asar）
- `apps/desktop/vitest.config.ts`：桌面测试 Vitest 配置
- `bidlens-engine/Cargo.toml`：Rust 工作区配置

**核心逻辑：**
- `apps/desktop/src/main/services/risk-review-service.ts`：V0.3 风险审查业务逻辑（49KB）
- `apps/desktop/src/main/services/engine-manager.ts`：Rust 引擎生命周期和 JSON-RPC 客户端
- `apps/desktop/src/main/services/task-orchestrator.ts`：V0.2 比对流水线编排
- `apps/desktop/src/main/db/repositories.ts`：V0.3 数据库仓库（30KB）
- `packages/shared/src/risk-review.ts`：V0.3 领域类型（RiskFinding、Evidence 等）
- `packages/shared/src/ipc.ts`：BidLensApi 接口定义
- `bidlens-engine/src/risk_engine.rs`：Rust 风险分析流水线（36KB）

**UI 页面：**
- `apps/desktop/src/renderer/app/App.tsx`：根组件，基于视图的路由
- `apps/desktop/src/renderer/features/projects/project-list-page.tsx`：项目仪表板
- `apps/desktop/src/renderer/features/projects/new-project-page.tsx`：新建项目表单
- `apps/desktop/src/renderer/features/projects/project-processing-page.tsx`：分析进度
- `apps/desktop/src/renderer/features/risk-review/risk-result-page.tsx`：风险审查结果

**测试文件：**
- `apps/desktop/src/main/__tests__/`：主进程单元测试
- `apps/desktop/src/main/services/__tests__/`：服务单元测试
- `apps/desktop/src/main/db/__tests__/`：数据库单元测试
- `apps/desktop/src/renderer/`（共置 `*.test.tsx` 文件）：组件测试
- `apps/desktop/tests/e2e/`：Playwright E2E 测试
- `tests/integration/`：跨包集成测试
- `tests/e2e/`：根级 E2E 测试
- `tests/v03/`：V0.3 指标/门控测试

## 命名约定

**文件命名：**
- TypeScript：kebab-case（`risk-review-service.ts`、`project-list-page.tsx`）
- Rust：snake_case（`risk_engine.rs`、`text_detector.rs`）
- 测试文件：共置为 `*.test.ts` / `*.test.tsx`，或在 `__tests__/` 目录中

**目录命名：**
- 功能目录：kebab-case（`risk-review/`、`project-processing/`）
- 组件：kebab-case（`file-import.tsx`、`finding-filter-toolbar.tsx`）
- Rust crate：目录名用 kebab-case（`diff-engine/`），模块名用 snake_case

**类型/接口：**
- PascalCase（`RiskFinding`、`AnalysisProjectDetail`、`BidLensApi`）
- 枚举使用字符串字面量联合类型（`type RiskLevel = 'high' | 'medium' | 'low'`）

**函数/变量：**
- camelCase（`createProject`、`riskLevel`、`handleSubmit`）

## 新代码添加位置

**新的 V0.3 功能页面：**
- 实现：`apps/desktop/src/renderer/features/risk-review/` 或 `apps/desktop/src/renderer/features/projects/`
- 添加视图到：`apps/desktop/src/renderer/stores/app-store.ts`（添加到 `AppView` 联合类型和转换）
- 路由在：`apps/desktop/src/renderer/app/App.tsx`

**新的 IPC 端点：**
- 共享类型：`packages/shared/src/ipc.ts`（添加到 `BidLensApi` 接口）
- 请求/响应类型：`packages/shared/src/ipc.ts` 或 `packages/shared/src/risk-review.ts`
- 处理器注册：`apps/desktop/src/main/ipc/risk-review-handlers.ts`（或新建处理器文件）
- 服务方法：`apps/desktop/src/main/services/risk-review-service.ts`
- 预加载桥接：`apps/desktop/src/preload/index.ts`（添加映射）

**新的数据库表：**
- Schema：`apps/desktop/src/main/db/schema.ts`
- 迁移：`apps/desktop/src/main/db/migrations.ts`
- 仓库：`apps/desktop/src/main/db/repositories.ts`（V0.3 仓库）或 `apps/desktop/src/main/repositories/`（V0.2 仓库）

**新的 Rust 检测器：**
- 实现：`bidlens-engine/crates/review-core/src/detectors/`
- 注册到：`bidlens-engine/crates/review-core/src/detectors/mod.rs`
- 接入到：`bidlens-engine/crates/review-core/src/lib.rs`

**新的共享类型：**
- V0.3 类型：`packages/shared/src/risk-review.ts`
- V0.2 类型：`packages/shared/src/compare-task.ts`
- 从导出：`packages/shared/src/index.ts`

**新的 UI 组件：**
- 原语（button、dialog 等）：`apps/desktop/src/renderer/components/ui/`
- 领域组件：共置在相关功能目录中
- 共享 feedback/layout：`apps/desktop/src/renderer/components/feedback/` 或 `layout/`

**新的 Zustand Store：**
- 位置：`apps/desktop/src/renderer/stores/`（全局）或与功能共置
- 模式：`create<StateType>((set, get) => ({...}))`，使用 `use*Store` 命名

## 特殊目录

**`.artifacts/`：**
- 职责：构建产物、BGE-M3 模型文件、测试结果
- 自动生成：是
- 提交到 Git：否（在 .gitignore 中）

**`apps/desktop/dist/` 和 `apps/desktop/dist-electron/`：**
- 职责：构建输出（渲染器 bundle、Electron 打包应用）
- 自动生成：是
- 提交到 Git：否

**`bidlens-engine/target/`：**
- 职责：Rust 构建输出
- 自动生成：是
- 提交到 Git：否

**`apps/desktop/.native-runtime/`：**
- 职责：better-sqlite3 的原生模块运行时
- 自动生成：是（通过 electron-rebuild）
- 提交到 Git：否

---

*结构分析：2026-07-22*
