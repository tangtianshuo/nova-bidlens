# Milestones

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
