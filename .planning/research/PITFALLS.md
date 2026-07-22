# Domain Pitfalls: BidLens V0.3.0

**Domain:** Desktop bid document similarity risk review (Electron + Rust)
**Researched:** 2026-07-22
**Overall Confidence:** HIGH (all findings verified against actual code)

---

## Gap Analysis: Claimed vs Actual State

### Gap 1: Risk Projects in Memory Map

**CLAIM (PROJECT.md):** "Risk projects live only in Main-process Map"

**ACTUAL STATE:** PARTIALLY RESOLVED — but Rust side is still in-memory.

**Evidence:**
- TypeScript `RiskReviewService` (`apps/desktop/src/main/services/risk-review-service.ts`) uses 13 SQLite repository instances (projectRepo, submissionRepo, findingRepo, evidenceRepo, reviewDecisionRepo, checkpointRepo, etc.). All project data persists to SQLite via `better-sqlite3`.
- Rust `RiskEngine` (`bidlens-engine/src/risk_engine.rs:175`) still stores projects in `Arc<RwLock<HashMap<String, ProjectState>>>` — purely in-memory.
- However, the real pipeline (`run_analysis_with_ast`) receives pre-parsed ASTs from TypeScript and returns results without using the in-memory map. The in-memory map is only used by the legacy `run_analysis` path (which is a placeholder that sleeps 10ms per phase).
- TypeScript side is the persistence source of truth. Rust side is ephemeral by design (process restarts lose nothing).

**Risk:** LOW for TS side. The Rust in-memory map is a non-issue because `run_analysis_with_ast` doesn't persist anything — it's stateless. The legacy `run_analysis` path should be removed to avoid confusion.

**Action:** Remove legacy `run_analysis` and `ProjectState` from Rust engine. Mark as dead code.

---

### Gap 2: Status Conflation

**CLAIM (PROJECT.md):** "Project status, analysis phase and submission status are conflated"

**ACTUAL STATE:** RESOLVED.

**Evidence:**
- `packages/shared/src/risk-review.ts` defines three separate types:
  - `ProjectStatus`: `'draft' | 'running' | 'ready' | 'partial' | 'interrupted' | 'failed' | 'cancelled'`
  - `AnalysisPhase`: `'validating' | 'parsing' | 'extracting-nodes' | ... | 'completed'`
  - `SubmissionState`: `'pending' | 'validated' | 'parsing' | 'parsed' | 'extracting' | 'extracted' | 'failed' | 'removed'`
- `risk_projects` table stores `status` and `phase` as separate columns (`repositories.ts:181-182`).
- `risk_submissions` table has its own `status` column (`repositories.ts:251`).
- `RiskReviewService.updateStatus()` accepts `ProjectStatus` and optional `AnalysisPhase` independently (`repositories.ts:213-222`).

**Risk:** NONE. Clean separation is implemented.

---

### Gap 3: ReviewDecision Embedded in RiskFinding

**CLAIM (PROJECT.md):** "ReviewDecision is embedded in RiskFinding and important is modeled as a status"

**ACTUAL STATE:** RESOLVED.

**Evidence:**
- `ReviewDecision` is a separate interface in `risk-review.ts:196-205` with its own `id`, `projectId`, `findingId`, `status`, `important`, `note`, timestamps.
- `FindingReviewStatus = 'pending' | 'confirmed' | 'ignored'` — `important` is a separate `boolean` field, not a status value.
- `RiskFinding` stores `reviewStatus`, `important`, `reviewNote`, `reviewedAt` as denormalized fields for query convenience.
- `ReviewDecisionRepository` (`repositories.ts:449-510`) persists decisions separately with upsert logic.
- `saveRiskFindingReview()` updates both `risk_findings` and `review_decisions` tables atomically.

**Risk:** NONE. Proper denormalization with separate source of truth.

---

### Gap 4: Evidence Lacks Complete Location Info

**CLAIM (PROJECT.md):** "Evidence lacks complete AST/ReviewNode/page/table location"

**ACTUAL STATE:** RESOLVED in type system. Data completeness depends on Rust engine output.

**Evidence:**
- `Evidence` interface (`risk-review.ts:149-173`) includes:
  - `sourceSectionPath: string[]` / `targetSectionPath: string[]`
  - `sourcePageRange: [number, number] | null` / `targetPageRange: [number, number] | null`
  - `sourceTableLocation: TableLocation | null` / `targetTableLocation: TableLocation | null`
- `ReviewNode` (`risk-review.ts:81-97`) has `sectionPath`, `pageRange`, `tableLocation`.
- Rust `ReviewNode` (`review-core/src/lib.rs:266-285`) mirrors this with `section_path`, `page_range`, `table_location`.
- Rust `Evidence` (`review-core/src/lib.rs:315-342`) has all location fields.
- `Traverser` (`review-core/src/lib.rs:543-604`) tracks `section_path` and `page_range` during AST traversal.
- DB schema (`repositories.ts:97-123`) stores all location fields as encrypted JSON.

**Remaining concern:** `page_range` depends on parser output. DOCX parsers may not always provide page info (it's layout-dependent). `table_location` is populated by `build_review_nodes` but currently sets `table_location: None` for all nodes (`risk_engine.rs:725`). The `table_location` field exists in the type but isn't populated by the Rust engine yet.

**Risk:** MEDIUM. Type contract is correct. Page ranges may be null for DOCX (expected). Table location is not populated by Rust engine — needs wiring.

---

### Gap 5: Renderer Identity Split

**CLAIM (task breakdown):** "Renderer project identity is split across stores"

**ACTUAL STATE:** STILL EXISTS — three stores hold overlapping project identity.

**Evidence:**
- `useProjectStore` (`features/projects/project-store.ts`): `selectedProjectId: string | null`
- `useRiskReviewStore` (`features/risk-review/risk-review-store.ts`): `projectId: string | null`
- `useAppStore` (`stores/app-store.ts`): `taskId: string | null`

**How they interact:**
1. Creating a project (`App.tsx:58-60`): sets `useRiskReviewStore.projectId` AND `useAppStore.taskId`
2. Opening from list (`App.tsx:39`): sets `useRiskReviewStore.projectId` only (not `useProjectStore.selectedProjectId`)
3. Processing page (`project-processing-page.tsx:29`): reads `useProjectStore.selectedProjectId`
4. Result page (`risk-result-page.tsx:25`): reads `useRiskReviewStore.projectId`

**The bug:** `App.tsx:39` navigates to `project-result` after setting `useRiskReviewStore.projectId`, but `ProjectProcessingPage` reads from `useProjectStore.selectedProjectId`. These are different stores. If a user opens a project from the list, `RiskResultPage` works (reads from risk-review-store), but if they navigate to processing, it would read null from project-store.

**Risk:** MEDIUM. Works in practice because the happy path goes through `startRiskProject` which sets both, and the result page uses risk-review-store. But the split is fragile and confusing. A single source of truth for `projectId` would prevent future bugs.

---

### Gap 6: Rust IDs — Random vs Deterministic

**CLAIM (task breakdown):** "current Diff IDs are random"

**ACTUAL STATE:** RESOLVED for node IDs. Entity/KeyFact IDs remain random (acceptable).

**Evidence:**
- `generate_node_id()` (`review-core/src/lib.rs:505-514`): SHA-256 of `file_hash + node_path` → 32-char hex. Deterministic: same file + same position = same ID. Tested (`lib.rs:1028-1035`).
- `content_hash()` (`review-core/src/lib.rs:749-754`): SHA-256 of normalized text. Deterministic.
- Entity IDs and KeyFact IDs use `uuid::Uuid::new_v4()` (random). This is acceptable — entities are identified by their normalized value + type, not by ID. IDs are just database keys.

**Risk:** NONE. Node IDs are stable across re-runs. Entity/KeyFact random IDs are fine.

---

### Gap 7: No Real E2E Testing

**CLAIM (task breakdown):** "Is there actual Electron E2E testing or just component tests?"

**ACTUAL STATE:** NO Electron E2E. Only V0.2.2 workflow tests with mocked IPC.

**Evidence:**
- `tests/e2e/v022-workflow.test.ts` and `tests/e2e/document-comparison-workflow.test.ts` exist — but they test shared logic (report generation, diff computation) with mock fixtures, not real Electron IPC.
- No Playwright, Spectron, or Electron E2E framework configured.
- No `*.e2e.*` files found in `apps/desktop/`.
- Component tests exist in `features/risk-review/*.test.tsx` — these use `vitest` + `@testing-library/react` with mocked `window.bidlens`.
- The roadmap claims "真实文件 Electron E2E" as complete — this likely refers to the integration-level workflow tests, not actual Electron E2E.

**Risk:** HIGH. No automated verification that the full IPC → main → Rust → DB → renderer pipeline works end-to-end. Manual testing is the only gate.

---

## Additional Pitfalls Discovered

### Pitfall 8: Rust Engine Has Two Parallel Paths

**What:** `RiskEngine` has `run_analysis` (legacy, placeholder) and `run_analysis_with_ast` (real pipeline).

**Evidence:**
- `run_analysis` (`risk_engine.rs:579-682`): sleeps 10ms per phase, returns fake "Ready" status. Uses in-memory `ProjectState`.
- `run_analysis_with_ast` (`risk_engine.rs:307-575`): real pipeline — traverses ASTs, builds ReviewNodes, runs 4 detectors, aggregates.
- TypeScript always calls `riskAnalyzeWithAst` (`risk-review-service.ts:421`), never the legacy path.
- The JSON-RPC `risk.createProject` method in `main.rs:138-176` calls `run_analysis` (legacy) in background — this path is dead code for the TS-driven flow.

**Consequence:** Confusing. Legacy path could mislead developers into thinking it does real work.

**Prevention:** Delete `run_analysis`, `ProjectState`, and the `risk.createProject`/`risk.cancelProject`/`risk.getProject` JSON-RPC methods (they're only used by the legacy path that TypeScript doesn't call).

---

### Pitfall 9: Entity Extraction is Regex-Only

**What:** All entity and key fact extraction uses regex patterns (`review-core/src/lib.rs:879-914`).

**Evidence:**
- Credit code, phone, email, ID card → strong entities (high confidence, regex works well)
- Company name, person name → weak entities (regex `[一-鿿]{2,4}[:：]项目经理...` is fragile)
- Amounts, percentages, dates, periods → key facts (regex works for standard formats)

**Consequence:** Company name regex (`[一-鿿（）()]{2,30}(?:有限公司|...)`) will miss abbreviated names, joint ventures, and foreign companies. Person name regex requires the pattern `名字:职位` — won't catch names in prose.

**Prevention:** Acceptable for V0.3.0 (lexical fallback mode). V0.3.1 BGE-M3 semantic enhancement should improve recall. Keep confidence scores honest (0.6-0.7 for weak entities).

---

### Pitfall 10: Fallback Path Generates Fake Evidence

**What:** When `engineManager` is null, `buildFindings()` generates evidence with synthetic node IDs.

**Evidence:**
- `risk-review-service.ts:936`: `sourceNodeId: 'node-${index}'` — not real AST node IDs.
- `sourceSectionPath: []` — empty.
- `sourcePageRange: null`, `sourceTableLocation: null` — no location info.

**Consequence:** If the Rust engine fails to start, the fallback produces findings with untraceable evidence. Users can't navigate to the source location.

**Prevention:** The engine manager lazy-starts on first use. If it fails, the service should report an error rather than producing degraded results silently. Consider making engine availability a hard requirement.

---

### Pitfall 11: Checkpoint Resume Doesn't Resume Detectors

**What:** Checkpoint stores `phase` but resume always re-runs from `validating` or the checkpoint phase — it doesn't skip completed detectors.

**Evidence:**
- `risk-review-service.ts:166-195`: `resumeRiskProject()` finds latest checkpoint, sets `resumePhase`, then calls `run()` with `startPhase`.
- `run()` skips phases before `startPhase` but re-runs the entire Rust engine call for all detectors.
- `checkpoint.completedDetectors` is stored but never checked during resume.

**Consequence:** Resuming from `detecting` re-runs all 4 detectors instead of skipping completed ones. Wasted work on large documents.

**Prevention:** Check `completedDetectors` before calling each detector. Or accept the re-run as acceptable for V0.3.0 (documents are small, 2-8 files).

---

### Pitfall 12: TODO/FIXME Items

**Found in codebase:**

| File | Line | TODO |
|------|------|------|
| `apps/desktop/src/main/ipc/history-handlers.ts` | 108 | `// TODO: Trigger actual comparison via engine` — legacy compare path, not risk-review |
| `apps/desktop/src/renderer/features/compare/ReviewWorkbench.tsx` | 28 | `// TODO: wire cell click navigation` |
| `apps/desktop/src/renderer/features/compare/ReviewWorkbench.tsx` | 32 | `// TODO: wire jump-to-position` |

**Assessment:** All TODOs are in the legacy `compare:*` path, not the risk-review flow. Non-blocking for V0.3.0.

---

### Pitfall 13: PDF Generation via Hidden BrowserWindow

**What:** `generatePdfFromHtml()` (`risk-review-service.ts:295-315`) creates a hidden `BrowserWindow`, loads HTML, and calls `printToPDF`.

**Consequence:** Works but is fragile — depends on Chromium print behavior, may have layout differences from the HTML version. Creates a temporary file that could leak on crash.

**Prevention:** Acceptable for V0.3.0. Consider `puppeteer` or `pdf-lib` for more control in future versions.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Rust engine cleanup | Legacy `run_analysis` path confuses new contributors | Delete it; keep only `run_analysis_with_ast` |
| Renderer identity unification | Three stores with overlapping projectId | Consolidate to single source of truth |
| Table location wiring | Rust engine returns `None` for all `table_location` | Wire table index from AST traversal |
| E2E testing | No real Electron E2E exists | Add Playwright E2E for critical path |
| Engine fallback | Fallback produces untraceable evidence | Make engine a hard requirement or improve fallback |
| Checkpoint resume | Re-runs completed detectors | Check `completedDetectors` before re-running |

---

## Sources

All findings verified against actual source code:
- `apps/desktop/src/main/services/risk-review-service.ts` — TS service implementation
- `apps/desktop/src/main/db/repositories.ts` — SQLite persistence layer
- `packages/shared/src/risk-review.ts` — Shared type contracts
- `bidlens-engine/src/risk_engine.rs` — Rust engine implementation
- `bidlens-engine/crates/review-core/src/lib.rs` — Core types, ID generation, traversal
- `apps/desktop/src/renderer/features/risk-review/risk-review-store.ts` — Renderer store
- `apps/desktop/src/renderer/features/projects/project-store.ts` — Project store
- `apps/desktop/src/renderer/stores/app-store.ts` — App store
- `apps/desktop/src/renderer/app/App.tsx` — App entry point
- `tests/e2e/` — E2E test directory
