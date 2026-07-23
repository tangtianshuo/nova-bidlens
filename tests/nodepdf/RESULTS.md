# node-pdf-to-markdown Evaluation Report

**Date:** 2026-07-23
**Package:** node-pdf-to-markdown@1.2.5
**Test file:** tests/mineru/fixtures/mineru_test_file.pdf (76 pages, 353KB, digital Chinese PDF)

## NODEPDF-01: Text Extraction Quality

### Extraction Results

| Metric | node-pdf-to-markdown | pdf-parse v2 | MinerU (Phase 7) |
|--------|---------------------|--------------|-------------------|
| Time | 496ms | 500ms | 3500ms (API) |
| Pages detected | 77 | 77 | 76 |
| Total chars | 42,063 | 40,892 | N/A (blocks) |
| Chinese chars | 31,652 | 31,630 | N/A |
| Char accuracy | 100% match | baseline | N/A |
| Markdown headings | 38 | 0 | N/A |
| Tables detected | 0 | 0 | 21 |

### Chinese Character Accuracy

First 500 Chinese characters compared between node-pdf-to-markdown and pdf-parse:
- **Match rate: 100%** (117/117 Chinese chars in sample)
- Both extract Chinese text correctly from digital PDFs
- No garbled characters, no missing text

### Text Extraction Difference

node-pdf-to-markdown extracts ~3% more text (42,063 vs 40,892 chars). The difference comes from:
- node-pdf-to-markdown includes page headers/footers that pdf-parse skips
- Different paragraph merging strategies

### Paragraph Quality

- **node-pdf-to-markdown:** Outputs Markdown with headings (`##`, `####`), paragraph breaks, and list detection. 38 headings identified. Better document structure awareness.
- **pdf-parse:** Raw text with page boundaries. Paragraph splitting via the shared `splitIntoParagraphs()` function. No structural detection.

## NODEPDF-02: Feasibility as Lightweight Alternative

### Dependency Size

| Package | Size | Transitive deps |
|---------|------|-----------------|
| node-pdf-to-markdown | 343KB | pdfjs-dist@3.11 (32MB), enumify |
| pdf-parse | 19MB | pdfjs-dist@5.4 (36MB) |
| MinerU (cloud API) | 0 | HTTP client only |

### Performance

Both parsers are fast for digital PDFs (~500ms for 76 pages). The bottleneck for both is pdfjs-dist rendering. MinerU cloud API is slower (3.5s) but adds OCR and table recognition.

### Feature Comparison vs MinerU

| Feature | node-pdf-to-markdown | pdf-parse | MinerU |
|---------|---------------------|-----------|--------|
| Chinese text | Excellent | Excellent | Excellent |
| Table recognition | None (planned) | None | 21 tables |
| Heading detection | Yes (38 found) | No | Yes (text_level) |
| OCR/scanned PDF | No (planned) | No | Yes (81-142s) |
| Markdown output | Yes | No | Yes (full.md) |
| Structured blocks | No (flat pages) | No (flat pages) | Yes (content_list.json) |
| Bbox/position data | No | No | Yes |
| Local processing | Yes | Yes | No (cloud API) |

### Conclusion

**Conditionally recommended** as a lightweight fallback for digital PDF text extraction.

**Applicable scenarios:**
- Quick text-only extraction when MinerU API is unavailable
- Digital PDFs where table detection is not critical
- Offline/local processing requirement

**Not applicable for:**
- Table recognition (not implemented, roadmap item only)
- Scanned PDFs (no OCR, roadmap item only)
- Risk evidence extraction (no position/structure data for traceability)

**Recommendation:** Use as `pdf-parse` replacement for text extraction quality (headings, Markdown structure), but NOT as MinerU replacement. MinerU's table recognition (21 tables) and structured output (content_list.json with bbox, page_idx, text_level) are essential for BidLens risk analysis.

## NODEPDF-03: Roadmap Tracking

From node-pdf-to-markdown README "Future Plans":

| Feature | Status | Priority for BidLens |
|---------|--------|---------------------|
| Table Recognition | Planned (no timeline) | Critical - blocks risk analysis |
| OCR Support | Planned (no timeline) | High - scanned PDF handling |
| Better Layout | Planned (no timeline) | Medium |
| Performance Optimization | Planned (no timeline) | Low (already fast) |

**GitHub activity:** Package is a fork of @opengovsg/pdf2md. Active maintenance (v1.2.5). TypeScript support and image processing added by maintainer. No evidence of table recognition or OCR implementation progress in the codebase.

**Community:** Small npm download footprint. No significant community ecosystem.
