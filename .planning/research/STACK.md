# Technology Stack: MinerU Risk Pipeline Integration (v0.3.4)

**Project:** BidLens — MinerU PDF parsing wired into risk detection pipeline
**Researched:** 2026-07-23
**Confidence:** HIGH

## Executive Summary

**No new libraries or dependencies are needed.** The v0.3.3 work already built all the required infrastructure: MinerU parser, PDF type detection, mapper, ParserRegistry, parser-service fallback logic, EngineManager AST conversion, and the Rust risk engine. The v0.3.4 task is purely about wiring these existing pieces correctly into the end-to-end flow and fixing a few integration bugs found during analysis.

## Current State Analysis

### What Already Works (Verified in Code)

| Component | Location | Status |
|-----------|----------|--------|
| MinerU cloud API parser | `packages/shared/src/parser/mineru/index.ts` | Complete — batch upload, poll, ZIP download, content_list.json mapping |
| PDF type detection (scanned vs digital) | `packages/shared/src/parser/mineru/pdf-type-detector.ts` | Complete |
| content_list.json → DocumentAst mapper | `packages/shared/src/parser/mineru/mapper.ts` | Complete — section hierarchy, tables, paragraphs |
| ParserRegistry with priority indexing | `packages/shared/src/parser/registry.ts` | Complete |
| Parser-service PDF fallback strategy | `apps/desktop/src/main/services/parser-service.ts` | Complete — scanned→MinerU, digital→pdf-parse, fail→MinerU |
| Shared DocumentAst types | `packages/shared/src/document-ast.ts` | Complete — paragraph, section, list, table nodes |
| Shared→Rust AST conversion | `apps/desktop/src/main/services/engine-manager.ts` (`toEngineDocumentAst`) | Complete — flattens sections/lists to paragraphs, wraps table cells |
| Rust risk engine (4 detectors) | `bidlens-engine/src/risk_engine.rs` | Complete — text, table, entity, key-fact detectors + aggregation |
| Risk IPC contracts | `packages/shared/src/ipc.ts` | Complete — risk:* interfaces |
| RiskReviewService pipeline | `apps/desktop/src/main/services/risk-review-service.ts` | Complete — validate→parse→engine→persist→report |
| SQLite persistence with encryption | `apps/desktop/src/main/services/persistence.ts` | Complete |
| MinerU token management (safeStorage + IPC + UI) | `apps/desktop/src/main/services/mineru-config.ts` | Complete |

### Integration Gaps Found

These are wiring bugs, not missing technology:

1. **`file-validator.ts` doesn't know about MinerU.** It calls `globalRegistry.findByExtension('pdf')` which returns pdf-parse (priority=1). The `parserId` and `capabilities` in `FileValidationResult` will never reflect MinerU even when MinerU will actually be used. The validator reports `table: degraded` for PDFs regardless of whether MinerU (which extracts tables well) is handling it.

2. **Hardcoded `parserVersion: '0.2.2'`** in `risk-review-service.ts` line 126. Should reflect the actual parser used (e.g., `'mineru-api-v4'` from MinerU's `DocumentAst.parserVersion`).

3. **Hardcoded `fileFormat: 'docx'`** in `risk-review-service.ts` line 658 (`cacheDocumentAst`). Should use the actual format from the submission row.

4. **MinerU parser not registered in globalRegistry.** By design (needs API token), but this means `file-validator.ts` and other consumers that use the registry can't discover it. The parser-service bypasses the registry for MinerU anyway (direct instantiation), so this is intentional but has the validator side-effect.

## Recommended Stack

### No New Dependencies

| Category | Existing Tech | Why No Change Needed |
|----------|--------------|---------------------|
| PDF parsing (cloud) | MinerU API v4 via `MinerUParser` | Already implemented with retry, polling, ZIP extraction |
| PDF type detection | `detectPdfType` in shared | Already routes scanned→MinerU, digital→pdf-parse |
| Document AST | `DocumentAst` (shared) + `DocumentAst` (Rust) | Already compatible via `toEngineDocumentAst()` |
| Risk detection | Rust `review-core` crate (4 detectors) | Already receives ASTs via JSON-RPC, returns findings |
| IPC | `risk:*` contracts in shared | Already defined, handlers registered |
| Persistence | SQLite + better-sqlite3 + encryption | Already stores findings, evidence, assessments |
| Token management | safeStorage + MineruConfigService | Already handles token CRUD + validation |

### What NOT to Add

| Temptation | Why Not |
|------------|---------|
| Queue/batch library for multiple PDFs | Parser-service already iterates sequentially with AbortSignal; 2-8 files max |
| Progress bar library | Existing `risk:progress` IPC + `RiskProgress` type handles this |
| New Rust crates | `review-core` already has all 4 detectors; no new detection logic for v0.3.4 |
| PDF.js or alternative PDF parser | pdf-parse (digital) + MinerU (scanned/cloud) covers all cases |
| Caching layer for MinerU results | `document_versions` table + SHA256 dedup already exists in persistence |

## Integration Points (What to Wire)

### 1. Parser-Service → RiskReviewService (Already Connected)

`risk-review-service.ts` line 350 calls `parseDocumentFile(inputs[i].path)` which routes through `parser-service.ts` which handles the MinerU fallback chain. This works as-is.

### 2. DocumentAst → Rust Engine (Already Connected)

`risk-review-service.ts` line 434 calls `engineManager.riskAnalyzeWithAst(analyzeRequest)` where `analyzeRequest.submissions[i].ast` comes from `toEngineDocumentAst(parsed[i])`. The conversion in `engine-manager.ts` handles:
- `SectionNode` → flattened `ParagraphNode` (heading + children)
- `ListNode` → flattened `ParagraphNode` items
- `TableNode { rows: string[][] }` → `TableNode { rows: TableRow[] }` with cells

### 3. Fixes Needed (Wiring, Not Technology)

**Fix 1: File validator MinerU awareness**
In `file-validator.ts`, when extension is `.pdf` and MinerU token is configured, report `parserId: 'mineru-parser'` and upgrade table capability from `degraded` to `supported`.

**Fix 2: Dynamic parserVersion**
In `risk-review-service.ts`, read `parserVersion` from the parsed ASTs instead of hardcoding `'0.2.2'`. The MinerU parser sets `parserVersion: 'mineru-api-v4'`.

**Fix 3: Dynamic fileFormat in AST cache**
In `risk-review-service.ts` `cacheDocumentAst()`, use the submission's `file_format` instead of hardcoded `'docx'`.

## Alternatives Considered

| Category | Considered | Rejected Because |
|----------|-----------|-----------------|
| Local OCR (Tesseract) | Would eliminate cloud dependency | MinerU already integrated; Tesseract quality worse for Chinese bid docs; adds native binary dependency |
| Hybrid local+cloud | Run pdf-parse first, MinerU only on failure | Already implemented in parser-service.ts (the fallback chain) |
| ntfy/SSE for MinerU progress | Richer progress during cloud parsing | MinerU batch API doesn't support granular progress; polling with warnings is sufficient |

## Sources

- Source code analysis of all files listed in `files_to_read` plus `risk-review-service.ts`, `engine-manager.ts`, `risk_engine.rs`, `mapper.ts`, `document-ast.ts`, `document-ast/lib.rs`
- Confidence: HIGH — all findings verified against actual code, no external library research needed
