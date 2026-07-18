# BidLens V0.2.2 Task Breakdown

> Version: 0.1 Draft
> Date: 2026-07-18
> Status: Ready for estimation review, not authorized for implementation
> Specification: [v022-implementation-spec.md](v022-implementation-spec.md)
> Decisions: [v022-ui-ue-decision-log.md](v022-ui-ue-decision-log.md)
> Interactive prototype: [v022-ui-ux-prototype.html](../v022-ui-ux-prototype.html), v1.0 frozen baseline

## 1. Planning Rules

- Estimates are **ideal engineering days**, excluding approval wait, certificate procurement, and manual gold-corpus annotation.
- A task should normally fit in 0.5-3 days. Larger tasks must be split during sprint planning before assignment.
- Each task includes implementation, focused tests, and relevant documentation updates.
- A phase is complete only when its exit gate passes on a clean checkout.
- Mock implementations are allowed only inside tests. Reachable demo or empty production handlers do not satisfy a task.
- Renderer imports MUST use `@bidlens/shared/types-only` for browser-safe shared code.
- Existing user changes, including the deleted `ui-style-recommendations.html`, MUST not be reverted as part of this plan.
- Prototype review changes MUST update the decision log and specification before their implementation task is re-estimated.

## 2. Priority and Workstreams

| Priority | Meaning |
|---|---|
| P0 | Required for release; blocks dependent work |
| P1 | Required for release but can follow the first vertical slice |
| P2 | Required hardening or documentation before release candidate |

| Stream | Ownership area |
|---|---|
| CT | Shared contracts and architecture |
| RT | Parser, task orchestration, Rust engine, Electron main |
| DB | SQLite, encryption, history, backup |
| UI | Renderer, design system, accessibility |
| QA | Fixtures, integration, performance, packaging, release |

## 3. Delivery Graph

```text
Phase 0: contracts and evidence
    |-------------------|-------------------|
    v                   v                   v
Phase 1: runtime     Phase 2: storage    Phase 3: UI shell
    |                   |                   |
    +-------------------+-------------------+
                        v
              Phase 4: review workbench
                        |
                        v
              Phase 5: history and export
                        |
                        v
              Phase 6: release hardening
```

Phases 1, 2, and 3 MAY run in parallel after Phase 0 contract freeze. Phase 4 is the convergence point and MUST not begin against unstable production contracts.

## 4. Phase 0 - Contracts and Test Baseline

**Goal:** Create one canonical cross-layer contract and an objective evidence base before production feature work.

| ID | Pri | Stream | Task | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| P0-01 | P0 | QA | Capture current build/test baseline and classify failures as existing or introduced | - | 1 | Baseline report records TS, Rust, integration, E2E, and packaged-build status |
| P0-02 | P0 | CT | Update architecture and layer AGENT documents for D01-D37 boundaries | - | 2 | No formal architecture document still assigns history SQLite ownership to Rust or advertises out-of-scope UI |
| P0-03 | P0 | CT | Redesign shared comparison, progress, capability, annotation, history, settings, export, and structured-error types | P0-02 | 3 | Types compile under strict mode; renderer-safe exports are complete; obsolete model/topK options are absent |
| P0-04 | P0 | CT/RT | Define canonical TypeScript/Rust JSON field mapping and serialization fixtures | P0-03 | 2 | The same fixture round-trips in TS and Rust without name or enum drift |
| P0-05 | P0 | CT | Define task and review state machines, legal transitions, and error taxonomy | P0-03 | 1.5 | Transition tests reject illegal states and map every public error to a stable code |
| P0-06 | P0 | QA | Establish sanitized fixture catalog and reproducible generators for DOCX, PDF, tables, formats, comments, and revisions | - | 3 | Fixtures have manifest, expected capability metadata, licenses/source notes, and SHA-256 values |
| P0-07 | P0 | RT/QA | Specify and prototype deterministic result ordering and match ID generation | P0-04, P0-06 | 2 | Identical fixture runs produce identical order and IDs in Rust tests |
| P0-08 | P1 | QA | Create initial human-labeled gold corpus and scoring command | P0-06 | 3 | Command reports per-class precision/recall and critical-change misses |
| P0-09 | P1 | CT | Update `docs/api/ipc.md`, `rust.md`, `types.md`, and `parser.md` to the frozen contract | P0-03, P0-04, P0-05 | 2 | API docs match exported types and protocol fixtures |

### Phase 0 Exit Gate

- Shared and Rust contract tests pass.
- Browser-safe exports contain every renderer-required type/helper and no Node dependency.
- The task state machine, error codes, protocol version, and snapshot version are frozen for the first vertical slice.
- Test fixtures are available without confidential content.

## 5. Phase 1 - Real Runtime Pipeline

**Goal:** Replace the demo handler with a cancellable real-file parser-to-Rust pipeline.

| ID | Pri | Stream | Task | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| P1-01 | P0 | RT | Normalize parser extension registration and lookup | P0-03 | 0.5 | `.docx`/`docx` and `.pdf`/`pdf` resolve consistently with regression tests |
| P1-02 | P0 | RT | Implement main-process file validation and capability inspection | P0-03 | 2 | Missing, unreadable, unsupported, encrypted, scanned-PDF, and >100 MB inputs return structured results |
| P1-03 | P0 | RT | Integrate the existing DOCX adapter into the main-process orchestration path | P1-01, P1-02 | 3 | Real DOCX fixture produces canonical Document AST and capability states through integration tests |
| P1-04 | P0 | RT | Integrate the text-PDF adapter with page reliability and scanned-PDF rejection | P1-01, P1-02 | 2.5 | Real text PDF works; image-only PDF is rejected without OCR claims |
| P1-05 | P0 | RT | Add parser cancellation, timeout cleanup, and warning normalization | P1-03, P1-04 | 2 | Cancellation interrupts parsing, closes resources, and emits no late success |
| P1-06 | P0 | RT | Refactor Rust entry into transport adapter plus transport-neutral task service | P0-04, P0-05 | 2.5 | Core crates have no stdio dependency; existing compare behavior remains testable directly |
| P1-07 | P0 | RT | Implement JSON-RPC framing, handshake, protocol version, capabilities, and structured errors | P1-06 | 2.5 | Electron can reject incompatible engine versions before starting a task |
| P1-08 | P0 | RT | Implement Rust task coordinator, real stage events, cancellation token, and shutdown | P1-06, P1-07 | 4 | Ping remains responsive during work; cancel and shutdown have integration tests |
| P1-09 | P0 | RT | Add deterministic Diff AST mapping, full summary, inline text tokens, and stable ordering | P0-07, P1-08 | 4 | Rust output satisfies shared contract for all match types currently implemented and never uses random result IDs |
| P1-10 | P0 | RT | Expose table row/column alignments and canonical table structures in Rust responses | P0-04, P1-08 | 2 | Structural table fixtures align correctly in TS/Rust round-trip tests |
| P1-11 | P0 | RT | Build Electron `EngineProcessManager` with dev/packaged path resolution and hidden Windows process | P1-07 | 3 | Start, handshake, request correlation, stderr capture, exit, and timeout tests pass |
| P1-12 | P0 | RT | Implement crash recovery, bounded backoff, forced cancellation, and late-result discard | P1-08, P1-11 | 3 | Fake/crashing engine tests cover exit, retry limit, forced kill, and unavailable state |
| P1-13 | P0 | RT | Implement main-process comparison task orchestrator across validation, both parsers, Rust, and finalization | P1-03-P1-05, P1-09-P1-12 | 4 | One real comparison runs end to end and emits only real progress |
| P1-14 | P0 | CT/RT | Replace demo IPC/preload handlers with validated production IPC and subscription cleanup | P0-03, P1-13 | 2 | Renderer can start, cancel, observe, and retrieve a real result; invalid payloads are rejected |
| P1-15 | P1 | RT | Unify format, source-comment, and revision results with node/match associations | P1-03, P1-09 | 4 | Located changes attach to match IDs; unlocated changes become document-level items |
| P1-16 | P0 | QA | Add real pipeline integration tests for DOCX/DOCX, PDF/PDF, and cross-format | P1-13-P1-15 | 3 | All three supported combinations complete with correct degradation states |

### Phase 1 Exit Gate

- `compare:start` no longer returns a hard-coded result.
- Real DOCX/DOCX, PDF/PDF, and DOCX/PDF fixtures complete through main/preload IPC.
- Cancellation is demonstrated in both Node parsing and Rust comparison.
- Engine crash cannot crash Electron or leave an orphan child process.

## 6. Phase 2 - Persistence and Local Security

**Goal:** Persist immutable snapshots and mutable review state safely without blocking the Electron event loop.

| ID | Pri | Stream | Task | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| P2-01 | P0 | DB/QA | Spike `better-sqlite3` rebuild, Worker loading, ASAR unpack, and Electron 33 packaging | P0-01 | 2 | Dev and unpackaged smoke builds load the native module; findings are documented |
| P2-02 | P0 | DB | Define minimal V0.2.2 Schema and indexes for tasks, snapshots, annotations, settings, and migrations | P0-03, P0-05 | 2 | Schema excludes future model/plugin tables and enforces foreign keys |
| P2-03 | P0 | DB | Implement checksummed forward-only migration runner and `quick_check` startup | P2-02 | 2.5 | Fresh create, multi-version upgrade, rollback-on-failure, and checksum mismatch tests pass |
| P2-04 | P0 | DB | Implement dedicated database Worker protocol and serialized repository execution | P2-01, P2-03 | 3 | Large test writes do not introduce renderer/main-thread stalls; Worker failure is mapped safely |
| P2-05 | P0 | DB | Implement master-key creation and `safeStorage` wrapping through a key manager | P0-03 | 2 | Key is never logged or stored plaintext; unavailable safeStorage produces a structured degraded state |
| P2-06 | P0 | DB | Implement versioned compression plus AES-256-GCM envelope with unique nonce and AAD | P2-05 | 2.5 | Round-trip, wrong-key, tamper, nonce uniqueness, and version rejection tests pass |
| P2-07 | P0 | DB | Implement task metadata and encrypted Document/Diff snapshot repositories | P2-04, P2-06 | 3 | Completed snapshots reopen without source files and preserve exact parser/engine versions |
| P2-08 | P0 | DB | Implement independent review annotation repository and atomic autosave command | P2-04, P2-06 | 2 | Annotation updates never mutate Diff AST and survive restart |
| P2-09 | P1 | DB | Implement encrypted path metadata, relink, and hash verification for recompare | P2-05, P2-07 | 2 | Missing/moved source flow can relink only after hash/capability checks |
| P2-10 | P0 | DB | Implement retention count, 1 GB budget, LRU cleanup, and retained/active protection | P2-07, P2-08 | 2.5 | Cleanup is transactional and never removes protected tasks |
| P2-11 | P0 | DB | Implement Online Backup, five-backup retention, pre-migration backup, and restore diagnostics | P2-03, P2-04 | 3 | Backup made during WAL writes passes integrity and encrypted snapshot tests |
| P2-12 | P0 | DB | Implement database/WAL/SHM isolation and clean database recovery | P2-03, P2-11 | 2 | Corruption test starts app with new DB while retaining isolated evidence |
| P2-13 | P0 | CT/DB | Add history, settings, storage, cleanup, and annotation IPC contracts/handlers | P0-03, P2-07-P2-12 | 3 | Renderer receives minimal safe view models and cannot issue arbitrary SQL/path access |
| P2-14 | P0 | QA | Add persistence integration suite including restart, tamper, migration, backup, and cleanup | P2-13 | 3 | Suite passes on real temporary database files under Windows-compatible paths |

### Phase 2 Exit Gate

- A completed comparison and its annotations survive full application restart.
- Snapshot content, notes, and paths are not stored plaintext.
- Database corruption, missing key, and tampered record do not prevent application startup.
- Retention and backup behavior match D12, D14, D26, D27, and D30.

## 7. Phase 3 - Design System and Application Shell

**Goal:** Replace inline/demo styling with the approved application structure and reusable accessible primitives.

| ID | Pri | Stream | Task | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| P3-01 | P0 | UI | Install Tailwind 4, shadcn/Radix, Lucide, Sonner, resizable panels, and TanStack Virtual | P0-01 | 1.5 | Production build contains one component system and no browser Node externalization error |
| P3-02 | P0 | UI | Map Swiss Minimalism colors, spacing grid, typography, radii, hierarchy, and semantic diff states into theme tokens | P3-01 | 2 | Light/dark token snapshots are neutral-dominant, use one restrained accent, meet contrast targets, and contain no online font dependency |
| P3-03 | P0 | UI | Implement pre-paint system/light/dark theme boot and persistence | P3-02 | 1.5 | No light-to-dark flash in packaged cold-start test |
| P3-04 | P0 | UI | Build accessible Swiss Minimalism buttons, icon controls, fields, tabs, dialogs, menus, badges, tooltips, and feedback primitives | P3-01, P3-02 | 3 | Primitives use 1 px borders, 4-6 px radii, no decorative gradients/shadows, and cover keyboard, focus, disabled, error, high contrast, and reduced motion states |
| P3-05 | P0 | UI | Implement application state machine and view shell without marketing home or global sidebar | P0-05, P3-04 | 2.5 | New, processing, result, and history views transition only through legal states |
| P3-06 | P0 | UI | Implement compact top bar, leave confirmation, window minimums, and global actions | P3-05 | 2 | Top bar behavior matches D18 and has complete keyboard labels |
| P3-07 | P0 | UI | Implement new comparison view with file slots, swap, validation, capabilities, and sensitivity | P1-02, P3-05 | 3.5 | All supported/unsupported/degraded states render from real validation data |
| P3-08 | P0 | UI | Implement processing view with real stage list, elapsed time, warnings, cancel, retry, and adjust flow | P1-14, P3-05 | 3 | No synthetic percentage or ETA; failure and cancellation preserve inputs |
| P3-09 | P1 | UI | Implement history table shell and empty/loading/isolated states | P2-13, P3-05 | 2.5 | Responsive columns and row activation work with safe history view models |
| P3-10 | P1 | UI | Implement settings dialog for appearance, data/privacy, storage limits, cleanup, and about | P2-13, P3-03, P3-04 | 3 | Active task disables destructive data actions; versions and real storage values display |
| P3-11 | P0 | UI | Implement centralized field/page/warning/toast/confirmation feedback rules | P3-04 | 2 | Critical failures remain visible after toast timeout; duplicates are suppressed |
| P3-12 | P0 | QA/UI | Add shell component, responsive, theme, keyboard, and automated accessibility tests | P3-05-P3-11 | 3 | Core shell passes component accessibility scan and 1024x700/200% layout checks |

### Phase 3 Exit Gate

- The first screen is the real new-comparison workflow.
- No production renderer component uses the old inline-style demo shell.
- Light, dark, system, high-contrast, keyboard, and 1024x700 behaviors pass focused tests.
- All visible controls correspond to implemented capabilities.

## 8. Phase 4 - Result and Review Workbench

**Goal:** Deliver the primary difference-first review experience against persisted real results.

| ID | Pri | Stream | Task | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| P4-01 | P0 | UI | Implement normalized result store, selection, persisted filter state, and derived counts | P0-03, P2-07 | 3 | Selectors are deterministic and do not mutate snapshot data |
| P4-02 | P0 | UI | Implement search and combined match/dimension/review/important/identical filters | P4-01 | 3 | Counts, current result count, total count, notes, and empty-filter state are correct |
| P4-03 | P0 | UI | Implement virtualized left difference navigation with status and importance indicators | P3-04, P4-01 | 3 | 50,000-item fixture keeps focus, position semantics, and selection while virtualized |
| P4-04 | P0 | UI | Define central viewport interface and paragraph/table view dispatch | P0-03, P3-05 | 1.5 | A future full-document view can register without changing navigation/review contracts |
| P4-05 | P0 | UI | Implement paragraph dual-pane source view with aligned context expansion | P1-09, P4-04 | 3 | Baseline/review sources and reliable page labels render without layout shift |
| P4-06 | P0 | CT/UI | Implement fine-grained token rendering, hide-details control, and long-paragraph fallback | P1-09, P4-05 | 2.5 | Chinese, English, numbers, punctuation, and fallback fixtures match D09 semantics |
| P4-07 | P0 | UI | Implement task toolbar, compact statistics, previous/next/next-unreviewed navigation | P4-01, P4-03 | 2 | Controls remain fixed and update the same match ID across all panels |
| P4-08 | P0 | UI | Implement resizable/collapsible panels, saved preferences, and narrow-window detail overlay | P3-04, P4-04 | 3 | D23 size constraints, keyboard resizers, temporary auto-collapse, and restore all pass |
| P4-09 | P0 | UI/DB | Implement review controls, independent importance, note autosave, failure retry, and progress | P2-08, P4-01 | 3 | Restart restores exact annotation state; failed save is never shown as successful |
| P4-10 | P0 | UI | Implement stable Detail/Format/Source Comments/Revisions tabs and capability states | P1-15, P4-09 | 3 | Zero, unavailable, and changed states remain visually and semantically distinct |
| P4-11 | P1 | UI | Implement localized format groups, units, swatches, and source anchors | P4-10 | 2.5 | Text, paragraph, and table format fixtures show correct old/new values |
| P4-12 | P1 | UI | Implement source-comment and revision views with read-only anchors and reply/state metadata | P1-15, P4-10 | 3 | Source comments cannot be confused with or edited as review notes |
| P4-13 | P0 | CT/RT | Finalize table alignment contract and side-specific cell/span semantics | P1-10 | 2 | Added/deleted/modified/span fixtures map to unambiguous baseline/review coordinates |
| P4-14 | P0 | UI | Implement dual table viewport, placeholders, sticky headers/indexes, and scroll controls | P4-04, P4-13 | 4 | Structural changes stay aligned in side-by-side and stacked modes |
| P4-15 | P0 | UI | Implement table change selection, previous/next change, details, and nested expansion | P4-14 | 3 | Selecting a cell highlights both aligned cells and updates detail evidence |
| P4-16 | P1 | UI/QA | Implement large-table row virtualization with merged-cell and accessibility handling | P4-14 | 4 | Large fixture remains responsive and exposes correct headers/row/column positions |
| P4-17 | P0 | UI | Implement workbench keyboard commands, F6 panel traversal, focus restoration, and live regions | P4-03-P4-16 | 3 | Complete review path works without mouse; shortcuts are disabled in editable controls |
| P4-18 | P0 | QA | Add result store, renderer, interaction, keyboard, accessibility, and visual regression tests | P4-01-P4-17 | 4 | Text/table/format/comment/revision and responsive workbench suites pass |

### Phase 4 Exit Gate

- A real persisted result can be fully reviewed without source files.
- Every supported difference dimension is locatable and evidence-backed.
- Annotation state autosaves and survives restart.
- Large difference and table fixtures remain keyboard accessible and responsive.

## 9. Phase 5 - History and Report Closure

**Goal:** Complete recovery, lifecycle management, export, and repeated-task workflows.

| ID | Pri | Stream | Task | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| P5-01 | P0 | UI/DB | Implement history filename search, status filters, sort, counts, and safe in-memory decryption | P2-13, P3-09 | 2.5 | Search covers display names only and creates no plaintext DB index |
| P5-02 | P0 | UI/DB | Implement snapshot reopen with selected item, filters, panel state, and review progress recovery | P2-07, P4-01 | 3 | Restart and reopen return the reviewer to the saved working context |
| P5-03 | P0 | UI/RT | Implement recompare, source relocation, hash validation, and interrupted-task retry | P1-13, P2-09 | 3 | Missing source and hash mismatch produce actionable flows without overwriting old results |
| P5-04 | P0 | UI/DB | Implement retain/unretain, delete, clear history, active-view handling, and confirmations | P2-10, P3-11 | 2.5 | Protected records survive cleanup; explicit delete removes snapshot/annotation/key references only |
| P5-05 | P0 | RT/DB | Refactor report generation to consume immutable persisted snapshots and export scopes | P2-07, P4-02 | 3 | All/current/important/needs-confirmation scopes produce correct deterministic content |
| P5-06 | P0 | RT | Implement offline single-file HTML with print styles and Markdown output | P5-05 | 3 | Reports escape source/note content, include required metadata, and open offline |
| P5-07 | P0 | RT/UI | Implement save dialog, extension handling, overwrite behavior, open-file, and open-folder actions | P5-06, P3-11 | 2 | Cancellation writes nothing; completion toast actions target the saved file safely |
| P5-08 | P0 | UI/RT | Complete new-task transition and remove production demo path, result map, empty export, and debug logs | P5-02-P5-07 | 1.5 | Repository search finds no reachable demo comparison or empty report handler |
| P5-09 | P0 | QA | Add complete E2E workflow: compare, cancel/retry, review, restart, filter, export, delete, new task | P5-01-P5-08 | 4 | Workflow passes against real fixtures through production IPC in packaged-like mode |
| P5-10 | P1 | CT | Update roadmap and API/user-facing technical documents to implemented behavior | P5-08 | 2 | No completed capability is documented as future and no deferred capability is advertised |

### Phase 5 Exit Gate

- The D01 workflow completes repeatedly without restarting the app.
- History recovery and export work when original files are absent.
- Deletion and cleanup preserve source files and protect active/retained tasks.
- No reachable mock, demo, or empty production implementation remains.

## 10. Phase 6 - Performance, Packaging, and Release Hardening

**Goal:** Prove the product on supported Windows systems and satisfy D29, D31, D33, and D34.

| ID | Pri | Stream | Task | Depends | Estimate | Acceptance |
|---|---|---|---|---|---:|---|
| P6-01 | P0 | QA | Build repeatable benchmark harness with phase timing, memory, UI latency, and baseline comparison | P0-06, P5-09 | 3 | Results use fixed fixture hashes and emit machine/build metadata |
| P6-02 | P0 | RT | Profile current paragraph matcher and replace/constrain quadratic worst-case behavior | P6-01 | 5-8 | 50/200/1000-page matching meets staged budgets without correctness regression |
| P6-03 | P0 | RT | Optimize parsing, JSON-RPC serialization, snapshot compression/encryption, and memory release | P6-01 | 3-6 | End-to-end and 2 GB peak gates pass on reference machine |
| P6-04 | P0 | UI | Optimize 50,000-item filtering, selection updates, virtual lists/tables, and main-thread work | P6-01 | 3-5 | P95 UI and frame-time gates pass without reducing accessibility |
| P6-05 | P0 | QA/RT | Run cancellation, engine crash, database Worker crash, tamper, corruption, and repeated-task stress tests | P1-12, P2-14, P5-09 | 3 | No orphan process, false success, plaintext leak, or unrecoverable startup failure |
| P6-06 | P0 | QA/UI | Complete WCAG 2.2 AA keyboard, contrast, high-contrast, reduced-motion, and 200% zoom audit | P4-18 | 3 | All P0 workflow violations are fixed and regression tests added |
| P6-07 | P0 | QA/RT | Implement release build order, Rust staging/checksum, native-module rebuild, ASAR unpack, and missing-resource failure | P2-01, P1-11 | 3 | Clean CI build contains executable engine and loadable SQLite binding |
| P6-08 | P0 | CT/QA | Implement product version synchronization and artifact/build/license manifests | P6-07 | 2 | Electron, Cargo, shared constants, handshake, reports, and file metadata agree |
| P6-09 | P0 | QA | Configure Authenticode signing and trusted timestamp for app, engine, uninstaller, and installer | P6-07 | 2 plus external certificate | Signed artifact verification passes; unsigned pipeline remains clearly internal-only |
| P6-10 | P0 | QA | Validate clean non-admin install, custom/Chinese/space paths, offline use, and uninstall on Windows 10 | P6-07-P6-09 | 2 | Installer matrix passes with no console window or orphan process |
| P6-11 | P0 | QA | Repeat installation and workflow matrix on Windows 11 and Windows Defender | P6-10 | 2 | No Defender block; real DOCX/PDF/cross-format workflow passes |
| P6-12 | P0 | QA/DB | Validate in-place upgrade, migration backup, history/key preservation, and rollback evidence | P6-07-P6-11 | 3 | Previous formal build upgrades without losing readable review state |
| P6-13 | P0 | QA | Run D33 release corpus, accuracy scoring, 1000-page, and near-100 MB gates | P6-02-P6-06, P6-11 | 4-6 | Every hard performance/correctness gate passes on recorded reference machine |
| P6-14 | P1 | CT | Reconcile architecture, performance, database, IPC, release, API, and roadmap documents with measured implementation | P6-13 | 3 | Conflicting estimates are replaced by linked measurements and final behavior |
| P6-15 | P0 | QA | Produce release candidate checklist, known-issues report, SHA-256, and go/no-go evidence | P6-12-P6-14 | 2 | No open P0/P1 issue; all required artifacts and reports are attached |

### Phase 6 Exit Gate

- D33 performance and correctness gates pass on the reference Windows machine.
- Signed installer passes Windows 10/11, offline, Defender, upgrade, and uninstall tests.
- No P0/P1 defect remains open.
- Formal documents describe shipped behavior and measured limits.

## 11. Suggested Pull Request Slices

These are review-sized delivery units, not long-lived branches:

| PR | Content | Primary task IDs |
|---|---|---|
| PR-01 | Contract/state/error freeze | P0-02-P0-05, P0-09 |
| PR-02 | Fixtures, stable identity, baseline scoring | P0-01, P0-06-P0-08 |
| PR-03 | Parser normalization, validation, DOCX/PDF adapters | P1-01-P1-05 |
| PR-04 | Rust transport/coordinator/protocol | P1-06-P1-10 |
| PR-05 | Electron engine/task orchestration and real IPC | P1-11-P1-16 |
| PR-06 | Native SQLite spike, Schema, migration, Worker | P2-01-P2-04 |
| PR-07 | Encryption, snapshots, annotations | P2-05-P2-09 |
| PR-08 | Cleanup, backup, corruption, persistence IPC | P2-10-P2-14 |
| PR-09 | UI dependencies, tokens, primitives, shell | P3-01-P3-06 |
| PR-10 | New/processing/history/settings views | P3-07-P3-12 |
| PR-11 | Result store, filters, virtual navigation | P4-01-P4-04 |
| PR-12 | Paragraph viewport, inline diff, navigation, panels | P4-05-P4-09 |
| PR-13 | Detail dimensions and table contract | P4-10-P4-13 |
| PR-14 | Table viewport, keyboard, workbench tests | P4-14-P4-18 |
| PR-15 | History recovery and lifecycle | P5-01-P5-04 |
| PR-16 | Reports, E2E closure, demo removal | P5-05-P5-10 |
| PR-17 | Benchmark-driven engine/UI optimization | P6-01-P6-06 |
| PR-18 | Packaging, signing, platform and upgrade tests | P6-07-P6-12 |
| PR-19 | Final corpus, docs, release candidate | P6-13-P6-15 |

## 12. Estimate Rollup

| Phase | Estimated effort |
|---|---:|
| Phase 0 - Contracts and baseline | 16-20 engineer-days |
| Phase 1 - Runtime pipeline | 40-48 engineer-days |
| Phase 2 - Persistence and security | 32-40 engineer-days |
| Phase 3 - Design system and shell | 26-34 engineer-days |
| Phase 4 - Review workbench | 50-62 engineer-days |
| Phase 5 - History and reports | 25-32 engineer-days |
| Phase 6 - Release hardening | 40-57 engineer-days plus signing lead time |
| **Total** | **229-293 engineer-days** |

The rollup is intentionally larger than the legacy V0.2 plan because D01-D37 add production persistence, encryption, process recovery, accessibility, large-data performance, installer signing, Windows release evidence, and a frozen formal visual system. Compressing this scope into the old sprint estimate would hide rather than remove the work.

With independent CT/RT, DB, UI, and QA ownership, calendar time can be reduced through Phases 1-3 parallelism. The convergence and release phases remain dependency-bound. A calendar commitment SHOULD be made only after Phase 0 and the native SQLite/performance spikes.

## 13. Risk Register

| Risk | Impact | Early task | Mitigation |
|---|---|---|---|
| Current paragraph matcher cannot meet 1000-page target | Release blocker | P0-07, P6-02 | Stable corpus, profiling, candidate pruning/indexing before UI optimization |
| DOCX format/comment/revision locations do not map reliably | Feature correctness | P0-04, P1-15 | Canonical node IDs, document-level fallback, exact fixtures |
| `better-sqlite3` fails Electron/pnpm packaging | Runtime blocker | P2-01 | Prove rebuild and installed smoke path before repository implementation |
| Large encrypted snapshots block main process | UX/performance | P2-04, P6-03 | Dedicated Worker, phase measurements, bounded payloads |
| Virtualized merged tables lose semantics | Accessibility | P4-16 | Spike with representative spans; provide non-virtual fallback below threshold |
| Code signing certificate unavailable | Formal release blocker | P6-09 | Start procurement before Phase 6; label unsigned artifacts internal-only |
| Gold corpus is too small or unrepresentative | False quality confidence | P0-08, P6-13 | Versioned category quotas and legal reviewer sign-off |
| Existing documentation conflicts reappear | Implementation drift | Every phase gate | Documentation in same PR and final reconciliation task |

## 14. Deferred Backlog

The following MUST NOT be pulled into V0.2.2 tasks without an approved scope change:

- Full-fidelity page preview.
- Embedding, OCR, LLM, model store, and external API configuration.
- Plugin system.
- Automatic updater.
- PDF/DOCX report generation.
- macOS/Linux release certification.
- Windows 7 legacy build.
- Axum service deployment and Web/PWA client.

## 15. Planning Completion Checklist

- [x] D01-D37 mapped to normative spec sections.
- [x] Real repository gaps reflected in dependencies.
- [x] Tasks include priority, stream, dependency, estimate, and acceptance.
- [x] Every phase has an exit gate.
- [x] Packaging, security, accessibility, and performance are first-class work.
- [ ] Product owner confirms overall consensus and implementation authorization.
- [ ] Engineering owners review estimates after Phase 0 spikes.
- [ ] Signing certificate acquisition owner and lead time are assigned.
- [ ] Gold-corpus annotation owner is assigned.
