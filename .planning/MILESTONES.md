# Milestones

## v0.3.6 PDF 原文定位与数据提取 (Shipped: 2026-07-24)

**Phases:** 14-17 (4 phases) | **Plans:** 5 | **Requirements:** 17/17

**Key accomplishments:**
- MinerU bbox preservation through DocumentAst pipeline + risk:getPdfFile IPC
- react-pdf canvas-based PDF viewer with page nav, zoom, scroll tracking, keyboard shortcuts
- Evidence card page badges wired to open PDF Drawer at correct file and page
- HighlightOverlay canvas rendering with bbox rectangles, zoom-to-fit, and tooltip
- DualPdfDrawer with side-by-side panes and auto-detecting cross-file evidence

**Stats:** 33 commits, 62 files changed, 3895 insertions

---

## v0.3.4 MinerU 接入风险检测流程 (Shipped: 2026-07-23)

**Phases:** 11-13 (3 phases) | **Plans:** 8 | **Requirements:** 13/13

**Key accomplishments:**
- MinerU 云端 API 解析扫描版 PDF，mapper 产出 DocumentAst
- DocumentAst 流入 Rust 引擎风险检测 pipeline，产出 RiskFinding + filePairAssessment
- parserVersion/fileFormat 动态获取，AbortSignal 全链路传播，pollBatch 5 分钟硬超时
- 401 自动清除缓存、离线检测、友好中文错误、并发控制（max 2）、实时进度反馈

**Stats:** 29 commits, 35 files changed, 137/137 integration tests pass

---

## v0.3.3 MinerU PDF 解析集成调研 (Shipped: 2026-07-23)

**Phases completed:** 5 phases, 8 plans, 12 tasks

**Key accomplishments:**

- Status:
- Fixed addFilesFromList extension filter to accept .nzbtf files alongside .docx and .pdf
- MinerU content_list.json → DocumentAst mapper with hierarchy nesting and HTML table parsing
- MinerU parser implementing DocumentParser with batch upload API, scanned PDF detection, and ZIP content_list.json extraction
- PDF pre-detect routing: scanned PDFs go directly to MinerU, digital PDFs use pdf-parse with MinerU fallback on failure
- Encrypted safeStorage token service with IPC handlers and 3-retry exponential backoff on MinerU API fetches
- node-pdf-to-markdown is conditionally recommended as pdf-parse replacement for text extraction; table recognition and OCR remain unimplemented roadmap items, so it cannot replace MinerU.

---

## v0.2.2 — Dual-Document Comparison (Shipped)

- DOCX/text-PDF parsing pipeline
- Diff engine (table-diff, semantic diff)
- SQLite persistence with encryption
- Review and report UI foundations
- VNext project, matrix, finding and evidence UI components

## v0.3.0 — Non-Embedding Similarity Risk Review (Current)

**Goal:** Complete local, explainable, multi-submission similarity risk review product using text, table, entity and key-fact detectors.

**Status:** Planning

**Scope:** 7 waves, ~60 tasks (V3-000 through V3-607)
