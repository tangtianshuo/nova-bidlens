# Requirements — Milestone v0.3.3 MinerU PDF 解析集成调研

**Date:** 2026-07-22
**Source:** MinerU + node-pdf-to-markdown 调研

## 目标

调研 MinerU 和 node-pdf-to-markdown 在 Electron 桌面应用中的集成可行性，确定最佳接入方式和实施路径。

---

## v0.3.3 需求

### Category 1: 可行性验证

- [ ] **MINERU-01**: 验证 MinerU CLI 输出格式 — 运行 `magic-pdf` 命令处理真实投标 PDF，确认 `_content_list.json` schema 和字段结构
- [ ] **MINERU-02**: 验证 MinerU 对中文投标文档的解析质量 — 测试扫描版和数字版 PDF 的 OCR/文本提取效果
- [ ] **MINERU-03**: 评估 MinerU 依赖大小 — 运行 `pip install magic-pdf --dry-run` 确认实际下载/安装大小
- [ ] **MINERU-04**: 评估 MinerU CPU-only 性能 — 在无 GPU 环境测试解析速度，确认是否可接受

### Category 2: 集成方案设计

- [ ] **INTEG-01**: 设计预处理工具模式 — 编写 Python CLI 工具，输入 PDF 目录，输出解析后的 JSON
- [x] **INTEG-02**: 设计 JSON → DocumentAst mapper — 定义 MinerU JSON 到现有 BlockNode (ParagraphNode/TableNode/SectionNode) 的映射规则
- [ ] **INTEG-03**: 设计 parser registry 集成 — MinerU parser 实现 DocumentParser 接口，注册到 globalRegistry
- [ ] **INTEG-04**: 设计 fallback 策略 — 简单数字 PDF 用 pdf-parse，复杂/扫描 PDF 用 MinerU，确定检测启发式规则

### Category 3: 分发方案评估

- [ ] **DIST-01**: 评估 Python 打包方案 — 对比 python-embed vs PyInstaller vs 用户自行安装的优劣
- [ ] **DIST-02**: 评估模型分发方案 — 捆绑安装包 vs 首次下载 vs ModelScope 镜像，考虑中国网络环境
- [ ] **DIST-03**: 设计预处理 CLI 分发 — 作为独立工具还是集成到 Electron 安装流程

### Category 4: node-pdf-to-markdown 评估

- [ ] **NODEPDF-01**: 验证 node-pdf-to-markdown 文本提取质量 — 对比 pdf-parse 的输出
- [ ] **NODEPDF-02**: 评估 node-pdf-to-markdown 作为轻量替代方案的可行性 — 当前版本是否满足基本需求
- [ ] **NODEPDF-03**: 跟踪 node-pdf-to-markdown 发展 — 表格识别和 OCR 功能是否计划实现

---

## v0.3.0 需求 (已封存)

**说明:** v0.3.0 核心需求已封存，待 v0.3.3 调研完成后再决定是否继续。

<details>
<summary>点击展开 v0.3.0 需求</summary>

### Bug Fixes and Cleanup

- [x] **CLEAN-01**: Remove legacy `run_analysis` stub, `ProjectState`, and unused `risk.createProject`/`risk.cancelProject`/`risk.getProject` JSON-RPC methods from Rust engine (V3-103 cleanup)
- [x] **CLEAN-02**: Wire `source_submission_id`/`target_submission_id` in table detector output instead of empty strings (V3-302 fix)
- [x] **CLEAN-03**: Wire `table_location` in Rust `build_review_nodes` — currently always `None` despite type contract supporting it (V3-101 fix)
- [x] **CLEAN-04**: Remove or guard the engine fallback path (`buildFindings`) that produces untraceable evidence with fake node IDs (V3-411 fix)

### Integration Hardening

- [x] **HARDEN-01**: Unify renderer project identity to single source of truth — consolidate `useProjectStore.selectedProjectId`, `useRiskReviewStore.projectId`, `useAppStore.taskId` (V3-121/V3-122)
- [x] **HARDEN-02**: Checkpoint resume should skip completed detectors instead of re-running all 4 (V3-412 improvement)
- [x] **HARDEN-03**: Implement `risk:detectorProgress` channel or remove dead wiring in preload (V3-404 cleanup)
- [x] **HARDEN-04**: Wire hook ordering fix and remove production `console.log` command stubs in renderer (V3-123)

### Quality Gates

- [x] **QA-01**: Add Electron E2E test harness with Playwright — real IPC through packaged/dev Electron (V3-131)
- [x] **QA-02**: Add full risk pipeline E2E — create project with real DOCX files, process, verify findings/evidence/assessments in DB (V3-601/V3-602)
- [ ] **QA-03**: Add security tests — offline operation, log redaction, encrypted DB/WAL, deletion closure (V3-603)
- [ ] **QA-04**: Add performance tests — sparse recall, 4000-page project, 1000+ findings rendering (V3-604)
- [ ] **QA-05**: Add Diff regression tests for evidence compatibility (V3-605)
- [ ] **QA-06**: Run viewport/accessibility screenshots at 1280x800, 1024x700, 760 equivalent (V3-606)
- [ ] **QA-07**: Production-bundle fixture reachability scanning — build fails if test fixtures leak into production chunks (V3-132)

### Business Labels (Deferred)

- [ ] **LABEL-01**: Implement BusinessLabel extraction logic for ReviewNode — currently `labels` is always empty Vec (V3-102, deferable)

### nZBTF File Support

- [ ] **NZBTF-01**: Add nZBTF file format detection and ZIP extraction — detect .nZBTF extension, extract ZIP archive to temp directory
- [ ] **NZBTF-02**: Parse all XML metadata from nZBTF — TB.xml (bidder info, qualifications, personnel), Echo.xml (pricing, bill of quantities), hyChoose.xml (evaluation data)
- [ ] **NZBTF-03**: Map nZBTF XML data to existing Submission/DocumentAst model — store parsed metadata in submission record for risk detection

</details>

---

## Out of Scope

- **MinerU 实时推理集成** — Electron 内嵌 Python 运行时，依赖过大
- **自定义 MinerU fork** — 维护负担过重
- **替代 pdf-parse** — MinerU 是增强，不是替代
- **BGE-M3 语义增强** — 已封存到 v0.3.1

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| MINERU-01 | 7 | TBD | Pending |
| MINERU-02 | 7 | TBD | Pending |
| MINERU-03 | 7 | TBD | Pending |
| MINERU-04 | 7 | TBD | Pending |
| INTEG-01 | 8 | TBD | Pending |
| INTEG-02 | 8 | TBD | Pending |
| INTEG-03 | 8 | TBD | Pending |
| INTEG-04 | 8 | TBD | Pending |
| DIST-01 | 9 | TBD | Pending |
| DIST-02 | 9 | TBD | Pending |
| DIST-03 | 9 | TBD | Pending |
| NODEPDF-01 | 10 | TBD | Pending |
| NODEPDF-02 | 10 | TBD | Pending |
| NODEPDF-03 | 10 | TBD | Pending |
