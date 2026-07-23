# Requirements: v0.3.4 MinerU 接入风险检测流程

**Date:** 2026-07-23
**Source:** v0.3.4 research (Stack, Features, Architecture, Pitfalls)

## 目标

把 MinerU 接入实际的风险检测流程，让用户真正用起来。Pipeline 已端到端存在，工作是验证、修复集成 bug、打磨 UX。

---

## v1 Requirements

### Category 1: E2E 验证

- [ ] **E2E-01**: 用真实扫描 PDF 跑通完整链路 — 导入 PDF → MinerU 解析 → mapper → DocumentAst → Rust 引擎 → 风险检测结果 → UI 展示
- [ ] **E2E-02**: 验证 MinerU mapper 输出的 TableNode 在 Rust 引擎表格检测器中正确处理 — 确认 table detector 产出有效的 RiskFinding
- [ ] **E2E-03**: 验证混合格式项目 (DOCX + PDF) 的风险检测 — 确认 file-pair assessment 跨格式正确工作

### Category 2: 集成 Bug 修复

- [ ] **FIX-01**: 修复 parserVersion 硬编码为 '0.2.2' — 应从 DocumentAst 实际使用的 parser 动态获取
- [ ] **FIX-02**: 修复 fileFormat 硬编码为 'docx' — AST 缓存路径应根据实际文件格式动态设置
- [ ] **FIX-03**: 使 file-validator 识别 MinerU 能力 — 当 MinerU token 已配置时，PDF 文件的 parserId 和 capabilities 应反映 MinerU
- [ ] **FIX-04**: 修复 PDF 路径 AbortSignal 死代码 — 将 opts.signal 传递到 MinerU parse → pollBatch → fetch，使用户可以取消长时间解析
- [ ] **FIX-05**: 为 pollBatch 添加硬超时上限和退出机制 — 最长轮询 5 分钟，超时后报错而非无限等待

### Category 3: 进度与错误处理

- [ ] **UX-01**: MinerU 解析期间显示进度反馈 — 通过 risk:progress IPC 推送 "MinerU 解析中 (已等待 Xs)" 到 UI
- [ ] **UX-02**: 处理 token 401 错误 — 解析失败时清除缓存 parser 实例，提示用户重新输入 token
- [ ] **UX-03**: 添加离线检测 — MinerU 调用前检查网络状态，离线时显示明确提示 "此文件需要云端解析，请检查网络连接"
- [ ] **UX-04**: 将 API 错误映射为用户友好的中文消息 — 401→"Token 无效"，429→"请求频繁"，timeout→"解析超时"
- [ ] **UX-05**: 为 MinerU 请求添加并发控制 — 多文件导入时排队处理，避免同时发起过多云端请求

---

## Future Requirements (deferred)

- PDF page number in evidence — 证据中显示 PDF 页码
- Table cell-level evidence location — 表格单元格级证据定位
- Scanned PDF quality warning — 扫描 PDF 质量告警
- Batch import UX with MinerU stage labels — 批量导入阶段标签

## Out of Scope

- **GPU inference in Electron** — 4-5GB 依赖不可接受，使用云端 API
- **Replace pdf-parse entirely** — MinerU 对简单数字 PDF 是过度设计
- **Offline MinerU (local Python)** — 4-5GB 脚印，v0.3.x 使用云端 API
- **PDF image/formula comparison** — 不在 PRD 范围内

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| E2E-01 | Phase 11 | TBD | Pending |
| E2E-02 | Phase 11 | TBD | Pending |
| E2E-03 | Phase 11 | TBD | Pending |
| FIX-01 | Phase 12 | TBD | Pending |
| FIX-02 | Phase 12 | TBD | Pending |
| FIX-03 | Phase 12 | TBD | Pending |
| FIX-04 | Phase 12 | TBD | Pending |
| FIX-05 | Phase 12 | TBD | Pending |
| UX-01 | Phase 13 | TBD | Pending |
| UX-02 | Phase 13 | TBD | Pending |
| UX-03 | Phase 13 | TBD | Pending |
| UX-04 | Phase 13 | TBD | Pending |
| UX-05 | Phase 13 | TBD | Pending |
