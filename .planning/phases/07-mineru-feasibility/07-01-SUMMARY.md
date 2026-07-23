# Plan 07-01: MinerU 云端 API 测试 + 验证报告 - Summary

**Status:** ✅ Complete
**Date:** 2026-07-23

## What Was Built

MinerU 云端 API 测试基础设施，用于验证中文投标文档的 PDF 解析能力。

### Key Files

- `tests/mineru/mineru-api.ts` — API 测试脚本，支持本地文件上传、双后端测试、延迟测量、content_list.json 解析
- `tests/mineru/parse-docx.ts` — DOCX 解析脚本，用于三方对比
- `.planning/phases/07-mineru-feasibility/07-VALIDATION.md` — 完整验证报告

### Test Results Summary

| 维度 | pipeline | vlm | 推荐 |
|------|----------|-----|------|
| 输出格式 | ✅ 优秀 | ✅ 优秀 | pipeline |
| 中文解析质量 | ✅ 优秀 | ✅ 优秀 | pipeline |
| API 延迟 | ✅ 可接受 | ✅ 可接受 | pipeline |
| 表格识别 | ✅ 优秀 | ✅ 优秀 | pipeline |

### Key Findings

1. **content_list.json 字段结构完整** — type, text, text_level, bbox, page_idx, table_body 等字段均可用于 DocumentAst 映射
2. **中文解析质量优秀** — 数字版和扫描版 PDF 均无乱码、无漏字
3. **表格识别准确** — 21 个表格全部识别，HTML 格式正确
4. **pipeline 和 vlm 结果一致** — 对于标准中文文档，两个后端无显著差异
5. **扫描版 OCR 质量极高** — 与数字版几乎无差异

### API 延迟数据

- 数字版 PDF (76 页): 3.5s (0.05s/页)
- 扫描版 PDF (76 页): 81-142s (1.1-1.9s/页)

### Recommendation

使用 MinerU 云端 API (pipeline 后端) 进行 BidLens 集成。

## Deviations from Plan

- 修复了 ZIP 解压在 Windows 上的路径问题（tar → PowerShell Expand-Archive）
- 修复了 downloadAndExtractZip 未创建输出目录的 bug
- 添加了 DOCX 解析脚本用于三方对比（超出原计划范围）

## Verification

- [x] tests/mineru/mineru-api.ts 存在且功能完整
- [x] .planning/phases/07-mineru-feasibility/07-VALIDATION.md 包含 MINERU-01/02 测试结果
- [x] 所有 acceptance criteria 已满足

## Impact on Next Phases

- **Phase 8 (集成方案设计):** content_list.json → DocumentAst 映射路径已明确
- **Phase 9 (分发方案评估):** 需调整为 API 调用成本和配额管理
- **Phase 10 (node-pdf-to-markdown 评估):** MinerU 已验证可行，可作为参考基准
