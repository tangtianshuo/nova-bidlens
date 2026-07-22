# Codebase Concerns

**Analysis Date:** 2026-07-22

## Tech Debt

**God class: RiskReviewService (951 lines):**
- Issue: Single class handles project lifecycle, analysis pipeline, AST caching, finding persistence, report export, PDF generation, and risk assessment computation
- Files: `apps/desktop/src/main/services/risk-review-service.ts`
- Impact: Difficult to test, modify, or reason about. Any change risks side effects across unrelated features
- Fix approach: Extract into focused services — `AnalysisPipeline`, `ReportExporter`, `RiskAssessmentCalculator`, `DocumentCacheService`

**Monolithic repositories file (782 lines, 13 factories):**
- Issue: All 13 repository factory functions live in a single file with all row types
- Files: `apps/desktop/src/main/db/repositories.ts`
- Impact: Merge conflicts when multiple features modify different repositories. Hard to navigate
- Fix approach: Split into `repositories/project.ts`, `repositories/finding.ts`, `repositories/evidence.ts`, etc.

**Module-level mutable singletons in IPC handlers:**
- Issue: `orchestrator`, `persistenceDeps`, `service`, `engineManager` are module-level `let` variables with null checks scattered everywhere
- Files: `apps/desktop/src/main/ipc/compare-handlers.ts:30-37`, `apps/desktop/src/main/ipc/risk-review-handlers.ts:7-8`
- Impact: Fragile initialization order, non-obvious lifecycle, potential null dereference if IPC called before init
- Fix approach: Use dependency injection or a service container; require initialization before handler registration

**Fire-and-forget async in project creation:**
- Issue: `void this.run(projectId, request, abort)` discards the Promise, so unhandled rejection in the pipeline is only caught internally
- Files: `apps/desktop/src/main/services/risk-review-service.ts:148`, `:193`, `:211`
- Impact: If the internal catch block itself throws, the error is lost. No way for callers to await completion
- Fix approach: Store the Promise in `activeRuns` and expose a `waitForCompletion(projectId)` method

**Naive fallback detection (O(n^2) exact match):**
- Issue: `buildFindings()` compares every block of every document pair with exact string matching after normalization. No semantic or fuzzy matching
- Files: `apps/desktop/src/main/services/risk-review-service.ts:923-951`
- Impact: When Rust engine unavailable, detection quality is very low. Performance degrades quadratically with document size
- Fix approach: Replace with Jaccard similarity or shingled n-gram matching as interim improvement

**Hardcoded version strings everywhere:**
- Issue: `'lexical-fallback'`, `'1.0.0'`, `'0.2.2'`, `'0.3.0'`, `'lexical-1.0.0'` scattered as magic strings
- Files: `apps/desktop/src/main/services/risk-review-service.ts:120-123`, `:524`, `:606`, `:709`, `:946`
- Impact: Version bumps require hunting through code. Inconsistent version strings across code paths
- Fix approach: Define version constants in a single `versions.ts` config file

**Empty sha256 on project creation:**
- Issue: `sha256: ''` is set when creating submission rows, only computed later during parsing
- Files: `apps/desktop/src/main/services/risk-review-service.ts:132`
- Impact: If parsing fails or is interrupted, submissions have empty hashes. Resume logic at line 357 uses this empty hash to look up cached ASTs
- Fix approach: Compute file hash during validation phase (before parsing) and store it immediately

## Known Bugs

**TODO: History recompare not wired to engine:**
- Symptoms: Clicking "recompare" in history creates a new task but does not trigger actual comparison
- Files: `apps/desktop/src/main/ipc/history-handlers.ts:108-110`
- Trigger: History view -> recompare action
- Workaround: None — feature is incomplete

**TODO: Review workbench cell click and jump-to-position not wired:**
- Symptoms: Clicking a cell in the table viewport or jumping to a position does nothing
- Files: `apps/desktop/src/renderer/features/compare/ReviewWorkbench.tsx:28`, `:32`
- Trigger: Table diff review -> click cell or jump-to-position
- Workaround: None — stubs only

**`as any` in production CommentHighlight:**
- Symptoms: Type safety bypassed for children prop extraction
- Files: `apps/desktop/src/renderer/components/CommentHighlight.tsx:401`
- Trigger: Comment rendering with unexpected children structure
- Workaround: Runtime works but loses type checking

## Security Considerations

**Path traversal via shell.openPath / shell.showItemInFolder:**
- Risk: `risk:openFile` and `risk:openFolder` IPC handlers pass user-influenced file paths directly to `shell.openPath()` without validation. An attacker who can influence the stored file path (e.g., via a crafted project import) could open arbitrary files
- Files: `apps/desktop/src/main/ipc/risk-review-handlers.ts:48-54`, `apps/desktop/src/main/ipc/compare-handlers.ts:283-288`
- Current mitigation: Paths originate from user file selection dialog, but resume/recovery reconstructs paths from audit events
- Recommendations: Validate that paths are within expected directories before calling `shell.openPath()`

**IPC request parameter not type-checked:**
- Risk: `saveRiskFindingReview` handler receives `request` as untyped `unknown` from renderer. No validation of projectId, findingId, status, or note fields
- Files: `apps/desktop/src/main/ipc/risk-review-handlers.ts:25`
- Current mitigation: TypeScript types on the service layer provide some protection
- Recommendations: Add runtime validation (zod or manual guards) at the IPC boundary

**Encryption key held in memory:**
- Risk: AES-256 master key stored as `Buffer` in `KeyManager.masterKey` and passed to `RiskReviewService` constructor. Only zeroed on explicit `destroy()` call
- Files: `apps/desktop/src/main/services/key-manager.ts:27`, `apps/desktop/src/main/services/risk-review-service.ts:69`
- Current mitigation: Key is wrapped with Electron safeStorage (DPAPI) at rest. Memory zeroing on shutdown
- Recommendations: Consider scoped key derivation per operation to minimize exposure window

**Backup service SQL string interpolation:**
- Risk: `VACUUM INTO '${backupPath.replace(/'/g, "''")}'` uses string interpolation for SQL. While the path is internally generated, this pattern is fragile
- Files: `apps/desktop/src/main/services/backup.ts:35`
- Current mitigation: Path is constructed from timestamp, not user input. Single-quote escaping applied
- Recommendations: Use parameterized query or validate path contains only safe characters

## Performance Bottlenecks

**Synchronous file parsing in analysis pipeline:**
- Problem: Documents are parsed sequentially in a `for` loop, not in parallel
- Files: `apps/desktop/src/main/services/risk-review-service.ts:343-351`
- Cause: Each parse awaits completion before starting the next. For 8 documents, this serializes all parsing
- Improvement path: Parse documents in parallel with `Promise.all` (respecting memory limits)

**N+1 query pattern in listProjects:**
- Problem: `listProjects()` calls `submissionRepo.getByProject()` and `findingRepo.getByProject()` for each project in the list
- Files: `apps/desktop/src/main/services/risk-review-service.ts:92-94`
- Cause: Each project triggers 2 additional DB queries
- Improvement path: Batch query with JOIN or use a single query with aggregation

**Reconstructing full detail for risk level derivation:**
- Problem: `getProject()` loads all submissions, all findings, all evidence, all file pairs, all detector runs, all checkpoints, and the assessment for every detail view
- Files: `apps/desktop/src/main/services/risk-review-service.ts:730-820`
- Cause: No lazy loading or pagination of evidence/findings
- Improvement path: Load findings/evidence on demand when user expands a finding

**PDF generation creates hidden BrowserWindow per export:**
- Problem: Each PDF export creates a new `BrowserWindow({ show: false })`, loads HTML, renders, then closes
- Files: `apps/desktop/src/main/services/risk-review-service.ts:295-315`
- Cause: Uses Electron's `printToPDF` API which requires a window
- Improvement path: Pool a single hidden window for PDF generation, or use a headless PDF library

## Fragile Areas

**Engine manager restart logic:**
- Files: `apps/desktop/src/main/services/engine-manager.ts:647-688`
- Why fragile: Restart depends on `stopping` and `restarting` flags that must be set correctly. Race condition possible if `stop()` called during restart backoff
- Safe modification: Always test engine lifecycle with concurrent stop/start/crash scenarios
- Test coverage: `apps/desktop/tests/integration/resilience-stress.test.ts` covers basic restart but not race conditions

**Risk progress IPC channel:**
- Files: `apps/desktop/src/main/services/risk-review-service.ts:721-728`
- Why fragile: `this.window.webContents.send()` called from async pipeline. If window is closed during analysis, this throws
- Safe modification: Guard with `!this.window.isDestroyed()` before sending
- Test coverage: No test for window-close-during-analysis scenario

**State machine transitions in app-store:**
- Files: `apps/desktop/src/renderer/stores/app-store.ts:47-58`
- Why fragile: Adding a new view requires updating `VALID_TRANSITIONS` and `MODE_DEFAULT_VIEW`. Missing entries silently fail (only `console.warn`)
- Safe modification: Always update both maps when adding views. Consider deriving transitions from mode config
- Test coverage: Basic transition tests exist

**Document AST cache with silent failure:**
- Files: `apps/desktop/src/main/services/risk-review-service.ts:674-701`
- Why fragile: Both `cacheDocumentAst` and `loadCachedAstByHash` catch all errors and return null/skip. Cache corruption is invisible
- Safe modification: Log cache failures with structured context for debugging
- Test coverage: No tests for cache corruption scenarios

## Scaling Limits

**SQLite single-writer:**
- Current capacity: WAL mode with 5s busy timeout handles current load
- Limit: Concurrent writes from multiple analysis pipelines would serialize. Not an issue today (single-window Electron) but blocks multi-window or multi-project parallel analysis
- Scaling path: Connection pooling or write queue if multi-project parallel analysis is added

**In-memory active runs map:**
- Current capacity: All active runs stored in `Map<string, ActiveRun>` in `RiskReviewService`
- Limit: If app crashes mid-analysis, active runs are lost. No persistence of in-flight state
- Scaling path: Persist run state to DB with heartbeat, detect stale runs on startup

**Engine communication over stdio:**
- Current capacity: Single request-response channel, 300s timeout per request
- Limit: Large AST payloads (8 documents) serialized to JSON over pipe. Memory spike on both sides
- Scaling path: Use shared memory or file-based transfer for large payloads

## Dependencies at Risk

**better-sqlite3 (native module):**
- Risk: Native addon requires platform-specific compilation. Electron version upgrades can break ABI compatibility
- Impact: App fails to start if native module incompatible
- Migration plan: Rebuild native module for each Electron version. Consider `better-sqlite3` prebuilds or `sql.js` as fallback

**Rust engine binary distribution:**
- Risk: Engine binary must match platform (win/mac/linux) and architecture (x64/arm64). Packaging and distribution complexity
- Impact: App non-functional without engine. Fallback detection is low quality
- Migration plan: Current fallback (naive exact match) provides degraded functionality. Consider WASM compilation for single-binary distribution

## Missing Critical Features

**No test coverage for RiskReviewService:**
- Problem: The largest source file (951 lines) has zero dedicated unit tests
- Blocks: Confident refactoring, regression detection for the core analysis pipeline

**No IPC integration tests:**
- Problem: IPC handlers tested only via E2E smoke tests, no isolated integration tests
- Blocks: Fast feedback on handler logic, edge case coverage

**Recompare from history is broken:**
- Problem: `history:recompare` creates a new task stub but never triggers the engine
- Blocks: Users cannot re-run historical comparisons with updated engine

## Test Coverage Gaps

**risk-review-service.ts — no unit tests:**
- What's not tested: Project creation, analysis pipeline, resume/retry, finding persistence, report export, risk assessment computation
- Files: `apps/desktop/src/main/services/risk-review-service.ts`
- Risk: Any change to the core pipeline can silently break without detection
- Priority: High

**engine-manager.ts — limited test coverage:**
- What's not tested: Engine binary resolution, restart race conditions, large payload handling, timeout edge cases
- Files: `apps/desktop/src/main/services/engine-manager.ts`
- Risk: Engine lifecycle bugs manifest as silent analysis failures
- Priority: High

**repositories.ts — no direct unit tests:**
- What's not tested: Individual repository CRUD operations, encryption/decryption round-trips, SQL correctness
- Files: `apps/desktop/src/main/db/repositories.ts`
- Risk: Schema changes or SQL bugs only caught at integration level
- Priority: Medium

**buildFindings fallback — no tests:**
- What's not tested: Naive exact-match fallback detection logic
- Files: `apps/desktop/src/main/services/risk-review-service.ts:923-951`
- Risk: Fallback path may produce incorrect findings without detection
- Priority: Medium

---

*Concerns audit: 2026-07-22*
