# Codebase Structure

**Analysis Date:** 2026-07-22

## Directory Layout

```
nova-bidlens/
├── apps/
│   └── desktop/               # Electron app (React + Vite renderer, TS main process)
│       ├── src/
│       │   ├── main/          # Main process (Node.js, CommonJS)
│       │   ├── preload/       # IPC bridge (single file)
│       │   └── renderer/      # Renderer process (Vite + React)
│       ├── build/             # Electron builder resources (icons)
│       ├── scripts/           # Build helper scripts
│       └── tests/             # E2E tests (Playwright)
├── packages/
│   └── shared/                # Shared TypeScript library (types, parsers, IPC contract)
│       └── src/
├── bidlens-engine/            # Rust workspace (document parsing & diff engine)
│   ├── src/                   # Root crate (main.rs, risk_engine.rs, task_service.rs)
│   └── crates/
│       ├── common/            # Shared error types
│       ├── document-ast/      # AST data structures
│       ├── diff-engine/       # Semantic diff algorithms
│       ├── table-diff/        # Table-level diff
│       └── review-core/       # Risk detection (text, table, entity, fact detectors)
├── docs/                      # Documentation (architecture, API, product)
├── tests/                     # Root-level test suites (integration, e2e, benchmark, v03)
├── scripts/                   # Root-level scripts (v03 model feasibility)
├── demo/                      # Demo/prototype artifacts
├── package.json               # Root workspace package.json
├── pnpm-workspace.yaml        # pnpm workspace config
├── CLAUDE.md                  # Project guidance for AI assistants
└── AGENTS.md                  # Multi-agent coordination docs
```

## Directory Purposes

**`apps/desktop/src/main/`:**
- Purpose: Electron main process — business logic, persistence, engine management
- Contains: IPC handlers, services, database layer, repositories, workers
- Key files: `index.ts` (entry), `ipc/risk-review-handlers.ts`, `services/risk-review-service.ts`

**`apps/desktop/src/main/ipc/`:**
- Purpose: IPC handler registration — one file per domain
- Contains: `compare-handlers.ts`, `risk-review-handlers.ts`, `history-handlers.ts`, `settings-handlers.ts`, `annotation-handlers.ts`
- Key files: Each file exports a `register*Handlers()` function called from `index.ts`

**`apps/desktop/src/main/services/`:**
- Purpose: Business logic services
- Contains: `risk-review-service.ts` (49KB, core V0.3 logic), `engine-manager.ts` (Rust engine lifecycle), `persistence.ts` (facade), `task-orchestrator.ts` (V0.2 compare pipeline), `parser-service.ts`, `file-validator.ts`, `encryption.ts`, `backup.ts`, `recovery.ts`, `retention.ts`, `report-generator.ts`, `report-exporter.ts`
- Key files: `risk-review-service.ts`, `engine-manager.ts`, `persistence.ts`

**`apps/desktop/src/main/db/`:**
- Purpose: Database layer — schema, migrations, crypto, repositories
- Contains: `database.ts` (DatabaseManager), `schema.ts` (table definitions), `migrations.ts`, `repositories.ts` (V0.3 repos), `crypto.ts` (AES encryption), `database-worker.ts` (worker thread), `database-worker-client.ts`
- Key files: `database.ts`, `repositories.ts`, `schema.ts`

**`apps/desktop/src/main/repositories/`:**
- Purpose: V0.2 data access objects (legacy, still used by compare flow)
- Contains: `task-repository.ts`, `snapshot-repository.ts`, `annotation-repository.ts`

**`apps/desktop/src/main/workers/`:**
- Purpose: Worker threads for off-main-thread operations
- Contains: `database-worker.ts` — handles persist/load operations in a separate thread

**`apps/desktop/src/preload/`:**
- Purpose: Secure IPC bridge between renderer and main
- Contains: Single `index.ts` that maps `BidLensApi` interface to `ipcRenderer.invoke()` calls
- Key files: `index.ts`

**`apps/desktop/src/renderer/`:**
- Purpose: React UI — the entire frontend
- Contains: App shell, feature pages, stores, components, styles, workers

**`apps/desktop/src/renderer/app/`:**
- Purpose: Root application component and routing
- Contains: `App.tsx` — view-based routing via Zustand store, QueryClient provider

**`apps/desktop/src/renderer/features/`:**
- Purpose: Feature-organized pages and components (feature-sliced design)
- Contains: `projects/` (V0.3 project management), `risk-review/` (V0.3 results), `compare/` (V0.2 compare), `review/` (V0.2 review workbench), `history/` (task history), `settings/` (app settings)

**`apps/desktop/src/renderer/features/projects/`:**
- Purpose: V0.3 project creation, listing, and processing pages
- Contains: `project-list-page.tsx`, `new-project-page.tsx`, `project-processing-page.tsx`, `project-store.ts`, `project-queries.ts`, `project-table.tsx`, `submission-file-list.tsx`, `detection-preset.tsx`, `file-import.tsx`, `tender-baseline-slot.tsx`, `analysis-recovery-actions.tsx`, `stage-labels.ts`

**`apps/desktop/src/renderer/features/risk-review/`:**
- Purpose: V0.3 risk review results — findings, evidence, export
- Contains: `risk-result-page.tsx`, `risk-review-store.ts`, `risk-result-queries.ts`, `risk-review-mutations.ts`, `finding-virtual-list.tsx`, `finding-filter-toolbar.tsx`, `evidence-viewport.tsx`, `evidence-detail-tabs.tsx`, `evidence-review-controls.tsx`, `relationship-matrix.tsx`, `risk-overview.tsx`, `report-export-panel.tsx`, `risk-export-dialog.tsx`, `risk-result-toolbar.tsx`

**`apps/desktop/src/renderer/stores/`:**
- Purpose: Global Zustand stores
- Contains: `app-store.ts` (navigation state machine, mode switching), `result-store.ts` (V0.2 compare results)

**`apps/desktop/src/renderer/components/`:**
- Purpose: Shared reusable components
- Contains: `ui/` (shadcn-style primitives), `layout/` (AppShell, TopBar), `feedback/` (ErrorBoundary, loading states, banners)

**`apps/desktop/src/renderer/components/ui/`:**
- Purpose: Design system primitives (shadcn/ui pattern)
- Contains: `button.tsx`, `dialog.tsx`, `select.tsx`, `tabs.tsx`, `table.tsx`, `badge.tsx`, `input.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `progress.tsx`, `scroll-area.tsx`, etc.
- Key files: `index.ts` (barrel export)

**`apps/desktop/src/renderer/lib/`:**
- Purpose: Renderer utility functions
- Contains: `theme.ts` (dark/light mode), `utils.ts` (class name helpers), `semantic-state.ts` (semantic diff state), `progress-subscription.ts`, `project-router.ts`, `query-keys.ts`

**`apps/desktop/src/renderer/styles/`:**
- Purpose: Global CSS
- Contains: `globals.css` — Tailwind 4 imports, CSS custom properties for theming

**`packages/shared/src/`:**
- Purpose: Shared TypeScript library — types, IPC contract, parsers, diff utilities
- Contains: `ipc.ts` (BidLensApi interface), `risk-review.ts` (V0.3 domain types), `compare-task.ts` (V0.2 types), `document-ast.ts`, `diff-ast.ts`, `format-diff.ts`, `comment-diff.ts`, `table-diff.ts`, `report.ts`, `report-export.ts`, `errors.ts`, `state-machine.ts`, `field-mapping.ts`, `version.ts`, `types-only.ts`
- Key files: `ipc.ts`, `risk-review.ts`, `index.ts` (barrel export)

**`packages/shared/src/parser/`:**
- Purpose: Document parsers (DOCX, PDF)
- Contains: `registry.ts` (parser registry), `docx/` (docx4js parser), `pdf/` (pdf-parse parser), `types.ts`, `docx-comments.ts`, `docx-revisions.ts`

**`packages/shared/src/types/`:**
- Purpose: Additional shared type definitions

**`bidlens-engine/src/`:**
- Purpose: Root Rust crate — binary entry point and orchestration
- Contains: `main.rs` (JSON-RPC server over stdio), `risk_engine.rs` (36KB, risk analysis pipeline), `task_service.rs` (compare task execution)

**`bidlens-engine/crates/document-ast/src/`:**
- Purpose: AST data structures for parsed documents
- Contains: `lib.rs` (42KB — paragraphs, sections, lists, tables, comments, revisions)

**`bidlens-engine/crates/diff-engine/src/`:**
- Purpose: Semantic diff algorithms
- Contains: `lib.rs` (diff computation), `optimized.rs` (performance-optimized variant)

**`bidlens-engine/crates/table-diff/src/`:**
- Purpose: Table-level diff (cell changes, structural changes)
- Contains: `lib.rs` (64KB — table comparison logic)

**`bidlens-engine/crates/review-core/src/`:**
- Purpose: Risk detection and aggregation for V0.3
- Contains: `lib.rs` (orchestration), `aggregation.rs`, `scoring.rs`, `sparse_index.rs`, `tender.rs`, `detectors/` (text, table, entity, fact detectors)

**`bidlens-engine/crates/review-core/src/detectors/`:**
- Purpose: Individual risk detectors
- Contains: `text_detector.rs`, `table_detector.rs`, `entity_detector.rs`, `fact_detector.rs`, `mod.rs`

**`bidlens-engine/crates/common/src/`:**
- Purpose: Shared error types across Rust crates
- Contains: `error.rs`, `lib.rs`

**`docs/`:**
- Purpose: Project documentation
- Contains: `architecture.md`, `coding_style.md`, `getting-started.md`, `roadmap.md`, `api/` (IPC, parser, rust, types docs), `product/` (PRD), `v03/` (V0.3 planning docs), `reports/`

**`tests/`:**
- Purpose: Root-level test suites
- Contains: `integration/`, `e2e/`, `accessibility/`, `benchmark/`, `v03/`

## Key File Locations

**Entry Points:**
- `apps/desktop/src/main/index.ts`: Electron main process entry — creates window, initializes persistence, registers IPC handlers
- `apps/desktop/src/renderer/index.html` → `main.tsx`: Renderer entry — mounts React app
- `apps/desktop/src/preload/index.ts`: Preload entry — exposes `window.bidlens` API
- `bidlens-engine/src/main.rs`: Rust engine entry — JSON-RPC server over stdio

**Configuration:**
- `package.json`: Root workspace config (scripts, devDependencies)
- `pnpm-workspace.yaml`: Workspace packages (`apps/*`, `packages/*`)
- `apps/desktop/package.json`: Desktop app config (dependencies, scripts, Electron builder)
- `apps/desktop/vite.config.ts`: Vite config for renderer (port 5173, Tailwind, path aliases)
- `apps/desktop/tsconfig.json`: TypeScript config for renderer (ESNext, Bundler resolution)
- `apps/desktop/tsconfig.main.json`: TypeScript config for main/preload (CommonJS, Node resolution)
- `apps/desktop/electron-builder.yml`: Electron builder config (NSIS, resources, asar)
- `apps/desktop/vitest.config.ts`: Vitest config for desktop tests
- `bidlens-engine/Cargo.toml`: Rust workspace config

**Core Logic:**
- `apps/desktop/src/main/services/risk-review-service.ts`: V0.3 risk review business logic (49KB)
- `apps/desktop/src/main/services/engine-manager.ts`: Rust engine lifecycle and JSON-RPC client
- `apps/desktop/src/main/services/task-orchestrator.ts`: V0.2 compare pipeline orchestration
- `apps/desktop/src/main/db/repositories.ts`: V0.3 database repositories (30KB)
- `packages/shared/src/risk-review.ts`: V0.3 domain types (RiskFinding, Evidence, etc.)
- `packages/shared/src/ipc.ts`: BidLensApi interface definition
- `bidlens-engine/src/risk_engine.rs`: Rust risk analysis pipeline (36KB)

**UI Pages:**
- `apps/desktop/src/renderer/app/App.tsx`: Root component with view-based routing
- `apps/desktop/src/renderer/features/projects/project-list-page.tsx`: Project dashboard
- `apps/desktop/src/renderer/features/projects/new-project-page.tsx`: New project form
- `apps/desktop/src/renderer/features/projects/project-processing-page.tsx`: Analysis progress
- `apps/desktop/src/renderer/features/risk-review/risk-result-page.tsx`: Risk review results

**Testing:**
- `apps/desktop/src/main/__tests__/`: Main process unit tests
- `apps/desktop/src/main/services/__tests__/`: Service unit tests
- `apps/desktop/src/main/db/__tests__/`: Database unit tests
- `apps/desktop/src/renderer/` (co-located `*.test.tsx` files): Component tests
- `apps/desktop/tests/e2e/`: Playwright E2E tests
- `tests/integration/`: Cross-package integration tests
- `tests/e2e/`: Root E2E tests
- `tests/v03/`: V0.3 metric/gate tests

## Naming Conventions

**Files:**
- TypeScript: kebab-case (`risk-review-service.ts`, `project-list-page.tsx`)
- Rust: snake_case (`risk_engine.rs`, `text_detector.rs`)
- Test files: co-located as `*.test.ts` / `*.test.tsx` next to source, or in `__tests__/` directories

**Directories:**
- Features: kebab-case (`risk-review/`, `project-processing/`)
- Components: kebab-case (`file-import.tsx`, `finding-filter-toolbar.tsx`)
- Rust crates: kebab-case in directory name (`diff-engine/`), snake_case in module names

**Types/Interfaces:**
- PascalCase (`RiskFinding`, `AnalysisProjectDetail`, `BidLensApi`)
- Enums as string literal union types (`type RiskLevel = 'high' | 'medium' | 'low'`)

**Functions/Variables:**
- camelCase (`createProject`, `riskLevel`, `handleSubmit`)

## Where to Add New Code

**New V0.3 Feature Page:**
- Implementation: `apps/desktop/src/renderer/features/risk-review/` or `apps/desktop/src/renderer/features/projects/`
- Add view to: `apps/desktop/src/renderer/stores/app-store.ts` (add to `AppView` union and transitions)
- Route in: `apps/desktop/src/renderer/app/App.tsx`

**New IPC Endpoint:**
- Shared types: `packages/shared/src/ipc.ts` (add to `BidLensApi` interface)
- Request/response types: `packages/shared/src/ipc.ts` or `packages/shared/src/risk-review.ts`
- Handler registration: `apps/desktop/src/main/ipc/risk-review-handlers.ts` (or new handler file)
- Service method: `apps/desktop/src/main/services/risk-review-service.ts`
- Preload bridge: `apps/desktop/src/preload/index.ts` (add mapping)

**New Database Table:**
- Schema: `apps/desktop/src/main/db/schema.ts`
- Migration: `apps/desktop/src/main/db/migrations.ts`
- Repository: `apps/desktop/src/main/db/repositories.ts` (V0.3 repos) or `apps/desktop/src/main/repositories/` (V0.2 repos)

**New Rust Detector:**
- Implementation: `bidlens-engine/crates/review-core/src/detectors/`
- Register in: `bidlens-engine/crates/review-core/src/detectors/mod.rs`
- Wire into: `bidlens-engine/crates/review-core/src/lib.rs`

**New Shared Type:**
- V0.3 types: `packages/shared/src/risk-review.ts`
- V0.2 types: `packages/shared/src/compare-task.ts`
- Export from: `packages/shared/src/index.ts`

**New UI Component:**
- Primitive (button, dialog, etc.): `apps/desktop/src/renderer/components/ui/`
- Domain component: Co-locate in relevant feature directory
- Shared feedback/layout: `apps/desktop/src/renderer/components/feedback/` or `layout/`

**New Zustand Store:**
- Location: `apps/desktop/src/renderer/stores/` (global) or co-located with feature
- Pattern: `create<StateType>((set, get) => ({...}))` with `use*Store` naming

## Special Directories

**`.artifacts/`:**
- Purpose: Build artifacts, BGE-M3 model files, test results
- Generated: Yes
- Committed: No (in .gitignore)

**`apps/desktop/dist/` and `apps/desktop/dist-electron/`:**
- Purpose: Build output (renderer bundle, Electron packaged app)
- Generated: Yes
- Committed: No

**`bidlens-engine/target/`:**
- Purpose: Rust build output
- Generated: Yes
- Committed: No

**`apps/desktop/.native-runtime/`:**
- Purpose: Native module runtime for better-sqlite3
- Generated: Yes (via electron-rebuild)
- Committed: No

---

*Structure analysis: 2026-07-22*
