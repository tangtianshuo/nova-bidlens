# Roadmap: BidLens

## Milestones

- ✅ **v0.3.0 Non-Embedding Similarity Risk Review** — Phases 1-6 (shipped)
- ✅ **v0.3.3 MinerU PDF 解析集成调研** — Phases 7-10 (shipped 2026-07-23)
- 🚧 **v0.3.4 MinerU 接入风险检测流程** — Phases 11-13 (in progress)

## Phases

<details>
<summary>✅ v0.3.0 Non-Embedding Similarity Risk Review (Phases 1-6)</summary>

**Milestone Goal:** Complete local, explainable, multi-submission similarity risk review product using text, table, entity and key-fact detectors.

- [x] **Phase 1: Cleanup & Bug Fixes** - Remove dead code and fix known data issues in Rust engine and detectors
- [x] **Phase 2: Integration Hardening** - Unify renderer identity, fix checkpoint resume, wire missing IPC channels
- [x] **Phase 3: E2E Foundation** - Playwright harness + first full risk pipeline E2E test with real DOCX files
- [x] **Phase 4: Quality Gates** - Security, performance, Diff regression, viewport, and bundle scanning tests
- [ ] **Phase 5: Business Labels** - Extract BusinessLabel data for ReviewNode (deferrable to post-V0.3.0)
- [x] **Phase 6: nZBTF File Support** - Parse nZBTF bid documents (ZIP/XML) alongside DOCX/PDF

</details>

<details>
<summary>✅ v0.3.3 MinerU PDF 解析集成调研 (Phases 7-10) — Shipped 2026-07-23</summary>

**Milestone Goal:** 调研 MinerU 和 node-pdf-to-markdown 在 Electron 桌面应用中的集成可行性，确定最佳接入方式和实施路径。

- [x] **Phase 7: MinerU 可行性验证** — 通过 MinerU 云端 API 验证输出格式和中文解析质量 ✅ 2026-07-23
- [x] **Phase 8: 集成方案设计** — MinerU mapper, parser, fallback 策略, nZBTF 修复 ✅ 2026-07-23
- [x] **Phase 9: 分发方案评估** — Token 安全管理, 网络重试, 设置 UI ✅ 2026-07-23
- [x] **Phase 10: node-pdf-to-markdown 评估** — 轻量替代方案评估 ✅ 2026-07-23

</details>

### 🚧 v0.3.4 MinerU 接入风险检测流程 (In Progress)

**Milestone Goal:** 把 MinerU 接入实际的风险检测流程，让用户真正用起来。Pipeline 已端到端存在，工作是验证、修复集成 bug、打磨 UX。

- [x] **Phase 11: E2E 验证** — 用真实扫描 PDF 跑通完整链路，验证所有假设 (completed 2026-07-23)
- [x] **Phase 12: 集成 Bug 修复** — 修复硬编码元数据、死代码、缺失的能力声明 (completed 2026-07-23)
- [x] **Phase 13: UX 打磨** — 进度反馈、友好错误、离线检测、并发控制 (completed 2026-07-23)

### Phase 11: E2E 验证
**Goal**: 用真实扫描 PDF 跑通完整链路，验证 MinerU → mapper → DocumentAst → Rust 引擎 → 风险检测 → UI 展示的每个环节
**Depends on**: Phase 10 (v0.3.3 调研完成)
**Requirements**: E2E-01, E2E-02, E2E-03
**Success Criteria** (what must be TRUE):
  1. 用户导入扫描版 PDF 后，能在 UI 中看到风险检测结果（文本相似度 findings）
  2. MinerU mapper 输出的 TableNode 能被 Rust 引擎表格检测器正确处理，产出有效的 RiskFinding
  3. 混合格式项目（DOCX + PDF）的 file-pair assessment 跨格式正确工作，风险矩阵中显示跨格式结果
**Plans**: 2 plans
Plans:
- [x] 11-01-PLAN.md — PDF 全链路 E2E 验证（MinerU → mapper → AST → Rust 引擎 → RiskFinding）
- [x] 11-02-PLAN.md — 混合格式项目（DOCX + PDF）跨格式风险检测验证

### Phase 12: 集成 Bug 修复
**Goal**: 修复管道中的硬编码值、死代码和缺失能力声明，使 MinerU 路径行为正确
**Depends on**: Phase 11
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05
**Success Criteria** (what must be TRUE):
  1. DocumentAst 中的 parserVersion 和 fileFormat 反映实际使用的解析器和文件格式，而非硬编码值
  2. file-validator 在 MinerU token 已配置时，为 PDF 文件返回正确的 parserId 和 MinerU capabilities
  3. 用户可以取消正在进行的 MinerU 解析（AbortSignal 正确传播到 API 调用）
  4. pollBatch 轮询在 5 分钟后自动超时并报错，不会无限等待
**Plans**: 2 plans
Plans:
- [x] 12-01-PLAN.md — 修复 parserVersion/fileFormat 硬编码 + file-validator MinerU 能力识别 (FIX-01, FIX-02, FIX-03)
- [x] 12-02-PLAN.md — MinerU AbortSignal 传播 + pollBatch 硬超时 (FIX-04, FIX-05)

### Phase 13: UX 打磨
**Goal**: MinerU 解析体验达到生产质量——有进度反馈、友好错误提示、离线检测和并发控制
**Depends on**: Phase 12
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. MinerU 解析期间 UI 显示实时进度（已等待秒数），而非冻结的加载动画
  2. Token 过期（401）时自动清除缓存实例并提示用户重新输入，而非永久失败
  3. 离线状态下导入 PDF 时显示明确中文提示 "此文件需要云端解析，请检查网络连接"
  4. API 错误（401/429/timeout）映射为用户友好的中文消息
  5. 多文件导入时 MinerU 请求排队处理，不会同时发起过多云端请求
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 → 12 → 13

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
| 11. E2E 验证 | v0.3.4 | 4/4 | Complete   | 2026-07-23 |
| 12. 集成 Bug 修复 | v0.3.4 | 2/2 | Complete   | 2026-07-23 |
| 13. UX 打磨 | v0.3.4 | 2/2 | Complete   | 2026-07-23 |
