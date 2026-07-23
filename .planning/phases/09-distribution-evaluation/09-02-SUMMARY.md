---
phase: 09-distribution-evaluation
plan: 02
subsystem: desktop
tags: [ipc, settings, mineru, ui]
depends_on:
  requires: [09-01]
  provides: [mineru-ipc, settings-ui]
  affects: [parser-service]
tech_stack:
  added: []
  patterns: [ipc-bridge, settings-tab]
key_files:
  created: []
  modified:
    - packages/shared/src/ipc.ts
    - apps/desktop/src/preload/index.ts
    - apps/desktop/src/renderer/features/settings/settings-dialog.tsx
    - apps/desktop/src/main/services/parser-service.ts
    - apps/desktop/src/main/index.ts
decisions:
  - "Parser service reads token from MineruConfigService first, falls back to process.env"
  - "Validation uses actual MinerU batch API call (not a mock)"
metrics:
  duration: 2min
  completed: "2026-07-23T05:05:21Z"
  tasks: 2
  files: 5
---

# Phase 09 Plan 02: MinerU API Settings UI and IPC Bridge Summary

MinerU API token management wired through IPC bridge with settings UI tab for save/validate/clear operations.

## Tasks Completed

### Task 1: Wire IPC types and preload bridge
- Added `mineruGetToken`, `mineruSaveToken`, `mineruDeleteToken`, `mineruValidateToken` to `BidLensApi` interface
- Added preload bridge methods mapping to `mineru:*` IPC channels
- Parser service now reads token from `MineruConfigService` first, falls back to `process.env.MINERU_API_TOKEN`
- Exported `setMineruConfigService` and `resetMinerUParser` from parser-service
- Wired `setMineruConfigService` in main/index.ts after MineruConfigService instantiation
- Commit: `3792f73`

### Task 2: Add API config tab to settings dialog
- Added "API 配置" tab to settings dialog with `TabsTrigger` and `TabsContent`
- Token input field with password type and Eye/EyeOff toggle
- "保存" (save), "验证" (validate), "清除" (delete) buttons with loading spinners
- Validation result display: green CheckCircle for valid, red XCircle for invalid
- Masked token display when a token is stored
- Loads masked token on dialog open via `useEffect`
- All Chinese UI labels as required
- Commit: `4298935`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all UI is wired to real IPC handlers and MineruConfigService.

## Verification

- `pnpm --filter @bidlens/shared build` passes
- `npx tsc -p apps/desktop/tsconfig.main.json --noEmit` passes
- Pre-existing renderer type errors in top-bar.tsx and logger.ts (unrelated to this plan)

## Self-Check: PASSED
