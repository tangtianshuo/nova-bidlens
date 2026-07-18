# BidLens

BidLens 是面向招投标文档审核的本地智能比对桌面应用。它以统一的 Document AST 和 Diff AST 为核心，在 Windows 桌面端完成文档校验、解析、差异分析、审核标注和报告导出。

## 当前状态

V0.2.2 正在开发中，当前重点是 DOCX/PDF 文档的真实比对闭环、三栏审核工作台、本地历史记录和 Windows 桌面交付。

## 技术架构

- Electron + React 19 + TypeScript：桌面窗口和交互界面
- Zustand + Tailwind CSS 4 + shadcn/ui：渲染层状态与设计系统
- Node.js：文档解析、文件校验和本地 IPC 服务
- Rust：高性能差异计算和表格比对引擎
- SQLite：本地任务、结果快照和审核记录持久化

## 快速开始

环境要求：Node.js 18+、pnpm 9+、Rust 1.75+。

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm build       # 构建 shared、Desktop 和 Rust 引擎
pnpm test        # 运行全部测试
pnpm test:ts     # TypeScript 测试
pnpm test:rust   # Rust 测试
```

## 项目结构

```text
apps/desktop/       Electron 主进程、预加载脚本和 React 渲染层
packages/shared/    共享类型、IPC 契约和纯逻辑工具
bidlens-engine/     Rust 文档 AST、差异和表格引擎
docs/               架构、接口、开发计划和验收文档
tests/              集成、端到端和性能测试
```

## 设计与开发约束

- UI 采用中文，代码和注释使用英文。
- 渲染进程只能从 `@bidlens/shared/types-only` 导入共享模块。
- UI 以 `v022-ui-ux-prototype.html` 和 `docs/v022-ui-ue-decision-log.md` 为视觉基线。
- 主进程负责文件系统、SQLite、Rust 子进程和敏感数据；渲染进程通过类型化 IPC 访问这些能力。

详细约束请先阅读根目录 `AGENTS.md`、`docs/architecture.md` 和 `docs/coding_style.md`。
