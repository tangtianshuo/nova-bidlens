# AGENT.md - BidLens 项目指导方针

> 版本：v1.0
> 最后更新：2026-07-17
> 状态：开发中

---

## 一、项目概述

### 1.1 产品定位

**BidLens（招标文档语义比对工具）** 是一款 AI 原生的文档智能比对桌面平台，专注于招投标文档的智能审核与差异分析。

**核心价值：**
- 以 JSON AST 为核心数据模型
- 以 Embedding 语义匹配为主要比对手段
- 以 Rust 为计算引擎
- 以 Electron + React 为交互层
- 支持 1000 页以上大型文档的全保真（L5）智能比对

### 1.2 目标用户

| 用户角色 | 核心痛点 | 期望 |
|----------|----------|------|
| 标书审核员 | Word比较卡顿、结构不同无法比对 | 10分钟完成差异分析 |
| 项目经理 | 等待报告耗时、无法快速定位关键差异 | 5分钟看差异摘要 |
| 法务专员 | 无法检测格式变化、无法比对批注修订 | 精确到字级别的差异 |

---

## 二、技术架构

### 2.1 三层架构

`
┌─────────────────────────────────────────────────────────┐
│                 Electron Main Process                    │
│  AutoUpdate │ 窗口管理 │ IPC │ 文件管理 │ 权限管理        │
└────────────────────────┬────────────────────────────────┘
                         │ IPC (Channel)
┌────────────────────────▼────────────────────────────────┐
│                 React Renderer                           │
│  React 19 │ TypeScript │ Zustand │ TanStack Query        │
│  TailwindCSS │ shadcn/ui │ Virtual List                  │
└────────────────────────┬────────────────────────────────┘
                         │ stdio JSON-RPC
┌────────────────────────▼────────────────────────────────┐
│                 Rust Core Engine                          │
│  document-ast │ diff-engine │ table-diff │ vector         │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ONNX Runtime    PaddleOCR      llama.cpp
   (Embedding)      (OCR)          (LLM)
`

### 2.2 分层架构文档

| 层级 | 路径 | 职责 | 详细文档 |
|------|------|------|----------|
| **Desktop应用层** | pps/desktop/ | Electron桌面应用、UI渲染、IPC桥接 | [apps/desktop/AGENT.md](apps/desktop/AGENT.md) |
| **Shared共享层** | packages/shared/ | 共享类型、IPC契约、纯逻辑函数 | [packages/shared/AGENT.md](packages/shared/AGENT.md) |
| **Rust引擎层** | idlens-engine/ | 高性能计算、差异算法、AST处理 | [bidlens-engine/AGENT.md](bidlens-engine/AGENT.md) |

### 2.3 Monorepo 结构

`
nova-bidlens/
├── AGENT.md                    # 本文档（总规划）
├── apps/
│   └── desktop/                # Electron应用
│       ├── AGENT.md            # Desktop层详细文档
│       ├── electron/           # 主进程
│       └── src/renderer/       # 渲染进程 (React)
├── packages/
│   └── shared/                 # 共享类型、IPC契约
│       ├── AGENT.md            # Shared层详细文档
│       └── src/
├── bidlens-engine/             # Rust工作区
│       ├── AGENT.md            # Rust引擎层详细文档
│       ├── crates/
│       │   ├── document-ast/   # AST数据结构
│       │   ├── diff-engine/    # 语义差异算法
│       │   └── table-diff/     # 表格差异引擎
│       └── src/main.rs         # JSON-RPC Bridge
└── docs/                       # 设计文档
`

---

## 三、核心数据流

### 3.1 文档比对流程

`
用户拖入文档A和文档B
        │
        ▼
┌─────────────────┐
│  Electron主进程  │  接收文件路径
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node.js解析层  │  解析Word/PDF → Document AST
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rust引擎       │  计算差异 → Diff AST
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  React渲染层    │  展示差异结果
└─────────────────┘
`

### 3.2 核心数据模型

`	ypescript
// Document AST - 文档的结构化表示
DocumentAst {
    blocks: BlockNode[]  // 段落 | 表格 | 标题 | 列表
}

// Diff AST - 差异计算结果
DiffAst {
    items: DiffItem[]    // 差异项列表
    summary: DiffSummary // 统计摘要
}

// Table Diff - 表格差异
TableDiffResult {
    cellDiffs: CellDiff[]        // 单元格差异
    structuralChanges: Change[]  // 结构变化
}
`

---

## 四、技术栈总览

| 层级 | 技术栈 |
|------|--------|
| **Desktop** | Electron 35 + React 19 + Vite 6 + TypeScript 5 |
| **Shared** | TypeScript 5 + ESM |
| **Rust Engine** | Rust 2021 + Serde + Tokio |
| **状态管理** | Zustand 5 + TanStack Query 5 |
| **样式** | TailwindCSS 4 + shadcn/ui |
| **测试** | Vitest 3 (TS) + cargo test (Rust) |
| **包管理** | pnpm workspace |
| **IPC** | Electron IPC + stdio JSON-RPC |

---

## 五、开发指南

### 5.1 快速开始

`ash
# 克隆仓库
git clone <repo-url>
cd nova-bidlens

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 运行测试
pnpm test
`

### 5.2 命令参考

`ash
# 构建
pnpm build                    # 构建所有
pnpm --filter @bidlens/shared build    # 构建Shared
pnpm --filter @bidlens/desktop build   # 构建Desktop
cargo build --manifest-path bidlens-engine/Cargo.toml  # 构建Rust

# 测试
pnpm test                     # 所有测试
pnpm test:ts                  # TypeScript测试
pnpm test:rust                # Rust测试
pnpm test:integration         # 集成测试
pnpm test:e2e                 # 端到端测试

# 开发
pnpm dev                      # 启动开发服务器
pnpm --filter @bidlens/desktop dev     # Desktop开发
`

### 5.3 编码规范

| 类别 | 规范 |
|------|------|
| **语言** | UI中文(zh-CN)，代码/注释/提交英文 |
| **TypeScript** | ESM，严格类型，优先interface |
| **Rust** | Rust惯例，snake_case |
| **提交** | Conventional Commits：feat/fix/docs/test |
| **测试** | 每个功能需单元测试，关键路径需集成测试 |

### 5.4 分支策略

`
master/main
    │
    ├── feature/semantic-compare-mvp    # V0.1 ✅
    ├── feature/full-fidelity           # V0.2 🔄
    ├── feature/ai-integration          # V0.3 ⏳
    └── feature/web-ui                  # V0.4 ⏳
`

---

## 六、版本规划

### 6.1 版本路线图

| 版本 | 主题 | 状态 | 关键特性 |
|------|------|------|----------|
| **V0.1** | 语义比对MVP | ✅ 完成 | 段落级比对、三栏工作台 |
| **V0.2** | 全保真增强 | 🔄 开发中 | 表格、格式、批注、PDF |
| **V0.3** | AI集成 | ⏳ 规划中 | Embedding、OCR、LLM |
| **V0.4** | Web UI | ⏳ 规划中 | 国产化适配、PWA |

### 6.2 V0.2 开发计划

`
Sprint 1: 表格基础支持 ✅
├── Task 1.1: 扩展Document AST ✅
├── Task 1.2: Word表格解析 ✅
├── Task 1.3: 简单表格比对 ✅
└── Task 1.4: 工作台展示 ✅

Sprint 2: 表格高级特性 🔄
├── Task 2.1: 合并单元格 ✅
├── Task 2.2: 智能行列对齐 ✅
├── Task 2.3: 内容相似度匹配 ✅
└── Task 2.4: 嵌套表格支持 ✅

Sprint 3: 格式信息支持 🔄
├── Task 3.1: AST格式扩展 ✅
├── Task 3.2: 文本格式提取 ⏳
├── Task 3.3: 段落格式提取 ⏳
├── Task 3.4: 格式差异计算 ⏳
└── Task 3.5: 格式差异面板 ⏳

Sprint 4: 批注/修订支持 ⏳
Sprint 5: PDF支持与报告 ⏳
`

---

## 七、测试策略

### 7.1 测试层次

| 层次 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest (TS), cargo test (Rust) | 函数/类级别 |
| 集成测试 | Vitest | 模块间交互 |
| 端到端测试 | Vitest | 完整流程 |
| UI测试 | @testing-library/react | 组件渲染 |

### 7.2 测试覆盖要求

- 公共函数必须有单元测试
- 边界情况必须覆盖
- 关键路径必须有集成测试
- 组件必须有渲染测试

---

## 八、常见问题

### 8.1 构建问题

`ash
# 清理并重新构建
pnpm clean
pnpm install
pnpm build

# Rust编译错误
cargo update --manifest-path bidlens-engine/Cargo.toml
`

### 8.2 测试问题

`ash
# 运行单个测试文件
pnpm vitest run packages/shared/src/parser/docx-table.test.ts

# 查看详细输出
pnpm test:ts -- --reporter=verbose
`

### 8.3 开发环境

- Node.js >= 18
- pnpm >= 9
- Rust >= 1.75

---

## 九、相关文档

### 9.1 架构设计文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 目录与概述 | docs/00-目录与概述.md | 术语表、文档导航 |
| 总体架构 | docs/01-总体架构设计.md | 系统架构详细说明 |
| Rust引擎 | docs/02-模块设计-Rust引擎.md | Rust模块设计 |
| React前端 | docs/03-模块设计-React前端.md | 前端模块设计 |
| Node解析层 | docs/04-模块设计-Node解析层.md | 解析层设计 |
| 数据结构 | docs/05-数据结构设计.md | 核心数据模型 |
| IPC协议 | docs/06-IPC通信协议设计.md | 通信协议规范 |
| 数据库 | docs/07-数据库设计.md | 存储方案 |
| AI推理 | docs/08-AI推理流程设计.md | AI集成方案 |
| 多线程 | docs/09-多线程与任务调度设计.md | 并发方案 |
| 插件化 | docs/10-插件化与扩展机制.md | 扩展机制 |
| 性能优化 | docs/11-性能优化方案.md | 优化策略 |
| 发布运维 | docs/12-发布升级与运维方案.md | 部署方案 |
| 双模式 | docs/13-双模式架构与国产化适配.md | Web UI方案 |

### 9.2 开发计划文档

| 文档 | 路径 | 说明 |
|------|------|------|
| V0.2计划 | docs/02-v02-full-fidelity-plan.md | 当前开发计划 |
| V0.2状态 | docs/v02-development-status.md | 进度跟踪 |
| 头脑风暴 | docs/v021-brainstorm.md | 技术决策记录 |

---

## 十、联系方式

- **项目仓库**: D:\Projects\Nova\nova-bidlens
- **技术栈**: Electron + React 19 + TypeScript + Rust
- **包管理**: pnpm workspace
- **构建工具**: Vite (前端) + Cargo (Rust)

---

**文档维护**: 本文档应随项目演进持续更新
