# Testing Patterns

**Analysis Date:** 2026-07-22

## Test Framework

**Runner:**
- Vitest 2.1.8 for TypeScript tests
- Playwright for E2E tests (desktop only)
- Cargo test for Rust engine

**Assertion Library:**
- Vitest built-in: `expect` from `vitest`
- `@testing-library/jest-dom/vitest` for DOM matchers (setup in `apps/desktop/src/test-setup.ts`)
- `@testing-library/react` for React component testing

**Run Commands:**
```bash
pnpm test              # Run all tests (TS + Rust + integration + E2E)
pnpm test:ts           # shared + desktop unit tests
pnpm test:rust         # cargo test for Rust engine
pnpm test:integration  # vitest run tests/integration
pnpm test:e2e          # vitest run tests/e2e

# Individual packages
pnpm --filter @bidlens/shared test    # shared package tests
pnpm --filter @bidlens/desktop test   # desktop tests (vitest run)

# Rust
cargo test --manifest-path bidlens-engine/Cargo.toml

# V0.3 specific
pnpm test:v03:metrics  # Gold standard evaluation tests
pnpm test:v03:phase0   # Phase 0 gate tests
```

## Test File Organization

**Location:**
- Unit tests: co-located with source files (same directory)
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
- Benchmark tests: `tests/benchmark/`
- V0.3 evaluation: `tests/v03/`

**Naming:**
- Pattern: `{module-name}.test.ts` or `{module-name}.test.tsx`
- Examples: `result-store.test.ts`, `keyboard-handler.test.tsx`, `docx-parser.test.ts`

**Structure:**
```
apps/desktop/src/
├── main/
│   ├── parser/
│   │   ├── docx-parser.ts
│   │   └── docx-parser.test.ts
│   └── services/
│       ├── file-validator.ts
│       └── file-validator.test.ts
├── renderer/
│   ├── stores/
│   │   ├── result-store.ts
│   │   └── result-store.test.ts
│   ├── features/
│   │   └── review/
│   │       ├── keyboard-handler.tsx
│   │       └── keyboard-handler.test.tsx
│   └── components/
│       ├── TableCellView.tsx
│       └── TableCellView.test.tsx
└── smoke.test.ts

packages/shared/src/
├── diff-ast.ts
├── diff-ast.test.ts
├── parser/
│   ├── docx-format.ts
│   └── docx-format.test.ts
└── index.test.ts

tests/
├── integration/
│   ├── comparison-flow.test.ts
│   └── resilience-stress.test.ts
├── e2e/
│   └── v022-workflow.test.ts
└── benchmark/
    └── performance.test.ts
```

## Test Configuration

**Desktop Vitest Config:**
- File: `apps/desktop/vitest.config.ts`
- Environment: `jsdom`
- Setup file: `apps/desktop/src/test-setup.ts`
- Includes: `src/**/*.test.ts`, `src/**/*.test.tsx`, `scripts/**/*.test.ts`
- Path alias: `@` -> `src/renderer`

**Shared Vitest Config:**
- No explicit config (uses vitest defaults)
- Tests run via `vitest run` in package directory

**Playwright Config:**
- File: `apps/desktop/playwright.config.ts`
- Test dir: `./tests/e2e`
- Timeout: 60s per test, 10s for expects
- Serial execution (Electron requirement): `fullyParallel: false`, `workers: 1`
- Retries: 0

**Rust Test Config:**
- Standard `cargo test` with workspace resolver 2
- Tests in `#[cfg(test)] mod tests { ... }` blocks

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('Component/Module Name', () => {
  describe('feature group', () => {
    it('specific behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**Patterns:**
- `describe` blocks for grouping related tests
- `it` blocks for individual test cases (not `test`)
- `beforeEach` for setup, `afterEach` for cleanup
- Helper functions at top of file for test data creation

**React Component Tests:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders content', () => {
    render(<ComponentName prop="value" />);
    expect(screen.getByText('value')).toBeTruthy();
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    render(<ComponentName onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

## Mocking

**Framework:** Vitest built-in `vi` object

**Patterns:**
```typescript
// Mock entire module
vi.mock('fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    access: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  };
});

// Mock specific functions
vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 } as never);

// Spy on methods
const spy = vi.spyOn(event, 'preventDefault');

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

**What to Mock:**
- File system operations (`fs/promises`)
- Electron APIs (`app`, `BrowserWindow`)
- External services and network calls
- Module-level dependencies for isolated unit tests

**What NOT to Mock:**
- Pure utility functions
- Type definitions
- Test helper functions

## Fixtures and Factories

**Test Data:**
```typescript
// Factory functions for test data
function makeDiffItem(overrides: Partial<DiffItem> & { matchId: string; matchType: MatchType }): DiffItem {
  return {
    confidence: 1.0,
    similarity: 1.0,
    sourceA: null,
    sourceB: null,
    nodeIdsA: [],
    nodeIdsB: [],
    diffDetail: [],
    summary: `Item ${overrides.matchId}`,
    ...overrides,
  };
}

// Fixture arrays
const ITEMS: DiffItem[] = [
  makeDiffItem({ matchId: 'item-1', matchType: 'identical', summary: '第一章 总则' }),
  makeDiffItem({ matchId: 'item-2', matchType: 'modified', summary: '第二章', similarity: 0.8 }),
];
```

**Location:**
- Inline in test files (no separate fixture files)
- Helper functions at top of test file
- Shared fixtures in `tests/` directories use inline construction

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
```bash
# Not configured - would need vitest --coverage flag
# No coverage scripts in package.json
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, components, stores
- Location: Co-located with source
- Framework: Vitest + Testing Library (React)
- Examples: `result-store.test.ts`, `keyboard-handler.test.tsx`, `file-validator.test.ts`

**Integration Tests:**
- Scope: Cross-module workflows (parser -> diff -> report)
- Location: `tests/integration/`
- Framework: Vitest
- Examples: `comparison-flow.test.ts`, `resilience-stress.test.ts`

**E2E Tests:**
- Scope: Full application workflows
- Location: `tests/e2e/`
- Framework: Playwright (Electron)
- Examples: `v022-workflow.test.ts`, `document-comparison-workflow.test.ts`
- Note: E2E tests use vitest-style imports but run through Playwright

**Benchmark Tests:**
- Scope: Performance regression detection
- Location: `tests/benchmark/`
- Framework: Vitest with custom `benchmark-harness`
- Examples: `performance.test.ts`

**V0.3 Evaluation Tests:**
- Scope: Gold standard evaluation for similarity detection
- Location: `tests/v03/`
- Framework: Vitest
- Examples: `evaluate-gold.test.ts`, `jaccard-baseline.test.ts`

**Rust Tests:**
- Scope: Document AST serialization, diff algorithms
- Location: Inline `#[cfg(test)]` modules
- Framework: `cargo test` with `assert_eq!`, `assert!`
- Examples: `bidlens-engine/crates/document-ast/src/lib.rs`

## Common Patterns

**Async Testing:**
```typescript
it('returns FILE_NOT_FOUND when file does not exist', async () => {
  vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
  const result = await validateFile('/nonexistent/file.docx');
  expect(result.exists).toBe(false);
  expect(result.error?.code).toBe('FILE_NOT_FOUND');
});
```

**Error Testing:**
```typescript
it('returns FILE_TOO_LARGE when file exceeds 100MB', async () => {
  vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
  vi.mocked(fs.stat).mockResolvedValueOnce({ size: 200 * 1024 * 1024 } as never);
  const result = await validateFile('/large/file.docx');
  expect(result.exceedsLimit).toBe(true);
  expect(result.error?.code).toBe('FILE_TOO_LARGE');
});
```

**Store Testing:**
```typescript
beforeEach(() => {
  useResultStore.setState({ result: null, items: [], filteredItems: [] });
});

it('loads result correctly', () => {
  const result = makeCompareResult();
  useResultStore.getState().loadResult(result);
  expect(useResultStore.getState().items).toHaveLength(10);
});
```

**Component Event Testing:**
```typescript
it('calls onCellClick when clicked', () => {
  const onClick = vi.fn();
  const { container } = render(<Component content="test" onCellClick={onClick} />);
  fireEvent.click(container.querySelector('td')!);
  expect(onClick).toHaveBeenCalledWith([2, 3]);
});
```

**Keyboard Event Testing:**
```typescript
function pressKey(key: string, options: KeyboardEventInit = {}) {
  fireEvent.keyDown(document, { key, ...options });
}

it('calls onSelectNext on ArrowDown', () => {
  const { onSelectNext } = renderHandler();
  pressKey('ArrowDown');
  expect(onSelectNext).toHaveBeenCalledTimes(1);
});
```

**Rust Serialization Roundtrip:**
```typescript
#[test]
fn test_serialization_roundtrip() {
  let format = TextFormat { bold: Some(true), ... };
  let json = serde_json::to_string(&format).unwrap();
  let deserialized: TextFormat = serde_json::from_str(&json).unwrap();
  assert_eq!(format, deserialized);
}
```

## Test Utilities

**Setup File:**
- `apps/desktop/src/test-setup.ts`: Imports `@testing-library/jest-dom/vitest` for DOM matchers

**Helper Functions:**
- `cn()` from `@/lib/utils` for class name merging in tests
- Custom `renderHandler()` pattern for component tests with mock callbacks
- Factory functions (`makeDiffItem`, `makeCompareResult`) for test data

## Gaps and Notes

**What's Well Tested:**
- Zustand stores (result-store, app-store) with comprehensive edge cases
- UI components (TableCellView, KeyboardHandler, FilterBar)
- File validation service
- Document parsing (docx-parser)
- Report generation
- Integration flows

**Test Coverage Gaps:**
- No enforced coverage thresholds
- No coverage reporting configured
- Some IPC handler tests may be missing
- E2E tests are minimal (Playwright config exists but limited tests)
- No visual regression testing

**Testing Conventions:**
- Use `it()` not `test()` for test blocks
- Use `describe()` for grouping
- Chinese text in test fixtures (domain-appropriate)
- `vi.fn()` for mock functions, `vi.mock()` for module mocks
- `cleanup()` from Testing Library in `afterEach` for React tests

---

*Testing analysis: 2026-07-22*
