# AGENT.md - Rust Engine Layer

> Layer: Rust computation engine
> Path: bidlens-engine/
> Last updated: 2026-07-18 (V0.2.2)

## Overview

The Rust engine is a transport-neutral computation core that performs document comparison. It communicates with Electron via stdio JSON-RPC but the core crates have no transport dependency, enabling future Axum HTTP deployment.

## Workspace Structure

```
bidlens-engine/
├── Cargo.toml              # Workspace config
├── src/
│   ├── main.rs             # stdio JSON-RPC transport adapter
│   └── task_service.rs     # Transport-neutral task service
├── crates/
│   ├── common/             # Shared error types (BidLensError, Result)
│   ├── document-ast/       # AST data structures (paragraphs, tables, comments, revisions)
│   ├── diff-engine/        # Semantic diff algorithm (Jaccard matching)
│   └── table-diff/         # Table-level diff (cell changes, structural alignment)
└── tests/
    ├── json_rpc.rs         # JSON-RPC integration tests (ping, handshake, shutdown)
    └── field_mapping.rs    # TS/Rust field name consistency tests
```

## JSON-RPC Protocol

Methods:
- `ping` → `{ pong: true, engine_version, protocol_version, capabilities }`
- `engine.handshake` → same as ping
- `compare` → `{ diff, duration_ms }` or `{ error }`
- `compare.cancel` → `{ cancelled: bool }`
- `shutdown` → `{ shutting_down: true }` then process exits

Error codes:
- `-32700`: JSON parse error
- `-32601`: Unknown method
- `-32602`: Invalid params
- `-32000`: Compare error
- `-32001`: ENGINE_BUSY (another task running)
- `-32002`: Task cancelled
- `-32003`: Task join error (panic)

Notifications (no `id` field):
- `compare.progress` → `{ task_id, phase, message, current, total }`

## Transport-Neutral Architecture

`task_service.rs` contains:
- `TaskRequest` — input (doc_a, doc_b, options)
- `TaskResult` — output (diff, duration_ms)
- `TaskProgress` — phase updates
- `CancellationToken` — cooperative cancellation via watch channel
- `EngineInfo` — version, protocol, capabilities
- `run_compare()` — runs comparison with progress callback and cancellation check

`main.rs` is the stdio transport adapter. It:
1. Reads JSON-RPC requests from stdin (one per line)
2. Routes to handler by method name
3. Writes JSON-RPC responses/notifications to stdout
4. Manages single-task concurrency (ENGINE_BUSY)
5. Handles shutdown cleanly

## Field Naming Convention

All JSON field names use `snake_case` (Rust) which maps to `camelCase` in TypeScript.
The canonical fixture at `packages/shared/src/__fixtures__/canonical-ast.json` defines the contract.
`tests/field_mapping.rs` verifies Rust serialization matches the fixture.

## Build & Test

```bash
# Build
cargo build --manifest-path bidlens-engine/Cargo.toml

# All tests
cargo test --manifest-path bidlens-engine/Cargo.toml

# Specific crate
cargo test -p document-ast
cargo test -p diff-engine
cargo test -p table-diff

# Integration tests
cargo test --test json_rpc
cargo test --test field_mapping
```

## Key Design Decisions

- Core crates (`document-ast`, `diff-engine`, `table-diff`) have NO dependency on `tokio`, `serde_json` main loop, or stdio
- `common` crate defines `BidLensError` used across all crates
- `diff-engine` uses Jaccard similarity on character sets for paragraph matching
- `table-diff` supports 3 match strategies (Position/Content/Hybrid) and 4 similarity algorithms
- `DocumentAst` uses `runs: Vec<RunNode>` for text (not flat `text` field) — TypeScript must map accordingly
- Comments and revisions are top-level fields on DocumentAst (not nested in blocks)
