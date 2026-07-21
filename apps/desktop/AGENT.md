# AGENT.md - Desktop application layer

> Path: `apps/desktop/`
> Updated: 2026-07-21
> Product authority: `docs/product/PRD-v0.3-similarity-risk-review.md`

## Responsibilities

The Desktop layer owns:

- Electron windows and operating-system integration.
- Typed preload IPC between Renderer and Main.
- File dialogs, validation and Node parser orchestration.
- Project orchestration, progress, cancellation and recovery.
- SQLite Worker ownership, encryption, retention and reports.
- React project, processing, risk, evidence and settings surfaces.

Rust owns transport-neutral detection and risk computation. Renderer must not access Node APIs or databases directly.

## Current And Target State

Current:

- The V0.2.2 `compare:*` pipeline is implemented and remains registered.
- VNext risk-review UI surfaces and initial `risk:*` IPC are implemented.
- The risk-review Main service is an incomplete in-memory lexical fallback.
- Risk project persistence, ReviewNode extraction, detectors, recovery, review-save integration, project reports and real-file Electron E2E are not complete.

Target V0.3.0:

- A single project-based risk-review product flow.
- No standalone version-diff product entry.
- Existing Diff capabilities reused from RiskFinding and file-pair evidence views.
- Real encrypted project checkpoints and reports.

Target V0.3.1:

- Local model lifecycle, semantic progress, encrypted vector cache and explicit lexical fallback.

Do not describe target modules as currently implemented.

## Runtime Boundaries

```text
React Renderer
  -> window.bidlens typed API
Preload
  -> ipcRenderer.invoke / event subscriptions
Electron Main
  -> file validation, parsers, orchestration, SQLite, encryption
  -> stdio JSON-RPC
Rust Engine
```

Main entry and important boundaries:

- `src/main/index.ts`
- `src/main/ipc/compare-handlers.ts`
- `src/main/ipc/risk-review-handlers.ts`
- `src/main/services/task-orchestrator.ts`
- `src/main/services/risk-review-service.ts`
- `src/preload/index.ts`
- `src/renderer/app/App.tsx`

## IPC Rules

1. Define request, response and event types in `packages/shared/src/ipc.ts`.
2. Export renderer-safe types through `@bidlens/shared/types-only`.
3. Implement the Main handler under `src/main/ipc/`.
4. Expose the exact `BidLensApi` method in `src/preload/index.ts`.
5. Consume only `window.bidlens` from Renderer.
6. Add contract and handler tests.

Current risk creation uses:

```text
window.bidlens.createRiskProject(request)
-> risk:createProject
-> { projectId }
```

Do not rename this to `createProject` in documentation or code without changing the Shared contract.

`compare:*` remains a compatibility and evidence capability until the PRD migration is complete. New primary product work belongs under `risk:*`.

## Renderer Import Rule

Renderer files under `src/renderer/` must import Shared values and types from:

```ts
import type { RiskFinding } from '@bidlens/shared/types-only';
```

Renderer must not import from `@bidlens/shared` because the full entry can include Node-only parser dependencies.

When adding a browser-safe Shared type or pure helper, export it from `packages/shared/src/types-only.ts` without importing the full index.

## Vite And Electron Guardrails

`vite.config.ts` must retain:

```ts
server: {
  port: 5173,
  strictPort: true,
},
base: './',
```

- Electron development loads `http://127.0.0.1:5173`.
- Packaged `file://` rendering requires relative assets.
- The native menu stays disabled.
- Renderer owns the frameless title bar.
- DevTools must not open automatically.
- Default window is 1280x800 with a 1024x700 minimum.

## State And Data Rules

- TanStack Query owns server/IPC state.
- Zustand owns local selection, filters and view state.
- A project ID must have one canonical navigation source; do not split active project identity across unrelated stores.
- `ProjectStatus`, `AnalysisPhase` and per-submission processing state are separate concepts.
- Progress events invalidate or update the corresponding project Query.
- Production pages must never import fixture builders.
- Do not show fixed or fabricated progress timing.
- Partial results must never render as normal low risk.

## UI Rules

- Use existing Tailwind tokens and shadcn-style primitives.
- Preserve risk, detector, task and Diff semantic separation.
- Tables and matrices own horizontal scrolling; the app shell must not overflow.
- Validate 1280x800, 1024x700 and a 760px equivalent viewport.
- Persistent warnings such as no-baseline, degraded and partial states must not rely on transient toasts.
- Use Lucide icons and accessible labels for icon controls.
- Risk evidence may reuse the three-column review layout, but risk and Diff tabs remain explicitly configured.

## Commands

```powershell
pnpm --filter @bidlens/desktop dev
pnpm --filter @bidlens/desktop build
pnpm --filter @bidlens/desktop test
pnpm --filter @bidlens/desktop exec vitest run
pnpm --filter @bidlens/desktop exec tsc -p tsconfig.main.json --noEmit
pnpm --filter @bidlens/desktop exec tsc -p tsconfig.json --noEmit
```

For `pnpm`, do not append `-- --run`; use `pnpm --filter @bidlens/desktop exec vitest run`.

## Required Tests

- Main service and handler unit tests.
- Preload/Shared contract consistency.
- Renderer component and Query tests.
- Real-file integration tests for DOCX and text PDF.
- Electron E2E for create, process, cancel, recover, review, history and export.
- Accessibility and responsive regressions.
- Production bundle check proving fixture projects are unreachable.

## Documentation

- Product: `docs/product/PRD-v0.3-similarity-risk-review.md`
- Architecture: `docs/architecture.md`
- IPC: `docs/api/ipc.md`
- UI implementation status: `docs/reports/vnext-ui-execution-status.md`
- Roadmap: `docs/roadmap.md`
