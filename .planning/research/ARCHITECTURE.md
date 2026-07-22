# Architecture: BidLens V0.3.0

**Domain:** Electron desktop app — bid document similarity risk review
**Researched:** 2026-07-22
**Confidence:** HIGH (all claims verified against source code)

## Data Flow: End-to-End

```
Renderer (React/Zustand/React-Query)
  │  window.bidlens.createRiskProject(request)
  ▼
Preload (contextBridge → ipcRenderer.invoke)
  │  'risk:createProject'
  ▼
Main Process (ipcMain.handle → RiskReviewService)
  │  1. Validate files
  │  2. Parse DOCX/PDF via parser-service → DocumentAst
  │  3. Call EngineManager.riskAnalyzeWithAst()
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

## 1. IPC Flow: Fully Wired, Not Stubbed

**Verdict: The risk:* IPC calls are real and functional.** All calls go through actual implementations.

### Registration chain:
- `apps/desktop/src/main/index.ts` line 88: `registerRiskReviewHandlers(win, persistence.db.getDb(), persistence.keyManager.getKey())`
- `apps/desktop/src/main/ipc/risk-review-handlers.ts`: Creates `EngineManager` + `RiskReviewService`, registers all 12 `ipcMain.handle` calls

### Active IPC channels (all real):

| Channel | Handler | Status |
|---------|---------|--------|
| `risk:listProjects` | `service.listProjects()` | REAL — queries DB |
| `risk:getProject` | `service.getProject(projectId)` | REAL — reconstructs detail from DB |
| `risk:createProject` | `service.createProject(request)` | REAL — full pipeline |
| `risk:cancelProject` | `service.cancel(projectId)` | REAL — abort controller |
| `risk:resumeProject` | `service.resumeRiskProject(projectId)` | REAL — checkpoint-based resume |
| `risk:retrySubmission` | `service.retryRiskSubmission(projectId, submissionId)` | REAL — re-triggers analysis |
| `risk:acceptPartial` | `service.acceptPartial(projectId)` | REAL — status update |
| `risk:deleteProject` | `service.deleteProject(projectId)` | REAL — CASCADE delete |
| `risk:saveFindingReview` | `service.saveRiskFindingReview(request)` | REAL — updates DB |
| `risk:getAuditEvents` | `service.getAuditEvents(projectId)` | REAL — queries DB |
| `risk:exportReport` | `service.exportRiskReport(request)` | REAL — generates PDF/HTML/MD |
| `risk:openFile` / `risk:openFolder` | shell helpers | REAL |

### Progress push channel:
- `risk:progress` — Main pushes `RiskProgress` objects via `window.webContents.send()`
- `risk:detectorProgress` — Preload wired but **NOT currently pushed** by Main (detector progress goes through `risk:progress` with phase updates)

## 2. Rust Integration: JSON-RPC over stdio

**Transport:** JSON-RPC 2.0 newline-delimited over stdin/stdout of a child process.

### EngineManager (`apps/desktop/src/main/services/engine-manager.ts`):
- Spawns `bidlens-engine` binary as child process via `spawn()`
- Sends requests as `{id, method, params}\n` to stdin
- Parses responses from stdout line-by-line
- Handles notifications (progress) and responses (results) separately
- Crash recovery with exponential backoff (max 3 restarts)
- Request timeout: 5 minutes for analysis, 5s for ping, 3s for shutdown

### Rust-side JSON-RPC methods (verified in `bidlens-engine/src/main.rs`):

| Method | Status | Notes |
|--------|--------|-------|
| `ping` / `engine.handshake` | REAL | Returns engine version + capabilities |
| `compare` | REAL | V0.2.2 dual-doc comparison |
| `compare.cancel` | REAL | |
| `risk.createProject` | REAL | File-path based (legacy) — validates files, creates in-memory project |
| `risk.analyzeWithAst` | REAL | **Primary path** — accepts pre-parsed ASTs from TS |
| `risk.cancelProject` | REAL | |
| `risk.getProject` | REAL | In-memory project state |
| `shutdown` | REAL | |

### Two risk analysis paths:
1. **`risk.createProject`** (legacy): Rust validates files itself, creates project in HashMap, runs `run_analysis()` — currently a **placeholder** that just iterates phases with 10ms sleeps
2. **`risk.analyzeWithAst`** (real): TS parses documents, sends ASTs to Rust. Rust runs the real pipeline: `build_review_nodes` → `tender::filter_tender_content` → `sparse_index::RecallIndex` → 4 detectors → `aggregation::aggregate_findings`

**The main process always uses path 2** (`risk.analyzeWithAst`) — see `risk-review-service.ts` line 421. Path 1 exists in Rust but is never called from the TS main process.

### Key mapping: TS ↔ Rust AST format
`EngineManager.toEngineDocumentAst()` converts shared `DocumentAst` (camelCase) into engine format (snake_case with flat run/text structure). This is the serialization boundary.

## 3. Database: Real SQLite Schema with Migrations

**No migration files** — migrations are inline in `apps/desktop/src/main/db/migrations.ts`.

### Schema versions:
- **V1** (initial): `tasks`, `document_snapshots`, `diff_snapshots`, `review_annotations`, `settings`, `migration_history`
- **V2** (V0.3): All risk-project tables — **additive only**, does not touch V1 tables

### V2 tables (all verified in code):

| Table | Purpose | Encrypted Columns |
|-------|---------|-------------------|
| `risk_projects` | Project metadata, status, phase, versions | None |
| `risk_submissions` | Per-file submission record | `file_path_encrypted` |
| `document_versions` | Cached ASTs (shared by hash) | `ast_encrypted`, `review_nodes_encrypted` |
| `tender_baselines` | Baseline document reference | None |
| `risk_findings` | Risk findings with scores | `review_note_encrypted` |
| `risk_evidence` | Evidence items per finding | `source_original_text_encrypted`, `source_normalized_text_encrypted`, `target_*`, `context_*` (8 encrypted columns) |
| `file_pair_assessments` | Per-pair similarity scores | None |
| `project_risk_assessments` | Project-level risk summary | None |
| `review_decisions` | Review status per finding | `note_encrypted` |
| `analysis_checkpoints` | Resume checkpoints | None |
| `detector_runs` | Per-detector execution stats | None |
| `audit_events` | Full audit trail | None |
| `exported_reports` | Export history | `file_path_encrypted` |

### Encryption:
- AES-256-GCM via `apps/desktop/src/main/db/crypto.ts`
- Key derived by `KeyManager` from machine-specific material
- Applied to: ASTs, evidence text, review notes, file paths

### Foreign keys: All risk tables use `ON DELETE CASCADE` from `risk_projects`.

## 4. State Management: Zustand + React Query

### Zustand stores:

| Store | File | Purpose |
|-------|------|---------|
| `useAppStore` | `renderer/stores/app-store.ts` | Global view state machine (8 views), mode toggle |
| `useRiskReviewStore` | `renderer/features/risk-review/risk-review-store.ts` | Tab, filters, selected finding, bulk selection |
| `useProjectStore` | `renderer/features/projects/project-store.ts` | Selected project ID |
| `useResultStore` | `renderer/stores/result-store.ts` | V0.2 compare result state (legacy) |

### React Query:
- `useRiskResultDetail(projectId)` — calls `window.bidlens.getProject(projectId)` 
- `useProjectDetail(projectId)` — similar for processing page
- Query client with `retry: false` (line 22 of App.tsx)

### View state machine (App.tsx):
```
project-list → new-project → project-processing → project-result
                                                         ↓
                                                   project-list (back)
```

Legal transitions are enforced in `VALID_TRANSITIONS` map. `startTask()` auto-transitions to `project-processing`. Progress listener auto-transitions to `project-result` on `ready` status.

## 5. File Processing Pipeline: Fully Real

### Flow when user creates a project:

1. **Renderer** (`App.tsx:56`): `startRiskProject()` calls `window.bidlens.createRiskProject({name, preset, submissions, baseline})`
2. **Main** (`risk-review-service.ts:114`): Creates project row + submission rows in DB, starts async `run()`
3. **Phase: validating** (line 330): `validateFile()` on each input
4. **Phase: parsing** (line 339): `parseDocumentFile()` for each — produces `DocumentAst`
5. **Phase: extracting-nodes** (line 400): Calls `engineManager.riskAnalyzeWithAst()` which sends all ASTs to Rust
6. **Rust pipeline** (`risk_engine.rs:307`): 
   - `build_review_nodes()` — traverses AST blocks, extracts entities + key facts
   - `tender::build_baseline()` + `filter_tender_content()` — if baseline provided
   - `sparse_index::RecallIndex` — builds n-gram/hash index, finds candidate pairs
   - 4 detectors: `TextDetector`, `TableDetector`, `EntityDetector`, `FactDetector`
   - `aggregation::aggregate_findings()` — merges evidence into findings
   - `aggregation::assess_file_pairs()` + `compute_project_risk()`
7. **Main persists results** (line 538-647): Findings, evidence, file pair assessments, project risk assessment, detector runs
8. **Emits progress** throughout via `window.webContents.send('risk:progress', ...)`
9. **Renderer** (`project-processing-page.tsx:60`): Listens for progress, auto-navigates to result on `ready`

### Fallback path (no engine):
If `engineManager` is null, `risk-review-service.ts` line 527 uses `buildFindings()` — a naive exact-match function that compares normalized paragraph text. This is the degraded/development mode.

## 6. Evidence Chain: RiskFinding → Evidence → Source Location

### Type hierarchy:
```
RiskFinding
  ├── id, detectorType, riskLevel, involvedSubmissionIds[]
  ├── symmetricSimilarity, directionalCoverage[]
  ├── confidenceScore, scoreBreakdown (ScoreBreakdown)
  ├── reviewStatus, important, reviewNote, reviewedAt
  └── evidence: Evidence[]
        ├── id, detectorType, matchBasis (lexical|semantic|structural|entity|fact)
        ├── similarityScore
        ├── sourceSubmissionId, sourceNodeId
        ├── sourceOriginalText, sourceNormalizedText  (encrypted in DB)
        ├── sourceSectionPath: string[]               (JSON in DB)
        ├── sourcePageRange: [number, number] | null  (JSON in DB)
        ├── sourceTableLocation: TableLocation | null (JSON in DB)
        ├── target* (mirror of source fields)
        ├── contextBefore, contextAfter               (encrypted in DB)
        ├── tenderFiltered, tenderFilterReason
        └── ruleVersion
```

### Rust → TS mapping:
Rust `review_core::RiskFinding` is serialized to JSON via serde (camelCase). Main process maps it to shared `RiskFinding` type at `risk-review-service.ts:469-495`. The mapping is field-by-field with type assertions.

### Key observation: Evidence has complete location info.
`sourceSectionPath`, `sourcePageRange`, `sourceTableLocation` are all populated by the Rust engine (from `build_review_nodes()` which uses `Traverser` to walk the AST). This is the V0.3 improvement over V0.2.

### DB → UI flow:
1. DB stores evidence with encrypted text fields + JSON location fields
2. `EvidenceRepository.getByFinding()` decrypts and parses
3. `RiskReviewService.rowToFinding()` assembles `RiskFinding` with `Evidence[]`
4. React Query fetches via `window.bidlens.getProject()`
5. `RiskResultPage` passes findings to `EvidenceViewport`, `EvidenceDetailTabs`, etc.

## Component Boundaries Summary

| Layer | Component | Responsibility | Communicates With |
|-------|-----------|---------------|-------------------|
| Renderer | `App.tsx` | View routing, project creation | Zustand stores, IPC |
| Renderer | `RiskResultPage` | Evidence workbench UI | React Query, Zustand |
| Renderer | `ProjectProcessingPage` | Progress display, recovery | IPC progress events |
| Preload | `index.ts` | IPC bridge (contextBridge) | Renderer ↔ Main |
| Main | `risk-review-handlers.ts` | IPC registration | Main ↔ Renderer |
| Main | `RiskReviewService` | Pipeline orchestration, DB persistence | EngineManager, Repositories |
| Main | `EngineManager` | Rust process lifecycle, JSON-RPC | Rust binary |
| Main | `repositories.ts` | SQLite CRUD (13 repositories) | better-sqlite3 |
| Main | `DatabaseManager` | DB lifecycle, migrations | SQLite |
| Rust | `main.rs` | JSON-RPC dispatcher, task events | Main process (stdio) |
| Rust | `risk_engine.rs` | Project state, pipeline orchestration | review-core crate |
| Rust | `review-core` | Detectors, aggregation, scoring, sparse index | document-ast crate |

## Known Architecture Issues

1. **Dual project state**: Rust `RiskEngine` keeps an in-memory `HashMap<String, ProjectState>` for `risk.createProject` path, but the main process never uses that path — it uses `risk.analyzeWithAst` which is stateless per-call. The Rust in-memory state is vestigial.

2. **`risk.createProject` in Rust is dead code** from the main process perspective. It exists for potential future direct-from-file-path usage but is currently unreachable.

3. **Progress channel naming mismatch**: Preload wires `risk:detectorProgress` but Main never sends on that channel. Detector progress is embedded in `risk:progress` phase updates.

4. **No `engine:handshake` handler in risk-review-handlers**: The preload has `engineHandshake()` but it's only wired for the compare flow, not the risk flow. The `EngineManager.handshake()` method exists but is never called in the risk path.

5. **`ReviewDecision` duplicates `RiskFinding.reviewStatus`**: Both `risk_findings.review_status` and `review_decisions` table track the same state. The `saveRiskFindingReview()` method updates both.

## Sources

All findings verified directly against source code in this repository. No external sources needed.
