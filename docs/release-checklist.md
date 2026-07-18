# Release Candidate Checklist

Covers P6-13 through P6-15. Complete all items before tagging a release.

## P6-13: Release Corpus Validation

Accuracy and performance validation against the reference corpus.

- [ ] Run D33 accuracy scoring against reference corpus (`pnpm test:corpus`)
- [ ] Verify paragraph-level diff accuracy >= 95% (target from design doc)
- [ ] Verify table-cell diff accuracy >= 90%
- [ ] Run 1000-page document pair test — confirm completion within 120s
- [ ] Run 100MB file pair test — confirm no OOM, memory stays under 2GB peak
- [ ] Verify diff output matches expected golden files for regression corpus
- [ ] Record benchmark results in `docs/benchmarks/release-x.y.z.md`
- [ ] Compare performance against previous release — no regression > 10%

## P6-14: Documentation Reconciliation

Ensure all docs reflect current implementation state.

- [ ] **Architecture doc** (`docs/01-总体架构设计.md`) — matches actual module structure
- [ ] **Performance report** (`docs/v02-performance-report.md`) — updated with latest benchmarks
- [ ] **Database design** (`docs/07-数据库设计.md`) — schema matches current migrations
- [ ] **IPC protocol** (`docs/06-IPC通信协议设计.md`) — contracts match `packages/shared/src/ipc.ts`
- [ ] **Release notes** (`CHANGELOG.md`) — all user-facing changes documented
- [ ] **API reference** (`docs/api/`) — public API surface matches exports
- [ ] **Roadmap** (`docs/roadmap.md`) — completed items marked, next version planned
- [ ] README.md — install instructions, screenshots, and links are current

## P6-15: Release Candidate Go/No-Go

Final gate before publishing.

- [ ] **Known issues** — list documented in `docs/known-issues-x.y.z.md` with severity
- [ ] **SHA-256 manifest** — generated for all distributables (`scripts/generate-manifest.sh`)
- [ ] **SHA-256 manifest signed** — manifest file itself is GPG-signed or checksum-verified
- [ ] **All CI checks green** — build, lint, unit tests, integration tests pass
- [ ] **Smoke test on 3 OS configs** — Win 10, Win 11, one VM with non-standard locale
- [ ] **No P0/P1 bugs open** — check issue tracker, all blockers resolved
- [ ] **Version bumped** — `package.json` versions match across workspace
- [ ] **Git tag created** — `git tag -s vx.y.z` with release notes in tag message
- [ ] **Go/No-Go decision** — lead sign-off recorded here: `________ Date: ____`
