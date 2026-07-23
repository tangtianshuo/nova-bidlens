# Roadmap: BidLens

## Milestones

- ✅ **v0.3.0 Non-Embedding Similarity Risk Review** — Phases 1-6 (shipped)
- ✅ **v0.3.3 MinerU PDF 解析集成调研** — Phases 7-10 (shipped 2026-07-23)

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

**Key Deliverables:**
- MinerU 云端 API 集成 (mapper, parser, fallback)
- PDF 类型检测 (扫描版/数字版分流)
- Token 安全管理 (safeStorage + IPC + Settings UI)
- node-pdf-to-markdown 评估报告

</details>

## Progress

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
