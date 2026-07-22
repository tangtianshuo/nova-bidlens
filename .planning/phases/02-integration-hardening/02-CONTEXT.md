# Phase 2: Integration Hardening - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Unify renderer project identity, fix checkpoint resume to skip completed detectors, remove dead IPC wiring, and clean up hook ordering and console.log stubs. Phase 1 cleaned the Rust engine; this phase cleans the integration layer between renderer, main process, and engine.

</domain>

<decisions>
## Implementation Decisions

### Renderer Identity Unification (HARDEN-01)
- **D-01:** `useRiskReviewStore.projectId` is the single source of truth for project identity. Remove `selectedProjectId` from `useProjectStore` and `taskId` from `useAppStore`. All navigation paths (list → result, create → processing, processing → result) must read/write `useRiskReviewStore.projectId`.

### Checkpoint Resume (HARDEN-02)
- **D-02:** Check `checkpoint.completedDetectors` before running each detector. If a detector's results already exist in DB, skip it. This avoids re-running all 4 detectors on resume when only some failed.

### Detector Progress Channel (HARDEN-03)
- **D-03:** Delete `risk:detectorProgress` wiring from preload. It's dead code — never sent. Detector progress already flows through `risk:progress` phase updates. Remove the channel registration, the TypeScript handler, and any related type definitions.

### Hook and Logging Cleanup (HARDEN-04)
- **D-04:** Remove production `console.log` command stubs in renderer. Fix hook ordering violations (hooks called conditionally or after early returns). Ensure no command silently logs instead of executing.

### Claude's Discretion
- Commit strategy: one commit per logical change (identity, resume, progress, hooks)
- Whether to add regression tests for the identity fix — yes, verify navigation paths

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context
- `.planning/phases/01-cleanup-bug-fixes/01-CONTEXT.md` — Phase 1 decisions (engine is hard dependency, dead code removed)
- `.planning/phases/01-cleanup-bug-fixes/01-VERIFICATION.md` — Phase 1 verification results

### Research
- `.planning/research/PITFALLS.md` — Gap 5 (Renderer identity split across 3 stores), Pitfall 11 (checkpoint resume re-runs detectors)
- `.planning/research/ARCHITECTURE.md` — State management details, store locations

### Code (key files to modify)
- `apps/desktop/src/renderer/features/projects/project-store.ts` — `selectedProjectId` to remove
- `apps/desktop/src/renderer/features/risk-review/risk-review-store.ts` — canonical `projectId`
- `apps/desktop/src/renderer/stores/app-store.ts` — `taskId` to remove
- `apps/desktop/src/renderer/app/App.tsx` — Navigation logic that sets project identity
- `apps/desktop/src/main/services/risk-review-service.ts` — Checkpoint resume logic
- `apps/desktop/src/preload/index.ts` — `detectorProgress` dead wiring to remove

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRiskReviewStore` — Already manages projectId, selectedFindingId, filters. Natural home for single source of truth.
- `checkpoint.completedDetectors` — Already stored in DB, just not checked during resume.

### Established Patterns
- Zustand stores with `set()` for state updates
- React Query for async data with `queryKey` including projectId
- IPC subscriptions via `window.bidlens.onRiskProgress()`

### Integration Points
- `App.tsx:58-60` — Sets both riskReviewStore.projectId and appStore.taskId on create
- `App.tsx:39` — Sets riskReviewStore.projectId on open from list (but not projectStore.selectedProjectId)
- `risk-review-service.ts:166-195` — `resumeRiskProject()` reads checkpoint but doesn't check completedDetectors
- `preload/index.ts` — `detectorProgress` channel registration

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the four decisions above — integration cleanup with clear scope.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-integration-hardening*
*Context gathered: 2026-07-22*
