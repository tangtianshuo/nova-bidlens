# Phase 11: E2E 验证 - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

用真实扫描 PDF 跑通完整链路，验证 MinerU → mapper → DocumentAst → Rust 引擎 → 风险检测 → UI 展示的每个环节。这是验证阶段，不是构建阶段——所有组件已存在，需要确认它们协同工作。

</domain>

<decisions>
## Implementation Decisions

### 验证范围
- 使用真实扫描版 PDF（非合成测试文件）进行端到端测试
- 验证三个关键路径：文本相似度检测、表格检测、混合格式项目
- 如果发现实际问题，记录但不在本 phase 修复（留给 Phase 12）

### Claude's Discretion
- 测试用例选择和验证方法
- 如何构造混合格式测试项目
- 验证失败时的诊断策略

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- tests/mineru/fixtures/ — MinerU 测试 PDF 文件
- packages/shared/src/parser/mineru/ — mapper, parser, pdf-type-detector
- apps/desktop/src/main/services/parser-service.ts — PDF fallback logic
- apps/desktop/src/main/services/risk-review-service.ts — pipeline orchestration

### Established Patterns
- Phase 7 的 MinerU API 验证方法
- Phase 3 的 E2E 测试 harness (Playwright)

### Integration Points
- parser-service → MinerU parser → mapper → DocumentAst
- DocumentAst → toEngineDocumentAst() → Rust engine → RiskFinding
- RiskFinding → SQLite persistence → UI display

</code_context>

<specifics>
## Specific Ideas

- 复用 Phase 7 的测试 PDF 文件
- 重点关注：mapper 输出质量、引擎表格处理、证据链接完整性
- 记录每个环节的实际耗时，为后续优化提供数据

</specifics>

<deferred>
## Deferred Ideas

- 性能优化（基于本 phase 收集的耗时数据）
- 具体 bug 修复（Phase 12 处理）

</deferred>
