# Phase 7: MinerU 可行性验证 - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

确认 MinerU 能否满足中文投标文档的 PDF 解析需求。通过实际运行 MinerU 验证输出格式、中文解析质量、依赖大小和 CPU 性能，为后续集成决策提供数据支撑。

</domain>

<decisions>
## Implementation Decisions

### 测试方法
- 使用 Docker 部署 MinerU（而非 pip install）— 隔离环境，避免依赖冲突
- 使用 -m auto 模式测试 — 自动检测数字/扫描 PDF
- 用真实投标 PDF 测试，检查 _content_list.json 输出格式
- 写入 07-VALIDATION.md 记录测试结果

### 测试数据和基准
- 使用真实投标 PDF（扫描+数字版）测试
- 性能基准：<30秒/页可接受，>60秒不可接受
- 同一 PDF 对比 pdf-parse 和 MinerU 输出
- 结果存储在 .planning/phases/07-mineru-feasibility/

### Claude's Discretion
Docker 部署方式的具体实现（镜像选择、卷挂载、环境变量）由 Claude 决定。

</decisions>

<code_context>
## Existing Code Insights

### 现有解析器
- `packages/shared/src/parser/pdf/index.ts` — 当前 pdf-parse 实现
- `packages/shared/src/parser/index.ts` — ParserRegistry 注册中心
- `packages/shared/src/parser/docx/index.ts` — DOCX 解析器（参考模式）

### 集成点
- DocumentParser 接口 — MinerU parser 需要实现此接口
- ParserRegistry.globalRegistry — MinerU parser 注册位置
- DocumentAst.blocks[] — MinerU 输出需要映射到此结构

</code_context>

<specifics>
## Specific Ideas

- 使用 Docker 部署 MinerU（用户明确要求）
- 验证 _content_list.json schema 和字段结构
- 测试中文扫描版和数字版 PDF 的解析效果
- 量化依赖大小（pip install 数据）
- 测量无 GPU 环境下的解析速度

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
