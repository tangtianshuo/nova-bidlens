# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BidLens is an Electron desktop app for **bid document similarity risk review** (投标文件雷同性风险审查). V0.3.0 is defined to import 2-8 bid documents per project, perform explainable text/table/entity/key-fact detection, and output traceable risk evidence. BGE-M3 semantic enhancement is a V0.3.1 target. The standalone version-diff product flow is being retired, while Diff capabilities remain as evidence tooling until migration is complete.

The canonical product source is `docs/product/PRD-v0.3-similarity-risk-review.md`. Do not redefine product scope or Shared contracts in this file.

## Monorepo Structure

```
nova-bidlens/
├── apps/desktop/          # Electron app (React + Vite renderer, TS main process)
├── packages/shared/       # Shared types, IPC contracts, diff logic (TypeScript)
├── bidlens-engine/        # Rust workspace — document parsing & diff engine (Cargo)
└── pnpm-workspace.yaml    # pnpm workspace config
```

## Build & Dev Commands

```bash
# Install dependencies
pnpm install

# Full dev (builds shared, then launches Vite + Electron)
pnpm dev

# Build everything (TS + Rust)
pnpm build

# Run all tests
pnpm test

# Individual test suites
pnpm test:ts          # shared + desktop unit tests
pnpm test:rust        # cargo test for Rust engine
pnpm test:integration # vitest run tests/integration
pnpm test:e2e         # vitest run tests/e2e

# Desktop-only dev
pnpm --filter @bidlens/desktop dev
pnpm --filter @bidlens/desktop test

# Shared package
pnpm --filter @bidlens/shared build
pnpm --filter @bidlens/shared test

# Rust engine
cargo build --manifest-path bidlens-engine/Cargo.toml
cargo test --manifest-path bidlens-engine/Cargo.toml
```

## Architecture

### Three-Layer Stack

1. **`packages/shared`** — Pure TypeScript library. Exports all data types (`DocumentAst`, `AnalysisProject`, `RiskFinding`, `Evidence`, `RiskAssessment`, etc.), IPC contracts (`BidLensApi`), diff utilities, and the table-diff engine. No framework dependencies. Built with `tsc` to `dist/` as ESM with declarations.

2. **`apps/desktop`** — Electron app with two compilation targets:
   - **Main process** (`src/main/`) — Compiled via `tsconfig.main.json` (CommonJS, target ES2022). Entry: `src/main/index.ts`. Registers IPC handlers via `ipcMain.handle()`.
   - **Renderer process** (`src/renderer/`) — Vite + React 19. Entry: `src/renderer/index.html` → `main.tsx`. Uses Zustand for state, `@tanstack/react-query` for async.
   - **Preload** (`src/preload/`) — Bridges main↔renderer via `contextBridge.exposeInMainWorld('bidlens', api)`. The `BidLensApi` interface is defined in `packages/shared/src/ipc.ts`.

3. **`bidlens-engine/`** — Rust workspace with crates:
   - `document-ast` — AST data structures (paragraphs, sections, lists, tables)
   - `diff-engine` — Semantic diff algorithms, depends on `document-ast`
   - `table-diff` — Table-level diff (cell changes, structural changes)
   - Root crate `bidlens-engine` — Orchestrates parsing + diffing
   - *V0.3 planned:* `tender-filter`, `semantic-detector`, `table-detector`, `entity-detector`, `finding-aggregator`, `risk-engine`

### IPC Flow (V0.3 — risk:* interfaces)

Renderer calls `window.bidlens.createRiskProject(request)` → preload forwards via `ipcRenderer.invoke('risk:createProject', request)` → main process returns `{ projectId }`. Progress updates are pushed via `window.webContents.send('risk:progress', progress)`. See `packages/shared/src/ipc.ts` and `docs/api/ipc.md` for the contract.

### Key Data Model (V0.3)

- **`AnalysisProjectSummary` / `AnalysisProjectDetail`** — Current project summary/detail contracts
- **`Submission`** — A single bid file with parsing/vectorization status
- **`RiskFinding`** — A merged risk finding with detection type, risk level, involved submissions, and evidence
- **`Evidence`** — Traceable evidence linking to file, AST node, original text, and match basis
- **`RiskAssessment`** — File-pair or project-level risk evaluation (low/medium/high)
- **`DocumentAst`** — Parsed document with `blocks: BlockNode[]` (paragraph | section | list | table) — retained from prototype

## Current State

- **V0.2.2 prototype complete** — dual-document comparison pipeline (parse → diff → review → export) fully functional as capability prototype.
- **V0.3 in development** — UI surfaces and initial `risk:*` IPC exist; the real analysis, persistence, recovery, review-save, report, and E2E chain is incomplete.
- UI uses Tailwind 4 + Radix UI + shadcn-style components; the VNext UI implementation phases are substantially complete.
- Rust engine crates (document-ast, diff-engine, table-diff) are integrated. New Rust detectors (semantic, table, entity, risk) planned for V0.3.
- `compare:*` remains registered for compatibility and evidence tooling. Do not remove it before RiskFinding evidence migration is complete.

## Language

UI is in Chinese (zh-CN). Code, comments, commit messages, and variable names are in English.
