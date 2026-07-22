# Phase 6: nZBTF File Support - Context

**Gathered:** 2026-07-22
**Status:** Ready for research and planning
**Source:** User request + nZBTF file analysis

<domain>
## Phase Boundary

Extend BidLens to support nZBTF bid document format alongside existing DOCX/PDF. nZBTF is a ZIP archive containing XML metadata files (TB.xml, Echo.xml, hyChoose.xml) and embedded documents (PDF, DOCX). The system must:

1. Detect and accept .nZBTF files in project creation
2. Extract ZIP contents to temporary directory
3. Parse all XML metadata files completely
4. Map parsed data to existing Submission/DocumentAst model
5. Make nZBTF data available for risk detection pipeline

</domain>

<decisions>
## Implementation Decisions

### File Format Support
- nZBTF files treated as ZIP archives (detected by extension and magic bytes)
- Extract to temp directory, parse XMLs, store structured data
- Support alongside existing DOCX/PDF (not replacement)

### XML Parsing Scope
- **TB.xml**: Bidder info (company name, credit code, legal person, qualifications, personnel)
- **Echo.xml**: Pricing data (bill of quantities, cost breakdowns, summaries)
- **hyChoose.xml**: Evaluation/bidding choice data
- All fields must be parsed (user requirement: "全部XML元数据")

### Data Model Integration
- Parsed nZBTF data stored in Submission record (extended schema)
- XML metadata accessible for risk detection algorithms
- Embedded documents (PDF/DOCX in BiaoShu/TechDoc) can be parsed separately if needed

### Technical Constraints
- Use Node.js built-in `zlib` or lightweight `adm-zip` for extraction
- Use `fast-xml-parser` or similar for XML parsing (already in ecosystem)
- Maintain offline operation (no external API calls)
- Handle Chinese character encoding correctly (UTF-8 XML)

### Claude's Discretion
- Specific XML field mapping to DocumentAst structure
- Temp directory management and cleanup strategy
- Error handling for corrupted/invalid nZBTF files
- Performance optimization for large nZBTF files

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current File Handling
- `apps/desktop/src/main/services/risk-review-service.ts` — Current file upload and submission creation logic (lines 114-150)
- `apps/desktop/src/main/services/parser-service.ts` — Document parsing service (DOCX/PDF)
- `apps/desktop/src/main/services/file-validator.ts` — File validation logic

### Data Models
- `packages/shared/src/risk-review.ts` — Submission, DocumentAst, and related types
- `packages/shared/src/ipc.ts` — CreateRiskProjectRequest, RiskFileInput interfaces

### IPC Handlers
- `apps/desktop/src/main/ipc/risk-review-handlers.ts` — Risk review IPC registration

### Sample Files
- `D:/Projects/Epoint/资料/v2第三批最新/*.nZBTF` — Sample nZBTF files for testing

</canonical_refs>

<specifics>
## Specific Ideas

- nZBTF file structure (from analysis):
  - TB.xml: ~41KB, contains bidder qualifications, personnel info, OCR data
  - JingJibiao/Echo.xml: ~443KB, contains pricing, bill of quantities, cost summaries
  - HyData/hyChoose.xml: ~25KB, contains evaluation selection data
  - BiaoShu/*.pdf: Embedded bid documents
  - TechDoc/*.docx: Embedded technical documents

- XML namespaces and encoding:
  - Echo.xml uses `xmlns:altova` and `xsi:noNamespaceSchemaLocation`
  - All files are UTF-8 encoded
  - Some fields contain HTML entities (`&amp;quot;`)

- Key data points to extract:
  - Project info: name, section code, bidder name, software version
  - Bidder info: company name, credit code, legal person, qualifications
  - Personnel: project manager, technical staff, qualifications
  - Pricing: total amount, provisional sums, tax, cost breakdowns
  - Bill of quantities: items, quantities, unit prices, norms

</specifics>

<deferred>
## Deferred Ideas

- Embedded document parsing (PDF/DOCX within nZBTF) — can be extracted and parsed separately
- nZBTF encryption support — sample files are "不加密" (unencrypted)
- Bidirectional export (creating nZBTF files) — out of scope

</deferred>

---

*Phase: 6-nzbtf-file-support*
*Context gathered: 2026-07-22*
