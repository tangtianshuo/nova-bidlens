# Phase 7: MinerU 可行性验证 - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

通过 MinerU 云端 API（mineru.net）验证中文投标文档的 PDF 解析能力。评估 API 输出格式、中文解析质量、API 延迟和配额限制，为后续集成决策提供数据支撑。

**不包含：** 本地部署、Docker 环境、pip install、CPU 性能测试（这些已由云端 API 替代）。

</domain>

<decisions>
## Implementation Decisions

### 部署方式
- **D-01:** 使用 mineru.net 云端 API，不进行本地部署（用户明确要求）
- **D-02:** 使用精准解析 API（非 Agent 轻量 API），因投标 PDF 可能超过 20 页且需要 content_list.json
- **D-03:** 已有 API Token（`sk-gqygNnaDIKxd5gia6tdTFlZDAA7OyPO9EA4BtuTplDX9p8dS`）

### API 选择理由
- Agent 轻量 API 限制 ≤10MB/≤20页，仅返回 Markdown（无 content_list.json）
- 精准解析 API 支持 ≤200MB/≤200页，返回 ZIP 包含 content_list.json + full.md + layout.json
- 投标 PDF 常超过 20 页 → 必须用精准解析 API

### 测试方法
- **D-04:** 测试两个后端：pipeline（默认）和 vlm（推荐），用数据对比决定
- **D-05:** 输出格式选择 ZIP 全量输出（含 Markdown + content_list.json + 中间结果）
- **D-06:** 用真实投标 PDF 测试（扫描版 + 数字版），对比两个后端的解析质量
- **D-07:** 延迟基准测试后定（不预设，用真实数据决定可接受性）

### API 配额（精准解析 API）
- **D-08:** 每天 1000 页最高优先级，超出后降低优先级
- **D-09:** 文件限制：≤200MB / ≤200页
- **D-10:** 批量限制：单次≤50个文件
- **D-11:** 配额充足，无需在验证阶段考虑优化

### 错误处理
- **D-12:** Phase 7 仅记录 API 错误行为（超时、失败、限流响应），不设计降级策略
- **D-13:** fallback 到 pdf-parse 的降级策略在 Phase 8 设计

### Claude's Discretion
- 测试脚本的具体实现（HTTP 客户端选择、轮询逻辑、结果解析）
- 测试 PDF 的选取和分组方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MinerU 云端 API 文档（通过 Playwright 从 mineru.net/apiManage/docs 获取）

#### 精准解析 API（我们的选择）

**创建解析任务（URL 模式）：**
- `POST https://mineru.net/api/v4/extract/task`
- Header: `Authorization: Bearer {token}`, `Content-Type: application/json`
- Body: `{ "url": "https://...", "model_version": "vlm" }`
- 可选参数: `is_ocr`, `enable_formula`, `enable_table`, `language`, `data_id`, `callback`, `seed`, `extra_formats`, `page_ranges`, `no_cache`, `cache_tolerance`
- model_version: `pipeline`（默认）/ `vlm`（推荐）/ `MinerU-HTML`
- Response: `{ "code": 0, "data": { "task_id": "..." } }`

**本地文件批量上传（签名上传模式）：**
- `POST https://mineru.net/api/v4/file-urls/batch`
- Header: `Authorization: Bearer {token}`, `Content-Type: application/json`
- Body: `{ "files": [{"name": "demo.pdf", "data_id": "abcd"}], "model_version": "vlm" }`
- Response: `{ "data": { "batch_id": "...", "file_urls": ["https://oss-..."] } }`
- 然后 PUT 上传文件到 file_urls（无须设置 Content-Type）
- 上传完成后系统自动提交解析任务

**获取任务结果（单个）：**
- `GET https://mineru.net/api/v4/extract/task/{task_id}`
- Response state: `done` / `pending` / `running` / `failed` / `converting`
- state=done 时返回 `full_zip_url`（ZIP 包含 content_list.json + full.md + layout.json + model.json）
- state=running 时返回 `extract_progress`（extracted_pages / total_pages / start_time）

**批量获取任务结果：**
- `GET https://mineru.net/api/v4/extract-results/batch/{batch_id}`
- Response: `{ "data": { "extract_result": [{ "file_name": "...", "state": "...", "full_zip_url": "..." }] } }`

#### Agent 轻量解析 API（不使用，仅参考）

- `POST https://mineru.net/api/v1/agent/parse/file` — 签名上传（≤10MB/≤20页，仅 Markdown）
- `POST https://mineru.net/api/v1/agent/parse/url` — URL 解析
- `GET https://mineru.net/api/v1/agent/parse/{task_id}` — 查询结果
- 无需 Token，IP 限频
- **不使用原因：** 页数限制（20页）、无 content_list.json

#### 常见错误码
- A0202: Token 错误
- A0211: Token 过期
- -500: 传参错误
- -60005: 文件大小超出限制（200MB）
- -60006: 文件页数超过限制（200页）
- -60007: 模型服务暂时不可用
- -60009: 任务提交队列已满
- -60010: 解析失败
- -60018: 每日解析任务数量已达上限

### MinerU 输出格式
- MinerU GitHub `docs/en/reference/output_files.md` — content_list.json 完整 schema 定义
- ZIP 内容：`full.md`（Markdown）、`*_content_list.json`（结构化块列表）、`layout.json`（布局结果）、`*_model.json`（模型推理结果）

### 现有集成
- `packages/shared/src/parser/pdf/index.ts` — 当前 pdf-parse 实现（对比基准）
- `packages/shared/src/parser/index.ts` — ParserRegistry 注册中心
- `packages/shared/src/parser/docx/index.ts` — DOCX 解析器（参考模式）

</canonical_refs>

<code_context>
## Existing Code Insights

### 现有解析器
- `packages/shared/src/parser/pdf/index.ts` — 当前 pdf-parse 实现，作为对比基准
- `packages/shared/src/parser/index.ts` — ParserRegistry 注册中心
- `packages/shared/src/parser/docx/index.ts` — DOCX 解析器（参考模式）

### 集成点（Phase 8 范围，此处仅记录）
- DocumentParser 接口 — MinerU parser 需要实现此接口
- ParserRegistry.globalRegistry — MinerU parser 注册位置
- DocumentAst.blocks[] — MinerU 输出需要映射到此结构

### MinerU content_list.json → DocumentAst 映射（Phase 8 范围）
- `type: "text"` + `text_level: 0` → ParagraphNode
- `type: "text"` + `text_level > 0` → SectionNode
- `type: "table"` → TableNode（HTML table_body 需解析）
- `type: "list"` → ListNode
- `type: "image"` → 图片引用节点

</code_context>

<specifics>
## Specific Ideas

### 精准解析 API 调用流程
1. **本地文件上传**: POST `/api/v4/file-urls/batch` 获取签名 URL → PUT 上传文件 → 系统自动解析
2. **轮询结果**: GET `/api/v4/extract/task/{task_id}` 轮询 state 直到 done/failed
3. **下载结果**: GET full_zip_url 下载 ZIP → 解压获取 content_list.json + full.md

### 测试计划
- 同时测试 pipeline 和 vlm 两个后端，对比输出质量
- ZIP 全量输出，验证 content_list.json 的完整 schema
- 用真实投标 PDF 测试中文解析质量（特别关注表格和公章识别）
- 记录 API 延迟数据（创建任务→轮询→下载全链路），测试后确定可接受基准
- 验证 API 的错误响应格式（超时、限流、解析失败）

### API 配额
- 精准解析 API：每天 1000 页最高优先级
- 文件限制：≤200MB / ≤200页
- 批量限制：单次≤50个文件

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-mineru-feasibility*
*Context gathered: 2026-07-23*
