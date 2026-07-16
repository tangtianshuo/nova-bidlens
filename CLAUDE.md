# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BidLens (招标文档语义比对工具) is an Electron desktop app for comparing bid/tender documents (.docx). It parses Word documents into a structured AST, performs semantic diff at paragraph and table-cell level, and presents results in a review workbench UI.

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

1. **`packages/shared`** — Pure TypeScript library. Exports all data types (`DocumentAst`, `DiffAst`, `DiffItem`, `CompareResult`, `TableDiffResult`, etc.), IPC contracts (`BidLensApi`), diff utilities, and the table-diff engine. No framework dependencies. Built with `tsc` to `dist/` as ESM with declarations.

2. **`apps/desktop`** — Electron app with two compilation targets:
   - **Main process** (`src/main/`) — Compiled via `tsconfig.main.json` (CommonJS, target ES2022). Entry: `src/main/index.ts`. Registers IPC handlers via `ipcMain.handle()`.
   - **Renderer process** (`src/renderer/`) — Vite + React 19. Entry: `src/renderer/index.html` → `main.tsx`. Uses Zustand for state, `@tanstack/react-query` for async.
   - **Preload** (`src/preload/`) — Bridges main↔renderer via `contextBridge.exposeInMainWorld('bidlens', api)`. The `BidLensApi` interface is defined in `packages/shared/src/ipc.ts`.

3. **`bidlens-engine/`** — Rust workspace with crates:
   - `document-ast` — AST data structures (paragraphs, sections, lists, tables)
   - `diff-engine` — Semantic diff algorithms, depends on `document-ast`
   - `table-diff` — Table-level diff (cell changes, structural changes)
   - Root crate `bidlens-engine` — Orchestrates parsing + diffing

### IPC Flow

Renderer calls `window.bidlens.startCompare(request)` → preload forwards via `ipcRenderer.invoke('compare:start', request)` → main process handler in `registerCompareHandlers()` → returns `{ taskId }`. Progress updates pushed via `window.webContents.send('compare:progress', progress)`.

### Key Data Model

- **`DocumentAst`** — Parsed document with `blocks: BlockNode[]` (paragraph | section | list | table)
- **`DiffAst`** — Result of comparing two documents, contains `items: DiffItem[]` + `summary: DiffSummary`
- **`DiffItem`** — Single diff unit with `matchType` (identical/modified/added/deleted/moved/split/merged/uncertain), `confidence`, `similarity`, optional `tableDiff`
- **`TableDiffResult`** — Cell-level diffs (`CellDiff[]`) + structural changes (rows/columns added/deleted)

## Current State

- IPC handlers currently return **demo/mock data** (see `compare-handlers.ts:demoResult`). Real parsing/diffing is not wired to the Electron app yet.
- No UI library selected — all styles are inline React `style` props.
- Renderer uses `system-ui` font, no CSS files or Tailwind config.
- Rust engine crates exist but are not yet integrated into the Electron main process.

## Language

UI is in Chinese (zh-CN). Code, comments, commit messages, and variable names are in English.
