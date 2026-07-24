# Roadmap: BidLens

## Milestones

- **v0.3.0 Non-Embedding Similarity Risk Review** — Phases 1-6 (shipped)
- **v0.3.3 MinerU PDF 解析集成调研** — Phases 7-10 (shipped 2026-07-23)
- **v0.3.4 MinerU 接入风险检测流程** — Phases 11-13 (shipped 2026-07-23)
- **v0.3.6 PDF 原文定位与数据提取** — Phases 14-17 (in progress)

## Phases

<details>
<summary>v0.3.0 Non-Embedding Similarity Risk Review (Phases 1-6)</summary>

**Milestone Goal:** Complete local, explainable, multi-submission similarity risk review product using text, table, entity and key-fact detectors.

- [x] **Phase 1: Cleanup & Bug Fixes** - Remove dead code and fix known data issues in Rust engine and detectors
- [x] **Phase 2: Integration Hardening** - Unify renderer identity, fix checkpoint resume, wire missing IPC channels
- [x] **Phase 3: E2E Foundation** - Playwright harness + first full risk pipeline E2E test with real DOCX files
- [x] **Phase 4: Quality Gates** - Security, performance, Diff regression, viewport, and bundle scanning tests
- [ ] **Phase 5: Business Labels** - Extract BusinessLabel data for ReviewNode (deferrable to post-V0.3.0)
- [x] **Phase 6: nZBTF File Support** - Parse nZBTF bid documents (ZIP/XML) alongside DOCX/PDF

</details>

<details>
<summary>v0.3.3 MinerU PDF 解析集成调研 (Phases 7-10) — Shipped 2026-07-23</summary>

**Milestone Goal:** 调研 MinerU 和 node-pdf-to-markdown 在 Electron 桌面应用中的集成可行性，确定最佳接入方式和实施路径。

- [x] **Phase 7: MinerU 可行性验证** — 通过 MinerU 云端 API 验证输出格式和中文解析质量
- [x] **Phase 8: 集成方案设计** — MinerU mapper, parser, fallback 策略, nZBTF 修复
- [x] **Phase 9: 分发方案评估** — Token 安全管理, 网络重试, 设置 UI
- [x] **Phase 10: node-pdf-to-markdown 评估** — 轻量替代方案评估

</details>

<details>
<summary>v0.3.4 MinerU 接入风险检测流程 (Phases 11-13) — Shipped 2026-07-23</summary>

**Milestone Goal:** 把 MinerU 接入实际的风险检测流程，让用户真正用起来。

- [x] **Phase 11: E2E 验证** — 用真实扫描 PDF 跑通完整链路
- [x] **Phase 12: 集成 Bug 修复** — 修复硬编码元数据、死代码、缺失的能力声明
- [x] **Phase 13: UX 打磨** — 进度反馈、友好错误、离线检测、并发控制

**Key results:** 13/13 requirements complete, 137/137 integration tests pass, 29 commits, 35 files changed

</details>

### v0.3.6 PDF 原文定位与数据提取 (In Progress)

**Milestone Goal:** 实现点击关键审查点的提取文本后，弹出 PDF 阅读器并定位到对应原文位置

- [x] **Phase 14: 数据层扩展与 PDF 阅读器基础** - MinerU bbox 保留、模型扩展、IPC 端点、应用内 PDF 渲染与导航 (completed 2026-07-24)
- [x] **Phase 15: Evidence → PDF 定位连线** - 点击 evidence 卡片打开对应 PDF 并滚动到原文页 (completed 2026-07-24)
- [ ] **Phase 16: 高亮与交互增强** - bbox 高亮区域、zoom-to-fit、批量高亮、tooltip
- [ ] **Phase 17: 双栏对比** - 左右并排源文件/目标文件 PDF，同步滚动

## Phase Details

### Phase 14: 数据层扩展与 PDF 阅读器基础
**Goal**: 数据管道保留 bbox 位置信息，用户可在应用内查看 PDF 文件
**Depends on**: Phase 13 (v0.3.4)
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, PDF-08
**Success Criteria** (what must be TRUE):
  1. MinerU mapper 产出的 DocumentAst 节点包含 bbox 和 pageIdx 字段（不再丢弃）
  2. Evidence 模型包含可选 sourceBbox/targetBbox 字段，旧数据仍可正常读取
  3. risk:getPdfFile IPC 端点返回项目内指定 submission 的 PDF 文件路径
  4. PDF 阅读器以 Drawer 形式从右侧弹出，支持翻页（按钮 + 滚动）和缩放（放大/缩小/适应宽度）
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md — Data layer: types, mapper bbox, IPC endpoint
- [x] 14-02-PLAN.md — PDF viewer: react-pdf, Drawer, nav, zoom

### Phase 15: Evidence → PDF 定位连线
**Goal**: 审查员点击 evidence 卡片即可打开对应 PDF 文件并定位到原文页面
**Depends on**: Phase 14
**Requirements**: PDF-09, PDF-10, PDF-11
**Success Criteria** (what must be TRUE):
  1. Evidence 卡片显示页码标签（如 "P1-2"），点击后打开 PDF Drawer
  2. 多文件项目中，根据 Evidence.submissionId 自动打开正确的 PDF 文件
  3. PDF Drawer 打开后自动滚动到 evidence 所在页面
**Plans:** 1/1 plans complete

Plans:
- [x] 15-01-PLAN.md — Evidence page labels + PDF Drawer wiring

### Phase 16: 高亮与交互增强
**Goal**: PDF 页面上高亮显示 evidence 匹配区域，支持交互查看详细信息
**Depends on**: Phase 15
**Requirements**: PDF-12, PDF-13, PDF-14, PDF-15
**Success Criteria** (what must be TRUE):
  1. PDF 页面上用半透明矩形框高亮 evidence 匹配区域（基于 bbox 坐标）
  2. 打开 PDF 后自动缩放使高亮区域填满视口（zoom-to-fit）
  3. 同一页面存在多个 evidence 时，全部高亮显示
  4. 悬浮高亮区域显示 tooltip（匹配依据、相似度分数、段落路径）
**Plans**: 1 plan

Plans:
- [ ] 16-01-PLAN.md — 高亮 overlay + zoom-to-fit + tooltip

### Phase 17: 双栏对比
**Goal**: 审查员可同时查看源文件和目标文件的 PDF，点击 evidence 同步定位两侧
**Depends on**: Phase 15
**Requirements**: PDF-16, PDF-17
**Success Criteria** (what must be TRUE):
  1. 支持左右双栏同时显示源文件和目标文件的 PDF
  2. 点击一侧 evidence 可同步滚动另一侧到对应位置
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Cleanup & Bug Fixes | v0.3.0 | — | Complete | — |
| 2. Integration Hardening | v0.3.0 | — | Complete | — |
| 3. E2E Foundation | v0.3.0 | — | Complete | — |
| 4. Quality Gates | v0.3.0 | — | Complete | — |
| 5. Business Labels | v0.3.0 | — | Deferred | — |
| 6. nZBTF File Support | v0.3.0 | — | Complete | — |
| 7. MinerU 可行性验证 | v0.3.3 | 1/1 | Complete | 2026-07-23 |
| 8. 集成方案设计 | v0.3.3 | 4/4 | Complete | 2026-07-23 |
| 9. 分发方案评估 | v0.3.3 | 2/2 | Complete | 2026-07-23 |
| 10. node-pdf-to-markdown 评估 | v0.3.3 | 1/1 | Complete | 2026-07-23 |
| 11. E2E 验证 | v0.3.4 | 4/4 | Complete | 2026-07-23 |
| 12. 集成 Bug 修复 | v0.3.4 | 2/2 | Complete | 2026-07-23 |
| 13. UX 打磨 | v0.3.4 | 2/2 | Complete | 2026-07-23 |
| 14. 数据层扩展与 PDF 阅读器基础 | v0.3.6 | 2/2 | Complete    | 2026-07-24 |
| 15. Evidence → PDF 定位连线 | v0.3.6 | 1/1 | Complete    | 2026-07-24 |
| 16. 高亮与交互增强 | v0.3.6 | 0/1 | Not started | - |
| 17. 双栏对比 | v0.3.6 | 0/1 | Not started | - |
