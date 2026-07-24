# Roadmap: BidLens

## Milestones

- **v0.3.0 Non-Embedding Similarity Risk Review** — Phases 1-6 (shipped)
- **v0.3.3 MinerU PDF 解析集成调研** — Phases 7-10 (shipped 2026-07-23)
- **v0.3.4 MinerU 接入风险检测流程** — Phases 11-13 (shipped 2026-07-23)
- **v0.3.6 PDF 原文定位与数据提取** — Phases 14-17 (shipped 2026-07-24)
- **v0.3.7 全面追赶竞品** — Phases 18+ (planned)

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

<details>
<summary>v0.3.6 PDF 原文定位与数据提取 (Phases 14-17) — Shipped 2026-07-24</summary>

**Milestone Goal:** 实现点击关键审查点的提取文本后，弹出 PDF 阅读器并定位到对应原文位置

- [x] **Phase 14: 数据层扩展与 PDF 阅读器基础** - MinerU bbox 保留、模型扩展、IPC 端点、应用内 PDF 渲染与导航
- [x] **Phase 15: Evidence → PDF 定位连线** - 点击 evidence 卡片打开对应 PDF 并滚动到原文页
- [x] **Phase 16: 高亮与交互增强** - bbox 高亮区域、zoom-to-fit、批量高亮、tooltip
- [x] **Phase 17: 双栏对比** - 左右并排源文件/目标文件 PDF，同步滚动

**Key results:** 17/17 requirements complete, 5 plans, 33 commits, 62 files changed

</details>

### v0.3.7 全面追赶竞品 (Planned)

**Milestone Goal:** 补全设备特征比对、图片查重、经济标比对、资信标矩阵展示，全面追赶 bqpoint 竞品审查能力

- [ ] Phase 18+: TBD (待规划)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. 数据层扩展与 PDF 阅读器基础 | v0.3.6 | 2/2 | Complete | 2026-07-24 |
| 15. Evidence → PDF 定位连线 | v0.3.6 | 1/1 | Complete | 2026-07-24 |
| 16. 高亮与交互增强 | v0.3.6 | 1/1 | Complete | 2026-07-24 |
| 17. 双栏对比 | v0.3.6 | 1/1 | Complete | 2026-07-24 |
