# Phase 4: Quality Gates - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — grey area discussion skipped)

<domain>
## Phase Boundary

Automated tests cover security, performance, compatibility, and production readiness. Phase delivers:
1. Security tests — offline operation, log redaction, encrypted DB/WAL, deletion closure (QA-03)
2. Performance tests — sparse recall on 4000-page documents, 1000+ findings rendering (QA-04)
3. Diff regression tests — evidence compatibility with existing Diff tooling (QA-05)
4. Viewport/accessibility screenshots at 1280x800, 1024x700, 760 equivalent (QA-06)
5. Production-bundle fixture scanning — build fails if test fixtures leak into production chunks (QA-07)

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- Phase 1: Engine fallback removed, table detector has correct submission IDs
- Phase 2: Single project identity, checkpoint resume working, dead IPC removed
- Phase 3: E2E harness (Playwright) and full risk pipeline E2E test exist

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/e2e/` — Playwright E2E tests from Phase 3
- `tests/benchmark/benchmark-harness.ts` — Performance benchmark harness
- `tests/accessibility/` — Accessibility test directory (empty, ready for Phase 4)
- `apps/desktop/vitest.config.ts` — Test config
- `apps/desktop/src/renderer/__fixtures__/risk-project.ts` — Test fixture data

### Established Patterns
- Vitest for unit/integration tests
- Playwright for E2E tests
- Benchmark harness with timing assertions

### Integration Points
- `apps/desktop/vite.config.ts` — Build config for production-bundle scanning
- `packages/shared/src/ipc.ts` — IPC contract for offline/security testing
- SQLite DB path for encrypted DB/WAL verification

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-quality-gates*
*Context gathered: 2026-07-22*
