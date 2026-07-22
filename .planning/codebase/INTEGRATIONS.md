# 外部集成

**分析日期：** 2026-07-22

## API 和外部服务

**未检测到外部 API。** BidLens 是完全离线的桌面应用。所有文档解析、分析和风险检测均在本地通过 Rust 引擎和 TypeScript 库完成。

## 数据存储

**数据库：**
- SQLite（通过 `better-sqlite3`）
  - 位置：`app.getPath('userData')/bidlens.db`（Electron 用户数据目录）
  - 启用 WAL 模式支持并发读写
  - Schema 版本跟踪和迁移校验和
  - 表：`tasks`、`document_snapshots`、`diff_snapshots`、`review_annotations`、`settings`、`migration_history`
  - 管理器：`apps/desktop/src/main/db/database.ts`
  - Schema：`apps/desktop/src/main/db/schema.ts`
  - 迁移：`apps/desktop/src/main/db/migrations.ts`

**文件存储：**
- 仅限本地文件系统
- 文档文件从用户选择的路径读取（通过 Electron `dialog.showOpenDialog`）
- 导出的报告保存到用户选择的路径（通过 Electron `dialog.showSaveDialog`）
- 数据库和密钥文件存储在 Electron `userData` 目录

**缓存：**
- 无（无显式缓存层）

## 认证和身份

**认证提供者：**
- 无 — 离线桌面应用，无用户认证

**加密：**
- Electron `safeStorage`（Windows 上为 DPAPI，macOS 上为 Keychain）用于主密钥保护
- AES-256 加密用于敏感数据库字段（文档路径、批注、快照）
- 密钥文件：userData 目录下的 `.bidlens-key.enc`
- 实现：`apps/desktop/src/main/services/key-manager.ts`

## 监控和可观测性

**错误追踪：**
- 仅控制台日志（`console.log`、`console.error`、`console.warn`）
- 渲染器控制台消息通过 `webContents.on('console-message')` 转发到主进程

**日志：**
- 主进程：通过 Electron 内置日志输出到 stdout/stderr
- 引擎进程：stderr 由 `EngineManager` 捕获
- 无外部日志服务

## CI/CD 和部署

**托管：**
- 桌面分发（无服务器托管）

**CI 流水线：**
- 未检测到（无 `.github/workflows/`、`.gitlab-ci.yml` 或类似配置）

**构建脚本：**
- `scripts/build-windows.ps1` — Windows 构建自动化
- `scripts/release-build.md` — 发布构建文档
- `scripts/v03/` — V0.3 模型可行性脚本

**分发方式：**
- Windows：通过 electron-builder 生成 NSIS 安装包
- macOS：通过 electron-builder 生成 DMG（x64 + arm64）
- Linux：通过 electron-builder 生成 AppImage

## 环境配置

**必需的环境变量：**
- 未检测到 — 应用完全自包含

**配置：**
- 应用设置存储在 SQLite `settings` 表（键值 JSON 存储）
- 默认设置：20 条任务历史限制、1GB 存储限制

## IPC 通信（内部）

**Electron IPC：**
- 预加载脚本通过 `contextBridge.exposeInMainWorld('bidlens', api)` 桥接主进程↔渲染器
- 契约定义在 `packages/shared/src/ipc.ts`
- IPC 通道：`risk:*`、`compare:*`、`file:*`、`review:*`、`history:*`、`export:*`、`settings:*`、`window:*`、`engine:*`

**Rust 引擎通信：**
- JSON-RPC 2.0 over stdio（stdin/stdout 管道）
- 引擎由 `EngineManager` 作为子进程启动
- 方法：`ping`、`compare`、`compare.cancel`、`shutdown`、`risk.analyzeWithAst`、`risk.cancelProject`
- 通知：`compare.progress`、`risk.progress`
- 实现：`apps/desktop/src/main/services/engine-manager.ts`

## 文档解析

**支持的格式：**
- DOCX — 通过 `docx4js` 3.3.0（shared 包）
- PDF — 通过 `pdf-parse` 2.4.5（shared 包）
- XML — 通过 `fast-xml-parser` 4.5.1（desktop 包）
- ZIP — 通过 `jszip` 3.10.1（用于 DOCX 解压）

## 原生模块

**better-sqlite3：**
- 需要通过 `@electron/rebuild` 进行原生编译
- 重编译命令：`pnpm native:electron`（开发）/ `npm rebuild better-sqlite3`（测试）
- 生产构建中从 asar 解包（electron-builder 配置中的 `asarUnpack`）
- 打包时通过 `scripts/copy-native-runtime.cjs` 复制原生运行时

## 平台 API

**使用的 Electron API：**
- `app` — 应用生命周期
- `BrowserWindow` — 窗口管理（无边框、自定义标题栏）
- `ipcMain` / `ipcRenderer` — IPC 通信
- `contextBridge` — 安全预加载桥接
- `dialog` — 文件/文件夹选择、保存对话框
- `shell` — 在系统资源管理器中打开文件/文件夹
- `Menu` — 禁用原生菜单（`Menu.setApplicationMenu(null)`）
- `safeStorage` — 操作系统级加密用于密钥存储

**使用的 Node.js API：**
- `child_process.spawn` — 引擎进程管理
- `fs` / `fs/promises` — 文件操作
- `path` — 路径处理
- `crypto` — 随机密钥生成
- `os` — 系统信息

---

*集成审计：2026-07-22*
