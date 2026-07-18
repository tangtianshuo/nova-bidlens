# BidLens V0.2.2 Implementation Spec

> Version: 0.1 Draft
> Date: 2026-07-18
> Status: Implementation authorized; Prototype v1.0 is the active UI acceptance baseline
> Decision source: [v022-ui-ue-decision-log.md](v022-ui-ue-decision-log.md)
> Task breakdown: [v022-task-breakdown.md](v022-task-breakdown.md)
> Interactive prototype: [v022-ui-ux-prototype.html](../v022-ui-ux-prototype.html), v1.0 frozen baseline

## 1. Purpose

This specification converts decisions D01-D37 into an implementation contract for BidLens V0.2.2. It defines the product boundary, cross-layer behavior, quality gates, and release criteria. It does not authorize implementation by itself.

Normative keywords in this document have the following meanings:

- **MUST**: required for V0.2.2 release.
- **SHOULD**: expected unless an implementation constraint is documented and approved.
- **MAY**: optional and must not delay P0 acceptance.

## 2. Release Objective

V0.2.2 MUST deliver one real, local, end-to-end review workflow:

`Select two documents -> validate -> configure -> process/cancel -> review real differences -> annotate -> export -> start a new comparison`

The application MUST run as an installable Windows desktop product. Demo results, empty IPC implementations, and UI-only placeholders do not satisfy this objective.

## 3. Scope

### 3.1 In Scope

- Windows 10/11 x64 desktop application.
- DOCX/DOCX, text-PDF/text-PDF, and DOCX/text-PDF comparison.
- Real file validation, parsing, comparison, progress, cancellation, result persistence, review, and report export.
- Content, table, format, source comment, and revision dimensions where supported by both inputs.
- Local encrypted history and review recovery.
- HTML and Markdown reports.
- Light, dark, and system themes.
- Packaged Rust engine and SQLite native dependency.
- Accessibility, performance, security, installer, and upgrade acceptance.

### 3.2 Explicitly Out of Scope

- Embedding, reranking, LLM, OCR, scanned PDF, and AI marketing claims.
- Legacy DOC.
- Encrypted documents.
- Full-fidelity page rendering or Word-compatible editing.
- Direct PDF or DOCX report generation.
- Plugins, model store, accounts, cloud services, and automatic updates.
- Windows 7/8/8.1.
- Public Rust HTTP service or localized Web deployment.
- macOS/Linux release blocking criteria.

### 3.3 Future-Compatible Boundaries

- The central comparison viewport MUST support additional view implementations without rewriting navigation or review state.
- Rust core crates MUST remain transport-neutral so a future Axum adapter can coexist with the stdio adapter.
- V0.2.2 MUST NOT expose controls for future capabilities that are not implemented.

## 4. Actors and Primary Use Cases

| Actor | Primary use case | Success outcome |
|---|---|---|
| Tender reviewer | Review all meaningful changes | Every relevant item can be located, classified, annotated, and exported |
| Project manager | Inspect important or unresolved changes | Filtered result and summary are available without reopening source files |
| Legal reviewer | Inspect wording, formatting, comments, and revisions | Fine-grained source evidence and review notes are retained |

## 5. Functional Requirements

### 5.1 Input and Capability Negotiation

| ID | Requirement | Decision |
|---|---|---|
| INP-001 | The application MUST accept exactly one baseline document and one review document. | D01, D04 |
| INP-002 | Users MUST be able to select, drag/drop, replace, remove, and swap the two documents. | D04, D19 |
| INP-003 | Each file MUST be validated for existence, readability, extension, size, encryption, and parser capability before comparison. | D02, D19 |
| INP-004 | The per-file size limit MUST be 100 MB. | D02 |
| INP-005 | DOCX/DOCX MUST negotiate content, table, format, source comment, and revision capabilities based on actual parser output. | D02, D05 |
| INP-006 | Text-PDF/text-PDF MUST expose content and reliable page capabilities only. | D02 |
| INP-007 | Cross-format comparison MUST use only shared capabilities and MUST show each degraded dimension. | D02, D05 |
| INP-008 | Unsupported, unavailable, no-change, and changed capability states MUST remain distinct throughout the result contract and UI. | D25 |
| INP-009 | Matching sensitivity MUST offer strict, standard, and loose levels only, with standard as the zero-configuration default. | D05, D19 |

### 5.2 Task Lifecycle

| ID | Requirement | Decision |
|---|---|---|
| TASK-001 | Only one comparison task MAY be active in V0.2.2. Concurrent starts MUST return `ENGINE_BUSY`. | D31 |
| TASK-002 | The task MUST report real stages for validation, parsing both documents, comparison, and result finalization. | D06, D20 |
| TASK-003 | Percent completion MUST be emitted only when a stage has measurable current and total values. | D06, D20 |
| TASK-004 | The UI MUST show elapsed time and deduplicated non-blocking warnings, but MUST NOT show estimated remaining time. | D06, D20 |
| TASK-005 | Cancellation MUST propagate through Node parsing and Rust comparison and release temporary resources. | D06, D31 |
| TASK-006 | If cooperative Rust cancellation misses its deadline, Electron MUST terminate and restart the engine. | D31 |
| TASK-007 | Failed and cancelled tasks MUST preserve input selection for retry. | D06, D20 |
| TASK-008 | Engine crash MUST fail the current task with a structured, redacted diagnostic and MUST NOT automatically rerun it. | D31 |
| TASK-009 | Leaving a running or unsaved task MUST require confirmation. | D03, D20 |

### 5.3 Difference Result

| ID | Requirement | Decision |
|---|---|---|
| DIFF-001 | The result MUST use stable ordering and stable match IDs for identical inputs, configuration, and version. | D08, D33 |
| DIFF-002 | Supported match types MUST include identical, modified, added, deleted, moved, split, merged, and uncertain. | D08 |
| DIFF-003 | Identical items MUST be counted but hidden by default. | D08, D22 |
| DIFF-004 | Search MUST cover both source texts, summary, and review note. | D08 |
| DIFF-005 | Filters MUST support match type, dimension, review status, important-only, and identical visibility, with counts. | D08, D10, D22 |
| DIFF-006 | Modified text MUST include fine-grained tokens: Chinese by character, English by word, with numeric and punctuation boundaries retained. | D09 |
| DIFF-007 | Very long text MAY fall back to paragraph-level highlighting but MUST identify the fallback. | D09 |
| DIFF-008 | Page numbers MUST be shown only when the parser marks them reliable. | D07 |
| DIFF-009 | Content that cannot be attached to a specific match MUST be retained as a document-level change item. | D25 |

### 5.4 Review Workflow

| ID | Requirement | Decision |
|---|---|---|
| REV-001 | Review status MUST be one of unreviewed, confirmed, needs-confirmation, or ignored. | D10 |
| REV-002 | Important MUST be an independent boolean and MAY combine with any review status. | D10 |
| REV-003 | A review item MAY contain a note, which MUST autosave. | D10 |
| REV-004 | Autosave failure MUST remain visible near the note and offer retry. | D28 |
| REV-005 | The workbench MUST show processed progress and provide next-unreviewed navigation. | D10 |
| REV-006 | Previous, next, and next-unreviewed controls MUST remain visible while source content scrolls. | D07, D22 |
| REV-007 | Source comments and BidLens review notes MUST use different names, storage, and controls. | D25 |
| REV-008 | Source comments and revisions MUST be read-only; BidLens MUST NOT edit DOCX or accept/reject Word revisions. | D25 |

### 5.5 Table Review

| ID | Requirement | Decision |
|---|---|---|
| TBL-001 | Table comparison MUST render baseline and review tables as two aligned views. | D24 |
| TBL-002 | Shared contracts MUST expose row and column alignments from Rust. | D24 |
| TBL-003 | Side-by-side MUST be default, with a stacked mode for constrained width. | D24 |
| TBL-004 | Vertical scrolling MUST synchronize by default; horizontal synchronization MUST be optional. | D24 |
| TBL-005 | Added, deleted, modified, and span-changed cells MUST use distinct semantics and non-color indicators. | D24, D29 |
| TBL-006 | Changed-cell navigation MUST support previous and next change. | D24 |
| TBL-007 | Nested table differences MUST be collapsed by default and expandable on demand. | D24 |
| TBL-008 | Large tables MUST virtualize rows while retaining accessible table semantics. | D24, D29 |

### 5.6 Format, Comment, and Revision Review

| ID | Requirement | Decision |
|---|---|---|
| DIM-001 | The detail panel MUST expose stable Detail, Format, Source Comments, and Revisions tabs with counts or unavailable state. | D25 |
| DIM-002 | Format changes MUST use localized property names and old-to-new values with units or color swatches. | D25 |
| DIM-003 | Source comment changes MUST include content, author, time, resolution state, and reply relationships where available. | D25 |
| DIM-004 | Revision changes MUST include type, author, time, content, and original acceptance state where available. | D25 |
| DIM-005 | Format, comment, and revision results MUST link to node IDs and match IDs when location is available. | D25 |

### 5.7 History, Recovery, and Settings

| ID | Requirement | Decision |
|---|---|---|
| HIS-001 | Completed task snapshots and review state MUST survive application restart. | D11 |
| HIS-002 | The history view MUST list at most the configured number of complete tasks, defaulting to 20, ordered by last access. | D12, D21, D26 |
| HIS-003 | Opening a saved result and exporting it MUST NOT require source files. | D15, D26 |
| HIS-004 | Recomparison MUST validate the saved path and hash or request relocation. | D26 |
| HIS-005 | Running tasks found after restart MUST become interrupted and retryable, not resumable. | D26 |
| HIS-006 | Users MUST be able to retain, unretain, delete, and clear records with appropriate confirmation. | D11, D26 |
| HIS-007 | Retained and active review tasks MUST be excluded from automatic cleanup. | D12, D27 |
| SET-001 | Settings MUST include appearance, data/privacy, and about sections only. | D27 |
| SET-002 | Theme MUST support system, light, and dark and apply before first renderer paint. | D16, D27 |
| SET-003 | Users MUST be able to configure history count and total storage limits with cleanup impact confirmation. | D12, D27 |

### 5.8 Report Export

| ID | Requirement | Decision |
|---|---|---|
| EXP-001 | HTML and Markdown MUST be supported; HTML is the primary format. | D15 |
| EXP-002 | Export scope MUST support all differences, current filter, important-only, and needs-confirmation-only. | D15 |
| EXP-003 | Identical content MUST be excluded by default. | D15 |
| EXP-004 | Reports MUST include document metadata, statistics, evidence, status, important flag, and review note. | D10, D15 |
| EXP-005 | HTML MUST be a single offline file with print styles. | D15 |
| EXP-006 | Export MUST use the system save dialog and offer open-file and open-folder actions after completion. | D15, D28 |
| EXP-007 | Export MUST read the persisted task snapshot rather than transient renderer state. | D15 |

## 6. UX and Accessibility Requirements

The standalone interactive prototype v1.0 is the frozen visual review baseline. It demonstrates information hierarchy and interaction states, but this specification and the decision log remain normative when prototype behavior conflicts with an approved decision. A later visual change requires an approved decision and a new prototype revision.

### 6.1 Visual Philosophy

The renderer MUST apply Swiss Minimalism as an operational design system:

- Visual style MUST be clean, restrained, functional, and free of non-functional decoration.
- Information hierarchy MUST rely primarily on type size, weight, and neutral color depth.
- Layout MUST use strict alignment, a consistent spacing grid, and whitespace before decorative containers.
- Surfaces MUST use low-saturation neutrals; one restrained product accent is reserved for primary actions, focus, and selection.
- Difference colors MUST be used only for semantic changes and necessary states.
- Gradients, decorative illustration, glow, ornamental color blocks, and skeuomorphic effects are prohibited.
- Controls and tool surfaces SHOULD use 1 px borders and 4-6 px radii. Shadows are reserved for true overlays such as dialogs and toasts.
- Offline system sans-serif fonts MUST be used with zero letter spacing.
- Dark theme MUST preserve the same hierarchy using neutral charcoal surfaces rather than a dominant blue-black palette.
- Result screens MAY be dense, but MUST preserve stable scanning paths, clear grouping, and sufficient breathing room.

### 6.2 Information Architecture

- One window with New Comparison, Processing, Review Workbench, and History views.
- No marketing home page and no permanent global sidebar.
- A compact top bar provides brand, new comparison, recent comparisons, theme, and settings.
- Export remains a result-context action.

### 6.3 Window and Panels

- Default window: 1280 x 800.
- Minimum window: 1024 x 700.
- Default review panels: 280 px navigation, flexible center, 320 px details.
- Navigation range: 240-360 px; details range: 280-420 px; center minimum: 560 px.
- Below approximately 1120 px, details collapse into an overlay.
- Panel sizes and user collapse preferences persist locally.

### 6.4 Feedback Hierarchy

- Field errors appear next to their control.
- Blocking task errors use persistent page panels.
- Capability degradation uses persistent warnings.
- Toasts are limited to transient completed actions and MUST NOT be the only representation of critical failures.
- Destructive actions use application dialogs, never browser `alert`, `confirm`, or `prompt`.

### 6.5 Accessibility

- Renderer target: WCAG 2.2 AA.
- All workflows MUST be keyboard operable.
- Required commands include standard focus traversal, F6 panel traversal, list arrow navigation, Ctrl+F search, and Escape dismissal.
- Color MUST NOT be the sole status indicator.
- Resizers, virtual lists, tables, dialogs, progress, and notifications MUST expose correct semantics.
- Windows high-contrast mode, reduced motion, and 200% zoom MUST remain usable.

## 7. Architecture

### 7.1 Runtime Boundaries

```text
React Renderer
    | typed Electron IPC through preload
Electron Main
    |-- file validation and Node parser adapters
    |-- task orchestrator and Rust process manager
    |-- database Worker and encryption/key services
    |-- report exporter and system dialogs
    |
    +-- stdio JSON-RPC --> Rust transport adapter --> transport-neutral core crates
```

The renderer MUST import shared browser-safe exports from `@bidlens/shared/types-only`. Node-capable modules MUST NOT enter the renderer graph.

### 7.2 Parser Boundary

- Parser registration MUST normalize extensions consistently.
- Parser adapters MUST return a common result with AST, capability states, warnings, duration, parser ID, and structured error.
- Node parsing MUST accept cancellation.
- Source paths MUST remain in the main process and MUST NOT be exposed broadly to the renderer.

### 7.3 Rust Boundary

- Core crates MUST NOT depend on stdio or future HTTP frameworks.
- The stdio adapter MUST own framing, request IDs, progress notifications, cancellation, shutdown, and error mapping.
- stdout MUST contain protocol messages only; stderr MUST contain redacted diagnostics only.
- Startup handshake MUST expose engine version, protocol version, and capabilities.
- Packaged path MUST be `process.resourcesPath/engine/bidlens-engine.exe`.

### 7.4 Persistence Boundary

- SQLite ownership belongs to Electron main through a dedicated Worker.
- `better-sqlite3` is the selected driver.
- Rust MUST NOT access the history database.
- Writes MUST be serialized and parameterized.
- Migrations MUST be forward-only, checksummed, transactional, and reflected in `PRAGMA user_version`.

## 8. Conceptual Data Model

### 8.1 Comparison Task

Required concepts:

- Task ID and deterministic comparison identity inputs.
- Baseline and review metadata, encrypted paths, hashes, parser versions, and capability results.
- Sensitivity, lifecycle status, current phase, timings, warnings, and redacted failure summary.
- Last-access time, retained flag, review progress, and result statistics.

### 8.2 Snapshots

- Document snapshots store compressed and encrypted Document AST payloads.
- Difference snapshots store compressed and encrypted Diff AST payloads.
- Snapshot format versions MUST be independent from database Schema version.
- A completed task MUST reference the exact immutable snapshots used for report export.

### 8.3 Review Annotation

Each annotation MUST contain:

- Annotation ID, task ID, and match ID.
- Review status.
- Independent important flag.
- Encrypted optional note.
- Created and updated timestamps.

Annotations MUST NOT mutate the algorithm result payload.

## 9. State Model

```text
draft
  -> validating
  -> parsing_baseline
  -> parsing_review
  -> comparing
  -> finalizing
  -> ready

validating/parsing/comparing/finalizing
  -> cancelling -> cancelled
  -> failed

running state discovered at next launch
  -> interrupted
```

- `ready` is the only state with a complete persisted result.
- Failed, cancelled, and interrupted records store diagnostic summaries only.
- Review progress is independent from comparison execution state.

## 10. IPC and Protocol Surface

The final shared contract MUST cover these capability groups. Exact method names are frozen in Phase 1.

| Group | Operations |
|---|---|
| File | select, validate, inspect capabilities |
| Comparison | start, cancel, get status, get result, subscribe progress |
| Review | save annotation, batch read annotations |
| History | list, open snapshot, recompare, retain, delete, clear |
| Export | choose scope, save HTML/Markdown, open result/location |
| Settings | read/update appearance and retention settings, storage report, cleanup |
| Engine | handshake, health, compare, cancel, shutdown |

All failures MUST use a shared structured error with stable code, user-safe message, retryability, phase, optional diagnostic ID, and no sensitive content.

## 11. Security and Privacy

- Document AST, Diff AST, review notes, encrypted paths, and detailed error context MUST use AES-256-GCM before SQLite persistence.
- Encryption MUST use a random master key protected with Electron `safeStorage` and Windows DPAPI.
- Every encrypted payload MUST use a unique nonce and authenticated context containing record identity and payload version.
- Database list metadata MUST be minimized; sensitive filenames or paths MUST not be indexed in plaintext.
- History search MAY decrypt at most the retained list into renderer-safe in-memory view models.
- Logs MUST NOT include source content, notes, keys, AST, or full paths.
- Tampered or undecryptable records MUST be isolated without preventing application startup.
- Database, WAL, and SHM files MUST be isolated together when corruption is detected.
- Backup MUST use SQLite Online Backup and retain encrypted payloads only.

## 12. Performance and Quality Gates

Reference environment: Windows 11 x64, 16 GB RAM, SSD, Intel Core i5-1240P or equivalent Ryzen 5, packaged release build, cold cache.

| Measure | Release gate |
|---|---:|
| 50 pages per side, end to end | <= 15 s |
| 200 pages per side, end to end | <= 60 s |
| 1000 pages per side, end to end | <= 5 min |
| Near-100 MB single file | <= 10 min and no crash |
| 1000-page whole-application peak working set | <= 2 GB |
| Cold start to operable | <= 3 s |
| Large snapshot restore | <= 3 s |
| Difference selection update P95 | <= 100 ms |
| 50,000-item filter/search P95 | <= 150 ms |
| Normal cancellation | <= 3 s |
| Forced cancel plus engine recovery | <= 5 s |

Correctness gates:

- Primary match-type precision and recall MUST each be at least 90% on the versioned gold corpus.
- The legal critical-change corpus MUST have no missed labeled change.
- Deterministic table, format, comment, and revision fixtures MUST match expected output exactly.
- Identical inputs MUST produce stable ordering and IDs.

## 13. Packaging and Release

- Official artifact: `BidLens-0.2.2-win-x64-setup.exe` plus SHA-256 file.
- Installer: NSIS, per-user by default, selectable installation directory, offline runtime.
- Electron app, Rust engine, uninstaller, and installer MUST be Authenticode SHA-256 signed with trusted timestamp for a formal release.
- Unsigned builds are internal test builds only.
- Rust binary and native `.node` files MUST be outside ASAR where required.
- Build MUST use `pnpm --frozen-lockfile` and `cargo build --release --locked`.
- `apps/desktop/package.json` is the product version source; CI MUST verify all exposed versions agree.
- Upgrade MUST preserve database, encryption material, history, and review annotations.

## 14. Test Strategy

| Layer | Required tests |
|---|---|
| Shared | Contract, state transition, filter, inline diff, serialization, error mapping |
| Parser | Real DOCX/PDF fixtures, capability detection, warnings, cancellation, invalid inputs |
| Rust | Matching, table alignment, stable IDs, progress, cancellation, protocol, crash behavior |
| Persistence | Migration, encryption, tamper, backup, corruption, retention, transaction rollback |
| Renderer | Component, keyboard, accessibility, virtual list/table, responsive panel behavior |
| Integration | Main-preload-renderer IPC, parser-to-engine conversion, persisted snapshot export |
| E2E | Installed Windows application workflow, restart recovery, cancellation, export, upgrade |
| Performance | PR smoke, nightly 200-page, release 1000-page and near-100 MB gates |

Test documents MUST be versioned or reproducibly generated, fixed by SHA-256, free of confidential material, and representative of Chinese tender documents.

## 15. Documentation Deliverables

Implementation phases MUST update the relevant architecture document in the same change. Required final documents include:

- `docs/architecture.md`
- `apps/desktop/AGENT.md`
- `packages/shared/AGENT.md`
- `bidlens-engine/AGENT.md`
- `docs/03-模块设计-React前端.md`
- `docs/06-IPC通信协议设计.md`
- `docs/07-数据库设计.md`
- `docs/11-性能优化方案.md`
- `docs/12-发布升级与运维方案.md`
- `docs/api/ipc.md`, `rust.md`, `types.md`, `parser.md`
- `docs/roadmap.md`

## 16. Decision Traceability

| Decisions | Spec sections |
|---|---|
| D01, D02, D03, D04, D05, D06 | 2, 3, 5.1, 5.2 |
| D07, D08, D09, D10 | 5.3, 5.4, 6 |
| D11, D12, D13, D14, D15 | 5.7, 5.8, 7.4, 8, 11, 13 |
| D16, D17, D18, D19, D20, D21, D22, D23, D36, D37 | 6 |
| D24, D25 | 5.5, 5.6 |
| D26, D27, D28, D29, D30, D31 | 5.7, 6.3, 6.4, 7, 9, 10, 11 |
| D32 | 3.3, 7.3 |
| D33, D34 | 12, 13, 14 |
| D35 | 15 and task breakdown |

## 17. Known Implementation Spikes

These are engineering investigations, not unresolved product scope:

1. Verify `better-sqlite3` rebuild and packaging with Electron 33, pnpm, and NSIS.
2. Establish deterministic match IDs without relying on random UUID generation.
3. Replace or constrain the current quadratic paragraph matcher to meet D33.
4. Preserve accessible table semantics while virtualizing rows with merged cells.
5. Define node and match association for source comments and revisions across two documents.
6. Calibrate strict, standard, and loose thresholds against the gold corpus.

## 18. Release Definition of Done

V0.2.2 is complete only when:

- Every MUST requirement is implemented or explicitly removed through an approved decision change.
- No demo comparison path or empty report/history IPC remains reachable.
- Required unit, integration, E2E, accessibility, security, performance, installer, and upgrade gates pass.
- Windows 10/11 packaged clients complete the real workflow offline.
- Documentation reflects implemented behavior rather than future architecture.
- No P0/P1 defect remains open.
