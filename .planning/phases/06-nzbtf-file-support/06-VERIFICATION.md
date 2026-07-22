---
phase: 06
status: passed
verified: 2026-07-22
---

# Phase 6: nZBTF File Support — Verification

## Automated Checks

| Check | Result |
|-------|--------|
| `pnpm --filter @bidlens/shared build` | ✅ passes |
| `grep "nzbtfParser" packages/shared/src/parser/` | ✅ registered in index.ts |
| `grep "class NzbtfParser" packages/shared/src/parser/nzbtf/index.ts` | ✅ found |
| `grep "parseTbXml\|parseEchoXml\|parseHyChooseXml" packages/shared/src/parser/nzbtf/` | ✅ all 3 parsers |
| `packages/shared/src/parser/nzbtf/index.ts` min 60 lines | ✅ 122 lines |

## Must-Have Verification

| Truth | Status |
|-------|--------|
| NzbtfParser detects .nzbtf files and extracts ZIP archive | ✅ |
| TB.xml bidder info parsed into DocumentAst paragraph/section blocks | ✅ |
| Echo.xml pricing data parsed into DocumentAst table blocks | ✅ |
| hyChoose.xml evaluation data parsed into DocumentAst paragraph blocks | ✅ |
| Parsed nZBTF data stored as DocumentAst available for risk detection | ✅ |

## Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| nzbtf/index.ts | registry.ts | implements DocumentParser | ✅ |
| parser/index.ts | nzbtf/index.ts | globalRegistry.register(nzbtfParser) | ✅ |
| nzbtf/index.ts | tb-parser.ts | import parseTbXml | ✅ |
| nzbtf/index.ts | echo-parser.ts | import parseEchoXml | ✅ |
| nzbtf/index.ts | hy-parser.ts | import parseHyChooseXml | ✅ |

## Human Verification (deferred)

| Item | Why Manual |
|------|-----------|
| User can select .nZBTF in file dialog | Requires Electron window |
| nZBTF parsing produces readable content | Visual inspection of DocumentAst |

## Result

**Status: passed** — all automated checks and must-haves verified. Human verification items deferred (require running Electron app).
