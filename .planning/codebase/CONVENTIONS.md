# Coding Conventions

**Analysis Date:** 2026-07-22

## Naming Patterns

**Files:**
- kebab-case for all TypeScript files: `result-store.ts`, `keyboard-handler.tsx`, `file-validator.ts`
- Test files use `.test.ts` / `.test.tsx` suffix, co-located with source: `result-store.test.ts` next to `result-store.ts`
- Rust files use snake_case: `document_ast.rs`, `diff_engine.rs`

**Functions:**
- camelCase for all functions: `validateFile()`, `parseDocumentXmlToAst()`, `createError()`
- React components use PascalCase: `TableCellView`, `FilterBar`, `KeyboardHandler`
- Zustand stores use `use` prefix: `useAppStore`, `useResultStore`

**Variables:**
- camelCase for variables and parameters: `filePath`, `matchType`, `selectedItemId`
- UPPER_SNAKE_CASE for constants: `MAX_FILE_SIZE_BYTES`, `FILTER_STORAGE_KEY`, `ALL_MATCH_TYPES`

**Types:**
- PascalCase for interfaces and types: `DiffItem`, `ReviewAnnotation`, `FileValidationResult`
- Union types use string literals: `'identical' | 'modified' | 'added'`
- Generic type parameters: single uppercase letter `K`, `T`, or descriptive `TState`

## Code Style

**Formatting:**
- No Prettier or ESLint config detected at project root
- TypeScript strict mode enabled in all tsconfigs (`"strict": true`)
- Indentation: 2 spaces (consistent across all files)
- Single quotes for strings in TypeScript
- Trailing commas in multi-line structures

**Linting:**
- No ESLint configuration found
- Lint check via TypeScript compiler: `tsc -p tsconfig.json --noEmit`
- Rust: standard `cargo clippy` conventions

## Import Organization

**Order:**
1. External packages (`react`, `zustand`, `@radix-ui/*`, `vitest`)
2. Internal workspace packages (`@bidlens/shared`, `@bidlens/shared/types-only`)
3. Relative imports (`./`, `../../`)
4. Type-only imports use `import type` syntax

**Path Aliases:**
- `@/*` maps to `apps/desktop/src/renderer/*` (configured in tsconfig and vite)
- Shared package accessed via `@bidlens/shared` and `@bidlens/shared/types-only`
- Rust uses path dependencies: `document-ast = { path = "crates/document-ast" }`

**ESM Conventions:**
- All TypeScript modules use ESM (`"type": "module"` in package.json)
- Import extensions required for relative imports in shared package: `./compare-task.js`
- Desktop renderer uses Vite bundler resolution (no extensions needed)

## Error Handling

**Patterns:**
- Structured errors with error codes: `createError('FILE_NOT_FOUND', message, { retryable: false })`
- Error codes defined as union type in `packages/shared/src/compare-task.ts`: `ErrorCode`
- Factory function pattern: `createError()` in `packages/shared/src/errors.ts`
- Try-catch with early return for validation: see `apps/desktop/src/main/services/file-validator.ts`
- Rust uses `anyhow` for error handling with `Result<T>` return types

**Error Structure:**
```typescript
interface StructuredError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  phase?: ComparePhase;
  diagnosticId?: string;
}
```

## Logging

**Framework:** `console.log` / `console.error` / `console.warn`

**Patterns:**
- Main process uses prefixed logs: `console.log('[Main] Creating window')`
- Renderer console messages forwarded to main via `console-message` event
- No structured logging framework

## State Management

**Zustand Stores:**
- Location: `apps/desktop/src/renderer/stores/`
- Pattern: `create<StateInterface>((set, get) => ({ ... }))`
- Pure helper functions for derived state (no side-effects in helpers)
- Filter state persisted to `localStorage` with serialization/deserialization helpers
- Store actions are methods on the state object

**Store Structure:**
```typescript
// State interface first
interface ResultState {
  result: CompareResult | null;
  items: DiffItem[];
  // ...actions
  loadResult: (result: CompareResult) => void;
}

// Pure helpers (no side-effects)
function buildItemMap(items: DiffItem[]): ItemMap { ... }

// Store creation
export const useResultStore = create<ResultState>((set, get) => ({
  result: null,
  loadResult: (result) => { ... },
}));
```

## Component Patterns

**React Components:**
- Functional components only (no class components)
- `React.forwardRef` for UI primitives that need ref forwarding
- `displayName` set on forwarded components
- Props interfaces defined inline or exported separately

**UI Components (shadcn-style):**
- Location: `apps/desktop/src/renderer/components/ui/`
- Use `class-variance-authority` (cva) for variant definitions
- Use `cn()` utility from `@/lib/utils` for class merging
- CSS custom properties for theming: `var(--color-accent)`, `var(--color-border)`
- Tailwind 4 with `@tailwindcss/vite` plugin

**Component File Structure:**
```
components/
├── ui/              # Reusable primitives (button, badge, dialog)
├── feedback/        # Error boundaries, loading states, banners
├── layout/          # App shell, top bar
└── [feature].tsx    # Feature-specific components
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Barrel files: `packages/shared/src/index.ts` re-exports all modules
- Type-only exports via `types-only.ts` for tree-shaking
- UI components export both component and variants: `export { Button, buttonVariants }`

**Shared Package:**
- Dual ESM/CJS build: `tsc -p tsconfig.json && tsc -p tsconfig.cjs.json`
- Entry points: `.` and `./types-only`
- All types defined in shared, consumed by desktop

## Comments

**When to Comment:**
- JSDoc for public API functions and interfaces
- Section dividers using `// ---------------------------------------------------------------------------`
- Chinese comments for domain-specific explanations in parser/registry code
- English for code-level comments

**JSDoc Pattern:**
```typescript
/**
 * Validate a single file and detect its capabilities
 */
export async function validateFile(filePath: string): Promise<FileValidationResult> {
```

## IPC Conventions

**Pattern:**
- IPC contracts defined in `packages/shared/src/ipc.ts`
- Request/Response interfaces: `CreateRiskProjectRequest` / `CreateRiskProjectResponse`
- Handler registration: `registerCompareHandlers(win)` in main process
- Preload bridges via `contextBridge.exposeInMainWorld('bidlens', api)`
- Event subscriptions return unsubscribe function: `onRiskProgress(handler): () => void`

## TypeScript Configuration

**Renderer (Vite):**
- Target: ES2022, Module: ESNext, JSX: react-jsx
- Strict mode, noEmit (Vite handles bundling)
- Path alias: `@/*` -> `src/renderer/*`

**Main Process (Electron):**
- Target: ES2022, Module: CommonJS, ModuleResolution: Node
- Strict mode, esModuleInterop
- Output to `dist/`

**Shared Package:**
- Target: ES2022, Module: ESNext, ModuleResolution: Bundler
- Strict mode, declaration generation
- Dual build for ESM (`dist/`) and CJS (`dist/cjs/`)

---

*Convention analysis: 2026-07-22*
