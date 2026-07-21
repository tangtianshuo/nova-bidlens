# AGENT.md - Rust computation engine

> Path: `bidlens-engine/`
> Updated: 2026-07-21
> Product authority: `docs/product/PRD-v0.3-similarity-risk-review.md`

## Responsibilities

The Rust workspace is a transport-neutral computation core. It communicates with Electron through stdio JSON-RPC, while reusable crates remain independent of Electron, SQLite and UI concerns.

Current crates:

- `common`: shared Rust errors and results.
- `document-ast`: Rust document structures.
- `diff-engine`: current Jaccard-based two-document matching.
- `table-diff`: table comparison.
- root binary: JSON-RPC bridge.

V0.3 target crates must not be documented as implemented before they exist:

- ReviewNode extraction support.
- tender common-content filter.
- text detector.
- table detector.
- entity and key-fact detector.
- finding aggregator.
- deterministic risk engine.

V0.3.1 target:

- embedding provider contracts.
- BGE-M3 ONNX provider.
- semantic Top-K and hybrid reranking.

## Ownership Boundaries

Rust owns:

- deterministic extraction, detection, aggregation and risk rules.
- sparse candidate generation and conflict resolution.
- model/provider contracts and inference in V0.3.1.
- cancellation checks and progress production.

Electron Main owns:

- file validation and parser orchestration.
- SQLite, encryption and retention.
- model package lifecycle and cache orchestration.
- project checkpoints and report export.

Rust must not directly access the application SQLite database or Windows `safeStorage`.

## JSON-RPC Rules

- The root binary reads newline-delimited JSON-RPC from stdin and writes responses/events to stdout.
- Stdout is protocol-only. Diagnostics go to stderr.
- Every task request carries a stable task/project ID.
- Long loops check cancellation and emit progress heartbeats.
- Errors are structured and mapped to Shared error semantics.
- TypeScript uses camelCase; Rust uses snake_case with explicit serde/adaptation boundaries.
- Binary vector payloads in V0.3.1 use a documented binary encoding, not JSON float arrays.

Current protocol behavior must remain backward-compatible while the risk protocol is introduced. Do not remove compare methods before the RiskFinding evidence workflow has replaced their product usage.

## Detection Rules

V0.3.0:

- Only compare nodes from different submissions.
- Use sparse indexes; do not build an unconditional full `N x M` matrix.
- Preserve independent lexical, structural, entity, fact and discount contributions.
- Tender-filtered evidence remains reviewable.
- Merge duplicate detector hits into one Finding while retaining all bases.
- Project risk is not a simple count sum.
- Partial detector execution produces incomplete assessment, never normal low risk.
- Equal inputs and versions produce deterministic output.

V0.3.1:

- Semantic output is an additional candidate/score source.
- Fatal provider errors discard partial semantic output and trigger an explicit lexical fallback or task failure.
- Cache keys include document, node text, section context, model, tokenizer, chunking and normalization versions.

## Build And Test

```powershell
cargo build --manifest-path bidlens-engine/Cargo.toml
cargo build --release --manifest-path bidlens-engine/Cargo.toml
cargo test --manifest-path bidlens-engine/Cargo.toml
cargo clippy --manifest-path bidlens-engine/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path bidlens-engine/Cargo.toml -- --check
```

Required coverage includes:

- detector normalization and boundary cases.
- deterministic ordering and aggregation.
- cross-language field mapping.
- JSON-RPC framing, errors, progress and cancellation.
- malformed input and engine shutdown.
- V0.3.1 provider dimensions, normalization, batching, OOM and fallback.

## Documentation

- Product: `docs/product/PRD-v0.3-similarity-risk-review.md`
- Architecture: `docs/architecture.md`
- Rust design: `docs/02-模块设计-Rust引擎.md`
- JSON-RPC API: `docs/api/rust.md`
- Semantic design reference: `docs/superpowers/specs/2026-07-19-bidlens-v03-semantic-matching-design.md`
