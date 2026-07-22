# 技术栈

**分析日期：** 2026-07-22

## 编程语言

**主要语言：**
- TypeScript 5.7.2 — 共享包、桌面应用（主进程、渲染器、预加载脚本）
- Rust 2024 edition — 文档解析和差异引擎（`bidlens-engine/`）

**辅助语言：**
- JavaScript (CJS) — 构建脚本（`apps/desktop/scripts/copy-native-runtime.cjs`）
- PowerShell — Windows 构建脚本（`scripts/build-windows.ps1`）

## 运行时

**环境：**
- Node.js（通过 Electron 33.2.1 运行时）
- Electron 33.2.1 — 桌面应用外壳（Chromium + Node.js）

**包管理器：**
- pnpm 9.15.0 — Monorepo 工作区管理
- 锁文件：`pnpm-lock.yaml`（已存在）

**Rust 工具链：**
- Cargo（标准 Rust 构建系统）
- Workspace resolver: 2

## 框架

**核心框架（渲染器）：**
- React 19.0.0 — UI 框架
- Vite 6.0.7 — 构建工具和开发服务器（渲染器进程）
- Tailwind CSS 4.3.3 — 原子化 CSS（通过 `@tailwindcss/vite` 插件）
- Zustand 5.0.2 — 客户端状态管理
- TanStack React Query 5.64.2 — 异步/服务端状态管理

**UI 组件库：**
- Radix UI — 无头原语（dialog、dropdown、checkbox、tabs、select、popover、tooltip、scroll-area 等）
- shadcn/ui 模式 — 使用 `class-variance-authority` + `tailwind-merge` + `clsx` 的组件封装
- Lucide React 1.25.0 — 图标库
- Sonner 2.0.7 — Toast 通知

**测试框架：**
- Vitest 2.1.8 — 单元测试运行器（shared + desktop）
- Playwright 1.49.0 — E2E 测试
- Testing Library（React 16.1.0、jest-dom 6.9.1、user-event 14.6.1）— 组件测试工具
- jsdom 25.0.1 — Vitest 的 DOM 环境

**构建/开发工具：**
- Vite 6.0.7 — 渲染器打包和 HMR
- electron-builder 26.15.3 — Electron 打包和分发
- @electron/rebuild 4.2.0 — 原生模块重编译
- tsx 4.23.1 — TypeScript 脚本执行

## 关键依赖

**核心依赖（桌面应用）：**
- `better-sqlite3` 12.11.1 — 嵌入式 SQLite 数据库（原生模块，需要重编译）
- `@bidlens/shared` workspace:* — 内部共享类型和 IPC 契约
- `electron` 33.2.1 — 桌面运行时

**核心依赖（共享包）：**
- `docx4js` 3.3.0 — DOCX 文件解析
- `pdf-parse` 2.4.5 — PDF 文件解析

**核心依赖（Rust）：**
- `serde` 1 — 序列化/反序列化
- `serde_json` 1 — JSON 处理
- `tokio` 1（full features）— 异步运行时
- `anyhow` 1 — 错误处理
- `uuid` 1（v4）— ID 生成
- `sha2` 0.10 — SHA-256 哈希（review-core crate）
- `regex` 1 — 正则匹配（review-core crate）
- `thiserror` 1 — 错误派生宏（common crate）

**基础设施依赖：**
- `fast-xml-parser` 4.5.1 — XML 解析（用于文档处理）
- `jszip` 3.10.1 — ZIP 解压（DOCX 本质是 ZIP 归档）
- `diff` 8.0.2 — 文本差异工具
- `concurrently` 10.0.3 — 并行开发进程管理
- `wait-on` 9.0.10 — 开发服务器就绪检测

## 配置

**TypeScript 配置：**
- 渲染器：`apps/desktop/tsconfig.json` — ES2022 target、ESNext modules、Bundler resolution、JSX react-jsx、路径别名 `@/* → src/renderer/*`
- 主进程/预加载：`apps/desktop/tsconfig.main.json` — ES2022 target、CommonJS modules、Node resolution
- 共享包：`packages/shared/tsconfig.json` — ES2022 target、ESNext modules、双输出 CJS/ESM

**Vite 配置：**
- `apps/desktop/vite.config.ts` — 根目录 `src/renderer`、端口 5173、strict port、外部化 Node 内置模块和原生解析器

**Electron Builder 配置：**
- `apps/desktop/electron-builder.yml` — App ID: `com.bidlens.desktop`、NSIS 安装包（Windows）、DMG（macOS）、AppImage（Linux）、asar 打包、better-sqlite3 原生模块解包、Rust 引擎作为 extraResource 打包

**Vitest 配置：**
- `apps/desktop/vitest.config.ts` — jsdom 环境、测试文件共置
- 共享包使用内联 vitest 配置（未找到独立配置文件）

**Playwright 配置：**
- `apps/desktop/playwright.config.ts` — E2E 测试在 `tests/e2e`、60 秒超时、串行执行（Electron 要求）、单 worker

## 平台要求

**开发环境：**
- Node.js（版本未在 `.nvmrc` 中固定）
- pnpm 9.15.0
- Rust 工具链（用于 `bidlens-engine` cargo build）
- `electron-rebuild` 用于原生模块（`better-sqlite3`）

**生产环境：**
- Windows x64（NSIS 安装包，打包 `bidlens-engine.exe`）
- macOS x64 + arm64（DMG）
- Linux x64（AppImage）
- Rust 引擎二进制文件作为 extraResource 打包到所有目标平台

## Monorepo 结构

**工作区布局：**
- `packages/shared` — 纯 TypeScript 库，双输出 ESM/CJS
- `apps/desktop` — Electron 应用（React 渲染器 + TS 主进程）
- `bidlens-engine/` — Rust 工作区，包含 5 个 crate

**Rust Crate：**
- `bidlens-engine`（根）— 编排器，基于 stdio 的 JSON-RPC 服务器
- `document-ast` — AST 数据结构（段落、章节、列表、表格）
- `diff-engine` — 语义差异算法
- `table-diff` — 表格级差异
- `review-core` — 审查逻辑（SHA-256、regex）
- `common` — 共享错误类型

---

*技术栈分析：2026-07-22*
