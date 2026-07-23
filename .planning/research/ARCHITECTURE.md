# Architecture: MinerU Integration into Risk Detection Pipeline

**Domain:** Bid document similarity risk review (投标文件雷同性风险审查)
**Researched:** 2026-07-23
**Overall confidence:** HIGH (all claims verified against source code)

## Executive Summary

MinerU is **already wired** into the parsing layer. The `parser-service.ts` in desktop main implements a complete PDF fallback strategy (D-03): `detectPdfType()` routes scanned PDFs directly to MinerU, and digital PDFs fall back to MinerU when `pdf-parse` fails. The `RiskReviewService.run()` pipeline calls `parseDocumentFile()` for each submission, so MinerU-produced ASTs already flow into the Rust risk engine automatically.

The integration gap is **not** plumbing -- it is operational: ensuring MinerU token is configured, verifying end-to-end with real PDFs, and handling edge cases (network failures mid-pipeline, partial results, timeout tuning for large scanned PDFs).

## Current Architecture: End-to-End Data Flow

```
Renderer (React/Zustand/React-Query)
  │  window.bidlens.createRiskProject(request)
  ▼
Preload (contextBridge → ipcRenderer.invoke)
  │  'risk:createProject'
  ▼
Main Process (ipcMain.handle → RiskReviewService)
  │  1. Validate files
  │  2. Parse via parser-service → DocumentAst    ← MinerU enters here
  │  3. Call EngineManager.riskAnalyzeWithAst()    ← Rust engine processes ASTs
  ▼
Rust Engine (JSON-RPC over stdio)
  │  'risk.analyzeWithAst' method
  │  review-core: extract nodes → recall candidates → 4 detectors → aggregate
  │  Returns: findings, filePairAssessments, projectRisk, detectorRuns
  ▼
Main Process
  │  Persists findings/evidence/assessments to SQLite (better-sqlite3)
  │  Emits progress via win.webContents.send('risk:progress', ...)
  ▼
Renderer receives progress + queries project detail via React Query
```

## MinerU Integration Point: parser-service.ts

The key file is `apps/desktop/src/main/services/parser-service.ts`. It implements a **PDF fallback strategy** that is **outside** the `ParserRegistry` priority system, using manual routing instead:

```typescript
// parser-service.ts lines 88-115
if (ext === '.pdf') {
  const pdfType = await detectPdfType(filePath);  // 'digital' | 'scanned' | 'unknown'

  if (pdfType === 'scanned') {
    // Scanned PDF → try MinerU directly (pdf-parse can't OCR)
    const mineru = getMinerUParser();
    if (mineru) return mineru.parse(input, options);
    // else fall through to pdf-parse (will likely fail)
  }

  // Digital PDF → use pdf-parse (priority=1 in registry)
  const result = await parser.parse(input, options);

  // pdf-parse fails → fallback to MinerU
  if (!result.success && pdfType !== 'scanned') {
    const mineru = getMinerUParser();
    if (mineru) return mineru.parse(input, options);
  }

  return result;
}
```

### Why MinerU Is Not in ParserRegistry

MinerU is intentionally **not auto-registered** in `packages/shared/src/parser/index.ts`:

```typescript
// MinerU parser: not auto-registered (needs API token)
// Consumer should: const p = new MinerUParser(token); globalRegistry.register(p);
```

`MinerUParser` requires an API token at construction time. The `parser-service.ts` handles this via lazy-init:

```typescript
let mineruParserInstance: MinerUParser | null = null;

function getMinerUParser(): MinerUParser | null {
  if (!mineruParserInstance) {
    const token = mineruConfig?.getToken() ?? process.env.MINERU_API_TOKEN;
    if (token) mineruParserInstance = new MinerUParser(token);
  }
  return mineruParserInstance;
}
```

## Integration Points Map

| Component | File | Role | MinerU Status |
|-----------|------|------|---------------|
| ParserRegistry | `packages/shared/src/parser/registry.ts` | Priority-based parser selection | MinerU NOT registered (by design) |
| ParserService | `apps/desktop/src/main/services/parser-service.ts` | PDF fallback routing | **PRIMARY integration point** -- already routes scanned PDFs to MinerU |
| MinerU Parser | `packages/shared/src/parser/mineru/index.ts` | Cloud API parser | Produces `DocumentAst` compatible with pipeline |
| MinerU Mapper | `packages/shared/src/parser/mineru/mapper.ts` | content_list.json to BlockNode[] | Converts MinerU output to shared AST format |
| PDF Type Detector | `packages/shared/src/parser/mineru/pdf-type-detector.ts` | Scanned vs digital detection | Determines routing in parser-service |
| MineruConfigService | `apps/desktop/src/main/services/mineru-config.ts` | Token storage (encrypted via DPAPI) | Provides token for MinerU instantiation |
| RiskReviewService | `apps/desktop/src/main/services/risk-review-service.ts` | Pipeline orchestration | Calls `parseDocumentFile()` which routes to MinerU |
| EngineManager | `apps/desktop/src/main/services/engine-manager.ts` | Rust engine bridge | Accepts any `DocumentAst`, including MinerU-produced |
| Main index | `apps/desktop/src/main/index.ts` | Startup wiring | Sets MineruConfigService on parser-service (line 99) |

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `parser-service.ts` | File to DocumentAst (with MinerU routing) | ParserRegistry, MinerUParser, pdf-parse |
| `MinerUParser` | Cloud API call to DocumentAst | MinerU cloud API (mineru.net) |
| `RiskReviewService` | Pipeline orchestration, DB persistence | parser-service, EngineManager, 13 repositories |
| `EngineManager` | TypeScript AST to Rust engine, JSON-RPC | bidlens-engine child process (stdio) |
| `MineruConfigService` | Token lifecycle (encrypt/decrypt/validate) | Electron safeStorage, IPC handlers |

## What Is Already Working

1. MinerU parser class with full API v4 integration (upload, poll, download ZIP, parse)
2. PDF type detection (`detectPdfType` -- scanned vs digital via text density heuristic)
3. Fallback strategy in parser-service (scanned -> MinerU, digital -> pdf-parse with MinerU fallback)
4. Token management (encrypted storage via DPAPI, validation, CRUD IPC)
5. Mapper from MinerU `content_list.json` to `DocumentAst` with `BlockNode[]`
6. Risk pipeline calls `parseDocumentFile()` which already routes through MinerU
7. Engine bridge accepts any `DocumentAst` regardless of parser origin
8. Retry with exponential backoff for transient MinerU API failures (ECONNRESET, ETIMEDOUT, 429, 503)

## Gaps for v0.3.4

### Gap 1: End-to-End Verification (Critical)

The plumbing exists but has **not been tested** with real scanned PDFs through the full pipeline. Need to verify:
- `detectPdfType()` correctly identifies scanned PDFs in production
- MinerU API returns valid `content_list.json` for real bid documents
- Mapper produces correct `BlockNode[]` structure for Rust engine consumption
- Rust engine processes MinerU-produced ASTs without errors
- Findings reference correct node IDs and page locations from MinerU output

### Gap 2: Timeout Tuning

Current `DEFAULT_TIMEOUT_MS = 60_000` (60 seconds) in parser-service. MinerU's `parse()` uses `options.timeout` for its polling deadline. Scanned PDFs may take significantly longer via cloud API. The timeout chain:
- `parseDocumentFile()` default: 60s
- `MinerUParser.parse()` uses `options.timeout` for polling
- MinerU poll interval: 3s between checks

For large scanned PDFs (100+ pages), 60s may be insufficient. Timeout should be MinerU-aware or configurable per-parser.

### Gap 3: parserVersion Tracking

MinerU-produced ASTs set `parserVersion: 'mineru-api-v4'`. But `RiskReviewService.createProject()` hardcodes `parserVersion: '0.2.2'` (line 125). This should reflect the actual parser used, or at minimum not overwrite with stale metadata.

### Gap 4: Progress Granularity

During parsing, progress shows generic `已解析 1/4`. MinerU parsing has distinct sub-phases (upload, poll, download, map) that could be surfaced. Not blocking but improves UX for long-running scanned PDF processing.

### Gap 5: Error Recovery Verification

If MinerU fails mid-pipeline after some submissions are already parsed, the checkpoint/resume mechanism handles re-parsing. AST cache stores by SHA256, so a failed MinerU parse won't cache -- subsequent resume re-attempts the API call. This is correct behavior but should be verified with real failure scenarios.

## IPC Surface (Already Wired)

All `risk:*` IPC channels are real and functional (not stubs):

| Channel | Status | Notes |
|---------|--------|-------|
| `risk:createProject` | REAL | Full pipeline including MinerU routing |
| `risk:listProjects` | REAL | Queries DB |
| `risk:getProject` | REAL | Reconstructs detail from DB |
| `risk:cancelProject` | REAL | Abort controller |
| `risk:resumeProject` | REAL | Checkpoint-based resume |
| `risk:retrySubmission` | REAL | Re-triggers analysis |
| `risk:exportReport` | REAL | PDF/HTML/MD generation |
| `mineruGetToken/Save/Delete/Validate` | REAL | Token lifecycle |

## Token Management Chain

```
Renderer (Settings UI)
  → window.bidlens.mineruSaveToken({token})
    → ipcMain.handle('mineru:saveToken')
      → MineruConfigService.setToken()
        → safeStorage.encryptString() → .mineru-token.enc

Parser-service lazy-init:
  getMinerUParser()
    → mineruConfig.getToken()
      → safeStorage.decryptString()
        → new MinerUParser(token)
```

## Build Order Recommendation

The integration plumbing is done. Remaining work is verification and hardening:

1. **Verify end-to-end** with a real scanned PDF -- highest priority, validates entire chain
2. **Fix parserVersion tracking** in `RiskReviewService.createProject()` -- small fix, prevents stale metadata
3. **Tune timeouts** for MinerU-heavy paths -- depends on real-world timing data from step 1
4. **Add MinerU-specific progress events** (optional) -- improves UX for long scans
5. **Test error recovery** -- kill network mid-parse, verify resume works

## Sources

All findings verified directly against source code in this repository (HIGH confidence):

- `packages/shared/src/parser/mineru/index.ts` -- MinerU parser implementation
- `packages/shared/src/parser/mineru/mapper.ts` -- content_list.json to BlockNode[] mapper
- `packages/shared/src/parser/mineru/pdf-type-detector.ts` -- PDF type detection
- `packages/shared/src/parser/registry.ts` -- ParserRegistry (MinerU intentionally not registered)
- `packages/shared/src/parser/index.ts` -- Parser module entry (registration comments)
- `packages/shared/src/parser/types.ts` -- DocumentParser interface
- `packages/shared/src/document-ast.ts` -- DocumentAst type
- `packages/shared/src/ipc.ts` -- IPC contracts including MinerU token management
- `packages/shared/src/risk-review.ts` -- Domain types
- `apps/desktop/src/main/services/parser-service.ts` -- PDF fallback strategy
- `apps/desktop/src/main/services/mineru-config.ts` -- Token management
- `apps/desktop/src/main/services/risk-review-service.ts` -- Pipeline orchestration
- `apps/desktop/src/main/services/engine-manager.ts` -- Rust engine bridge
- `apps/desktop/src/main/index.ts` -- Startup wiring
- `apps/desktop/src/main/ipc/risk-review-handlers.ts` -- IPC handler registration
