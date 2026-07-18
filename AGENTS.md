# AGENTS.md - BidLens 项目指导方针

> 版本：v1.2
> 最后更新：2026-07-17

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

### 2.2 Monorepo 结构

`
nova-bidlens/
├── AGENTS.md                   # 本文档（项目指导方针）
├── apps/
│   └── desktop/                # Electron应用
│       ├── AGENT.md            # Desktop层详细文档
│       ├── src/main/           # 主进程
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

### 2.3 分层架构文档

**项目采用分层架构文档体系，每层都有独立的详细文档：**

| 层级 | 路径 | 职责 | 详细文档 |
|------|------|------|----------|
| **项目级** | 根目录 | 项目指导方针、架构遵循规范 | AGENTS.md |
| **Desktop应用层** | apps/desktop/ | Electron桌面应用、UI渲染、IPC桥接 | apps/desktop/AGENT.md |
| **Shared共享层** | packages/shared/ | 共享类型、IPC契约、纯逻辑函数 | packages/shared/AGENT.md |
| **Rust引擎层** | bidlens-engine/ | 高性能计算、差异算法、AST处理 | bidlens-engine/AGENT.md |

**分层架构文档引用：**
- [apps/desktop/AGENT.md](apps/desktop/AGENT.md) - Desktop应用层详细设计
- [packages/shared/AGENT.md](packages/shared/AGENT.md) - Shared共享层详细设计
- [bidlens-engine/AGENT.md](bidlens-engine/AGENT.md) - Rust引擎层详细设计

---

## 三、构建与开发命令

### 3.1 常用命令

`ash
# 安装依赖
pnpm install

# 完整开发（构建shared，启动Vite + Electron）
pnpm dev

# 构建全部（TS + Rust）
pnpm build

# 运行所有测试
pnpm test

# 单独测试
pnpm test:ts          # shared + desktop 单元测试
pnpm test:rust        # Rust引擎 cargo test
pnpm test:integration # 集成测试
pnpm test:e2e         # 端到端测试

# Desktop开发
pnpm --filter @bidlens/desktop dev
pnpm --filter @bidlens/desktop test

# Shared包
pnpm --filter @bidlens/shared build
pnpm --filter @bidlens/shared test

# Rust引擎
cargo build --manifest-path bidlens-engine/Cargo.toml
cargo test --manifest-path bidlens-engine/Cargo.toml
`

### 3.2 开发环境要求

- Node.js >= 18
- pnpm >= 9
- Rust >= 1.75

---

## 四、核心数据模型

### 4.1 DocumentAst

`	ypescript
interface DocumentAst {
  id: string;
  filename: string;
  sha256: string;
  pageCount: number | null;
  wordCount: number;
  parserVersion: string;
  blocks: BlockNode[];  // ParagraphNode | SectionNode | ListNode | TableNode
}
`

### 4.2 DiffAst

`	ypescript
interface DiffAst {
  taskId: string;
  docAId: string;
  docBId: string;
  items: DiffItem[];
  summary: DiffSummary;
}

interface DiffItem {
  matchId: string;
  matchType: 'identical' | 'modified' | 'added' | 'deleted' | 'moved' | 'split' | 'merged' | 'uncertain';
  confidence: number;
  similarity: number;
  sourceA: string | null;
  sourceB: string | null;
  tableDiff?: TableDiffResult;
}
`

---

## 五、架构文档遵循规范

### 5.1 强制要求

**在进行任何架构决策或重大代码变更前，必须：**

1. 阅读 docs/architecture.md 了解当前架构
2. 阅读 docs/coding_style.md 了解编码规范
3. 确保变更符合文档中记录的架构

### 5.2 关键约束

| 约束 | 说明 | 参考文档 |
|------|------|----------|
| **解析器适配器** | 必须遵循适配器模式 | docs/04-模块设计-Node解析层.md |
| **Rust crate依赖** | 必须遵循依赖规则 | docs/02-模块设计-Rust引擎.md |
| **IPC通信** | 必须使用共享契约 | packages/shared/src/ipc.ts |
| **数据结构** | 必须使用DocumentAst | packages/shared/src/document-ast.ts |

### 5.3 架构决策流程

`


### 5.4 关键架构约束（必须遵守）

#### ⚠️ 渲染进程导入规范（Critical）

**问题描述：**
渲染进程（React Renderer）运行在浏览器环境中，不能直接导入包含 Node.js 模块（如 crypto, vents, s, path 等）的依赖。Vite 会将这些模块 externalize，导致运行时报错：
`
Module "crypto" has been externalized for browser compatibility. Cannot access "crypto.createHash" in client code.
`

**根本原因：**
@bidlens/shared 包的 index.ts 导出了所有模块，包括使用 docx4js（依赖 Node.js 模块）的解析器模块。渲染进程直接从 @bidlens/shared 导入时，会拉取这些 Node.js 依赖。

**正确做法：**

| 场景 | 导入路径 | 说明 |
|------|----------|------|
| **渲染进程** | @bidlens/shared/types-only | 只包含 TypeScript 类型和纯 JS 工具函数 |
| **主进程** | @bidlens/shared | 完整导出，包含 Node.js 依赖 |

**示例：**
`typescript
// ✅ 正确 - 渲染进程使用 types-only
import type { CompareResult, DiffItem } from '@bidlens/shared/types-only';
import { isTableDiffItem } from '@bidlens/shared/types-only';

// ❌ 错误 - 渲染进程不能直接导入
import type { CompareResult } from '@bidlens/shared';
import { isTableDiffItem } from '@bidlens/shared';
`

**	ypes-only.ts 包含的内容：**
- 所有 TypeScript 类型定义（interface, type）
- 不依赖 Node.js 的纯 JavaScript 工具函数（如 isTableDiffItem, getCellChangeColor）
- 常量（如 BIDLENS_VERSION）

**检查清单：**
- [ ] 渲染进程（pps/desktop/src/renderer/）的所有文件必须从 @bidlens/shared/types-only 导入
- [ ] 新增共享类型时，必须同步更新 packages/shared/src/types-only.ts
- [ ] 新增工具函数时，确认是否依赖 Node.js 模块，如不依赖可加入 	ypes-only.ts

**历史问题记录：**
- 2026-07-17: 渲染进程导入 @bidlens/shared 导致 crypto 模块 externalize 错误，页面空白
- 解决方案: 创建 	ypes-only.ts 文件，渲染进程统一从 @bidlens/shared/types-only 导入

---

#### ⚠️ Vite 配置规范

**开发环境：**
`typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,  // 端口固定，与 Electron 主进程一致
  },
  base: './',  // 打包后使用相对路径
});
`

**为什么需要 strictPort: true：**
Electron 主进程硬编码加载 http://127.0.0.1:5173，如果端口被占用，Vite 会自动选择其他端口，导致 Electron 加载空白页面。
提出变更需求
      │
      ▼
查阅相关架构文档
      │
      ▼
评估变更影响
      │
      ├── 不符合架构 → 重新设计
      │
      └── 符合架构 → 实施变更
`

---

## 六、文档维护规范

### 6.1 文档更新触发条件

**以下情况必须更新相关文档：**

| 变更类型 | 触发条件 | 需要更新的文档 |
|----------|----------|----------------|
| **API变更** | IPC接口、Rust接口、TypeScript类型变更 | docs/api/*.md |
| **技术栈变更** | 新增依赖、升级版本、更换工具 | docs/architecture.md, AGENTS.md |
| **架构变更** | 模块职责调整、数据流变更 | docs/architecture.md, 相关AGENT.md |
| **代码规范变更** | 命名规则、格式规范调整 | docs/coding_style.md |
| **版本发布** | 版本号变更、功能完成 | docs/roadmap.md |
| **新功能开发** | 新增模块、新接口 | 相关AGENT.md, docs/api/*.md |

### 6.2 文档更新流程

`
代码变更完成
      │
      ▼
检查是否触发文档更新
      │
      ├── 是 → 更新相关文档
      │         │
      │         ▼
      │       提交文档变更（与代码变更同一PR）
      │
      └── 否 → 无需更新
`

### 6.3 分层架构文档维护责任

| 文档 | 维护责任 | 更新时机 |
|------|----------|----------|
| **AGENTS.md** | 项目负责人 | 项目架构变更、版本规划调整 |
| **apps/desktop/AGENT.md** | Desktop开发人员 | UI变更、IPC变更、Electron配置变更 |
| **packages/shared/AGENT.md** | 共享层开发人员 | 类型变更、IPC契约变更、工具函数变更 |
| **bidlens-engine/AGENT.md** | Rust开发人员 | 算法变更、crate结构调整、性能优化 |

### 6.4 文档同步检查清单

**在提交PR前，检查以下项目：**

- [ ] API变更是否已更新 docs/api/*.md
- [ ] 新增模块是否已更新相关 AGENT.md
- [ ] 技术栈变更是否已更新 docs/architecture.md
- [ ] 版本进度是否已更新 docs/roadmap.md
- [ ] 代码规范变更是否已更新 docs/coding_style.md

---

## 七、版本规划

### 7.1 版本路线图

| 版本 | 主题 | 状态 | 关键特性 |
|------|------|------|----------|
| **V0.1** | 语义比对MVP | ✅ 完成 | 段落级比对、三栏工作台 |
| **V0.2** | 全保真增强 | 🔄 开发中 | 表格、格式、批注、PDF |
| **V0.2.1** | 稳定性版本 | ⏳ 规划中 | 文档解析增强、客户端优化 |
| **V0.3** | AI集成 | ⏳ 规划中 | Embedding、OCR、LLM |
| **V0.4** | Web UI | ⏳ 规划中 | 国产化适配、PWA |

### 7.2 当前开发重点（V0.2.1）

**主攻方向：**
1. 文档解析增强（docx、PDF文字版）
2. 客户端构建优化（自动更新、错误处理）
3. Rust引擎优化（性能、错误处理）

---

## 八、编码规范

### 8.1 语言规范

| 类别 | 规范 |
|------|------|
| **UI语言** | 中文 (zh-CN) |
| **代码/注释/提交** | 英文 |
| **TypeScript** | ESM，严格类型，优先interface |
| **Rust** | Rust惯例，snake_case |

### 8.2 提交规范

使用 Conventional Commits：
- eat: 新功能
- ix: 修复
- docs: 文档
- 	est: 测试
- efactor: 重构
- chore: 构建/工具

---

## 九、测试策略

### 9.1 测试层次

| 层次 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest (TS), cargo test (Rust) | 函数/类级别 |
| 集成测试 | Vitest | 模块间交互 |
| 端到端测试 | Vitest | 完整流程 |
| UI测试 | @testing-library/react | 组件渲染 |

### 9.2 测试要求

- 公共函数必须有单元测试
- 边界情况必须覆盖
- 关键路径必须有集成测试
- 组件必须有渲染测试

---

## 十、相关文档

### 10.1 架构设计文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 目录与概述 | docs/00-目录与概述.md | 术语表、文档导航 |
| 总体架构 | docs/01-总体架构设计.md | 系统架构详细说明 |
| Rust引擎 | docs/02-模块设计-Rust引擎.md | Rust模块设计 |
| React前端 | docs/03-模块设计-React前端.md | 前端模块设计 |
| Node解析层 | docs/04-模块设计-Node解析层.md | 解析层设计 |
| 数据结构 | docs/05-数据结构设计.md | 核心数据模型 |

### 10.2 开发计划文档

| 文档 | 路径 | 说明 |
|------|------|------|
| V0.2计划 | docs/02-v02-full-fidelity-plan.md | 当前开发计划 |
| V0.2状态 | docs/v02-development-status.md | 进度跟踪 |
| 头脑风暴 | docs/v021-brainstorm.md | 技术决策记录 |

### 10.3 简洁实用文档（待创建）

| 文档 | 路径 | 说明 |
|------|------|------|
| 架构概述 | docs/architecture.md | 架构精简导航版 |
| 代码规范 | docs/coding_style.md | 编码规范 |
| IPC接口 | docs/api/ipc.md | Electron IPC接口 |
| Rust接口 | docs/api/rust.md | JSON-RPC接口 |
| 类型定义 | docs/api/types.md | TypeScript类型 |
| 解析器接口 | docs/api/parser.md | 解析器契约 |
| 版本路线图 | docs/roadmap.md | 版本规划 |
| 快速上手 | docs/getting-started.md | 开发指南 |

---

**文档维护**: 本文档应随项目演进持续更新

