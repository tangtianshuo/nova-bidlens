# 架构

**分析日期：** 2026-07-22

## 模式概述

**整体架构：** 三层 Electron monorepo + Rust 子进程引擎

**关键特征：**
- Electron 桌面应用，严格的进程隔离（主进程/渲染器/预加载）
- pnpm workspace monorepo：`apps/desktop`（Electron）、`packages/shared`（类型/逻辑）、`bidlens-engine`（Rust）
- IPC 优先通信：渲染器从不直接访问文件系统、数据库或引擎
- 两种产品模式：`risk-review`（V0.3 主模式）和 `version-diff`（V0.2 遗留模式，正在退役）
- JSON-RPC over stdio 与 Rust 引擎子进程通信

## 分层图

```
┌─────────────────────────────────────────────────────────────┐
│  渲染器进程 (Vite + React 19)                                │
│  src/renderer/                                              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ App     │ │ Features │ │ Stores   │ │ Components     │  │
│  │ Shell   │ │ (pages)  │ │ (Zustand)│ │ (shadcn/Radix) │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └────────────────┘  │
│       │           │            │                            │
│       └───────────┴────────────┘                            │
│                   │                                         │
│         window.bidlens (BidLensApi)                         │
├───────────────────┼─────────────────────────────────────────┤
│  预加载脚本        │  contextBridge                          │
│  src/preload/     │  映射 BidLensApi → ipcRenderer.invoke   │
├───────────────────┼─────────────────────────────────────────┤
│  主进程 (Node.js / CommonJS)                                 │
│  src/main/                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ IPC Handlers │ │ Services     │ │ Persistence      │    │
│  │ (ipcMain)    │→│ (编排)       │→│ (SQLite + repos) │    │
│  └──────────────┘ └──────┬───────┘ └──────────────────┘    │
│                          │                                  │
│                   JSON-RPC over stdio                        │
├─────────────────────────┼───────────────────────────────────┤
│  Rust 引擎 (bidlens-engine)                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ document-ast │ │ diff-engine  │ │ review-core      │    │
│  │ (AST 类型)   │ │ (差异算法)   │ │ (4 个检测器)     │    │
│  └──────────────┘ └──────────────┘ └──────────────────┘    │
│  ┌──────────────┐ ┌──────────────┐                         │
│  │ table-diff   │ │ common       │                         │
│  │ (表格差异)   │ │ (错误类型)   │                         │
│  └──────────────┘ └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## 各层职责

**渲染器（UI）：**
- 职责：用户界面、状态管理、展示
- 位置：`apps/desktop/src/renderer/`
- 包含：React 组件、Zustand store、功能页面、Tailwind 样式
- 依赖：`@bidlens/shared`（仅类型）、`window.bidlens` IPC 桥接
- 使用者：终端用户

**预加载脚本（桥接）：**
- 职责：渲染器和主进程之间的安全 IPC 桥接
- 位置：`apps/desktop/src/preload/index.ts`
- 包含：单文件，将 `BidLensApi` 接口映射到 `ipcRenderer.invoke()` 调用
- 依赖：`@bidlens/shared`（类型）、`electron`（contextBridge、ipcRenderer）
- 使用者：渲染器通过 `window.bidlens` 调用

**主进程（后端）：**
- 职责：业务逻辑编排、持久化、引擎生命周期管理
- 位置：`apps/desktop/src/main/`
- 包含：IPC 处理器、服务、仓库、数据库层、worker 线程
- 依赖：`@bidlens/shared`、`better-sqlite3`、`electron`
- 使用者：预加载脚本（通过 IPC），启动 Rust 引擎

**共享包：**
- 职责：跨层类型、IPC 契约、文档解析器、差异工具
- 位置：`packages/shared/src/`
- 包含：TypeScript 类型、IPC 接口定义、DOCX/PDF 解析器、差异算法
- 依赖：`docx4js`、`pdf-parse`
- 使用者：主进程和渲染器（作为类型）

**Rust 引擎：**
- 职责：高性能文档解析、差异计算、风险检测
- 位置：`bidlens-engine/`
- 包含：5 个 crate（document-ast、diff-engine、table-diff、review-core、common）
- 依赖：`serde`、`serde_json`、`tokio`、`uuid`、`anyhow`
- 使用者：主进程（作为子进程启动，JSON-RPC over stdio）

## 数据流

**V0.3 风险审查流程（主流程）：**

1. 渲染器：用户通过 `NewProjectPage` 创建项目 → 调用 `window.bidlens.createRiskProject(request)`
2. 预加载：转发为 `ipcRenderer.invoke('risk:createProject', request)`
3. 主进程 IPC：`risk-review-handlers.ts` 接收 → 委托给 `RiskReviewService`
4. 服务：在 SQLite 中创建项目行，校验文件，创建提交行，启动异步流水线
5. 服务：对每个阶段（校验 → 解析 → 提取 → 检测 → 聚合）：
   - 通过 `ParserService` 解析文档（使用 shared 解析器模块）
   - 通过 `EngineManager` 发送分析请求到 Rust 引擎（JSON-RPC）
   - 接收进度通知，通过 `window.webContents.send('risk:progress', ...)` 推送到渲染器
   - 将检查点持久化到 SQLite 用于崩溃恢复
6. 渲染器：`ProjectProcessingPage` 通过 `onRiskProgress` 订阅进度 → 更新 UI
7. 服务：完成时，聚合 findings → 持久化到 DB → 推送最终状态
8. 渲染器：`RiskResultPage` 通过 `window.bidlens.getProject(id)` 加载 findings → 显示结果

**V0.2 比对流程（遗留，已保留）：**

1. 渲染器：用户选择文件 → 调用 `window.bidlens.startCompare(request)`
2. 主进程：`TaskOrchestrator` 校验 → 通过 `ParserService` 解析 → 发送到 Rust 引擎 → 返回 `CompareResult`
3. 主进程：通过 `SnapshotRepository` 将加密快照持久化到 SQLite
4. 渲染器：`ReviewWorkbench` 显示差异结果

**状态管理：**
- `app-store.ts`（Zustand）：导航状态机、视图切换、模式切换
- `result-store.ts`（Zustand）：V0.2 比对结果、差异项、批注、过滤器
- `risk-review-store.ts`（Zustand）：V0.3 项目导航、发现项选择、过滤状态
- `@tanstack/react-query`：用于异步数据获取（项目列表、项目详情）

## 核心抽象

**BidLensApi（IPC 契约）：**
- 职责：渲染器和主进程之间的完整 API 接口
- 示例：`packages/shared/src/ipc.ts`
- 模式：在 shared 中定义纯接口，由 preload 实现，由 renderer 消费

**PersistenceManager：**
- 职责：编排所有持久化服务（数据库、仓库、加密、备份、保留策略）
- 示例：`apps/desktop/src/main/services/persistence.ts`
- 模式：对 DatabaseManager、KeyManager、repositories 和 worker 的门面封装

**EngineManager：**
- 职责：管理 Rust 引擎子进程生命周期和 JSON-RPC 通信
- 示例：`apps/desktop/src/main/services/engine-manager.ts`
- 模式：单例服务，启动子进程，维护请求/响应映射，处理崩溃恢复

**RiskReviewService：**
- 职责：完整的风险审查业务逻辑（项目 CRUD、分析流水线、导出）
- 示例：`apps/desktop/src/main/services/risk-review-service.ts`
- 模式：基于仓库的服务，带内存中活跃运行跟踪

**DocumentAst / RiskFinding / Evidence：**
- 职责：跨所有层共享的核心领域类型
- 示例：`packages/shared/src/document-ast.ts`、`packages/shared/src/risk-review.ts`
- 模式：纯 TypeScript 接口，无运行时依赖

## 入口点

**Electron 主进程：**
- 位置：`apps/desktop/src/main/index.ts`
- 触发：Electron 应用启动
- 职责：创建 BrowserWindow、初始化 PersistenceManager、注册所有 IPC 处理器、管理引擎生命周期

**渲染器入口：**
- 位置：`apps/desktop/src/renderer/index.html` → `main.tsx`
- 触发：BrowserWindow 加载 URL/文件
- 职责：挂载 React 应用，包含 QueryClient、ErrorBoundary、TooltipProvider

**Rust 引擎入口：**
- 位置：`bidlens-engine/src/main.rs`
- 触发：由 EngineManager 作为子进程启动
- 职责：从 stdin 读取 JSON-RPC 请求，分发到 task_service 或 risk_engine，发送进度事件

## 错误处理

**策略：** 在信任边界使用结构化错误，非关键故障优雅降级

**模式：**
- `StructuredRiskError`，包含 `code`、`message`、`retryable` 标志，用于引擎错误（定义在 `packages/shared/src/ipc.ts`）
- `ErrorBoundary` React 组件包裹整个应用（`apps/desktop/src/renderer/components/feedback/error-boundary.tsx`）
- 数据库损坏 → 通过 `RecoveryService` 自动恢复尝试（`apps/desktop/src/main/services/recovery.ts`）
- 引擎崩溃 → EngineManager 检测并重启子进程（`apps/desktop/src/main/services/engine-manager.ts`）
- 部分分析 → 项目进入 `partial` 状态，用户可接受部分结果或重试

## 横切关注点

**日志：** 主进程使用 `console.log` 加 `[Component]` 前缀约定；渲染器控制台消息通过 `console-message` 事件转发到主进程
**校验：** 通过 `file-validator.ts` 进行文件校验（大小、格式、可读性）；IPC 边界进行输入校验
**认证：** 无（本地桌面应用）。通过 `KeyManager` + AES 对敏感数据进行静态加密（`apps/desktop/src/main/db/crypto.ts`）
**线程：** 数据库 worker 线程用于重度持久化/加载操作（`apps/desktop/src/main/workers/database-worker.ts`）；Web Worker 用于差异过滤（`apps/desktop/src/renderer/workers/filter-worker.ts`）

---

*架构分析：2026-07-22*
