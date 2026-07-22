# MinerU PDF Parsing — Feature Landscape

**Domain:** Bid document PDF parsing for similarity risk review
**Researched:** 2026-07-22
**Confidence:** MEDIUM — based on training data; live sources blocked by network restrictions

## Context: Current PDF Parser

The current `pdf-parser.ts` uses `pdf-parse` (a wrapper around Mozilla's pdf.js). It:
- Extracts raw text per page
- Splits paragraphs by consecutive empty lines
- Produces `ParagraphNode[]` blocks only — no tables, no sections, no images
- No OCR — scanned PDFs yield empty/garbled text
- No layout awareness — multi-column PDFs merge columns incorrectly

This is adequate for text-based digital PDFs but fails on:
- Scanned/image-based PDFs (common in Chinese bid documents)
- PDFs with tables (bill of quantities, pricing schedules)
- Multi-column layouts (technical proposals)

## MinerU Overview

**MinerU** (PyPI: `magic-pdf`) is OpenDataLab's open-source document extraction tool. It uses deep learning models for layout analysis, OCR, and table recognition.

### Core Capabilities

| Capability | Model/Tech | Output |
|------------|-----------|--------|
| Layout analysis | DocLayout-YOLO | Bounding boxes for text, table, image, title, etc. |
| OCR | PaddleOCR / RapidOCR | Text from scanned/image regions |
| Table extraction | Table structure recognition | HTML/Markdown tables with rows/cols/merged cells |
| Formula recognition | LaTeX model | LaTeX strings |
| Reading order | Heuristic + layout | Correct text sequence across columns |
| Multi-column | Layout-aware merging | Separate column text streams |

### Output Formats

MinerU outputs to a directory structure:
```
<output_dir>/<pdf_name>/
  ├── auto/
  │   ├── <name>.md              # Markdown with text, tables, images
  │   ├── <name>_content_list.json  # Structured JSON (blocks with coordinates)
  │   └── images/                # Extracted images
```

The `_content_list.json` is the key integration point — it contains structured blocks with:
- Block type (text, table, title, image, etc.)
- Text content or table HTML
- Bounding box coordinates (page, x, y, w, h)
- Page number

### CLI Usage

```bash
magic-pdf -p <input.pdf> -o <output_dir> -m auto
# -m auto: auto-detect digital vs scanned
# -m txt:  text-only (no OCR)
# -m ocr:  force OCR
```

Batch mode: `-p <directory>` processes all PDFs in directory.

### Python API

```python
from magic_pdf.pipe.UNIPipe import UNIPipe
from magic_pdf.data.data_reader_writer import FileBasedDataWriter, FileBasedDataReader

reader = FileBasedDataReader("")
pdf_bytes = reader.read(pdf_path)
writer = FileBasedDataWriter(output_dir)

pipe = UNIPipe(pdf_bytes, [], writer)
pipe.pipe_classify()   # Detect page types
pipe.pipe_analyze()    # Layout analysis
pipe.pipe_parse()      # Extract content
md = pipe.pipe_mk_markdown("images")  # Generate markdown
```

### Dependencies (Heavy)

| Dependency | Size | Purpose |
|------------|------|---------|
| PyTorch | ~2-4 GB | Deep learning inference |
| PaddlePaddle + PaddleOCR | ~500 MB - 1 GB | OCR engine |
| ONNX Runtime | ~200 MB | Model inference |
| detectron2 | ~300 MB | Object detection |
| opencv-python | ~100 MB | Image processing |
| pymupdf | ~50 MB | PDF rendering |
| Model weights | ~500 MB - 1 GB | Layout, OCR, table models |

**Total environment footprint: 4-5+ GB.** This is the single biggest integration challenge.

### Hardware Requirements

- **GPU (CUDA):** Strongly recommended. Layout analysis + OCR on CPU is 5-10x slower.
- **CPU-only:** Works but impractical for batch processing (>1 min per page vs ~5 sec with GPU).
- **RAM:** 4-8 GB minimum during processing.

## Table Stakes Features

Features MinerU adds that the current parser critically lacks.

| Feature | Why Table Stakes | Complexity | Current Gap |
|---------|-----------------|------------|-------------|
| **Table extraction** | Bid documents contain bill-of-quantity tables critical for similarity detection. Current parser merges table text into paragraphs, losing structure. | Medium | `pdf-parser.ts` has no table detection |
| **Scanned PDF OCR** | Many Chinese bid documents are scanned images. Current parser returns empty/garbled text. | High | `pdf-parse` cannot OCR |
| **Layout-aware text extraction** | Multi-column PDFs (technical proposals) merge columns. Current parser produces scrambled text. | Medium | No column detection |

## Differentiator Features

Features that improve quality but aren't strictly required.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Formula recognition** | Technical proposals may contain formulas. LaTeX output enables comparison. | Low (MinerU handles) | Rarely relevant for bid similarity |
| **Image extraction** | Could detect copied diagrams/charts between submissions. | Low (MinerU handles) | Deferred — image comparison is a separate problem |
| **Reading order detection** | Ensures text sequence is correct for structural comparison. | Low (MinerU handles) | Improves n-gram accuracy |
| **Bounding box coordinates** | Enables precise evidence location (page + position). | Low (JSON output) | Enhances evidence traceability |

## Anti-Features

Features to NOT build or defer.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Ship Python with the app** | 4-5 GB footprint, Python version conflicts, update nightmare | Use pre-processed JSON output; run MinerU as external tool or dev-only |
| **Real-time GPU inference in Electron** | Requires CUDA, massive dependency, incompatible with offline-first desktop distribution | Pre-parse PDFs to JSON, parse JSON in Node.js |
| **Custom MinerU fork** | Maintenance burden, upstream changes fast | Use CLI as-is, parse standard output format |
| **Replace pdf-parse entirely** | MinerU is overkill for simple digital PDFs | Keep pdf-parse for text-only PDFs, use MinerU for complex/scanned |

## Integration Approaches

### Approach A: Python Subprocess (CLI)

Electron spawns `magic-pdf` as child process, reads output JSON.

```
Main Process → spawn('magic-pdf', ['-p', file, '-o', tmpDir, '-m', 'auto'])
  → Wait for process exit
  → Read <tmpDir>/<name>/auto/<name>_content_list.json
  → Map JSON blocks to DocumentAst
```

**Pros:** Simple, no Python API coupling, standard output format.
**Cons:** Requires Python + magic-pdf installed on user machine. Cold start ~10-30s (model loading).

### Approach B: Bundled Python Environment

Ship a standalone Python environment (PyInstaller, conda-pack, or embedded Python) with pre-installed magic-pdf.

**Pros:** No user-side installation.
**Cons:** 4-5 GB package size. Complex build pipeline. Platform-specific binaries.

### Approach C: Pre-processing Tool (Recommended)

Separate CLI tool (Python script) that pre-processes PDFs to JSON. The Electron app reads pre-processed JSON files.

```
# Developer/admin tool (run once per batch)
python preprocess_pdfs.py --input ./bid_docs/ --output ./parsed/

# Electron app reads pre-parsed JSON
Main Process → readJson(preParsedPath) → map to DocumentAst
```

**Pros:** Zero Python dependency in Electron. Clean separation. Pre-processing can run on GPU machine.
**Cons:** Two-step workflow. User must run pre-processing separately.

### Approach D: Local HTTP Server

Run a Python FastAPI server locally. Electron sends PDF path, receives JSON.

**Pros:** Persistent process (no cold start after first). Clean API boundary.
**Cons:** Server lifecycle management. Port conflicts. Still requires Python installed.

## Feature Dependencies

```
MinerU integration
  ├── Python environment setup (prerequisite for all)
  ├── CLI/API invocation layer
  │     └── Approach selection (A/B/C/D)
  ├── JSON-to-DocumentAst mapper
  │     ├── Table block mapping (TableNode from MinerU table HTML)
  │     ├── Paragraph block mapping (ParagraphNode from MinerU text blocks)
  │     └── Section detection (from MinerU title blocks)
  ├── Parser registry integration
  │     └── MinerU parser implements DocumentParser interface
  └── Fallback strategy
        └── pdf-parse for simple PDFs, MinerU for complex/scanned
```

## MVP Recommendation

**Phase 1 — Feasibility spike (Approach C: Pre-processing tool)**
1. Write a Python script that runs MinerU on a directory of PDFs and outputs JSON
2. Write a TypeScript mapper: MinerU JSON → DocumentAst (paragraphs + tables)
3. Validate with real bid document PDFs (scanned + digital)

**Phase 2 — Integration**
4. Implement `MinerUParser` in parser registry (reads pre-parsed JSON)
5. Keep `pdf-parse` as fallback for simple digital PDFs
6. Add MinerU detection heuristic (if pdf-parse yields <N chars/page, try MinerU)

**Phase 3 — Distribution (if needed)**
7. Evaluate bundled Python vs. user-installed Python
8. Build pre-processing CLI tool as separate package

**Defer:** GPU inference in Electron, real-time parsing, image extraction, formula comparison.

## Open Questions

1. **Training data confidence:** All MinerU details below are from training data (pre-2025). The API, CLI flags, and output format may have changed significantly. **Must verify with live repo before implementation.**

2. **content_list.json schema:** The exact JSON structure needs verification. Training data suggests blocks with `type`, `text`/`html`, `bbox`, `page_idx` fields — but this needs confirmation.

3. **MinerU version stability:** MinerU has been iterating rapidly. The API changed between 0.x and 1.x releases. Need to pin a specific version.

4. **Model download:** MinerU downloads models on first run (~500 MB - 1 GB). This needs internet access. For offline-first constraint, models must be pre-downloaded and bundled.

5. **Chinese text quality:** MinerU is developed by a Chinese team (OpenDataLab) and should handle Chinese well, but real bid document testing is needed.

## Sources

- **Training data** (LOW confidence): MinerU GitHub repo, PyPI package, community discussions
- **Codebase inspection** (HIGH confidence): `pdf-parser.ts`, parser registry, DocumentAst types
- **No live sources verified** — all external fetches blocked by network restrictions
