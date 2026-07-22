# Phase 6: nZBTF File Support - Research

**Researched:** 2026-07-22
**Domain:** nZBTF bid document format parsing, ZIP/XML processing
**Confidence:** HIGH

## Summary

nZBTF is a ZIP archive containing XML metadata files and embedded documents (PDF/DOCX). The format is used by "新点" (XinDian) bidding software in China. The archive contains three key XML files: TB.xml (bidder info, qualifications, personnel), JingJibiao/Echo.xml (pricing, bill of quantities, cost breakdowns), and HyData/hyChoose.xml (evaluation selection data). The embedded documents in BiaoShu/ and TechDoc/ directories are standard PDF/DOCX files that can be parsed separately.

The existing parser registry architecture (`packages/shared/src/parser/registry.ts`) makes this a clean extension point. Implement the `DocumentParser` interface, register in `globalRegistry`, and the existing pipeline handles the rest. Both required dependencies (`jszip` and `fast-xml-parser`) are already installed in `apps/desktop/package.json`.

**Primary recommendation:** Create a single `NzbtfParser` class implementing `DocumentParser` that extracts ZIP, parses all three XMLs, and maps metadata into `DocumentAst` paragraph/table blocks. No new dependencies needed.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- nZBTF files treated as ZIP archives (detected by extension and magic bytes)
- Extract to temp directory, parse XMLs, store structured data
- Support alongside existing DOCX/PDF (not replacement)
- **TB.xml**: Bidder info (company name, credit code, legal person, qualifications, personnel)
- **Echo.xml**: Pricing data (bill of quantities, cost breakdowns, summaries)
- **hyChoose.xml**: Evaluation/bidding choice data
- All fields must be parsed (user requirement: "全部XML元数据")
- Parsed nZBTF data stored in Submission record (extended schema)
- XML metadata accessible for risk detection algorithms
- Embedded documents (PDF/DOCX in BiaoShu/TechDoc) can be parsed separately if needed
- Use Node.js built-in `zlib` or lightweight `adm-zip` for extraction
- Use `fast-xml-parser` or similar for XML parsing (already in ecosystem)
- Maintain offline operation (no external API calls)
- Handle Chinese character encoding correctly (UTF-8 XML)

### Claude's Discretion
- Specific XML field mapping to DocumentAst structure
- Temp directory management and cleanup strategy
- Error handling for corrupted/invalid nZBTF files
- Performance optimization for large nZBTF files

### Deferred Ideas (OUT OF SCOPE)
- Embedded document parsing (PDF/DOCX within nZBTF) — can be extracted and parsed separately
- nZBTF encryption support — sample files are "不加密" (unencrypted)
- Bidirectional export (creating nZBTF files) — out of scope

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NZBTF-01 | Add nZBTF file format detection and ZIP extraction | Parser registry + `jszip` (already installed) |
| NZBTF-02 | Parse all XML metadata from nZBTF | `fast-xml-parser` (already installed) + XML structure mapped |
| NZBTF-03 | Map nZBTF XML data to existing Submission/DocumentAst model | DocumentAst block types + Submission schema |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jszip | ^3.10.1 | ZIP extraction | Already installed in apps/desktop |
| fast-xml-parser | ^4.5.1 | XML parsing | Already installed in apps/desktop |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | built-in | SHA256 hash for file identity | Always (already used by docx4js parser) |
| node:os | built-in | Temp directory for extraction | Always |
| node:fs/promises | built-in | File I/O | Always |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jszip | adm-zip | jszip already installed, async API preferred |
| fast-xml-parser | xml2js | fast-xml-parser already installed, faster |

**No installation needed.** Both dependencies are already in `apps/desktop/package.json`.

## Architecture Patterns

### Current Parser Registry Pattern

The codebase uses a clean parser registry pattern:

```
packages/shared/src/parser/
├── registry.ts          # ParserRegistry class + globalRegistry singleton
├── types.ts             # DocumentParser interface, ParseInput, ParseResult
├── index.ts             # Re-exports + auto-registers docx4js + pdf parsers
├── docx/index.ts        # Docx4jsParser implements DocumentParser
└── pdf/index.ts         # PdfParser implements DocumentParser
```

**How registration works** (from `packages/shared/src/parser/index.ts`):
```typescript
import { docx4jsParser } from './docx/index.js';
import { pdfParser } from './pdf/index.js';
globalRegistry.register(docx4jsParser);
globalRegistry.register(pdfParser);
```

**How parsers are selected** (from `registry.ts`):
```typescript
findByExtension(ext: string): DocumentParser | null {
  const normalized = ext.toLowerCase().replace(/^\./, '');
  const list = this.extensionIndex.get(`.${normalized}`);
  return list?.[0] ?? null;
}
```

### Recommended Implementation Structure

```
packages/shared/src/parser/
├── nzbtf/
│   ├── index.ts         # NzbtfParser class + export
│   ├── tb-parser.ts     # TB.xml parsing
│   ├── echo-parser.ts   # Echo.xml parsing
│   └── hy-parser.ts     # hyChoose.xml parsing
```

### Pattern: nZBTF Parser Implementation

**What:** Implement `DocumentParser` interface for `.nzbtf` files
**When to use:** Always — this is the standard extension mechanism
**Example:**

```typescript
// packages/shared/src/parser/nzbtf/index.ts
import type { DocumentParser, ParseInput, ParseOptions, ParseResult } from '../types.js';

export class NzbtfParser implements DocumentParser {
  readonly id = 'nzbtf-parser';
  readonly name = 'nZBTF Parser';
  readonly supportedExtensions = ['.nzbtf'];
  readonly mimeTypes = ['application/zip'];
  readonly priority = 1;

  async canParse(input: ParseInput): Promise<boolean> {
    return input.fileName.toLowerCase().endsWith('.nzbtf');
  }

  async parse(input: ParseInput, options: ParseOptions): Promise<ParseResult> {
    // 1. Read file, compute SHA256
    // 2. Extract ZIP with jszip
    // 3. Parse TB.xml, Echo.xml, hyChoose.xml with fast-xml-parser
    // 4. Map to DocumentAst blocks
    // 5. Return ParseResult
  }
}
```

### Pattern: XML-to-DocumentAst Mapping

**What:** Map structured XML data into flat paragraph/table blocks for the risk detection pipeline
**When to use:** Always — the downstream detectors expect `BlockNode[]`
**Strategy:**

Each XML section becomes a `SectionNode` with child `ParagraphNode` and `TableNode` blocks:

- **TB.xml root attributes** -> Section "项目信息" with paragraphs for project name, section code, bidder name, etc.
- **TB.xml TBInfo** -> Section "投标要点" with paragraphs for bid amount, quality承诺, project manager, duration
- **TB.xml BiaoShu/TBNetFileInfo** -> Section "资质人员" with paragraphs per person and qualifications
- **Echo.xml BidderInfo** -> Section "投标人信息" with paragraphs
- **Echo.xml Summary** -> Table "费用汇总" with SummaryItem rows
- **Echo.xml SectionalWorks** -> Section "分部分项" with table for bill of quantities
- **hyChoose.xml ZhengType/DanWeiItem** -> Section "资格审查" with paragraphs for company details

### Anti-Patterns to Avoid

- **Don't create a new DocumentAst variant:** The existing `BlockNode` union type covers all needs. Map nZBTF data to paragraph/section/table blocks.
- **Don't extract embedded documents in this phase:** The BiaoShu/*.pdf and TechDoc/*.docx files are deferred per CONTEXT.md.
- **Don't store raw XML in the database:** Parse completely and store structured blocks. The risk detectors need text content, not XML.
- **Don't use synchronous ZIP extraction:** Use jszip's async API to avoid blocking the main process.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP extraction | Custom ZIP reader | jszip ^3.10.1 | Already installed, handles edge cases |
| XML parsing | regex/xml tokenizer | fast-xml-parser ^4.5.1 | Already installed, handles namespaces, attributes |
| File hashing | Custom SHA256 | node:crypto createHash | Built-in, already used by docx4js parser |
| Temp directory | Custom temp management | node:os tmpdir() + crypto.randomUUID() | Built-in, standard pattern |

**Key insight:** Both core dependencies are already installed. No new packages needed.

## Common Pitfalls

### Pitfall 1: ZIP Path Separator Inconsistency
**What goes wrong:** ZIP entries may use backslashes (Windows) or forward slashes as path separators
**Why it happens:** nZBTF files created on Windows use `\` in ZIP entry names (e.g., `JingJibiao\Echo.xml`)
**How to avoid:** When looking up files in the ZIP, normalize path separators: `Object.keys(zf.files).find(n => n.includes('Echo'))`
**Warning signs:** `zf.file('JingJibiao/Echo.xml')` returns null

### Pitfall 2: HTML Entities in XML
**What goes wrong:** Some XML fields contain HTML entities like `&amp;quot;` that need double-decoding
**Why it happens:** The bidding software stores JSON data inside XML attributes, encoding quotes as `&amp;quot;`
**How to avoid:** After XML parsing, run a second decode pass on string values that contain `&amp;`
**Warning signs:** OCR data in hyChoose.xml contains `&amp;quot;result&amp;quot;`

### Pitfall 3: Large Echo.xml (443KB)
**What goes wrong:** Echo.xml can be very large with deep nesting (bill of quantities with thousands of items)
**Why it happens:** Each work element has norms, each norm has labor/material breakdowns
**How to avoid:** Use fast-xml-parser's streaming mode or limit depth. For risk detection, the Summary and BidderInfo sections are most valuable — don't recursively expand all nested work elements into paragraphs.
**Warning signs:** Memory spike during parsing, slow response

### Pitfall 4: Chinese Filename Encoding in ZIP
**What goes wrong:** ZIP entries with Chinese filenames may not match expected paths
**Why it happens:** ZIP spec has multiple ways to encode filenames (UTF-8, CP936, etc.)
**How to avoid:** Use jszip which handles encoding. When iterating entries, match by partial path (e.g., find entry containing 'Echo.xml' rather than exact path).
**Warning signs:** File lookup returns null despite entry existing

### Pitfall 5: format Type Hardcoded as Union
**What goes wrong:** `RiskFileFormat` is `'docx' | 'pdf'` — adding `'nzbtf'` requires changes in multiple locations
**Why it happens:** The type is used in shared types, DB schema (TEXT), renderer components, and submission creation
**How to avoid:** Change `RiskFileFormat` in `packages/shared/src/risk-review.ts`, update all cast sites
**Warning sites:**
- `packages/shared/src/risk-review.ts` line 23: `RiskFileFormat = 'docx' | 'pdf'`
- `apps/desktop/src/main/services/risk-review-service.ts` line 131: `as 'docx' | 'pdf'`
- `apps/desktop/src/renderer/features/projects/submission-file-list.tsx` line 13: `format: 'docx' | 'pdf'`
- `apps/desktop/src/renderer/features/projects/submission-file-list.tsx` line 42: `ALLOWED_FORMATS`
- `apps/desktop/src/renderer/features/projects/submission-file-list.tsx` line 199: `ext !== 'docx' && ext !== 'pdf'`
- `apps/desktop/src/renderer/features/projects/submission-file-list.tsx` line 310: `accept=".docx,.pdf"`
- `apps/desktop/src/main/ipc/compare-handlers.ts` line 110: file dialog filter
- `apps/desktop/src/renderer/features/projects/tender-baseline-slot.tsx` line 26: `ACCEPT_DEFAULT`

## Code Examples

### ZIP Extraction with jszip
```typescript
// Source: apps/desktop already has jszip ^3.10.1
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

async function extractNzbtf(filePath: string): Promise<Map<string, string>> {
  const buf = await readFile(filePath);
  const zf = await JSZip.loadAsync(buf);
  const files = new Map<string, string>();
  for (const [name, entry] of Object.entries(zf.files)) {
    if (entry.dir) continue;
    // Normalize: match by filename, not full path (handles \ vs /)
    const baseName = name.split(/[\\/]/).pop()!;
    files.set(baseName, await entry.async('string'));
  }
  return files;
}
```

### XML Parsing with fast-xml-parser
```typescript
// Source: apps/desktop already has fast-xml-parser ^4.5.1
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,  // Strip namespace prefixes
});
const parsed = parser.parse(xmlString);
```

### TB.xml Key Data Points
```typescript
// Root attributes (from XiangMuInfo):
// @_XiangMuMC - project name
// @_BiaoDuanBM - section code
// @_TBDW - bidder name
// @_ZhaoBiaoDL - tender agency
// @_JianSheDW - construction unit

// TBInfo array items (key-value pairs):
// @_Key="投标报价", @_Value="24634524.20" (bid amount)
// @_Key="质量承诺", @_Value="合格" (quality commitment)
// @_Key="项目经理", @_Value="建电表" (project manager)
// @_Key="工期", @_Value="12", @_KeyExt="日历天" (duration)
```

### Echo.xml Key Data Points
```typescript
// ConstructionProject attributes:
// @_Total="24634524.20" - total amount
// @_ProvisionalSums - provisional sums
// @_Tax - tax amount
// @_DivisionalAndElementalWorks - divisional works cost

// BidderInfo:
// @_BidName - bidder name
// @_BidTotal - bid total
// @_Compiler - compiler name

// Summary/SummaryItem[] - cost breakdown table
// SectionalWorks -> UnitWorks -> DivisionalAndElementalWorks -> bill of quantities
```

### hyChoose.xml Key Data Points
```typescript
// ZhengType/Main[] - evaluation categories (11 total)
// Main[0] (资格审查材料) -> DanWeiItem:
//   DanWeiName, UnitOrgNum (credit code), FaRen (legal person),
//   ZhuCeZiBen (registered capital), LicenceNum, AnQuanXuKeZhenNum

// Main[1] (项目负责人) -> PMItem - project manager details
// Main[3] (项目组成员) -> XMItem - team member details

// OcrjsonDatas -> OcrjsonData[] - OCR-extracted data (JSON in XML)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual ZIP + XML parsing | Parser registry + jszip + fast-xml-parser | Current codebase | Clean extension point |
| `RiskFileFormat` union type | Same — needs `'nzbtf'` added | This phase | Type change cascades |

**No deprecated patterns detected.** The parser registry is the current standard.

## Open Questions

1. **nZBTF SHA256 computation**
   - What we know: Current parsers hash the file buffer for identity
   - What's unclear: Should we hash the entire .nzbtf ZIP, or just the XML content?
   - Recommendation: Hash the entire .nzbtf file (consistent with docx/pdf behavior)

2. **Echo.xml SectionalWorks depth**
   - What we know: SectionalWorks contains deeply nested UnitWorks -> DivisionalWorks -> WorkElement -> Norm -> LMEME
   - What's unclear: How many levels deep in real files, how much text to include
   - Recommendation: Flatten to 2 levels — Section name + WorkElement summary (name, quantity, price). Skip LMEME detail.

3. **Embedded document count in nZBTF**
   - What we know: Sample has ~30 PDFs and ~10 DOCX files per nZBTF
   - What's unclear: Whether users expect all embedded docs to be parsed
   - Recommendation: Defer per CONTEXT.md. Parse XML metadata only in this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| jszip | ZIP extraction | ✓ | ^3.10.1 (in apps/desktop) | — |
| fast-xml-parser | XML parsing | ✓ | ^4.5.1 (in apps/desktop) | — |
| node:crypto | SHA256 | ✓ | built-in | — |
| node:os | tmpdir | ✓ | built-in | — |
| node:fs/promises | File I/O | ✓ | built-in | — |

**No missing dependencies.** All required packages are already installed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.8 |
| Config file | apps/desktop/vitest.config.ts |
| Quick run command | `pnpm --filter @bidlens/desktop test` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NZBTF-01 | Detect .nzbtf, extract ZIP | unit | `vitest run tests/nzbtf-parser.test.ts` | ❌ Wave 0 |
| NZBTF-02 | Parse all XML metadata | unit | `vitest run tests/nzbtf-parser.test.ts` | ❌ Wave 0 |
| NZBTF-03 | Map to DocumentAst model | unit | `vitest run tests/nzbtf-parser.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @bidlens/desktop test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/shared/src/parser/nzbtf/` — parser implementation directory
- [ ] `packages/shared/src/parser/nzbtf/index.ts` — NzbtfParser class
- [ ] `packages/shared/src/parser/nzbtf.test.ts` — unit tests with fixture XML
- [ ] Sample nZBTF XML fixtures for testing (extract from real files)

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: all files listed in canonical_refs
- nZBTF sample file analysis: `D:/Projects/Epoint/资料/v2第三批最新/*.nZBTF`
- Package.json dependency verification: `apps/desktop/package.json`

### Secondary (MEDIUM confidence)
- jszip API: https://stuk.github.io/jszip/documentation/api.html
- fast-xml-parser API: https://github.com/NaturalIntelligence/fast-xml-parser

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — dependencies already installed, APIs verified
- Architecture: HIGH — parser registry pattern directly observed in codebase
- Pitfalls: HIGH — ZIP path separators and HTML entities verified from sample files

**Research date:** 2026-07-22
**Valid until:** 2026-08-22 (30 days — stable, no external API dependencies)
