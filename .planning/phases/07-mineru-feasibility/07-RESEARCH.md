# Phase 7: MinerU 可行性验证 - Research

**Researched:** 2026-07-22
**Domain:** MinerU PDF parsing engine, Docker deployment, Chinese OCR
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 使用 Docker 部署 MinerU（而非 pip install）-- 隔离环境，避免依赖冲突
- 使用 -m auto 模式测试 -- 自动检测数字/扫描 PDF
- 用真实投标 PDF 测试，检查 _content_list.json 输出格式
- 写入 07-VALIDATION.md 记录测试结果
- 性能基准：<30秒/页可接受，>60秒不可接受
- 同一 PDF 对比 pdf-parse 和 MinerU 输出

### Claude's Discretion
Docker 部署方式的具体实现（镜像选择、卷挂载、环境变量）由 Claude 决定。

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MINERU-01 | 验证 MinerU CLI 输出格式 -- 运行 `magic-pdf` 命令处理真实投标 PDF，确认 `_content_list.json` schema 和字段结构 | output_files.md 文档详细定义了 content_list.json 的 schema；需实际运行验证 |
| MINERU-02 | 验证 MinerU 对中文投标文档的解析质量 -- 测试扫描版和数字版 PDF 的 OCR/文本提取效果 | MinerU 3.4 使用 PP-OCRv6，支持 109 语言，-m auto 自动检测扫描/数字 PDF |
| MINERU-03 | 评估 MinerU 依赖大小 -- 运行 `pip install magic-pdf --dry-run` 确认实际下载/安装大小 | Docker 镜像基于 vllm/vllm-openai，镜像本身较大；pip install mineru[core] 包含 torch+transformers |
| MINERU-04 | 评估 MinerU CPU-only 性能 -- 在无 GPU 环境测试解析速度，确认是否可接受 | pipeline 后端支持纯 CPU 运行；需要在 Docker 中用 CPU 模式测试 |
</phase_requirements>

## Summary

MinerU (by OpenDataLab) 是一个高精度文档解析引擎，当前版本 3.4.0（2026年6月发布）。它将 PDF/DOCX/PPTX/XLSX/图片转换为结构化 Markdown 和 JSON。MinerU 支持三种解析后端：`pipeline`（CPU/GPU，基于 ONNX）、`vlm-engine`（VLM 推理，需 GPU）、`hybrid-engine`（混合模式，需 GPU）。

对于本 phase 的可行性验证，核心路径是：Docker 容器中运行 MinerU `pipeline` 后端（支持纯 CPU），使用 `-m auto` 模式自动检测数字/扫描 PDF，检查 `content_list.json` 输出格式，测量中文解析质量和 CPU 性能。

**Primary recommendation:** 使用 `mineru -p <pdf> -o <output> -b pipeline -m auto` 在 Docker 中测试。pipeline 后端是唯一支持纯 CPU 的后端，且在 OmniDocBench v1.5 上得分 86.2，精度接近上一代 VLM。

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MinerU (mineru) | >=3.4.0 | PDF/文档解析引擎 | OpenDataLab 维护，109 语言 OCR，中文支持好 |
| Docker | 28.3.2 (本地) | 环境隔离 | 用户明确要求，避免依赖冲突 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vllm/vllm-openai | v0.21.0 | GPU Docker 基础镜像 | 有 GPU 时使用，含 CUDA 运行时 |
| PP-OCRv6 | 内置 | OCR 引擎 | pipeline 后端的 OCR 模型 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Docker 部署 | pip install mineru[core] | pip 更轻量但会污染系统环境；Docker 隔离更好 |
| pipeline 后端 | hybrid-engine | hybrid 精度更高但需要 GPU；pipeline 是 CPU 唯一选项 |

## Architecture Patterns

### MinerU CLI 命令格式

```bash
# 基本用法
mineru -p <input_path> -o <output_path>

# 指定后端和模式（CPU-only）
mineru -p <input.pdf> -o <output_dir> -b pipeline -m auto

# 指定语言（提升 OCR 准确率）
mineru -p <input.pdf> -o <output_dir> -b pipeline -m auto -l ch
```

### MinerU 输出目录结构

```
<output_dir>/
├── <filename>/
│   ├── <filename>.md                    # Markdown 输出
│   ├── <filename>_content_list.json     # 扁平内容块列表（我们主要关注这个）
│   ├── <filename>_content_list_v2.json  # 按页分组的内容块（V2 格式）
│   ├── <filename>_middle.json           # 中间处理结果（详细布局信息）
│   ├── <filename>_model.json            # 模型推理结果
│   ├── <filename>_layout.pdf            # 布局分析可视化
│   └── images/                          # 提取的图片
```

### content_list.json Schema（Pipeline 后端）

```typescript
// content_list.json 是一个数组，每个元素是一个内容块
interface ContentListItem {
  type: 'text' | 'table' | 'image' | 'equation' | 'code' | 'list' |
        'header' | 'footer' | 'page_number' | 'aside_text' | 'page_footnote';
  bbox: [number, number, number, number];  // [x0, y0, x1, y1]，归一化到 0-1000
  page_idx: number;  // 页码，从 0 开始

  // text 类型特有字段
  text?: string;
  text_level?: number;  // 0=正文, 1=一级标题, 2=二级标题, ...

  // table 类型特有字段
  table_body?: string;      // HTML 格式的表格内容
  table_caption?: string[];
  table_footnote?: string[];
  img_path?: string;        // 表格截图路径

  // image 类型特有字段
  image_caption?: string[];
  image_footnote?: string[];
  img_path?: string;
  sub_type?: string;        // 如 "seal"（印章）

  // equation 类型特有字段
  text?: string;            // LaTeX 格式
  text_format?: 'latex';
  img_path?: string;

  // code 类型特有字段
  sub_type?: 'code' | 'algorithm';
  code_body?: string;
  code_caption?: string[];

  // list 类型特有字段
  sub_type?: 'text' | 'ref_text';
  list_items?: string[];
}
```

### content_list_v2.json Schema（V2 格式，3.0+ 新增）

```typescript
// V2 按页分组，每页是一个数组
type ContentListV2 = ContentListV2Page[][];  // [pages][blocks]

interface ContentListV2Page {
  type: 'title' | 'paragraph' | 'equation_interline' | 'image' | 'table' |
        'chart' | 'code' | 'algorithm' | 'list' | 'index' |
        'page_header' | 'page_footer' | 'page_number' | 'page_aside_text' | 'page_footnote';
  content: Record<string, unknown>;  // 结构化内容
  bbox?: [number, number, number, number];
  anchor?: string;
  sub_type?: string;
}
```

### Docker 部署方案

**官方 Docker 镜像要求 GPU（nvidia）。** 所有 compose 服务都配置了 `deploy.resources.reservations.devices` 要求 nvidia GPU。

对于 CPU-only 测试，有两个方案：
1. **方案 A（推荐）：** 直接在本机 pip install 测试（本机有 Python 3.12 + pip），用 `--prefix` 安装到临时目录避免污染
2. **方案 B：** 自建 CPU-only Dockerfile，基于 python:3.12-slim，pip install mineru[pipeline]

本机环境：Windows 11, Python 3.12, pip 26.1.1, Docker 28.3.2, NVIDIA RTX 4060 Laptop GPU (CUDA 12.7)

### 与现有 ParserRegistry 集成点（Phase 8 范围，此处仅记录）

MinerU 的 `content_list.json` 输出需要映射到 `DocumentAst.blocks[]`：
- `type: "text"` + `text_level: 0` -> `ParagraphNode`
- `type: "text"` + `text_level > 0` -> `SectionNode`
- `type: "table"` -> `TableNode`（HTML table_body 需解析）
- `type: "list"` -> `ListNode`
- `type: "image"` -> 图片引用节点

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF 解析 | 自定义 PDF 解析器 | MinerU pipeline 后端 | 内置 OCR、布局分析、表格识别，自建成本极高 |
| 中文 OCR | 自建 OCR 模型 | MinerU PP-OCRv6 | 109 语言支持，中文准确率高 |
| 布局检测 | 自定义 bbox 检测 | MinerU 内置模型 | OmniDocBench 86.2 分 |

## Common Pitfalls

### Pitfall 1: Docker 镜像无 GPU 不可用
**What goes wrong:** 官方 MinerU Docker 镜像基于 vllm/vllm-openai，要求 nvidia GPU
**Why it happens:** vllm 基础镜像需要 CUDA 运行时
**How to avoid:** CPU-only 测试使用 pip install 而非 Docker；或自建 CPU Dockerfile
**Warning signs:** 容器启动时报 CUDA 相关错误

### Pitfall 2: HuggingFace 模型下载被墙
**What goes wrong:** MinerU 首次运行需下载模型，默认从 HuggingFace 下载，中国网络无法访问
**Why it happens:** HuggingFace 在中国被墙
**How to avoid:** 设置环境变量 `MINERU_MODEL_SOURCE=modelscope` 使用 ModelScope 镜像
**Warning signs:** 模型下载超时或连接拒绝

### Pitfall 3: pipeline 后端需要额外依赖
**What goes wrong:** pip install mineru 不包含 pipeline 后端依赖（torch, onnxruntime 等）
**Why it happens:** pipeline 是可选依赖组
**How to avoid:** 使用 `pip install 'mineru[pipeline]'` 或 `pip install 'mineru[core]'`
**Warning signs:** 报错缺少 torch/onnxruntime 模块

### Pitfall 4: content_list.json 格式因后端不同而异
**What goes wrong:** pipeline 和 vlm/hybrid 后端的 content_list.json 格式有差异（vlm 有额外的 code/list/sub_type 字段）
**Why it happen:** 两个后端使用不同的渲染函数
**How to avoid:** 测试时明确记录使用的后端；集成时处理两种格式
**Warning signs:** 字段缺失或类型不匹配

### Pitfall 5: 模型下载体积大
**What goes wrong:** 首次运行需下载 GB 级模型文件
**Why it happen:** pipeline 后端包含布局检测、OCR、公式识别等多个模型
**How to avoid:** 提前下载模型（`mineru-models-download -s modelscope -m all`），在 Docker 构建时预下载
**Warning signs:** 首次解析极慢或超时

## Code Examples

### CLI 调用（CPU pipeline 模式）

```bash
# 设置 ModelScope 模型源（中国网络）
export MINERU_MODEL_SOURCE=modelscope

# 基本调用
mineru -p /path/to/bid.pdf -o /output/dir -b pipeline -m auto -l ch

# 仅解析特定页
mineru -p /path/to/bid.pdf -o /output/dir -b pipeline -m auto -l ch -s 0 -e 10
```

### Docker 构建（GPU 模式，官方推荐）

```bash
# 下载中国区 Dockerfile
wget https://gcore.jsdelivr.net/gh/opendatalab/MinerU@master/docker/china/Dockerfile

# 构建镜像
docker build -t mineru:latest -f Dockerfile .

# 运行容器
docker run --gpus all --shm-size 32g -p 8000:8000 -it mineru:latest /bin/bash
```

### 自建 CPU-only Dockerfile

```dockerfile
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y fonts-noto-cjk fontconfig libgl1 && \
    fc-cache -fv && \
    apt-get clean

RUN pip install --no-cache-dir 'mineru[pipeline]>=3.4.0' \
    -i https://mirrors.aliyun.com/pypi/simple

# 预下载模型
ENV MINERU_MODEL_SOURCE=modelscope
RUN mineru-models-download -s modelscope -m pipeline

ENTRYPOINT ["mineru"]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| magic-pdf CLI | mineru CLI | 3.0.0 (2026-03-29) | 包名从 magic-pdf 改为 mineru，CLI 从 magic-pdf 改为 mineru |
| AGPLv3 许可证 | MinerU Open Source License (Apache 2.0 基础) | 3.1.0 (2026-04-18) | 商业集成更友好 |
| PP-OCRv5 | PP-OCRv6 | 3.4.0 (2026-06-18) | OCR 准确率提升约 11% |
| content_list.json (V1 only) | content_list.json + content_list_v2.json | 3.0.0 | V2 按页分组，结构化更好 |

**Deprecated/outdated:**
- `magic-pdf` 命令：已改名为 `mineru`
- `pip install magic-pdf`：包名已改为 `mineru`
- content_list V1 格式：仍支持但 V2 更结构化

## Open Questions

1. **Docker CPU-only 镜像大小**
   - What we know: 官方 GPU 镜像基于 vllm/vllm-openai，预计 10GB+；自建 CPU 镜像基于 python:3.12-slim + mineru[pipeline]，预计 3-5GB
   - What's unclear: 实际 pip install mineru[pipeline] 的下载/安装大小
   - Recommendation: 在测试中实际测量 `pip install mineru[pipeline]` 的大小

2. **中文投标 PDF 的实际解析质量**
   - What we know: MinerU 支持中文（PP-OCRv6, ch 模型），支持扫描和数字 PDF
   - What's unclear: 投标文档特有的格式（公章、资质证书、报价表）的解析效果
   - Recommendation: 用真实投标 PDF 测试，特别关注表格和公章识别

3. **CPU-only 性能是否可接受**
   - What we know: pipeline 后端支持 CPU，3.4.0 版本 OCR 速度提升约 100%
   - What's unclear: 实际解析速度（受文档复杂度、页数影响）
   - Recommendation: 用不同页数的 PDF 测试，建立性能基线

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Docker 部署 MinerU | ✓ | 28.3.2 | pip install |
| Python | MinerU 运行时 | ✓ | 3.12.4 | -- |
| pip | 安装 MinerU | ✓ | 26.1.1 | -- |
| NVIDIA GPU | GPU 加速（可选） | ✓ | RTX 4060 Laptop, CUDA 12.7 | pipeline CPU 模式 |
| Node.js | 项目构建 | ✓ | 24.14.0 | -- |
| pnpm | 项目包管理 | ✓ | 9.10.0 | -- |

**Missing dependencies with no fallback:**
- 无（所有依赖均可用）

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 手动验证（本 phase 是可行性验证，非自动化测试） |
| Config file | 无 |
| Quick run command | `mineru -p <test.pdf> -o <output> -b pipeline -m auto` |
| Full suite command | 无（手动测试） |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MINERU-01 | 验证 content_list.json schema | 手动检查 | 检查输出 JSON 结构 | N/A |
| MINERU-02 | 验证中文解析质量 | 手动对比 | 对比 pdf-parse 和 MinerU 输出 | N/A |
| MINERU-03 | 评估依赖大小 | 手动测量 | pip install 大小统计 | N/A |
| MINERU-04 | 评估 CPU 性能 | 手动计时 | 解析计时 | N/A |

### Sampling Rate
- **Per task commit:** N/A（手动验证 phase）
- **Per wave merge:** N/A
- **Phase gate:** 07-VALIDATION.md 包含所有 4 个需求的测试结果

### Wave 0 Gaps
- 需要真实投标 PDF 测试文件（扫描版 + 数字版）
- 需要在测试前下载 MinerU 模型（首次约需数分钟）

## Sources

### Primary (HIGH confidence)
- MinerU GitHub README -- 项目介绍、功能列表、CLI 用法、Docker 部署
- MinerU docs/en/reference/output_files.md -- content_list.json 完整 schema 定义
- MinerU docs/zh/usage/cli_tools.md -- CLI 参数和环境变量完整说明
- MinerU docs/zh/quick_start/docker_deployment.md -- Docker 部署步骤
- MinerU pyproject.toml -- 依赖列表、版本要求、可选依赖组
- MinerU docker/compose.yaml -- Docker Compose 服务配置
- MinerU docker/china/Dockerfile -- 中国区 Docker 镜像构建

### Secondary (MEDIUM confidence)
- MinerU changelog (README 中) -- 版本更新历史、性能改进数据

### Tertiary (LOW confidence)
- 训练数据中的 MinerU 知识 -- 已通过官方文档验证和更新

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 基于官方文档和 pyproject.toml 的实际依赖
- Architecture: HIGH -- content_list.json schema 直接来自官方文档
- Pitfalls: HIGH -- 基于官方文档中的注意事项和实际环境验证

**Research date:** 2026-07-22
**Valid until:** 2026-08-22 (MinerU 版本更新较快，30 天后需检查新版本)
