# Requirements — Milestone v0.3.0

**Date:** 2026-07-22
**Source:** Codebase research + task breakdown document gap analysis

## Context

V0.3.0 core pipeline (Waves 0-5) is substantially implemented. Requirements below cover the remaining gaps: bug fixes, integration hardening, quality gates, and cleanup. Each requirement maps back to the original task breakdown IDs where applicable.

---

### Bug Fixes and Cleanup

- [ ] **CLEAN-01**: Remove legacy `run_analysis` stub, `ProjectState`, and unused `risk.createProject`/`risk.cancelProject`/`risk.getProject` JSON-RPC methods from Rust engine (V3-103 cleanup)
- [ ] **CLEAN-02**: Wire `source_submission_id`/`target_submission_id` in table detector output instead of empty strings (V3-302 fix)
- [ ] **CLEAN-03**: Wire `table_location` in Rust `build_review_nodes` — currently always `None` despite type contract supporting it (V3-101 fix)
- [x] **CLEAN-04**: Remove or guard the engine fallback path (`buildFindings`) that produces untraceable evidence with fake node IDs (V3-411 fix)

### Integration Hardening

- [ ] **HARDEN-01**: Unify renderer project identity to single source of truth — consolidate `useProjectStore.selectedProjectId`, `useRiskReviewStore.projectId`, `useAppStore.taskId` (V3-121/V3-122)
- [ ] **HARDEN-02**: Checkpoint resume should skip completed detectors instead of re-running all 4 (V3-412 improvement)
- [ ] **HARDEN-03**: Implement `risk:detectorProgress` channel or remove dead wiring in preload (V3-404 cleanup)
- [ ] **HARDEN-04**: Wire hook ordering fix and remove production `console.log` command stubs in renderer (V3-123)

### Quality Gates

- [ ] **QA-01**: Add Electron E2E test harness with Playwright — real IPC through packaged/dev Electron (V3-131)
- [ ] **QA-02**: Add full risk pipeline E2E — create project with real DOCX files, process, verify findings/evidence/assessments in DB (V3-601/V3-602)
- [ ] **QA-03**: Add security tests — offline operation, log redaction, encrypted DB/WAL, deletion closure (V3-603)
- [ ] **QA-04**: Add performance tests — sparse recall, 4000-page project, 1000+ findings rendering (V3-604)
- [ ] **QA-05**: Add Diff regression tests for evidence compatibility (V3-605)
- [ ] **QA-06**: Run viewport/accessibility screenshots at 1280x800, 1024x700, 760 equivalent (V3-606)
- [ ] **QA-07**: Production-bundle fixture reachability scanning — build fails if test fixtures leak into production chunks (V3-132)

### Business Labels (Deferred)

- [ ] **LABEL-01**: Implement BusinessLabel extraction logic for ReviewNode — currently `labels` is always empty Vec (V3-102, deferable)

---

## Out of Scope

- BGE-M3 semantic embedding — V0.3.1
- Gold-set calibration and threshold tuning — V0.3.2
- Standalone version-diff product removal — separate migration task
- Template discount logic — no template detection exists yet, deferred

## Traceability

| Requirement | Task Breakdown ID(s) | Wave | Phase | Status |
|-------------|----------------------|------|-------|--------|
| CLEAN-01 | V3-103 | W1 | Phase 1 | Pending |
| CLEAN-02 | V3-302 | W3 | Phase 1 | Pending |
| CLEAN-03 | V3-101 | W1 | Phase 1 | Pending |
| CLEAN-04 | V3-411 | W4 | Phase 1 | Pending |
| HARDEN-01 | V3-121, V3-122 | W1 | Phase 2 | Pending |
| HARDEN-02 | V3-412 | W4 | Phase 2 | Pending |
| HARDEN-03 | V3-404 | W4 | Phase 2 | Pending |
| HARDEN-04 | V3-123 | W1 | Phase 2 | Pending |
| QA-01 | V3-131 | W1 | Phase 3 | Pending |
| QA-02 | V3-601, V3-602 | W6 | Phase 3 | Pending |
| QA-03 | V3-603 | W6 | Phase 4 | Pending |
| QA-04 | V3-604 | W6 | Phase 4 | Pending |
| QA-05 | V3-605 | W6 | Phase 4 | Pending |
| QA-06 | V3-606 | W6 | Phase 4 | Pending |
| QA-07 | V3-132 | W1 | Phase 4 | Pending |
| LABEL-01 | V3-102 | W1 | Phase 5 | Pending |
