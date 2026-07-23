# Roadmap: BidLens

## Overview

BidLens is a local Electron desktop app for bid document similarity risk review. This roadmap tracks milestones from v0.3.0 through v0.3.3. V0.3.0 phases 1-6 are complete; v0.3.3 is a research milestone to evaluate MinerU and node-pdf-to-markdown integration feasibility.

## Milestones

<details>
<summary>v0.3.0 Non-Embedding Similarity Risk Review (Phases 1-6) — COMPLETE</summary>

**Milestone Goal:** Complete local, explainable, multi-submission similarity risk review product using text, table, entity and key-fact detectors.

- [x] **Phase 1: Cleanup & Bug Fixes** - Remove dead code and fix known data issues in Rust engine and detectors
- [x] **Phase 2: Integration Hardening** - Unify renderer identity, fix checkpoint resume, wire missing IPC channels
- [x] **Phase 3: E2E Foundation** - Playwright harness + first full risk pipeline E2E test with real DOCX files
- [x] **Phase 4: Quality Gates** - Security, performance, Diff regression, viewport, and bundle scanning tests
- [ ] **Phase 5: Business Labels** - Extract BusinessLabel data for ReviewNode (deferrable to post-V0.3.0)
- [x] **Phase 6: nZBTF File Support** - Parse nZBTF bid documents (ZIP/XML) alongside DOCX/PDF

</details>

### v0.3.3 MinerU PDF 解析集成调研 (Phases 7-10)

**Milestone Goal:** 调研 MinerU 和 node-pdf-to-markdown 在 Electron 桌面应用中的集成可行性，确定最佳接入方式和实施路径。

## Phases

- [x] **Phase 7: MinerU 可行性验证** - 通过 MinerU 云端 API 验证输出格式（content_list.json schema）和中文解析质量（pipeline vs vlm） ✅ 2026-07-23
- [ ] **Phase 8: 集成方案设计** - 设计预处理工具模式、JSON→DocumentAst 映射、parser registry 集成和 fallback 策略
- [ ] **Phase 9: 分发方案评估** - 评估 Python 打包、模型分发和预处理 CLI 分发方案
- [ ] **Phase 10: node-pdf-to-markdown 评估** - 评估 node-pdf-to-markdown 作为轻量替代方案的可行性和发展跟踪

## Phase Details

### Phase 7: MinerU 可行性验证
**Goal**: 确认 MinerU 云端 API 能否满足中文投标文档的 PDF 解析需求
**Depends on**: Nothing (本里程碑首个 phase)
**Requirements**: MINERU-01, MINERU-02
**Success Criteria** (what must be TRUE):
  1. MinerU `content_list.json` schema 和字段结构已确认，可用真实投标 PDF 复现
  2. 中文扫描版和数字版 PDF 的 OCR/文本提取质量已有 pipeline vs vlm 对比报告
  3. API 延迟数据已收集，有明确的可接受性评估
**Plans:** 1 plan

Plans:
- [x] 07-01-PLAN.md — MinerU 云端 API 测试 + 验证报告 ✅

### Phase 8: 集成方案设计
**Goal**: 确定 MinerU 输出到现有 BidLens DocumentAst 的完整集成路径
**Depends on**: Phase 7
**Requirements**: INTEG-01, INTEG-02, INTEG-03, INTEG-04
**Success Criteria** (what must be TRUE):
  1. PDF 预检测分流模式已设计，扫描版直接走 MinerU，数字版走 pdf-parse
  2. MinerU content_list.json 到 ParagraphNode/TableNode/SectionNode 的映射规则已定义并测试
  3. MinerU parser 实现 DocumentParser 接口，已注册到 globalRegistry
  4. pdf-parse 与 MinerU 的 fallback 检测启发式规则已确定并实现
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — nZBTF 文件上传过滤修复
- [x] 08-02-PLAN.md — MinerU content_list.json → DocumentAst 映射器
- [x] 08-03-PLAN.md — MinerU parser 实现 + 注册到 ParserRegistry
- [x] 08-04-PLAN.md — PDF 预检测分流 + fallback 策略

### Phase 9: 分发方案评估
**Goal**: 确定 MinerU Python 依赖和模型权重的分发策略
**Depends on**: Phase 7
**Requirements**: DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. python-embed vs PyInstaller vs 用户自行安装三种方案的优劣对比已完成
  2. 模型分发方案（捆绑/首次下载/ModelScope 镜像）已有推荐，考虑中国网络环境
  3. 预处理 CLI 的分发方式已确定（独立工具 vs 集成到 Electron 安装流程）
**Plans**: TBD

### Phase 10: node-pdf-to-markdown 评估
**Goal**: 确认 node-pdf-to-markdown 是否可作为轻量级 PDF 解析替代方案
**Depends on**: Phase 7
**Requirements**: NODEPDF-01, NODEPDF-02, NODEPDF-03
**Success Criteria** (what must be TRUE):
  1. node-pdf-to-markdown 与 pdf-parse 的文本提取质量对比已完成
  2. node-pdf-to-markdown 作为轻量替代方案的可行性已有结论
  3. node-pdf-to-markdown 的表格识别和 OCR 功能路线图已跟踪
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. MinerU 可行性验证 | v0.3.3 | 1/1 | Complete | 2026-07-23 |
| 8. 集成方案设计 | v0.3.3 | 0/4 | Not started | - |
| 9. 分发方案评估 | v0.3.3 | 0/TBD | Not started | - |
| 10. node-pdf-to-markdown 评估 | v0.3.3 | 0/TBD | Not started | - |
