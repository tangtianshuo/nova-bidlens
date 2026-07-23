# MinerU Cloud API Integration Pitfalls

**Domain:** Cloud PDF parsing in Electron desktop app
**Researched:** 2026-07-23
**Overall confidence:** HIGH (based on actual codebase inspection)

---

## Critical Pitfalls

### Pitfall 1: AbortSignal Dead Code in PDF Path

**What goes wrong:** `parser-service.ts` creates timeout and cancel races (lines 131-183), but the PDF code path (lines 89-115) returns `mineru.parse()` directly, bypassing the race entirely. The `opts.signal` and `opts.timeoutMs` parameters are silently ignored for all PDF files. Users cannot cancel a MinerU parse in progress, and the 60s default timeout never applies.

**Why it happens:** The PDF branch was added as an early-return before the race logic. The race block at line 131 only runs for non-PDF files.

**Consequences:**
- MinerU poll loop (3s intervals, 1-3 min duration) is completely uncancellable
- App close during parse leaves fetch requests dangling
- UI shows no cancellation option; user must force-quit

**Prevention:**
- Pass `opts.signal` into `mineru.parse()` and propagate it to `pollBatch`
- In `pollBatch`, check `signal.aborted` before each poll iteration
- In `pollBatch`, listen for `abort` event to break the loop
- Wrap MinerU calls in the same `Promise.race` pattern used for non-PDF parsers

**Detection:** Start a MinerU parse on a scanned PDF, click cancel in UI, observe that polling continues in the background.

---

### Pitfall 2: Infinite Polling with No Escape Hatch

**What goes wrong:** `pollBatch` sets `deadline = Infinity` when `timeoutMs = 0`. The loop runs `fetch → wait 3s → fetch → wait 3s` forever. If the MinerU task is stuck (server-side bug, lost result), the app hangs indefinitely with no feedback.

**Why it happens:** `ParseOptions.timeout` defaults to `0` (no timeout) in the type definition. The parser-service passes 60s, but MinerU's parse path doesn't use it (see Pitfall 1).

**Consequences:**
- User sees a spinner for minutes with no progress or ETA
- No way to cancel (see Pitfall 1)
- Support gets tickets: "app stuck on analyzing PDF"

**Prevention:**
- Set a hard maximum poll duration (e.g., 5 minutes) regardless of `timeoutMs`
- Show poll progress in UI: "MinerU 解析中... (已等待 45s)"
- After N polls (e.g., 60 polls = 3 min), surface a "still working, continue waiting?" dialog
- Log each poll attempt with elapsed time for debugging

**Detection:** Simulate MinerU returning `state: 'pending'` indefinitely. Verify the app surfaces progress and eventually gives up.

---

### Pitfall 3: Offline-First Constraint Violation

**What goes wrong:** `PROJECT.md` states "Offline-first: No network calls during analysis." MinerU is a cloud API. This is a direct architectural contradiction. Users in offline environments (common in Chinese government offices) will hit network errors with no graceful fallback.

**Why it happens:** MinerU was added for scanned PDF OCR capability, but the offline-first constraint predates this decision.

**Consequences:**
- Scanned PDFs fail silently in offline environments (no MinerU → no OCR → `UNSUPPORTED_FORMAT` or garbage output from pdf-parse)
- No UI indication that a network feature was attempted and failed
- Product messaging ("local-only") contradicts actual behavior

**Prevention:**
- **Decide the policy:** Is MinerU an accepted exception to offline-first? If so, update PROJECT.md. If not, queue MinerU tasks for when online.
- Show clear status: "此文件需要云端解析，请检查网络连接"
- Add network detection before attempting MinerU calls (`navigator.onLine` in main process via `net` module)
- Consider a "fully offline mode" that skips scanned PDFs entirely with a warning

**Detection:** Disable network, import a scanned PDF. Verify user gets a clear error, not a 3-minute hang.

---

### Pitfall 4: Token Lifecycle — No Expiration or Refresh

**What goes wrong:** `MineruConfigService` stores a single encrypted token. There is no expiration check, no refresh mechanism, and no handling of mid-session token revocation. If the MinerU API token expires during a long session, every parse fails with a raw 401 error. The cached `mineruParserInstance` holds a stale token forever.

**Why it happens:** Token was designed as "set once, use forever." No token refresh protocol exists in the MinerU API (as of v4).

**Consequences:**
- User sets token, it works. Days later, token expires. Every PDF parse fails with "MinerU batch URL error 401"
- `getMinerUParser()` caches the parser instance; even if user updates the token, the old instance is reused until `resetMinerUParser()` is called
- `validateToken` creates a real batch as a side effect (wasteful, confusing)

**Prevention:**
- On 401 during parse: invalidate cached parser, prompt user to re-enter token
- Call `resetMinerUParser()` when token is updated via settings
- Add a lightweight token check endpoint (if MinerU has one) or skip validation side effects
- Log token source: "using env MINERU_API_TOKEN" vs "using stored token" for debugging

**Detection:** Set a token, revoke it on mineru.net, try to parse. Verify the app shows a re-auth prompt, not a generic error.

---

## Moderate Pitfalls

### Pitfall 5: pollBatch Missing Retry Logic

**What goes wrong:** `withRetry` wraps upload and download operations, but `pollBatch`'s fetch call (line 202) has no retry wrapper. A single ECONNRESET or 503 during polling kills the entire parse — even though the task is still running on MinerU's server.

**Why it happens:** Polling was written separately from the upload/download code. The retry pattern wasn't applied consistently.

**Consequences:**
- Transient network blip during a 2-minute poll loop wastes the entire parse (file was already uploaded, task is running)
- User must re-upload and wait another 1-3 minutes

**Prevention:** Wrap the poll fetch in `withRetry` with a short retry (1-2 attempts, not 3) since the poll interval already provides spacing.

**Detection:** Simulate a network drop during polling. Verify retry occurs instead of immediate failure.

---

### Pitfall 6: No Progress Feedback to User

**What goes wrong:** MinerU parsing takes 1-3 minutes. The current code returns a `ParseResult` only when complete or failed. There are no intermediate progress updates pushed to the renderer. The user sees a spinner for up to 3 minutes with no indication of progress, ETA, or whether the app is still working.

**Why it happens:** The `DocumentParser` interface is synchronous (call parse, await result). No progress callback mechanism exists.

**Consequences:**
- Users assume the app is frozen and force-quit
- Support tickets for "app hangs on PDF"
- Users on slow connections may wait 5+ minutes with no feedback

**Prevention:**
- Add an `onProgress` callback to `ParseOptions` or emit IPC events during polling
- Push progress to renderer via `webContents.send('risk:progress', { ... })` pattern (already exists in IPC contracts)
- Show: "MinerU 解析中 (已等待 30s / 预计 60-180s)" in UI
- At minimum, log poll iterations to the structured logger

**Detection:** Time a real MinerU parse. Verify the UI shows progress updates, not just a static spinner.

---

### Pitfall 7: PDF Type Misclassification → Silent Garbage Output

**What goes wrong:** `parser-service.ts` routes based on `detectPdfType()` which calls `isScannedPdf()` from `mineru/index.ts`. The detection heuristic (avg <50 chars/page on first 3 pages) is fragile. A digital PDF with image-heavy pages (charts, diagrams) may be misclassified as "scanned" and routed to MinerU unnecessarily. Conversely, a scanned PDF with OCR text layer may be classified as "digital" and routed to pdf-parse, which extracts the OCR layer (often garbage) instead of doing proper OCR.

**Why it happens:** The threshold (50 chars/page) is arbitrary. OCR text layers on scanned PDFs vary wildly in quality.

**Consequences:**
- Digital PDFs with charts: unnecessary MinerU call (costs time, API quota)
- Scanned PDFs with bad OCR layer: pdf-parse returns garbage text, MinerU is never tried
- Evidence linking breaks because the AST is based on garbage text

**Prevention:**
- For "digital" PDFs that pdf-parse fails on: already handled (fallback to MinerU at line 106-112)
- For "digital" PDFs that pdf-parse returns low-quality text on: add a quality check (word count, gibberish detection) and fallback to MinerU
- Log the classification decision and chars/page ratio for debugging
- Consider letting the user override: "此 PDF 解析质量较低，是否使用云端解析？"

**Detection:** Parse a scanned PDF with a poor OCR text layer. Verify it doesn't silently produce garbage AST.

---

### Pitfall 8: Concurrent MinerU Requests — No Rate Limiting

**What goes wrong:** User imports 4 scanned PDFs simultaneously. Parser-service calls MinerU for all 4 in parallel. MinerU API may rate-limit (429), or the user's API quota may be exhausted. All 4 requests fail or degrade.

**Why it happens:** No request queue or concurrency limiter exists. Each file import calls `parseDocumentFile` independently.

**Consequences:**
- 429 errors cascade — all files fail simultaneously
- API quota burned faster than expected
- No clear error: "rate limited" vs "quota exceeded"

**Prevention:**
- Queue MinerU requests, process 1-2 at a time
- On 429: back off and retry with exponential delay (already partially handled in `withRetry`)
- Show queue position: "MinerU 排队中 (2/4)..."
- Track API usage in config service for user visibility

**Detection:** Import 5+ scanned PDFs simultaneously. Verify they don't all fail with 429.

---

### Pitfall 9: Error Messages Leak Internal Details

**What goes wrong:** Raw error messages from the MinerU API are surfaced to users: "MinerU batch URL error 401: {\"msg\":\"Unauthorized\"}", "MinerU task failed: model_version not supported". These are developer-facing, not user-facing.

**Why it happens:** Error handling in `parse()` catches and re-throws with the raw message. No user-friendly error mapping exists.

**Consequences:**
- Users confused by HTTP status codes and JSON error bodies
- Security concern: internal API structure exposed
- Chinese users get English error messages (product is zh-CN)

**Prevention:**
- Map known error codes to user-friendly Chinese messages:
  - 401 → "API Token 无效或已过期"
  - 429 → "请求过于频繁，请稍后重试"
  - timeout → "MinerU 解析超时，请检查网络或稍后重试"
- Log raw errors to structured logger for debugging
- Show generic message to user with "查看详情" expand for technical details

---

## Minor Pitfalls

### Pitfall 10: validateToken Creates Side Effects

**What goes wrong:** `MineruConfigService.validateToken()` sends a real batch creation request to MinerU API. This creates an actual batch entry on MinerU's server, consuming quota and leaving orphaned tasks.

**Prevention:** If MinerU has a lighter auth-check endpoint, use it. Otherwise, accept the side effect but document it. Or just check if the token format is valid locally before making the API call.

---

### Pitfall 11: SHA256 as Document ID Is Fragile

**What goes wrong:** `MinerUParser` uses `sha256(fileBuffer)` as `DocumentAst.id`. If the same file is parsed twice (e.g., user re-imports after a failed attempt), the ID collides. This is fine for deduplication but may cause issues if the AST is stored and the second parse produces a different AST (MinerU API results may vary).

**Prevention:** Accept this as a feature (dedup), not a bug. But ensure the persistence layer handles AST replacement correctly when the same SHA256 is re-parsed.

---

### Pitfall 12: nodeIdCounter Not Globally Unique

**What goes wrong:** `mapper.ts` uses a module-level counter (`nodeIdCounter`) that resets on import. If two ASTs are parsed in the same process, node IDs collide (`paragraph-1`, `paragraph-2` reused). Currently harmless since ASTs are processed independently, but risky if merged later.

**Prevention:** Prefix node IDs with the document SHA256 or a short UUID: `${sha256.slice(0,8)}-paragraph-1`. Or keep the counter but reset per-parse (already done via `resetNodeIdCounter()` — verify it's called).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Wiring MinerU into risk pipeline | AbortSignal not propagated (Pitfall 1) | Pass signal through parse → poll → fetch |
| User experience | 3-min spinner with no feedback (Pitfall 6) | Progress IPC events + ETA display |
| Offline environments | Silent failure or 3-min hang (Pitfall 3) | Network check + clear error message |
| Token management | Stale token cache (Pitfall 4) | Invalidate on 401, reset singleton on update |
| Multi-file import | Rate limiting cascade (Pitfall 8) | Queue MinerU requests, 1-2 concurrent |
| Error handling | Raw API errors shown to user (Pitfall 9) | Map to zh-CN user-friendly messages |

---

## Sources

- `packages/shared/src/parser/mineru/index.ts` — MinerU API parser implementation
- `packages/shared/src/parser/mineru/mapper.ts` — Content list to AST mapper
- `apps/desktop/src/main/services/mineru-config.ts` — Token management
- `apps/desktop/src/main/services/parser-service.ts` — Parser routing and fallback
- `packages/shared/src/parser/types.ts` — Parser interface contracts
- `.planning/PROJECT.md` — Offline-first constraint

**Confidence notes:**
- All pitfalls above are derived from code inspection of the current codebase (HIGH confidence)
- MinerU API rate limits: LOW confidence — not documented in code, inferred from typical cloud API behavior
- Token expiration behavior: LOW confidence — no MinerU API docs available for token lifecycle
