# Architecture

**Analysis Date:** 2026-07-22

## Pattern Overview

**Overall:** Three-layer Electron monorepo with Rust subprocess engine

**Key Characteristics:**
- Electron desktop app with strict process isolation (main/renderer/preload)
- pnpm workspace monorepo: `apps/desktop` (Electron), `packages/shared` (types/logic), `bidlens-engine` (Rust)
- IPC-first communication: renderer never talks to filesystem, database, or engine directly
- Two product modes: `risk-review` (V0.3 primary) and `version-diff` (V0.2 legacy, being retired)
- JSON-RPC over stdio to Rust engine child process

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer Process (Vite + React 19)                         │
│  src/renderer/                                              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ App     │ │ Features │ │ Stores   │ │ Components     │  │
│  │ Shell   │ │ (pages)  │ │ (Zustand)│ │ (shadcn/Radix) │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └────────────────┘  │
│       │           │            │                            │
│       └───────────┴────────────┘                            │
│                   │                                         │
│         window.bidlens (BidLensApi)                         │
├───────────────────┼─────────────────────────────────────────┤
│  Preload          │  contextBridge                          │
│  src/preload/     │  Maps BidLensApi → ipcRenderer.invoke   │
├───────────────────┼─────────────────────────────────────────┤
│  Main Process (Node.js / CommonJS)                          │
│  src/main/                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ IPC Handlers │ │ Services     │ │ Persistence      │    │
│  │ (ipcMain)    │→│ (orchestrate)│→│ (SQLite + repos) │    │
│  └──────────────┘ └──────┬───────┘ └──────────────────┘    │
│                          │                                  │
│                   JSON-RPC over stdio                        │
├─────────────────────────┼───────────────────────────────────┤
│  Rust Engine (bidlens-engine)                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ document-ast │ │ diff-engine  │ │ review-core      │    │
│  │ (AST types)  │ │ (diff algos) │ │ (4 detectors)    │    │
│  └──────────────┘ └──────────────┘ └──────────────────┘    │
│  ┌──────────────┐ ┌──────────────┐                         │
│  │ table-diff   │ │ common       │                         │
│  │ (table diff) │ │ (errors)     │                         │
│  └──────────────┘ └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Layers

**Renderer (UI):**
- Purpose: User interface, state management, presentation
- Location: `apps/desktop/src/renderer/`
- Contains: React components, Zustand stores, feature pages, Tailwind styles
- Depends on: `@bidlens/shared` (types only), `window.bidlens` IPC bridge
- Used by: End user

**Preload (Bridge):**
- Purpose: Secure IPC bridge between renderer and main
- Location: `apps/desktop/src/preload/index.ts`
- Contains: Single file mapping `BidLensApi` interface to `ipcRenderer.invoke()` calls
- Depends on: `@bidlens/shared` (types), `electron` (contextBridge, ipcRenderer)
- Used by: Renderer via `window.bidlens`

**Main Process (Backend):**
- Purpose: Business logic orchestration, persistence, engine lifecycle
- Location: `apps/desktop/src/main/`
- Contains: IPC handlers, services, repositories, database layer, worker threads
- Depends on: `@bidlens/shared`, `better-sqlite3`, `electron`
- Used by: Preload (via IPC), spawns Rust engine

**Shared Package:**
- Purpose: Cross-cutting types, IPC contracts, document parsers, diff utilities
- Location: `packages/shared/src/`
- Contains: TypeScript types, IPC interface definitions, DOCX/PDF parsers, diff algorithms
- Depends on: `docx4js`, `pdf-parse`
- Used by: Both main process and renderer (as types)

**Rust Engine:**
- Purpose: High-performance document parsing, diff computation, risk detection
- Location: `bidlens-engine/`
- Contains: 5 crates (document-ast, diff-engine, table-diff, review-core, common)
- Depends on: `serde`, `serde_json`, `tokio`, `uuid`, `anyhow`
- Used by: Main process (spawned as child process, JSON-RPC over stdio)

## Data Flow

**V0.3 Risk Review Flow (primary):**

1. Renderer: User creates project via `NewProjectPage` → calls `window.bidlens.createRiskProject(request)`
2. Preload: Forwards as `ipcRenderer.invoke('risk:createProject', request)`
3. Main IPC: `risk-review-handlers.ts` receives → delegates to `RiskReviewService`
4. Service: Creates project row in SQLite, validates files, creates submission rows, starts async pipeline
5. Service: For each phase (validate → parse → extract → detect → aggregate):
   - Parses documents via `ParserService` (uses shared parser module)
   - Sends analysis requests to Rust engine via `EngineManager` (JSON-RPC)
   - Receives progress notifications, pushes to renderer via `window.webContents.send('risk:progress', ...)`
   - Persists checkpoints to SQLite for crash recovery
6. Renderer: `ProjectProcessingPage` subscribes to progress via `onRiskProgress` → updates UI
7. Service: On completion, aggregates findings → persists to DB → pushes final status
8. Renderer: `RiskResultPage` loads findings via `window.bidlens.getProject(id)` → displays results

**V0.2 Compare Flow (legacy, retained):**

1. Renderer: User selects files → calls `window.bidlens.startCompare(request)`
2. Main: `TaskOrchestrator` validates → parses via `ParserService` → sends to Rust engine → returns `CompareResult`
3. Main: Persists encrypted snapshots to SQLite via `SnapshotRepository`
4. Renderer: `ReviewWorkbench` displays diff results

**State Management:**
- `app-store.ts` (Zustand): Navigation state machine, view transitions, mode switching
- `result-store.ts` (Zustand): V0.2 compare results, diff items, annotations, filters
- `risk-review-store.ts` (Zustand): V0.3 project navigation, finding selection, filter state
- `@tanstack/react-query`: Used for async data fetching (project lists, project details)

## Key Abstractions

**BidLensApi (IPC Contract):**
- Purpose: Complete API surface between renderer and main process
- Examples: `packages/shared/src/ipc.ts`
- Pattern: Interface-only definition in shared, implemented by preload, consumed by renderer

**PersistenceManager:**
- Purpose: Orchestrates all persistence services (DB, repos, encryption, backup, retention)
- Examples: `apps/desktop/src/main/services/persistence.ts`
- Pattern: Facade over DatabaseManager, KeyManager, repositories, and worker

**EngineManager:**
- Purpose: Manages Rust engine child process lifecycle and JSON-RPC communication
- Examples: `apps/desktop/src/main/services/engine-manager.ts`
- Pattern: Singleton service, spawns child process, maintains request/response map, handles crash recovery

**RiskReviewService:**
- Purpose: Complete risk review business logic (project CRUD, analysis pipeline, export)
- Examples: `apps/desktop/src/main/services/risk-review-service.ts`
- Pattern: Repository-backed service with in-memory active run tracking

**DocumentAst / RiskFinding / Evidence:**
- Purpose: Core domain types shared across all layers
- Examples: `packages/shared/src/document-ast.ts`, `packages/shared/src/risk-review.ts`
- Pattern: Pure TypeScript interfaces, no runtime dependencies

## Entry Points

**Electron Main Process:**
- Location: `apps/desktop/src/main/index.ts`
- Triggers: Electron app launch
- Responsibilities: Create BrowserWindow, initialize PersistenceManager, register all IPC handlers, manage engine lifecycle

**Renderer Entry:**
- Location: `apps/desktop/src/renderer/index.html` → `main.tsx`
- Triggers: BrowserWindow loads URL/file
- Responsibilities: Mount React app with QueryClient, ErrorBoundary, TooltipProvider

**Rust Engine Entry:**
- Location: `bidlens-engine/src/main.rs`
- Triggers: Spawned by EngineManager as child process
- Responsibilities: Read JSON-RPC requests from stdin, dispatch to task_service or risk_engine, emit progress events

## Error Handling

**Strategy:** Structured errors at trust boundaries, graceful degradation for non-critical failures

**Patterns:**
- `StructuredRiskError` with `code`, `message`, `retryable` flag for engine errors (defined in `packages/shared/src/ipc.ts`)
- `ErrorBoundary` React component wraps entire app (`apps/desktop/src/renderer/components/feedback/error-boundary.tsx`)
- Database corruption → automatic recovery attempt via `RecoveryService` (`apps/desktop/src/main/services/recovery.ts`)
- Engine crash → EngineManager detects and restarts child process (`apps/desktop/src/main/services/engine-manager.ts`)
- Partial analysis → project enters `partial` status, user can accept partial results or retry

## Cross-Cutting Concerns

**Logging:** `console.log` with `[Component]` prefix convention in main process; renderer console messages forwarded to main via `console-message` event
**Validation:** File validation via `file-validator.ts` (size, format, readability); input validation at IPC boundary
**Authentication:** None (local desktop app). Encryption at rest via `KeyManager` + AES for sensitive payloads (`apps/desktop/src/main/db/crypto.ts`)
**Threading:** Database worker thread for heavy persist/load operations (`apps/desktop/src/main/workers/database-worker.ts`); Web Worker for diff filtering (`apps/desktop/src/renderer/workers/filter-worker.ts`)

---

*Architecture analysis: 2026-07-22*
