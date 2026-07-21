# AGENT.md - Shared contracts and logic

> Path: `packages/shared/`
> Updated: 2026-07-21
> Product authority: `docs/product/PRD-v0.3-similarity-risk-review.md`

## Responsibilities

Shared owns cross-layer TypeScript contracts and deterministic reusable logic:

- DocumentAst and DiffAst contracts.
- Risk-review domain and IPC contracts.
- Task, progress, error and report types.
- Parser adapters and pure comparison utilities.
- Browser-safe `types-only` exports.

Shared does not own React UI, Electron handlers, SQLite orchestration or Rust runtime behavior.

## Sources Of Truth

Do not copy type definitions into AGENT or PRD files. Read the real contracts:

- `src/document-ast.ts`
- `src/diff-ast.ts`
- `src/risk-review.ts`
- `src/compare-task.ts`
- `src/ipc.ts`
- `src/types-only.ts`

The PRD defines semantics; these files define field names and wire shapes.

## Current And Target State

Current:

- DocumentAst, DiffAst and the V0.2.2 compare contract are implemented.
- Initial risk summary/detail, Finding, Evidence and `risk:*` IPC types exist.
- DOCX, format, comment, revision, table and text-PDF parser code exists.

Target V0.3.0 additions:

- ReviewNode and extraction provenance.
- Separate ProjectStatus, AnalysisPhase and SubmissionProcessingState.
- FilePairAssessment and ProjectRiskAssessment.
- Independent ReviewDecision with `important` separate from review status.
- Score breakdown, filter reason, structured detector errors and checkpoints.

Target V0.3.1 additions:

- Model identity, semantic coverage, Chunk, vector-cache keys and provider errors.

Do not mark a target contract implemented until it exists in `src/` and has tests.

## Export Boundaries

`@bidlens/shared` is the Node-capable entry. It may include parser modules and Node dependencies.

`@bidlens/shared/types-only` is the renderer-safe entry. It may export:

- TypeScript types.
- Constants.
- Pure JavaScript helpers with no Node dependency.

It must not re-export the full `index.ts` or import Node-only parser dependencies.

When adding a Shared type used by Renderer:

1. Define it in the owning source module.
2. Export it from `src/index.ts` when Node consumers need it.
3. Export it explicitly from `src/types-only.ts` for Renderer.
4. Build Shared before testing Desktop.
5. Check the Vite output for browser externalization warnings.

## Contract Rules

- Use explicit request and response interfaces for IPC.
- Event subscriptions return an unsubscribe function.
- Use structured errors across process boundaries.
- Preserve camelCase in TypeScript and explicit snake_case adapters for Rust.
- Avoid fields with ambiguous legal meaning such as `collusionProbability`.
- Risk review status and algorithm risk are separate.
- `important` is independent from `pending`, `confirmed` and `ignored`.
- Partial analysis must be representable independently of risk level.
- Evidence must retain source document and node identity.

Current Renderer risk creation API is `createRiskProject`, mapped to `risk:createProject`.

## Document Rules

- DocumentAst is the immutable parsed fact used for evidence location.
- ReviewNode is a derived analysis unit and must retain source AST node IDs.
- Derived caches use versioned keys and must be rebuildable.
- DiffAst remains available for evidence-level two-document inspection.
- RiskFinding must not absorb or replace DiffAst semantics.

## Parser Rules

- Parser selection follows the existing registry/adapter pattern.
- Preserve original text and stable node identity.
- Parser warnings and failures are structured.
- Unsupported, encrypted, scanned or damaged files fail explicitly.
- Renderer never imports parser implementations.

Relevant modules include:

- `src/parser/docx/`
- `src/parser/pdf/`
- `src/parser/docx-format.ts`
- `src/parser/docx-table.ts`
- `src/parser/docx-comments.ts`
- `src/parser/docx-revisions.ts`

## Commands

```powershell
pnpm --filter @bidlens/shared build
pnpm --filter @bidlens/shared test
```

## Required Tests

- Public functions and contract helpers require unit tests.
- Boundary and malformed input cases require coverage.
- `types-only` must remain browser-safe.
- Shared/Main/Rust field mapping requires contract tests.
- New parser behavior requires representative fixtures without customer-sensitive data.

## Documentation

- Product: `docs/product/PRD-v0.3-similarity-risk-review.md`
- Architecture: `docs/architecture.md`
- IPC: `docs/api/ipc.md`
- Types: `docs/api/types.md`
- Parser contracts: `docs/api/parser.md`
