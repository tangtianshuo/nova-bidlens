# Phase 3: E2E Foundation - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — grey area discussion skipped)

<domain>
## Phase Boundary

Automated E2E tests prove the full risk pipeline works end-to-end with real bid documents. Phase delivers:
1. Playwright E2E harness that can launch Electron (dev and packaged) and exercise IPC through real app flows
2. Full risk pipeline E2E test that creates a project with real DOCX files, processes them, and verifies findings/evidence/assessments exist in DB

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- Phase 1: Engine fallback removed, table detector has correct submission IDs
- Phase 2: Single project identity (useRiskReviewStore.projectId), checkpoint resume working, dead IPC removed

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/desktop/vitest.config.ts` — existing test config
- `packages/shared/src/risk-review.ts` — full type system for risk pipeline
- `apps/desktop/src/main/ipc/risk-review-handlers.ts` — IPC handlers to exercise

### Established Patterns
- Electron app with React renderer + TS main process
- IPC via `window.bidlens` preload bridge
- Better-sqlite3 for persistence

### Integration Points
- Playwright needs to launch Electron binary
- IPC calls through `window.bidlens.*` API
- DB verification through direct sqlite access or IPC queries

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>

---

*Phase: 03-e2e-foundation*
*Context gathered: 2026-07-22*
