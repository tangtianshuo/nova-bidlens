# Roadmap: BidLens V0.3.0 — Non-Embedding Similarity Risk Review Completion

## Overview

V0.3.0 core pipeline (Waves 0-5) is substantially implemented. This roadmap covers the remaining gaps: bug fixes and dead code removal, integration hardening, E2E test infrastructure, quality gate expansion, and optional business label extraction. Each phase builds on the previous, ensuring a clean pipeline before testing against it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Cleanup & Bug Fixes** - Remove dead code and fix known data issues in Rust engine and detectors
- [ ] **Phase 2: Integration Hardening** - Unify renderer identity, fix checkpoint resume, wire missing IPC channels
- [ ] **Phase 3: E2E Foundation** - Playwright harness + first full risk pipeline E2E test with real DOCX files
- [ ] **Phase 4: Quality Gates** - Security, performance, Diff regression, viewport, and bundle scanning tests
- [ ] **Phase 5: Business Labels** - Extract BusinessLabel data for ReviewNode (deferrable to post-V0.3.0)

## Phase Details

### Phase 1: Cleanup & Bug Fixes
**Goal**: Codebase is clean and all detector outputs are correct — no dead code, no fake evidence, no missing data
**Depends on**: Nothing (first phase)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04
**Success Criteria** (what must be TRUE):
  1. `run_analysis` stub, `ProjectState`, and unused JSON-RPC methods no longer exist in Rust engine
  2. Table detector output contains correct `source_submission_id` and `target_submission_id` (not empty strings)
  3. `table_location` is populated in review nodes when the source document contains table position data
  4. Engine fallback path either does not exist or cannot produce untraceable evidence with fake node IDs
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Integration Hardening
**Goal**: Renderer and main process communicate cleanly — single project identity, working checkpoint resume, no dead wiring
**Depends on**: Phase 1
**Requirements**: HARDEN-01, HARDEN-02, HARDEN-03, HARDEN-04
**Success Criteria** (what must be TRUE):
  1. All renderer stores reference the same project ID — no desync between `useProjectStore`, `useRiskReviewStore`, and `useAppStore`
  2. Checkpoint resume skips detectors that already have results in DB instead of re-running all 4
  3. `risk:detectorProgress` channel is either functional (pushes real progress) or removed from preload
  4. No production `console.log` stubs remain in renderer; hook ordering is correct
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: E2E Foundation
**Goal**: Automated E2E tests prove the full risk pipeline works end-to-end with real bid documents
**Depends on**: Phase 2
**Requirements**: QA-01, QA-02
**Success Criteria** (what must be TRUE):
  1. Playwright E2E harness can launch Electron (dev and packaged), exercise IPC through real app flows
  2. Full risk pipeline E2E creates a project with real DOCX files, processes them, and verifies findings/evidence/assessments exist in DB
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Quality Gates
**Goal**: Automated tests cover security, performance, compatibility, and production readiness
**Depends on**: Phase 3
**Requirements**: QA-03, QA-04, QA-05, QA-06, QA-07
**Success Criteria** (what must be TRUE):
  1. Security tests verify offline operation, log redaction, encrypted DB/WAL, and deletion closure
  2. Performance tests handle sparse recall on 4000-page documents and render 1000+ findings without degradation
  3. Diff regression tests pass — evidence compatibility with existing Diff tooling preserved
  4. Viewport/accessibility screenshots captured at 1280x800, 1024x700, and 760 equivalent widths
  5. Production-bundle fixture scan fails build if test fixtures leak into production chunks
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Business Labels
**Goal**: ReviewNode carries meaningful business labels for downstream filtering and reporting
**Depends on**: Nothing (independent, deferrable)
**Requirements**: LABEL-01
**Success Criteria** (what must be TRUE):
  1. ReviewNode `labels` field contains extracted business labels (not always empty Vec)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cleanup & Bug Fixes | 0/2 | Not started | - |
| 2. Integration Hardening | 0/2 | Not started | - |
| 3. E2E Foundation | 0/2 | Not started | - |
| 4. Quality Gates | 0/2 | Not started | - |
| 5. Business Labels | 0/1 | Not started | - |
