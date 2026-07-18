# BidLens Architecture

> Version: 2.0 (V0.2.2)
> Last updated: 2026-07-18

## Runtime Boundaries

```
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

## Three-Layer Stack

### 1. `packages/shared` — Pure TypeScript Library

Exports all data types, IPC contracts (`BidLensApi`), diff utilities, state machines, error taxonomy, and the table-diff engine. No framework dependencies. Built with `tsc` to `dist/` as ESM with declarations.

**Renderer-safe imports**: Renderer MUST import from `@bidlens/shared/types-only`. Node-capable modules MUST NOT enter the renderer graph.

### 2. `apps/desktop` — Electron App

Two compilation targets:

- **Main process** (`src/main/`) — Compiled via `tsconfig.main.json` (CommonJS, target ES2022). Entry: `src/main/index.ts`. Registers IPC handlers via `ipcMain.handle()`. Owns the SQLite database through a dedicated Worker, manages the Rust engine subprocess, and handles file validation and report export.

- **Renderer process** (`src/renderer/`) — Vite + React 19. Entry: `src/renderer/index.html` → `main.tsx`. Uses Zustand for state, `@tanstack/react-query` for async.

- **Preload** (`src/preload/`) — Bridges main↔renderer via `contextBridge.exposeInMainWorld('bidlens', api)`. The `BidLensApi` interface is defined in `packages/shared/src/ipc.ts`.

### 3. `bidlens-engine/` — Rust Workspace

Core crates are transport-neutral (no stdio or HTTP dependency):

- `document-ast` — AST data structures (paragraphs, sections, lists, tables, comments, revisions)
- `diff-engine` — Semantic diff algorithms, depends on `document-ast`
- `table-diff` — Table-level diff (cell changes, structural changes, row/column alignment)
- `common` — Shared error types and result aliases
- Root crate `bidlens-engine` — stdio JSON-RPC transport adapter + transport-neutral task service

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| SQLite ownership | Electron main via dedicated Worker | Rust is transport-neutral; main process handles persistence |
| Encryption | AES-256-GCM with Electron safeStorage + Windows DPAPI | Local content protection without SQLCipher |
| IPC protocol | Typed Electron IPC with structured errors | Renderer never accesses Node APIs or file paths directly |
| Rust transport | stdio JSON-RPC (V0.2.2), future Axum adapter | Core crates remain framework-agnostic |
| UI framework | React 19 + Tailwind 4 + shadcn/ui + Radix | Swiss Minimalism design system |
| State management | Zustand + TanStack Query | Lightweight, type-safe |
| Design philosophy | Swiss Minimalism | Clean, restrained, functional; information hierarchy via type/weight/color depth |

## Data Flow

```
Renderer: file selection → validateFiles IPC
Main: validate files, inspect capabilities → FileValidationResult[]
Renderer: startCompare IPC
Main: orchestrator starts task lifecycle:
  validating → parsing_baseline → parsing_review → comparing → finalizing → ready
  Each phase emits real progress via webContents.send('compare:progress')
  Rust subprocess receives Document ASTs via JSON-RPC → returns Diff AST
Main: encrypt + persist snapshots to SQLite
Renderer: receives CompareResult, renders review workbench
```

## IPC Surface (Spec §10)

| Group | Operations |
|---|---|
| File | validateFiles |
| Compare | startCompare, cancelCompare, getCompareResult, onCompareProgress |
| Review | saveAnnotation, batchReadAnnotations |
| History | listHistory, openSnapshot, recompare, retainTask, deleteTask, clearHistory |
| Export | exportReport, openExportedFile, openExportFolder |
| Settings | getSettings, updateSettings, getStorageReport, cleanup |
| Engine | engineHandshake |

## Task State Machine (Spec §9)

```
draft -> validating -> parsing_baseline -> parsing_review -> comparing -> finalizing -> ready
                    |                  |               |              |
                    +-------> cancelling -> cancelled
                    +-------> failed
```

Running states discovered at launch become `interrupted`.

## Module Ownership

| Stream | Area |
|---|---|
| CT | Shared contracts and architecture |
| RT | Parser, task orchestration, Rust engine, Electron main |
| DB | SQLite, encryption, history, backup |
| UI | Renderer, design system, accessibility |
| QA | Fixtures, integration, performance, packaging, release |

## References

- [V0.2.2 Implementation Spec](v022-implementation-spec.md)
- [V0.2.2 Task Breakdown](v022-task-breakdown.md)
- [UI/UE Decision Log](v022-ui-ue-decision-log.md)
- [API: IPC](api/ipc.md) | [API: Rust](api/rust.md) | [API: Types](api/types.md) | [API: Parser](api/parser.md)
