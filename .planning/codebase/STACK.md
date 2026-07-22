# Technology Stack

**Analysis Date:** 2026-07-22

## Languages

**Primary:**
- TypeScript 5.7.2 — Shared package, desktop app (main, renderer, preload)
- Rust 2024 edition — Document parsing and diff engine (`bidlens-engine/`)

**Secondary:**
- JavaScript (CJS) — Build scripts (`apps/desktop/scripts/copy-native-runtime.cjs`)
- PowerShell — Windows build script (`scripts/build-windows.ps1`)

## Runtime

**Environment:**
- Node.js (via Electron 33.2.1 runtime)
- Electron 33.2.1 — Desktop app shell (Chromium + Node.js)

**Package Manager:**
- pnpm 9.15.0 — Monorepo workspace management
- Lockfile: `pnpm-lock.yaml` (present)

**Rust Toolchain:**
- Cargo (standard Rust build system)
- Workspace resolver: 2

## Frameworks

**Core (Renderer):**
- React 19.0.0 — UI framework
- Vite 6.0.7 — Build tool and dev server (renderer process)
- Tailwind CSS 4.3.3 — Utility-first CSS (via `@tailwindcss/vite` plugin)
- Zustand 5.0.2 — Client state management
- TanStack React Query 5.64.2 — Async/server state management

**UI Component Library:**
- Radix UI — Headless primitives (dialog, dropdown, checkbox, tabs, select, popover, tooltip, scroll-area, etc.)
- shadcn/ui pattern — Component wrappers using `class-variance-authority` + `tailwind-merge` + `clsx`
- Lucide React 1.25.0 — Icon library
- Sonner 2.0.7 — Toast notifications

**Testing:**
- Vitest 2.1.8 — Unit test runner (shared + desktop)
- Playwright 1.49.0 — E2E testing
- Testing Library (React 16.1.0, jest-dom 6.9.1, user-event 14.6.1) — Component testing utilities
- jsdom 25.0.1 — DOM environment for Vitest

**Build/Dev:**
- Vite 6.0.7 — Renderer bundling and HMR
- electron-builder 26.15.3 — Electron packaging and distribution
- @electron/rebuild 4.2.0 — Native module rebuilding
- tsx 4.23.1 — TypeScript script execution

## Key Dependencies

**Critical (Desktop):**
- `better-sqlite3` 12.11.1 — Embedded SQLite database (native module, requires rebuild)
- `@bidlens/shared` workspace:* — Internal shared types and IPC contracts
- `electron` 33.2.1 — Desktop runtime

**Critical (Shared):**
- `docx4js` 3.3.0 — DOCX file parsing
- `pdf-parse` 2.4.5 — PDF file parsing

**Critical (Rust):**
- `serde` 1 — Serialization/deserialization
- `serde_json` 1 — JSON handling
- `tokio` 1 (full features) — Async runtime
- `anyhow` 1 — Error handling
- `uuid` 1 (v4) — ID generation
- `sha2` 0.10 — SHA-256 hashing (review-core crate)
- `regex` 1 — Pattern matching (review-core crate)
- `thiserror` 1 — Error derive macros (common crate)

**Infrastructure:**
- `fast-xml-parser` 4.5.1 — XML parsing (used for document processing)
- `jszip` 3.10.1 — ZIP extraction (DOCX is a ZIP archive)
- `diff` 8.0.2 — Text diffing utilities
- `concurrently` 10.0.3 — Parallel dev process management
- `wait-on` 9.0.10 — Dev server readiness detection

## Configuration

**TypeScript:**
- Renderer: `apps/desktop/tsconfig.json` — ES2022 target, ESNext modules, Bundler resolution, JSX react-jsx, path alias `@/* → src/renderer/*`
- Main/Preload: `apps/desktop/tsconfig.main.json` — ES2022 target, CommonJS modules, Node resolution
- Shared: `packages/shared/tsconfig.json` — ES2022 target, ESNext modules, dual CJS/ESM output

**Vite:**
- `apps/desktop/vite.config.ts` — Root at `src/renderer`, port 5173, strict port, externalizes Node built-ins and native parsers

**Electron Builder:**
- `apps/desktop/electron-builder.yml` — App ID: `com.bidlens.desktop`, NSIS installer (Windows), DMG (macOS), AppImage (Linux), asar packaging, native module unpacking for better-sqlite3, Rust engine bundled as extraResource

**Vitest:**
- `apps/desktop/vitest.config.ts` — jsdom environment, co-located test files
- Shared package uses inline vitest config (no separate config file found)

**Playwright:**
- `apps/desktop/playwright.config.ts` — E2E tests in `tests/e2e`, 60s timeout, serial execution (Electron requirement), single worker

## Platform Requirements

**Development:**
- Node.js (version not pinned in `.nvmrc`)
- pnpm 9.15.0
- Rust toolchain (for `bidlens-engine` cargo build)
- `electron-rebuild` for native modules (`better-sqlite3`)

**Production:**
- Windows x64 (NSIS installer, bundles `bidlens-engine.exe`)
- macOS x64 + arm64 (DMG)
- Linux x64 (AppImage)
- Rust engine binary packaged as extraResource in all targets

## Monorepo Structure

**Workspace Layout:**
- `packages/shared` — Pure TypeScript library, dual ESM/CJS output
- `apps/desktop` — Electron app (React renderer + TS main process)
- `bidlens-engine/` — Rust workspace with 5 crates

**Rust Crates:**
- `bidlens-engine` (root) — Orchestrator, JSON-RPC server over stdio
- `document-ast` — AST data structures (paragraphs, sections, lists, tables)
- `diff-engine` — Semantic diff algorithms
- `table-diff` — Table-level diff
- `review-core` — Review logic (SHA-256, regex)
- `common` — Shared error types

---

*Stack analysis: 2026-07-22*
