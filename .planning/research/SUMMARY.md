# Research Summary: MinerU PDF 解析集成调研

**Date:** 2026-07-22
**Confidence:** MEDIUM — based on training data + codebase inspection; MinerU details need live verification

## 核心发现

**MinerU 是可行的 PDF 解析增强方案，但集成到 Electron 桌面应用面临重大挑战。**

### 关键问题解答

| 问题 | 答案 |
|------|------|
| MinerU 是否必须依赖 Python？ | **是** — MinerU 是纯 Python 库，无 Node.js/Rust/WASM 移植 |
| 有无其他接入方式？ | CLI (`magic-pdf` 命令)、Python API、REST（需自建） |
| 推荐集成方式？ | **预处理工具模式**（Approach C）— Electron 零 Python 依赖 |

## 技术栈评估

### MinerU 依赖重量

| 组件 | 大小 | 说明 |
|------|------|------|
| PyTorch | ~2-4 GB | 深度学习推理 |
| PaddlePaddle + PaddleOCR | ~500MB-1GB | OCR 引擎 |
| ONNX Runtime | ~200MB | 模型推理 |
| 模型权重 | ~500MB-1GB | 布局/OCR/表格模型 |
| **总计** | **4-5+ GB** | 不含 Python 本身 |

### 当前解析器差距

| 能力 | pdf-parse (当前) | MinerU |
|------|-----------------|--------|
| 文本提取 | ✅ 基础 | ✅ 布局感知 |
| 表格提取 | ❌ | ✅ HTML/结构化 |
| 扫描PDF OCR | ❌ | ✅ PaddleOCR |
| 多栏布局 | ❌ | ✅ 列检测 |
| 公式识别 | ❌ | ✅ LaTeX |

## 推荐集成路径

### Approach C: 预处理工具模式（推荐）

```
┌─────────────────────────────────────────────────────┐
│  用户机器（离线）                                      │
│  ┌─────────────┐    ┌─────────────────┐             │
│  │ Electron App │    │ MinerU CLI      │             │
│  │ (Node.js)    │    │ (Python)        │             │
│  │              │    │                 │             │
│  │ 读取 JSON ───┼───→│ 输出 _content_  │             │
│  │ → DocumentAst│    │ list.json       │             │
│  └─────────────┘    └─────────────────┘             │
└─────────────────────────────────────────────────────┘

# 开发者/管理员预处理（GPU机器）
python preprocess.py --input ./bid_docs/ --output ./parsed/

# Electron 读取预解析 JSON
Main Process → readJson(path) → map to DocumentAst
```

**优势:**
- Electron 零 Python 依赖
- 预处理可在 GPU 机器上运行
- 打包大小不受影响

**劣势:**
- 两步工作流（用户需先预处理）
- 非实时解析

## 集成架构

### 数据流

```
PDF 文件
  ↓
MinerU CLI (magic-pdf -p input.pdf -o output -m auto)
  ↓
_content_list.json (结构化 JSON: type, text/html, bbox, page_idx)
  ↓
TypeScript Mapper (MinerU JSON → DocumentAst)
  ├── ParagraphNode ← text blocks
  ├── TableNode ← table HTML → 解析为行列
  └── SectionNode ← title blocks
  ↓
DocumentAst.blocks[]
  ↓
Rust Engine (review-core)
```

### 代码集成点

| 组件 | 文件 | 修改内容 |
|------|------|---------|
| Parser Registry | `packages/shared/src/parser/index.ts` | 添加 MinerU parser |
| MinerU Parser | `packages/shared/src/parser/mineru/index.ts` | 新文件：JSON → DocumentAst |
| Main Process | `apps/desktop/src/main/services/risk-review-service.ts` | 调用 MinerU parser |
| IPC | `packages/shared/src/ipc.ts` | 可选：添加 MinerU 状态查询 |

## 风险与陷阱

### 高风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 依赖 4-5GB | 打包爆炸 | 预处理模式，不打包 Python |
| 模型下载 4-8GB | 离线用户无法使用 | 捆绑模型或 ModelScope 镜像 |
| HuggingFace 中国被墙 | 首次运行失败 | HF_ENDPOINT 或 ModelScope |
| 冷启动 15秒 | UX 退化 | 后台预热 + 加载指示器 |

### 中风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| MinerU 输出格式 != DocumentAst | 证据链接断裂 | Adapter 层映射 |
| Windows CUDA 检测失败 | GPU 用户降级到 CPU | 捆绑 CPU-only PyTorch |
| macOS 签名问题 | Gatekeeper 拦截 | afterSign 签钩子 |

## 路线图建议

### Phase 1: 可行性验证（最高优先级）

1. **验证 MinerU 输出格式** — 用真实投标 PDF 测试，确认 `_content_list.json` schema
2. **编写 JSON → DocumentAst mapper** — 处理 text/table/title blocks
3. **对比现有解析器** — 同一 PDF，比较 pdf-parse 和 MinerU 输出

### Phase 2: 集成实现

4. **实现 MinerU parser** — 遵循现有 ParserRegistry 模式
5. **保留 pdf-parse 作为后备** — 简单数字 PDF 用 pdf-parse，复杂/扫描用 MinerU
6. **添加检测启发式** — 如果 pdf-parse 每页 <N 字符，尝试 MinerU

### Phase 3: 分发（如需）

7. **评估打包方案** — python-embed vs PyInstaller vs 用户自行安装
8. **构建预处理 CLI** — 作为独立工具分发
9. **模型捆绑或镜像** — 解决离线访问问题

## 待验证问题

1. **MinerU 输出格式** — 训练数据是 2025 年前，API 可能已变更
2. **content_list.json schema** — 需要实际运行确认
3. **版本稳定性** — MinerU 迭代快，需锁定版本
4. **中文投标文档质量** — 需实际测试
5. **CPU-only 性能** — 是否可接受？

## 决策建议

| 决策 | 建议 | 理由 |
|------|------|------|
| 是否集成 MinerU？ | **是，但分阶段** | 填补 OCR/表格空白，是产品竞争力关键 |
| 集成方式？ | **预处理工具模式** | 最小侵入性，符合离线优先 |
| Python 依赖？ | **不打包到 Electron** | 4-5GB 不可接受 |
| 替代 pdf-parse？ | **否，共存** | MinerU 是增强，不是替代 |

## 下一步

1. 在实际机器上运行 MinerU，验证输出格式
2. 编写 PoC mapper：MinerU JSON → DocumentAst
3. 用真实投标文档测试映射质量

---

**研究文件:**
- `FEATURES.md` — 功能全景、集成方案、MVP 建议
- `PITFALLS.md` — 12 个陷阱、缓解措施、决策矩阵
- `ARCHITECTURE.md` — 当前架构、集成点、数据流
