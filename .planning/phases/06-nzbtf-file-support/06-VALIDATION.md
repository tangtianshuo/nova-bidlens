---
phase: 06
slug: nzbtf-file-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.8 |
| **Config file** | apps/desktop/vitest.config.ts |
| **Quick run command** | `pnpm --filter @bidlens/desktop test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @bidlens/desktop test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | NZBTF-01 | unit | `pnpm --filter @bidlens/shared build` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | NZBTF-01, NZBTF-03 | unit | `pnpm --filter @bidlens/desktop build` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 2 | NZBTF-02 | unit | `vitest run tests/nzbtf-parser.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | NZBTF-01, NZBTF-02, NZBTF-03 | unit | `pnpm --filter @bidlens/shared build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/parser/nzbtf.test.ts` — unit tests for NzbtfParser with fixture XML
- [ ] `packages/shared/src/parser/nzbtf/fixtures/` — sample TB.xml, Echo.xml, hyChoose.xml fixtures extracted from real nZBTF files
- [ ] `pnpm --filter @bidlens/shared test` — verify test runner works for shared package

*Wave 0 creates test infrastructure before plan execution begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| User can select .nZBTF in file dialog | NZBTF-01 | Requires Electron window | Launch app, open project creation, verify .nzbtf appears in file filter |
| nZBTF parsing produces readable content | NZBTF-02 | Visual inspection of DocumentAst | Create project with nZBTF file, check submission detail shows parsed blocks |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

 /gsd:autonomous --from 6