# Risk Detection Pipeline — Feature Landscape

**Domain:** Bid document similarity risk review (投标文件雷同性风险审查)
**Researched:** 2026-07-23
**Confidence:** HIGH — based on codebase inspection, PRD, and existing type contracts

## Context

v0.3.3 built MinerU PDF parsing infrastructure (cloud API parser, PDF type detector, content-list mapper). v0.3.4 needs to wire MinerU into the actual risk detection flow so users can import PDFs and get risk results end-to-end.

**Current state of the pipeline:**
- ParserRegistry has Docx4jsParser, PdfParser, NzbtfParser registered. MinerU parser exists but is NOT registered (needs API token, lazy-init).
- `parser-service.ts` has custom PDF fallback logic (pdf-parse → detectPdfType → MinerU fallback) that bypasses the registry for PDFs.
- `RiskReviewService.run()` implements the full pipeline: validate → parse → call Rust engine (riskAnalyzeWithAst) → aggregate → persist.
- MinerU produces `DocumentAst` (same type as all parsers), so downstream pipeline works identically once parsing succeeds.
- UI pages exist: NewProjectPage, ProjectProcessingPage, RiskResultPage with evidence workbench.
- All shared types defined: RiskFinding, Evidence, ReviewNode, FilePairAssessment, ProjectRiskAssessment.

**Key insight:** The "pipeline" is already built. The gap is (1) MinerU parser registration, (2) making PDF parsing robust end-to-end, and (3) ensuring MinerU's richer AST output (tables, sections) flows correctly through the Rust engine.

## Table Stakes

Features that must work for v0.3.4 to be usable. Missing = product feels broken.

| Feature | Why Expected | Complexity | Current State |
|---------|-------------|------------|---------------|
| **PDF auto-routed to MinerU** | Users import PDFs; if MinerU token configured, scanned/complex PDFs should auto-route to MinerU parser | Low | `parser-service.ts` has fallback logic but MinerU not in registry. Need to register with token-aware `canParse`. |
| **MinerU token config persisted** | Users configure MinerU token once in Settings; subsequent parses use it | Low | `mineru-config.ts` + IPC handlers exist. Settings UI has token field. Just needs wiring into parser-service lazy-init. |
| **DocumentAst flows to Rust engine** | Parsed AST must convert to engine format via `toEngineDocumentAst()` and pass to `riskAnalyzeWithAst()` | Low | Already works for DOCX. MinerU produces same `DocumentAst` type. `toEngineBlocks()` handles paragraph/section/list/table. |
| **Table blocks from PDF reach table detector** | MinerU extracts tables as `TableNode`; Rust engine's table detector must receive them | Medium | `toEngineBlocks()` maps `TableNode` to engine format. Need to verify Rust engine's `risk.analyzeWithAst` actually processes table blocks. |
| **Section structure from PDF preserved** | MinerU detects titles/sections; these become `SectionNode` in AST, which `toEngineBlocks()` flattens to heading paragraphs | Low | Already handled: `toEngineBlocks()` converts section titles to paragraph nodes with heading IDs. |
| **Progress events during MinerU parse** | MinerU cloud API has upload + poll latency (5-30s). User must see progress, not a frozen UI | Medium | `parser-service.ts` emits progress for file-level parsing. MinerU's internal stages (upload/poll/download) are opaque to the caller. Need to surface MinerU-specific stage labels. |
| **MinerU failure fallback** | If MinerU API fails (timeout, auth error, network), fall back gracefully and report warning | Low | `parser-service.ts` already catches parse failures. Need to ensure warnings propagate to project warnings. |
| **RiskFinding with PDF evidence** | Findings from PDF documents must have valid sourceOriginalText, sourcePageRange, sourceSectionPath | Medium | MinerU mapper produces blocks with page ranges. Evidence extraction depends on ReviewNode generation from AST — currently done by Rust engine, not TypeScript. |
| **Relationship matrix for mixed formats** | Project with DOCX + PDF submissions must produce correct file-pair assessments | Low | File-pair assessment is format-agnostic; operates on RiskFinding objects regardless of source format. |
| **Report includes PDF-sourced findings** | Exported report (PDF/HTML/Markdown) must show evidence from PDF documents | Low | Report generator uses RiskFinding + Evidence objects, which are format-agnostic. |

## Differentiators

Features that improve quality but aren't strictly required for v0.3.4.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **PDF page number in evidence** | Users can jump to exact page in original PDF when reviewing evidence | Medium | MinerU provides page indices per block. Need to thread through AST → ReviewNode → Evidence. Currently page ranges in Evidence are nullable. |
| **Table cell-level evidence location** | Evidence from tables shows exact row/cell position, not just "somewhere in this table" | Medium | MinerU provides structured table data. `TableNode.rows: string[][]` maps to engine table format. Cell-level evidence requires engine support. |
| **Scanned PDF quality warning** | Warn user when OCR quality is likely low (few chars/page, many garbled characters) | Low | MinerU doesn't expose OCR confidence scores in content_list.json. Could heuristic-check post-parse word count. |
| **Multi-column PDF correct ordering** | Technical proposals with 2-3 column layouts parse in correct reading order | Low | MinerU handles this natively via layout analysis. No extra work if using MinerU. |
| **PDF parser version in report** | Report shows which parser (pdf-parse vs MinerU) was used for each document | Low | `DocumentAst.parserVersion` already stores this. Just needs to surface in report. |
| **Batch PDF import with progress** | Import 8 PDF files with per-file progress indication | Medium | Current UI shows file list. Per-file parse progress already emitted via `risk:progress`. |

## Anti-Features

Features to explicitly NOT build in v0.3.4.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **GPU inference in Electron** | 4-5 GB dependency, CUDA requirement, incompatible with offline desktop distribution | Use MinerU cloud API (already implemented) |
| **Replace pdf-parse entirely** | MinerU is overkill for simple digital PDFs; cloud API has latency cost | Keep pdf-parse as primary for digital PDFs, MinerU as fallback for scanned/failed |
| **PDF image extraction/comparison** | Image similarity detection is a separate product concern; not in PRD scope | Defer to future version |
| **Formula recognition/comparison** | Rarely relevant for bid similarity; LaTeX comparison is complex | Defer entirely |
| **Offline MinerU (local Python)** | 4-5 GB footprint, Python version conflicts, platform-specific binaries | Cloud API is the v0.3.x approach |
| **Custom OCR pipeline** | MinerU handles OCR internally; building custom PaddleOCR integration is redundant | Use MinerU as-is |
| **PDF annotation/comment extraction** | PDFs don't have DOCX-style comments; annotations are rare in bid documents | Not in PRD scope |
| **Real-time PDF preview during parsing** | PDF rendering in Electron requires pdf.js viewer; not needed for risk review workflow | Show parse status, not document preview |

## Feature Dependencies

```
User imports PDF
  └── File validation (file-validator.ts)
        ├── File existence, readability, size check
        ├── Encryption detection
        └── Parser availability check (globalRegistry.findByExtension)

Parser selection (parser-service.ts)
  ├── .docx → Docx4jsParser (priority=0)
  ├── .pdf → detectPdfType(filePath)
  │     ├── digital → pdf-parse (priority=1)
  │     │     └── fails → MinerU fallback (if token configured)
  │     └── scanned → MinerU (priority=2, if token configured)
  │           └── no token → pdf-parse (will likely fail, warning emitted)
  └── .nzbtf → NzbtfParser

MinerU parse (mineru/index.ts)
  ├── Upload to mineru.net batch API
  ├── Poll for completion
  ├── Download ZIP, extract content_list.json
  ├── mapContentListToAst() → BlockNode[]
  └── Return DocumentAst

Risk pipeline (risk-review-service.ts → engine-manager.ts)
  ├── Validate all files
  ├── Parse all files (loop, per-file progress)
  ├── toEngineDocumentAst() converts DocumentAst → engine JSON format
  ├── engineManager.riskAnalyzeWithAst() sends to Rust engine
  │     ├── Extracting nodes (ReviewNode generation)
  │     ├── Extracting entities
  │     ├── Filtering tender content (if baseline provided)
  │     ├── Recalling candidates (4-way sparse recall)
  │     ├── Detecting (text/table/entity/key-fact detectors)
  │     └── Aggregating (RiskFinding, FilePairAssessment, ProjectRiskAssessment)
  ├── Persist findings + evidence to SQLite (encrypted)
  └── Emit completion progress

Result display (risk-result-page.tsx)
  ├── Risk overview (project risk level, score)
  ├── Relationship matrix (file-pair similarities)
  ├── Finding list (filtered, sortable)
  ├── Evidence workbench (3-column: list + evidence + review)
  └── Report export (PDF/HTML/Markdown)
```

## MVP Recommendation for v0.3.4

The pipeline is 90% built. v0.3.4 is about wiring, not building new features.

**Priority 1 — Wire MinerU into the pipeline (Low complexity)**
1. Register MinerU parser in ParserRegistry when token is available (not in global registry, but in main-process registry at app startup)
2. Ensure `parser-service.ts` fallback logic works end-to-end: pdf-parse fails → MinerU → DocumentAst → engine
3. Verify MinerU token config flow: Settings → save token → parser-service picks it up

**Priority 2 — Verify AST → Engine data flow (Medium complexity)**
4. Verify `toEngineDocumentAst()` correctly maps MinerU's table blocks (TableNode with rows/cells) to engine format
5. Verify Rust engine's `risk.analyzeWithAst` actually processes table blocks from the engine JSON
6. Test with real MinerU-parsed PDF: does the engine produce findings with valid evidence?

**Priority 3 — Progress and error handling (Medium complexity)**
7. Surface MinerU-specific progress stages (uploading, processing, downloading) during parse
8. Ensure MinerU failures (auth error, timeout, network) produce meaningful project warnings
9. Ensure partial results work: if MinerU fails for 1 of 8 files, project enters partial state

**Defer to later milestones:**
- PDF page number in evidence (v0.3.5+)
- Table cell-level evidence location (depends on Rust engine support)
- Scanned PDF quality warning (nice-to-have)
- Batch import UX improvements (v0.3.5+)

## Key Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| MinerU cloud API latency (5-30s per file) | 8 PDFs = 40-240s parse time. Users may think app is stuck. | Surface per-file progress with MinerU stage labels. Show elapsed time. |
| MinerU API token expires mid-parse | Parse fails, project enters partial state | Already handled by parser-service fallback + project status. |
| Rust engine doesn't process MinerU's table blocks | Table detector produces 0 findings for PDF tables | Must verify engine's table handling. May need engine-side fix. |
| MinerU content_list.json schema changes | Mapper breaks silently | Pin MinerU API version. Add mapper validation with warnings. |
| Mixed DOCX+PDF project: AST quality差异 | PDF AST has less structure than DOCX AST (no comments/revisions) | Acceptable — PRD scope is text/table/entity/key-fact, not format comparison. |

## Sources

- **Codebase inspection** (HIGH confidence): parser-service.ts, risk-review-service.ts, engine-manager.ts, MinerU parser, shared types
- **PRD** (HIGH confidence): docs/product/PRD-v0.3-similarity-risk-review.md
- **IPC contracts** (HIGH confidence): packages/shared/src/ipc.ts, packages/shared/src/risk-review.ts
