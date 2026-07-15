# AI 文档智能比对平台 — 架构设计文档

> 版本：v1.0 Draft
> 日期：2026-07-05
> 状态：架构决策已完成，待开发

---

## 一、产品定位

**AI Native Document Intelligence Desktop（AI 原生文档智能分析桌面平台）**

一句话概括：

> 以 JSON AST 为核心，以 Node.js 为文档解析层，以 Rust 为计算引擎，以 Electron + React 为交互层，以 AI（Embedding、OCR、LLM）作为可插拔能力，通过适配器模式支持多种文档格式，通过插件化架构不断扩展智能分析能力，最终形成一个可持续演进的企业级 AI 文档平台。

### 核心目标

- 支持 1000 页以上 Word/PDF 等文档的智能比对
- 全保真 L5 级别（含批注、修订、精确位置）
- 本地 AI 模型 + 外部模型双模式
- 客户端发布，支持自动更新
- 插件化架构，可扩展合同审查、标书比对、法规检查等场景

---

## 二、架构总览

```
┌─────────────────────────────────────────────────────────┐
│                 Electron Main Process                    │
│  AutoUpdate │ 窗口管理 │ IPC │ 文件管理 │ 权限管理        │
└────────────────────────┬────────────────────────────────┘
                         │
               IPC (Channel)
                         │
┌────────────────────────▼────────────────────────────────┐
│                 React Renderer                           │
│  React 19 │ TypeScript │ Zustand │ TanStack Query        │
│  TailwindCSS │ shadcn/ui │ Virtual List                  │
└────────────────────────┬────────────────────────────────┘
                         │
                  stdio JSON-RPC
                  (newline-delimited JSON)
                         │
┌────────────────────────▼────────────────────────────────┐
│                 Rust Core Engine                          │
│                                                           │
│  ┌─────────────────────────────────────────────┐         │
│  │ core/（纯 Rust crate，无外部依赖）            │         │
│  │  ├── document-ast    JSON AST 类型定义       │         │
│  │  ├── diff-engine     Diff 算法引擎          │         │
│  │  ├── embedding       Embedding 引擎         │         │
│  │  ├── vector          向量索引（HNSW）        │         │
│  │  ├── chunk           文档分块引擎           │         │
│  │  └── common          公共工具               │         │
│  └─────────────────────────────────────────────┘         │
│  ┌─────────────────────────────────────────────┐         │
│  │ bridge/（napi-free，stdio 通信层）            │         │
│  │  └── JSON-RPC handler + 类型转换             │         │
│  └─────────────────────────────────────────────┘         │
│                                                           │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ONNX Runtime    PaddleOCR      llama.cpp
   (Embedding)      (OCR 插件)      (LLM)
```

---

## 三、核心架构决策

### 3.1 Document AST — 数据格式

**决策：JSON AST 为核心数据模型**

- 不选 Markdown（丢失格式/批注/页眉页脚）
- 不选 HTML（体积大、无标准文档语义）
- 不选 FlatBuffers（调试困难、开发迭代慢）
- 不选 Pandoc AST（为转换设计、不支持批注/修订）

**JSON AST 结构：**

```json
{
  "type": "document",
  "metadata": {
    "title": "...",
    "author": "...",
    "created_at": "...",
    "page_count": 1000
  },
  "children": [
    {
      "type": "section",
      "properties": { "level": 1 },
      "children": [
        {
          "type": "paragraph",
          "style": { "font": "宋体", "size": 12, "bold": true },
          "children": [
            { "type": "text_run", "text": "加粗文字", "bold": true },
            { "type": "text_run", "text": "普通文字" }
          ]
        },
        {
          "type": "table",
          "rows": [
            { "cells": [{ "colspan": 2, "children": [...] }] }
          ]
        },
        {
          "type": "comment",
          "author": "张三",
          "content": "批注内容",
          "created_at": "..."
        }
      ]
    }
  ]
}
```

**保真级别：全保真 L5**

| 层级 | 包含内容 | 第一版 |
|---|---|---|
| L1 | 字体、字号、加粗、斜体、下划线、颜色 | ✅ |
| L2 | 行距、缩进、对齐、编号、多级列表 | ✅ |
| L3 | 页眉、页脚、页码、分栏、页边距 | ✅ |
| L4 | 图片绝对定位、文字环绕、文本框坐标、表格列宽 | ✅ |
| L5 | 批注（作者+时间+内容）、修订模式（Track Changes） | ✅ |

用户可在设置中选择保真级别，降低级别可提升性能。

---

### 3.2 Parser — 适配器模式

**决策：Parser 放在 Node 层，采用适配器模式**

```typescript
interface DocumentParser {
  supportedExtensions(): string[];
  parse(file: Buffer): Promise<DocumentAST>;
}
```

**为什么不用 Rust 做 Parser：**
- Parser 不是性能瓶颈（1000 页约 1-3 秒，对比分钟级 AI 可忽略）
- npm 生态有成熟库（mammoth/docx4js）直接支持 L5
- Rust 生态的 Word/PDF 解析库不支持批注/修订/精确位置

**适配器列表（按优先级）：**

| 适配器 | 格式 | 第一版 |
|---|---|---|
| WordAdapter | .docx / .doc | ✅ V0.1 |
| PdfAdapter | .pdf | V0.4 |
| MarkdownAdapter | .md | V0.4 |
| HtmlAdapter | .html | V0.4 |
| ImageAdapter | .png/.jpg（OCR） | V0.4 |
| ExcelAdapter | .xlsx | 后续 |

---

### 3.3 Node ↔ Rust 通信 — stdio JSON-RPC

**决策：stdio JSON-RPC，不选 napi-rs**

**为什么不选 napi-rs：**
- ABI 版本与 Node/Electron 版本锁死，升级 Electron 可能被阻塞
- 调试体验差（native 段错误堆栈模糊）
- Rust panic 会导致整个 Electron 进程崩溃
- 构建工具链复杂（Rust + Node 双工具链联动）

**为什么选 stdio JSON-RPC：**
- Rust 子进程完全独立，崩溃自动重启，不影响 Electron
- 构建解耦，Rust 和 Node 各自独立编译
- 调试简单（Rust 独立日志）
- 性能影响可忽略（1000 页 AST 传输约 300-500ms，对比分钟级 AI 不敏感）

**协议设计：**

```
Node → Rust:  {"id":1,"method":"compare","params":{...}}
Rust → Node:  {"id":1,"event":"progress","data":"30%"}
Rust → Node:  {"id":1,"result":{...}}
```

**生命周期：**
- 应用启动时 spawn Rust 子进程
- 应用退出时 kill
- 子进程崩溃时自动重启
- 支持 progress event 推送（进度条）

---

### 3.4 模型策略 — 本地 + 外部双模式

**决策：用户可选择本地模型或外部模型**

#### 外部模型

| 类型 | 接口 | 覆盖范围 |
|---|---|---|
| LLM | OpenAI 兼容 API | Ollama / vLLM / DeepSeek / Qwen / OpenAI |
| Embedding | OpenAI 兼容 API (`/v1/embeddings`) | 同上 |
| OCR | 插件架构，热插拔 | 阿里云 / 百度云 / 腾讯云 / 自定义 |

用户配置 `base_url` + `api_key` + `model_name` 三条信息即可接入。

#### 本地模型

| 模型类型 | 推荐模型 | 运行时 | 大小 |
|---|---|---|---|
| Embedding | BGE-M3 / GTE | ONNX Runtime | ~1-2 GB |
| LLM | Qwen / DeepSeek (GGUF) | llama.cpp | ~4-8 GB |
| OCR | PaddleOCR | ONNX Runtime | ~500 MB |

**加载策略：懒加载 + LRU 缓存**
- 安装包不内置模型
- 用户在设置页面按需下载
- 下载后懒加载（首次使用时加载到内存）
- LRU 缓存（已用过的模型驻留内存）
- 使用本地模型前提示用户

**本地模型管理（第一版全部实现）：**
- ✅ 下载进度显示（进度条 + 百分比）
- ✅ 断点续传
- ✅ 模型版本管理（新版本发布提示更新）
- ✅ SHA256 校验（防文件损坏）
- ✅ 模型清理 / 磁盘空间管理
- ✅ 用户自定义存储路径（默认 Electron userData）

---

### 3.5 Embedding & Chunk 策略

#### Chunk 策略

```
256-512 token + 按标题/段落自然边界切分 + 10% overlap
```

- 主策略：按标题层级（Section-based），天然语义单元
- Fallback：超长 Section 按段落切
- 针对 Table：每张 table 独立成一个 chunk
- Overlap：相邻 chunk 重叠 10%，防止边界切断

#### 缓存策略

```
文档 → SHA256 hash → 查 SQLite
                      ├── 命中 → 直接取已存向量（秒开）
                      └── 未命中 → Embedding → 存 SQLite → 返回
```

第一阶段向量存 SQLite BLOB（1000 页 chunk 数最多几千条，暴力搜索够用）。

#### Embedding 比对链路

```
文档 A Chunks ──┐
                 ├── Embedding（全部向量化）  [必选]
文档 B Chunks ──┘
                       ↓
                向量相似度（余弦距离）          [必选]
                       ↓
                Top-K 候选匹配对               [必选]
                       ↓
                Rerank（精排）                 [精确模式]
                       ↓
                LLM 确认                      [精确模式]
                       ↓
                输出差异
```

| 环节 | 默认模式 | 精确模式 |
|---|---|---|
| Embedding 向量化 | ✅ | ✅ |
| 余弦相似度 + Top-K | ✅ | ✅ |
| Rerank 精排 | ❌ | ✅（额外 10-30 秒） |
| LLM 确认 | ❌ | ✅（额外 30-60 秒） |

---

### 3.6 Diff 算法策略

#### 对齐策略

主要依赖 **Embedding 语义匹配**（文档结构可能完全不同）。

#### 匹配阈值

| 模式 | 阈值 | 说明 |
|---|---|---|
| 宽松模式 | 0.6 | 追求召回率，宁可误报也不漏报 |
| 标准模式 | 0.75 | 平衡 |
| 严格模式 | 0.85 | 追求精确率，宁可漏报也不误报 |
| 用户自定义 | 手动输入 | 需提供阈值说明提示 |

#### 复杂匹配情况（第一版全部处理）

| 情况 | 说明 | 处理方式 |
|---|---|---|
| 一对多 | A 的一段拆成了 B 的两段 | 合并显示 + 拆分标记 |
| 多对一 | A 的两段合并成了 B 的一段 | 拆分显示 + 合并标记 |
| 顺序调整 | A 的第 3 段 ↔ B 的第 5 段 | 标记"顺序调整" |
| 碎片匹配 | A 的一段匹配到 B 的三段不同内容 | 标记"内容分散" |

#### Diff 结果展示方式

三种方式可选，用户自主选择：

| 方式 | 说明 | 适用 |
|---|---|---|
| 基准文档 | 以文档 A 为骨架，嵌入匹配结果 | 浏览模式，上下文完整 |
| 双栏对比 | 左右对照，匹配段落横向对齐 | 精确模式，视觉直观 |
| 时间线 | 按差异类型聚合展示 | 审查模式，快速扫描 |

#### Diff 比对层级

```
文档级 ── 元数据（文件名、作者、页数...）
  │
章节级 ── 章节增删、顺序调整、标题修改
  │
段落级 ── 段落增删、内容修改（主 Diff 层级）
  │
行内级 ── 同段落内文字增删改（inline diff）
  │
格式级 ── 同段文字字体/颜色/字号变化
  │
表格级 ── 行列增删、单元格内容变化
  │
图片级 ── 图片替换、尺寸变化、内容变化（哈希）
  │
批注级 ── 批注增删、修订记录
```

---

## 四、技术选型总表

### 前端

| 技术 | 选择 | 原因 |
|---|---|---|
| 桌面框架 | Electron | 生态成熟、自动更新、企业级实践丰富 |
| UI 框架 | React 19 + TypeScript | 组件生态完善，适合复杂交互 |
| 构建工具 | Vite | 开发体验优秀，构建速度快 |
| 样式 | TailwindCSS + shadcn/ui | 快速构建现代桌面界面 |
| 状态管理 | Zustand | 轻量、简单 |
| 服务端状态 | TanStack Query | 缓存、异步请求、任务状态管理 |
| 虚拟列表 | react-window / tanstack-virtual | 1000 页文档渲染性能 |
| 代码编辑器 | Monaco Editor（可选） | Diff 展示 |

### 后端（Rust）

| 技术 | 选择 | 原因 |
|---|---|---|
| 异步运行时 | Tokio | IO 密集任务调度 |
| CPU 并行 | Rayon | 文档解析、Embedding 并行化 |
| 序列化 | serde + serde_json | JSON AST 处理 |
| Embedding 运行时 | ONNX Runtime | 跨平台、速度快、Rust 支持好 |
| LLM 运行时 | llama.cpp (GGUF) | 本地推理成熟，支持多种开源模型 |
| 向量索引 | HNSW（第一阶段用 SQLite 暴力搜索） | 本地相似度检索 |
| 数据存储 | SQLite（rusqlite） | 配置、缓存、历史记录统一管理 |
| 日志 | tracing + tracing-subscriber | 全链路日志 |

### 文档解析（Node 层）

| 技术 | 选择 | 原因 |
|---|---|---|
| Word 解析 | mammoth / docx4js | L5 级完整提取（批注/修订/精确位置） |
| PDF 解析 | pdf.js / pdf-lib | 后续适配器 |
| Markdown 解析 | unified / remark | 后续适配器 |

### 基础设施

| 技术 | 选择 | 原因 |
|---|---|---|
| 自动更新 | electron-updater | 企业级桌面应用成熟方案 |
| 打包 | electron-builder | 多平台打包与签名支持 |
| 日志（Electron） | electron-log | 主进程日志 |

### Web UI 模式（国产化适配）

| 技术 | 选择 | 原因 |
|---|---|---|
| HTTP 框架 | axum | Tokio 官方出品，与 Rust 引擎共享 Runtime |
| WebSocket | axum::extract::ws | 内置支持，无需额外依赖 |
| 静态文件 | tower-http::ServeDir | axum 生态标准方案 |
| 通信抽象 | Transport Adapter | 前端代码 100% 共享，IPC/HTTP 可切换 |
| PWA | Service Worker + Web App Manifest | 离线缓存、安装到桌面、独立窗口 |

---

## 五、目录结构

```
document-compare/
├── apps/
│   ├── desktop/
│   │   ├── electron/           # Electron 主进程
│   │   │   ├── src/
│   │   │   │   ├── main.ts     # 入口
│   │   │   │   ├── ipc/        # IPC 处理
│   │   │   │   ├── parsers/    # 文档解析适配器
│   │   │   │   │   ├── adapter.ts    # Parser 接口
│   │   │   │   │   ├── word.ts       # Word 适配器
│   │   │   │   │   └── ...
│   │   │   │   └── updater.ts  # 自动更新
│   │   │   └── package.json
│   │   ├── renderer/           # React 前端
│   │   │   ├── src/
│   │   │   │   ├── App.tsx
│   │   │   │   ├── pages/
│   │   │   │   ├── components/
│   │   │   │   ├── stores/     # Zustand
│   │   │   │   └── hooks/
│   │   │   └── package.json
│   │   └── preload/            # 预加载脚本
│   └── rust-engine/
│       ├── core/               # 纯 Rust 核心
│       │   ├── document-ast/
│       │   ├── diff-engine/
│       │   ├── embedding/
│       │   ├── vector/
│       │   ├── chunk/
│       │   └── common/
│       ├── bridge/             # stdio JSON-RPC 桥接
│       │   └── src/
│       │       ├── main.rs
│       │       └── handler.rs
│       └── Cargo.toml
├── packages/
│   ├── ui/                     # 共享 UI 组件
│   ├── shared/                 # 共享工具
│   ├── types/                  # TypeScript 类型
│   └── hooks/                  # 共享 Hooks
├── resources/
│   └── models/                 # 模型下载目录（运行时）
├── scripts/
├── docs/
└── package.json                # Monorepo 根
```

---

## 六、数据流

### 完整比对流程

```
文件 A + 文件 B
       ↓
  Parser 适配器（Node 层）
       ↓
  Document AST（JSON）
       ↓
  Chunk 分块（256-512 token，自然边界，10% overlap）
       ↓
  SHA256 查缓存 ──→ 命中：取已存向量（秒开）
       ↓ 未命中
  Embedding 向量化（ONNX Runtime / 外部 API）
       ↓
  存入 SQLite 缓存
       ↓
  余弦相似度 + Top-K 匹配
       ↓
  阈值过滤（宽松/标准/严格/自定义）
       ↓
  对齐裁决（一对多/多对一/顺序调整/碎片匹配）
       ↓
  [精确模式] Rerank 精排
       ↓
  [精确模式] LLM 确认
       ↓
  Diff AST 生成
       ↓
  渲染展示（基准文档 / 双栏对比 / 时间线）
       ↓
  [可选] 导出报告（PDF/Word/HTML）
```

---

## 七、开发迭代计划

采用快速迭代方式，每两周一个版本。

### V0.1 — 最小可用产品

**目标：能跑通完整流水线，客户端可自动更新**

- [ ] Electron + React 脚手架搭建
- [ ] 自动更新（electron-updater）
- [ ] Parser 适配器框架（接口定义 + Word 适配器，L1~L3 级）
- [ ] JSON AST 生成
- [ ] stdio JSON-RPC 桥接 Rust 子进程
- [ ] Rust：文本 Diff（字符/段落级，不用 Embedding）
- [ ] React：基础 Diff 展示（方案 A 基准文档模式）

**验收标准**：拖入两个 Word 文档 → 显示段落级差异 → 客户端可自动更新。

---

### V0.2 — Embedding 语义比对

**目标：结构不同的文档能比**

- [ ] Chunk 策略实现（256-512 token，段落/标题自然边界，10% overlap）
- [ ] 本地 Embedding（ONNX Runtime + BGE-M3）
- [ ] 向量相似度 + 匹配阈值（三种预设 + 自定义）
- [ ] 一对多 / 多对一 / 顺序调整 / 碎片匹配处理
- [ ] Diff 结果三种展示方式（基准文档 / 双栏 / 时间线）
- [ ] 模型管理（下载 / 校验 / 缓存 / 路径 / 版本 / 磁盘管理）
- [ ] 进度展示（Embedding 进度条）

**验收标准**：两个结构不同的标书 → 找出语义对应和差异。

---

### V0.3 — L5 全保真 + 精确模式

**目标：批注/修订/格式检测，外部模型可用**

- [ ] Word 解析升级到 L5（批注/修订/精确位置）
- [ ] 格式级 Diff（字体/颜色/字号变化检测）
- [ ] 表格 Diff（行列增删、单元格对比）
- [ ] 精确模式（Rerank + LLM 确认）
- [ ] 外部模型接入（OpenAI 兼容 API）
- [ ] 本地 LLM 模型管理（llama.cpp + GGUF）

**验收标准**：能检测批注变化、格式变化；外部模型可用。

---

### V0.4 — 多格式支持 + OCR

**目标：支持 PDF、Markdown、HTML、扫描件**

- [ ] PDF 适配器
- [ ] Markdown 适配器
- [ ] HTML 适配器
- [ ] OCR 插件架构（热插拔）
- [ ] 本地 PaddleOCR 集成
- [ ] 扫描件比对流程

**验收标准**：PDF、Markdown、扫描件均可比对。

---

### V0.5 — 平台化

**目标：插件化架构，从工具变平台**

- [ ] 插件化架构（合同审查/标书审查/法规比对插件接口）
- [ ] Diff AST → 导出报告（PDF/Word/HTML）
- [ ] 批注/修订导出
- [ ] 历史记录管理
- [ ] 配置管理（主题/语言/快捷键）

**验收标准**：用户可以安装插件扩展新场景。

---

### V1.0 — 正式发布

**目标：性能达标，稳定性可靠**

- [ ] 1000 页文档性能优化实测
- [ ] 大文档虚拟滚动优化
- [ ] 内存优化（LRU 缓存策略调优）
- [ ] 多平台测试（Windows / macOS / Linux）
- [ ] 安装包签名
- [ ] 用户文档 / 使用教程
- [ ] Bug 修复与稳定性

**验收标准**：1000 页文档在合理时间内完成；多平台稳定运行。

---

### V1.1 — 双模式架构 + 国产化适配

**目标：Web UI 模式上线，覆盖信创/国产化终端**

- [ ] 通信层抽象（Transport Adapter 接口 + Electron IPC / HTTP-WS 双实现）
- [ ] Rust HTTP Server 模式（axum，与现有 stdio 模式共存）
- [ ] 前端 Web UI 入口（Vite 多入口构建）
- [ ] PWA 增强（Service Worker、Web App Manifest、独立窗口）
- [ ] 本地 HTTP Server 安全加固（localhost 绑定、Token 认证、CSRF 防护）
- [ ] Web UI 模式安装包（Linux x64/arm64，~20MB）
- [ ] 麒麟 V10 / 统信 UOS 真机验证
- [ ] 龙芯 LoongArch 交叉编译与 Web UI 验证

**验收标准**：麒麟/统信/龙芯环境下，系统浏览器访问 Web UI 完成文档比对全流程。详细设计参见 [[软件设计说明书/13-双模式架构与国产化适配.md]]。

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| Word L5 解析库不成熟 | 批注/修订提取不完整 | 预研 mammoth/docx4js，必要时自研补充 |
| 1000 页 Embedding 耗时过长 | 用户等待体验差 | 分批 Embedding + 进度展示 + 缓存复用 |
| Electron 包体积过大 | 下载/安装慢 | 按需加载模块，模型不内置 |
| Rust 子进程内存占用 | 大文档可能 OOM | LRU 缓存 + 内存上限配置 |
| 外部模型 API 不稳定 | 比对失败 | 重试机制 + 降级到本地模型 |
| 跨平台兼容性 | 各平台行为不一致 | CI 多平台测试 + 早期发现 |
| 国产化 OS 兼容性 | Electron 在麒麟/龙芯上无法启动 | Web UI 双模式架构，详见 [[软件设计说明书/13-双模式架构与国产化适配.md]] |

---

## 九、附录

### A. 参考文档

- 原始需求文档：`nova-agents-files/【需求】文档AI审核.docx`
- 初始设计讨论：`nova-agents-files/标书对比检测.md`、`标书对比检测 1.md`

### B. 术语表

| 术语 | 说明 |
|---|---|
| Document AST | 文档抽象语法树，统一的文档内部表示 |
| Chunk | 文档分块，Embedding 的最小单位 |
| L5 全保真 | 包含批注、修订、精确位置的最高保真级别 |
| 适配器模式 | Parser 的扩展模式，每种文档格式一个适配器 |
| stdio JSON-RPC | Node 与 Rust 子进程的通信协议 |
| LRU 缓存 | 最近最少使用缓存策略 |
| HNSW | 分层可导航小世界图，向量索引算法 |

---

## 十、详细设计

### D1 — JSON AST Schema

#### D1.1 节点类型体系

**块级节点（Block）：**

| 节点类型 | 说明 |
|---|---|
| `Document` | 文档根节点 |
| `Section` | 章节（含标题层级） |
| `Paragraph` | 段落 |
| `Table` | 表格 |
| `TableRow` | 表格行 |
| `TableCell` | 表格单元格 |
| `Image` | 图片 |
| `List` | 列表（有序/无序） |
| `ListItem` | 列表项 |

**行内节点（Inline）：**

| 节点类型 | 说明 |
|---|---|
| `TextRun` | 文本片段（带格式） |
| `LineBreak` | 换行 |
| `InlineImage` | 行内图片 |
| `Hyperlink` | 超链接 |
| `FieldCode` | 域代码（Word 特有，如目录、交叉引用） |
| `Equation` | 公式 |

**文档结构节点：**

| 节点类型 | 说明 |
|---|---|
| `Header` | 页眉 |
| `Footer` | 页脚 |
| `Footnote` | 脚注 |
| `Endnote` | 尾注 |
| `Comment` | 批注 |
| `Revision` | 修订记录 |
| `Bookmark` | 书签 |
| `PageBreak` | 分页符 |

**元数据节点：**

| 节点类型 | 说明 |
|---|---|
| `Metadata` | 文档元数据（标题、作者、创建时间等） |
| `Style` | 样式定义（可引用） |

#### D1.2 核心节点属性定义

**Document（文档根节点）：**

```json
{
  "type": "document",
  "metadata": {
    "title": "标书文件",
    "author": "张三",
    "created_at": "2026-01-01T00:00:00Z",
    "modified_at": "2026-07-01T00:00:00Z",
    "page_count": 1200,
    "word_count": 500000,
    "application": "Microsoft Word 2021",
    "revision": 5,
    "warnings": []
  },
  "children": [ ... ]
}
```

**Section（章节）：**

```json
{
  "type": "section",
  "level": 1,
  "number": "1.2",
  "title": "项目概述",
  "children": [ ... ]
}
```

**Paragraph（段落）：**

```json
{
  "type": "paragraph",
  "style": {
    "alignment": "left",
    "indent_first": 32,
    "indent_left": 0,
    "line_spacing": 1.5,
    "space_before": 0,
    "space_after": 6,
    "list_level": 0,
    "list_format": "decimal",
    "list_prefix": "1."
  },
  "children": [ ... ]
}
```

**TextRun（文本片段）：**

```json
{
  "type": "text_run",
  "text": "项目概述",
  "style": {
    "font_family": "宋体",
    "font_size": 14,
    "bold": true,
    "italic": false,
    "underline": "none",
    "strikethrough": false,
    "color": "#000000",
    "background": "transparent",
    "vertical_align": "baseline",
    "character_spacing": 0
  }
}
```

**Table（表格）：**

```json
{
  "type": "table",
  "properties": {
    "width": 500,
    "alignment": "center",
    "borders": { ... },
    "cell_padding": { ... }
  },
  "children": [
    {
      "type": "table_row",
      "children": [
        {
          "type": "table_cell",
          "colspan": 2,
          "rowspan": 1,
          "width": 250,
          "vertical_align": "center",
          "background": "#f5f5f5",
          "children": [ ... ]
        }
      ]
    }
  ]
}
```

**Comment（批注）：**

```json
{
  "type": "comment",
  "id": "doc::c1",
  "author": "李四",
  "created_at": "2026-06-15T10:30:00Z",
  "content": "此处需要补充详细说明",
  "resolved": false,
  "anchor": {
    "start": { "paragraph_index": 5, "char_offset": 10 },
    "end": { "paragraph_index": 5, "char_offset": 20 }
  }
}
```

**Revision（修订记录）：**

```json
{
  "type": "revision",
  "id": "doc::r1",
  "author": "王五",
  "created_at": "2026-06-20T14:00:00Z",
  "revision_type": "insert",
  "content": "新增的文字",
  "anchor": {
    "paragraph_index": 8,
    "char_offset": 5
  }
}
```

`revision_type` 可选值：`insert`（插入）、`delete`（删除）、`format`（格式变更）

**Equation（公式）：**

```json
{
  "type": "equation",
  "format": "mathml",
  "content": "<math xmlns=\"...\">...</math>",
  "latex": "E = mc^2",
  "fallback_text": "E = mc²",
  "width": 120,
  "height": 30
}
```

公式同时存储 MathML（原格式保真）和 LaTeX（方便渲染和编辑）。

#### D1.3 节点 ID 设计

采用**路径式 ID**，人类可读 + 机器易读。

格式：`doc::s1::p3::r2`（文档::章节1::段落3::文本片段2）

| 节点 | ID | 含义 |
|---|---|---|
| 文档根 | `doc` | 根节点 |
| 第一章 | `doc::s1` | 第一个 Section |
| 第一章第二节 | `doc::s1::s2` | 第一个 Section 下的第二个子 Section |
| 第一章第二节第三段 | `doc::s1::s2::p3` | 段落 |
| 该段落的第二个 TextRun | `doc::s1::s2::p3::r2` | 行内节点 |
| 表格第二行第三列 | `doc::s1::s2::t1::tr2::tc3` | 表格单元格 |
| 批注 | `doc::c1` | 第一个批注 |

不限长度，不补零，保持自然数字。

#### D1.4 编号处理策略

**自动编号：** 读取 Word 的编号定义（`abstractNum`），追踪每个段落的编号层级，生成 `number` 字段。

**手动编号：** 从段落文本开头提取编号模式，正则匹配常见格式（`1.`、`1.1`、`第一章`、`一、`、`（一）` 等），去除文本中的编号部分，存入 `number` 字段。

**编号异常检测与提示：**

| 异常类型 | 示例 | 提示 |
|---|---|---|
| 跳号 | 1.1 → 1.3（缺 1.2） | ⚠ "编号 1.2 缺失" |
| 重复 | 1.1 → 1.1 | ⚠ "编号 1.1 重复" |
| 层级错乱 | 1.1 → 1.1.1.1（跳级） | ⚠ "编号层级异常" |
| 格式混用 | "第一章" 和 "1." 混用 | ⚠ "编号格式不一致" |
| 自动与手动冲突 | 自动编号是 1.1，但文本前写的是 "1.2" | ⚠ "自动编号与文本编号不一致" |

Parser 解析时记录异常到 `metadata.warnings`，渲染时在界面上用黄色警告条展示。

---

### D2 — Parser 适配器接口设计

#### D2.1 适配器接口定义

```typescript
interface DocumentParser {
  readonly name: string;
  readonly supportedExtensions: string[];
  readonly supportedFidelityLevel: number; // 1~5

  parse(input: ParseInput, options: ParseOptions): Promise<ParseResult>;
  validate(input: ParseInput): Promise<ValidationResult>;
}

interface ParseInput {
  file: Buffer;
  filename: string;
  mimeType?: string;
}

interface ParseOptions {
  fidelityLevel: 1 | 2 | 3 | 4 | 5;
  extractComments: boolean;
  extractRevisions: boolean;
  extractHeaders: boolean;
  extractFooters: boolean;
  numberingDetect: boolean;
  onProgress?: (progress: ParseProgress) => void;
}

interface ParseProgress {
  phase: 'loading' | 'parsing' | 'building_ast' | 'validating';
  percent: number;
  current_page?: number;
  total_pages?: number;
  message?: string;
}

interface ParseResult {
  ast: DocumentAST;
  warnings: ParseWarning[];
  statistics: ParseStatistics;
}

interface ParseWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  location?: NodeID;
}

interface ParseStatistics {
  page_count: number;
  paragraph_count: number;
  table_count: number;
  image_count: number;
  comment_count: number;
  revision_count: number;
  equation_count: number;
  parse_time_ms: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  estimated_pages?: number;
}
```

#### D2.2 设计决策

| 决策项 | 方案 |
|---|---|
| **保真级别降级** | 混合策略：能提取的提取，不能的留空，在 warnings 里说明 |
| **大文件处理** | 第一阶段用 Buffer 整体读入，后续优化流式 |

---

### D3 — stdio JSON-RPC 协议定义

#### D3.1 消息格式

所有消息都是一行一个 JSON，以 `\n` 结尾。

**请求（Node → Rust）：**

```json
{"id": "req_001", "method": "compare", "params": { ... }}
```

**成功响应：**

```json
{"id": "req_001", "result": { ... }}
```

**失败响应：**

```json
{"id": "req_001", "error": {"code": "DIFF_FAILED", "message": "...", "details": { ... }}}
```

**进度事件：**

```json
{"id": "req_001", "event": "progress", "data": {"phase": "embedding", "percent": 45, "message": "..."}}
```

#### D3.2 方法列表

| 方法 | 方向 | 说明 |
|---|---|---|
| `ping` | Node → Rust | 心跳检测 |
| `compare` | Node → Rust | 执行比对（核心方法） |
| `embed` | Node → Rust | 单文档 Embedding（预热/缓存） |
| `load_model` | Node → Rust | 加载指定模型到内存 |
| `unload_model` | Node → Rust | 卸载模型释放内存 |
| `model_status` | Node → Rust | 查询模型加载状态 |
| `health` | Node → Rust | 查询引擎健康状态 |
| `cancel` | Node → Rust | 取消进行中的任务 |

#### D3.3 compare 方法参数

**请求参数：**

```json
{
  "id": "req_001",
  "method": "compare",
  "params": {
    "doc_a": { "ast": { ... }, "source_filename": "标书A.docx" },
    "doc_b": { "ast": { ... }, "source_filename": "标书B.docx" },
    "options": {
      "mode": "standard",
      "fidelity_level": 5,
      "threshold": 0.75,
      "enable_rerank": false,
      "enable_llm_confirm": false,
      "chunk_size": 384,
      "chunk_overlap": 0.1
    }
  }
}
```

**成功返回：**

```json
{
  "id": "req_001",
  "result": {
    "diff_ast": { ... },
    "statistics": {
      "total_chunks_a": 520,
      "total_chunks_b": 580,
      "matched_pairs": 410,
      "added": 85,
      "deleted": 45,
      "modified": 60,
      "unchanged": 350,
      "embedding_time_ms": 45000,
      "match_time_ms": 1200,
      "diff_time_ms": 800,
      "total_time_ms": 47000
    }
  }
}
```

#### D3.4 错误码体系

| 错误码 | 含义 | 常见原因 |
|---|---|---|
| `MODEL_NOT_FOUND` | 模型未找到 | 本地模型未下载 |
| `MODEL_LOAD_FAILED` | 模型加载失败 | 文件损坏、内存不足 |
| `EMBEDDING_FAILED` | Embedding 失败 | ONNX Runtime 错误 |
| `DIFF_FAILED` | Diff 失败 | AST 格式异常 |
| `INVALID_INPUT` | 输入无效 | AST 缺失必要字段 |
| `TIMEOUT` | 超时 | 任务执行时间过长 |
| `OUT_OF_MEMORY` | 内存不足 | 文档过大 |
| `PROCESS_CRASHED` | 子进程崩溃 | 会自动重启 |
| `CANCELLED` | 已取消 | 用户主动取消 |

#### D3.5 取消机制

不设固定超时，Node 侧可发送 `cancel` 请求取消进行中的任务。

```json
{"id": "cancel_001", "method": "cancel", "params": {"target_id": "req_001"}}
```

Rust 收到后中断当前任务，返回 `CANCELLED` 错误。

---

### D4 — SQLite 表结构设计

#### D4.1 表清单

| 表名 | 用途 | 第一版 |
|---|---|---|
| `document_cache` | 文档缓存（SHA256 → AST） | ✅ |
| `embedding_cache` | Embedding 缓存（chunk → 向量） | ✅ |
| `compare_history` | 比对历史记录 | ✅ |
| `model_registry` | 本地模型管理 | ✅ |
| `settings` | 用户配置 | ✅ |

#### D4.2 表结构

**document_cache：**

```sql
CREATE TABLE document_cache (
  id              TEXT PRIMARY KEY,     -- SHA256(file_content)
  filename        TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  page_count      INTEGER,
  ast_blob        BLOB NOT NULL,        -- gzip 压缩后的 JSON AST
  ast_size        INTEGER NOT NULL,
  fidelity_level  INTEGER NOT NULL,
  parser_name     TEXT NOT NULL,
  parse_time_ms   INTEGER,
  warnings_json   TEXT,
  created_at      TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  access_count    INTEGER DEFAULT 1
);
```

存储方案：gzip BLOB（1000 页 AST 压缩后 10-20MB，解压耗时 100-200ms）。

**embedding_cache：**

```sql
CREATE TABLE embedding_cache (
  id          TEXT PRIMARY KEY,     -- SHA256(doc_hash + chunk_text)
  doc_hash    TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text  TEXT NOT NULL,
  chunk_start INTEGER,
  chunk_end   INTEGER,
  vector_blob BLOB NOT NULL,        -- Float32 二进制向量
  model_name  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_embedding_doc ON embedding_cache(doc_hash);
```

存储方案：Float32 BLOB（4 bytes × 维度，计算余弦距离时直接读取）。

**compare_history：**

```sql
CREATE TABLE compare_history (
  id              TEXT PRIMARY KEY,     -- UUID
  doc_a_hash      TEXT NOT NULL,
  doc_a_filename  TEXT NOT NULL,
  doc_b_hash      TEXT NOT NULL,
  doc_b_filename  TEXT NOT NULL,
  mode            TEXT NOT NULL,
  fidelity_level  INTEGER NOT NULL,
  threshold       REAL NOT NULL,
  statistics_json TEXT NOT NULL,
  diff_ast_blob   BLOB,                -- 可选：gzip 压缩的 Diff 结果
  created_at      TEXT NOT NULL,
  duration_ms     INTEGER NOT NULL,
  status          TEXT NOT NULL         -- 'completed' | 'failed' | 'cancelled'
);
```

**model_registry：**

```sql
CREATE TABLE model_registry (
  id                TEXT PRIMARY KEY,   -- 如 'bge-m3'
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,      -- 'embedding' | 'llm' | 'ocr'
  version           TEXT,
  source            TEXT NOT NULL,      -- 'local' | 'external'
  storage_path      TEXT,
  file_size         INTEGER,
  sha256            TEXT,
  download_status   TEXT,               -- 'not_downloaded' | 'downloading' | 'ready' | 'corrupted'
  download_progress REAL DEFAULT 0,
  config_json       TEXT,
  last_used_at      TEXT,
  created_at        TEXT NOT NULL
);
```

**settings：**

```sql
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

预置 key：

| key | 默认值 | 说明 |
|---|---|---|
| `fidelity_level` | `5` | 默认保真级别 |
| `diff_threshold` | `0.75` | 默认匹配阈值 |
| `diff_mode` | `standard` | 默认展示方式 |
| `chunk_size` | `384` | Chunk 大小 |
| `chunk_overlap` | `0.1` | Overlap 比例 |
| `model_storage_path` | `userData/models` | 模型存储路径 |
| `theme` | `system` | 主题 |
| `language` | `zh-CN` | 语言 |
| `auto_update` | `true` | 自动更新 |
| `max_cache_size_gb` | `10` | 缓存空间上限 |

---

### D5 — React 渲染层设计

#### D5.1 页面结构

```
App
├── Home（首页）
│   └── 最近比对记录 + 新建比对入口
├── Compare（比对主页面）
│   ├── 文件选择区（拖拽/选择 A 和 B）
│   ├── 比对配置区（模式/阈值/保真级别）
│   ├── 进度展示区（比对进度条）
│   └── 结果展示区（三种展示方式）
│       ├── 基准文档模式
│       ├── 双栏对比模式
│       └── 时间线模式
├── Settings（设置）
│   ├── 模型管理（下载/删除/路径）
│   ├── 比对默认配置
│   ├── 外部模型配置（API key/base_url）
│   ├── 缓存管理
│   └── 主题/语言
└── PluginStore（插件市场，V0.5）
```

#### D5.2 结果展示区组件架构

```
CompareResultView
├── ResultToolbar          // 切换展示方式 / 导出 / 搜索差异
├── ResultStatsBar         // 统计摘要：新增 X 处 / 删除 Y 处 / 修改 Z 处
├── BaseDocView            // 方案 A：基准文档
│   ├── VirtualScroll
│   └── DiffBlock
├── SideBySideView         // 方案 B：双栏对比
│   ├── VirtualScroll × 2（同步滚动）
│   ├── DiffBlockLeft
│   └── DiffBlockRight
└── TimelineView           // 方案 C：时间线
    ├── DiffCategory       // 按类型分组
    └── DiffItem           // 每个差异条目
```

#### D5.3 虚拟滚动策略

采用**动态测量 + 预估高度**：
- 未渲染的 block 用预估高度（根据文字长度/类型估算）
- 渲染后替换为真实高度并缓存
- 滚动位置用已缓存的真实高度 + 未渲染的预估高度计算

#### D5.4 双栏同步滚动

采用**匹配锚点同步 + 手动微调**：
- 默认按匹配对自动同步
- 用户可以鼠标单独滚动某一侧（解锁同步）
- 点击"重新同步"按钮恢复

#### D5.5 差异高亮视觉设计

| 差异类型 | 颜色 | 样式 |
|---|---|---|
| 新增 | 绿色背景 | `rgba(46,139,110,0.15)` + 左边框 |
| 删除 | 红色背景 | `rgba(194,80,48,0.15)` + 左边框 + 删除线 |
| 修改 | 黄色背景 | `rgba(218,168,48,0.15)` + 左边框 |
| 格式变化 | 蓝色虚线边框 | 不改背景，只标边框 |
| 顺序调整 | 紫色箭头 | 显示从→到的箭头指示 |
| 未变化 | 无特殊样式 | 正常显示，可折叠 |

默认逐段高亮（性能好），鼠标 hover 某个修改段落时展开逐字 Diff（体验好）。

---

### D6 — 插件化架构接口设计

#### D6.1 插件类型

| 插件类型 | 职责 | 示例 |
|---|---|---|
| **Parser 插件** | 新增文档格式支持 | Excel 适配器、PPT 适配器 |
| **OCR 插件** | 新增 OCR 服务接入 | 阿里云 OCR、百度云 OCR |
| **Workflow 插件** | 新增业务分析流程 | 合同审查、标书比对、法规检查 |

#### D6.2 插件接口定义

```typescript
interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: 'parser' | 'ocr' | 'workflow';
  author: string;
  description: string;
  entry: string;
  min_app_version: string;
  dependencies?: string[];
  config_schema?: object;
}

// Parser 插件
interface ParserPlugin extends DocumentParser {
  manifest: PluginManifest;
  onInstall(): Promise<void>;
  onUninstall(): Promise<void>;
  onActivate(): Promise<void>;
  onDeactivate(): Promise<void>;
}

// OCR 插件
interface OcrPlugin {
  manifest: PluginManifest;
  recognize(image: Buffer, options: OcrOptions): Promise<OcrResult>;
  onInstall(): Promise<void>;
  onUninstall(): Promise<void>;
  onActivate(): Promise<void>;
  onDeactivate(): Promise<void>;
}

// Workflow 插件
interface WorkflowPlugin {
  manifest: PluginManifest;
  analyze(diffAst: DiffAST, options: WorkflowOptions): Promise<AnalysisReport>;
  getPanelComponent(): React.ComponentType;
  onInstall(): Promise<void>;
  onUninstall(): Promise<void>;
  onActivate(): Promise<void>;
  onDeactivate(): Promise<void>;
}
```

#### D6.3 插件生命周期

```
下载插件包（.zip）
    ↓
onInstall()     ← 解压、检查依赖、注册
    ↓
onActivate()    ← 加载到内存、初始化
    ↓
正常使用        ← 调用插件方法
    ↓
onDeactivate()  ← 卸载内存、清理资源
    ↓
onUninstall()   ← 删除文件、注销
```

#### D6.4 插件存放与加载

| 项目 | 方案 |
|---|---|
| 插件格式 | `.zip` 包，内含 `manifest.json` + 入口 JS + 资源文件 |
| 存放目录 | `userData/plugins/` |
| 加载时机 | 应用启动时扫描目录，按 `onActivate` 激活 |
| 沙箱 | 第一阶段用 Node vm 模块，V0.5 考虑 Worker 线程 |
| 配置 | 每个插件独立配置，存 SQLite settings 表（key 前缀 `plugin:{id}:`） |

#### D6.5 插件与核心的通信

**Core API（插件可调用）：**

| 方法 | 说明 |
|---|---|
| `embed(text)` | 文本向量化 |
| `diff(ast_a, ast_b)` | 执行 Diff |
| `chunk(ast, options)` | 文档分块 |
| `llm(prompt)` | 调用 LLM |
| `ocr(image)` | 图片识别 |
| `query(sql)` | 查询 SQLite |
| `getConfig(key)` | 读取配置 |
| `setConfig(key, value)` | 写入配置 |
| `log(level, message)` | 写日志 |

**Plugin API（核心调用插件）：**

| 插件类型 | 调用方法 |
|---|---|
| Parser 插件 | `parse(file) → ast` |
| OCR 插件 | `recognize(image) → text` |
| Workflow 插件 | `analyze(diff) → report` |

---

### D7 — Diff AST Schema 设计

#### D7.1 顶层结构

Diff AST 是比对引擎的输出，渲染层的输入。采用**仅存引用**方案：Diff AST 只存节点 ID 引用，不内嵌原始 AST，渲染时从 `document_cache` 表取原始 AST。

```json
{
  "type": "diff_result",
  "version": "1.0",
  "created_at": "2026-07-05T10:30:00Z",
  "doc_a": {
    "source_filename": "标书A.docx",
    "ast_hash": "sha256:abc123..."
  },
  "doc_b": {
    "source_filename": "标书B.docx",
    "ast_hash": "sha256:def456..."
  },
  "matches": [ ... ],
  "unmatched_a": [ ... ],
  "unmatched_b": [ ... ],
  "statistics": { ... },
  "metadata": {
    "mode": "standard",
    "fidelity_level": 5,
    "threshold": 0.75,
    "chunk_size": 384,
    "chunk_overlap": 0.1,
    "enable_rerank": false,
    "enable_llm_confirm": false
  }
}
```

#### D7.2 Match（匹配对）

每个 Match 代表文档 A 的一组节点和文档 B 的一组节点之间的对应关系。

```json
{
  "id": "match_001",
  "type": "match",
  "match_type": "1:1",
  "confidence": 0.92,
  "similarity": 0.88,
  "source_a": {
    "node_ids": ["doc::s1::p3"],
    "text_preview": "甲方应在30日内完成付款..."
  },
  "source_b": {
    "node_ids": ["doc::s2::p1"],
    "text_preview": "甲方须在三十日内完成支付..."
  },
  "diff": { ... },
  "match_category": "modified"
}
```

**match_type 可选值：**

| match_type | 含义 | 示例 |
|---|---|---|
| `1:1` | 一对一匹配 | A 的第 3 段 ↔ B 的第 1 段 |
| `1:N` | 一对多（拆分） | A 一段 ↔ B 两段 |
| `N:1` | 多对一（合并） | A 两段 ↔ B 一段 |
| `N:M` | 多对多（碎片匹配） | A 三段 ↔ B 两段 |

**match_category 可选值：**

| match_category | 含义 | 判断依据 |
|---|---|---|
| `unchanged` | 未变化 | similarity ≥ 0.95 且无格式变化 |
| `modified` | 内容修改 | 0.75 ≤ similarity < 0.95 |
| `reformatted` | 仅格式变化 | similarity ≥ 0.95 但有格式差异 |
| `reordered` | 顺序调整 | 匹配节点在各自文档中位置差异较大 |
| `split` | 拆分 | match_type = 1:N |
| `merged` | 合并 | match_type = N:1 |

#### D7.3 Diff Detail（差异详情）

每个 Match 内部的差异详情，支持多层级。

**text_diff（文本差异）：**

```json
{
  "text_diff": {
    "has_changes": true,
    "operations": [
      { "op": "equal", "text": "甲方应在" },
      { "op": "delete", "text": "30日" },
      { "op": "insert", "text": "三十日" },
      { "op": "equal", "text": "内完成" },
      { "op": "delete", "text": "付款" },
      { "op": "insert", "text": "支付" },
      { "op": "equal", "text": "..." }
    ]
  }
}
```

粒度：**中文按字，英文按单词**（与 git diff 行为一致）。

**style_diff（格式差异）：**

```json
{
  "style_diff": {
    "has_changes": true,
    "changes": [
      {
        "property": "font_size",
        "old_value": 12,
        "new_value": 14,
        "affected_range": { "start": 0, "end": 10 }
      },
      {
        "property": "bold",
        "old_value": false,
        "new_value": true,
        "affected_range": { "start": 0, "end": 5 }
      }
    ]
  }
}
```

property 可选值：`font_family`、`font_size`、`bold`、`italic`、`underline`、`strikethrough`、`color`、`background`、`alignment`、`indent_first`、`indent_left`、`line_spacing`、`space_before`、`space_after`

**table_diff（表格差异）：**

```json
{
  "table_diff": {
    "has_changes": true,
    "row_changes": [
      { "type": "add", "index": 3, "content": "..." },
      { "type": "delete", "index": 5, "content": "..." },
      { "type": "modify", "index": 2, "cell_changes": [
        { "col": 1, "old": "旧值", "new": "新值" }
      ]}
    ],
    "col_changes": []
  }
}
```

**comment_diff（批注差异）：**

```json
{
  "comment_diff": {
    "has_changes": true,
    "added": [
      { "author": "李四", "content": "此处需要修改", "position": 5 }
    ],
    "deleted": [],
    "modified": []
  }
}
```

**revision_diff（修订差异）：**

```json
{
  "revision_diff": {
    "has_changes": false,
    "changes": []
  }
}
```

#### D7.4 Unmatched（未匹配内容）

```json
{
  "unmatched_a": [
    {
      "node_id": "doc::s1::p5",
      "text_preview": "依据《XX管理办法》...",
      "reason": "no_match_in_b",
      "confidence": 0.0
    }
  ],
  "unmatched_b": [
    {
      "node_id": "doc::s2::p3",
      "text_preview": "本规范所称...",
      "reason": "no_match_in_a",
      "confidence": 0.0
    }
  ]
}
```

reason 可选值：`no_match_in_b`（A 有 B 无，删除）、`no_match_in_a`（B 有 A 无，新增）、`below_threshold`（有候选但低于阈值）、`excluded_by_user`（用户手动排除）

#### D7.5 Statistics（统计信息）

```json
{
  "statistics": {
    "total_nodes_a": 1200,
    "total_nodes_b": 1350,
    "matched_pairs": 980,
    "unchanged": 720,
    "modified": 180,
    "reformatted": 30,
    "reordered": 15,
    "split": 20,
    "merged": 15,
    "added": 150,
    "deleted": 70,
    "similarity_score": 0.82,
    "embedding_time_ms": 45000,
    "match_time_ms": 1200,
    "diff_time_ms": 800,
    "total_time_ms": 47000,
    "model_used": "bge-m3",
    "threshold_used": 0.75
  }
}
```

`similarity_score`（0~1）为整体相似度，可快速判断两份文档差异大小。
