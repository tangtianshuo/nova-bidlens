# 测试模式

**分析日期：** 2026-07-22

## 测试框架

**运行器：**
- Vitest 2.1.8 用于 TypeScript 测试
- Playwright 用于 E2E 测试（仅桌面应用）
- Cargo test 用于 Rust 引擎

**断言库：**
- Vitest 内置：`expect` 来自 `vitest`
- `@testing-library/jest-dom/vitest` 用于 DOM 匹配器（在 `apps/desktop/src/test-setup.ts` 中设置）
- `@testing-library/react` 用于 React 组件测试

**运行命令：**
```bash
pnpm test              # 运行所有测试（TS + Rust + integration + E2E）
pnpm test:ts           # shared + desktop 单元测试
pnpm test:rust         # cargo test Rust 引擎
pnpm test:integration  # vitest run tests/integration
pnpm test:e2e          # vitest run tests/e2e

# 单个包
pnpm --filter @bidlens/shared test    # 共享包测试
pnpm --filter @bidlens/desktop test   # 桌面测试（vitest run）

# Rust
cargo test --manifest-path bidlens-engine/Cargo.toml

# V0.3 专用
pnpm test:v03:metrics  # 金标评估测试
pnpm test:v03:phase0   # Phase 0 门控测试
```

## 测试文件组织

**位置：**
- 单元测试：与源文件共置（同一目录）
- 集成测试：`tests/integration/`
- E2E 测试：`tests/e2e/`
- 基准测试：`tests/benchmark/`
- V0.3 评估：`tests/v03/`

**命名：**
- 模式：`{module-name}.test.ts` 或 `{module-name}.test.tsx`
- 示例：`result-store.test.ts`、`keyboard-handler.test.tsx`、`docx-parser.test.ts`

**结构：**
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

## 测试配置

**桌面 Vitest 配置：**
- 文件：`apps/desktop/vitest.config.ts`
- 环境：`jsdom`
- 设置文件：`apps/desktop/src/test-setup.ts`
- 包含：`src/**/*.test.ts`、`src/**/*.test.tsx`、`scripts/**/*.test.ts`
- 路径别名：`@` -> `src/renderer`

**共享包 Vitest 配置：**
- 无显式配置（使用 vitest 默认值）
- 通过在包目录中运行 `vitest run` 执行测试

**Playwright 配置：**
- 文件：`apps/desktop/playwright.config.ts`
- 测试目录：`./tests/e2e`
- 超时：每测试 60 秒，expect 10 秒
- 串行执行（Electron 要求）：`fullyParallel: false`、`workers: 1`
- 重试：0

**Rust 测试配置：**
- 标准 `cargo test`，workspace resolver 2
- 测试在 `#[cfg(test)] mod tests { ... }` 块中

## 测试结构

**套件组织：**
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

**模式：**
- `describe` 块用于分组相关测试
- `it` 块用于单个测试用例（不用 `test`）
- `beforeEach` 用于设置，`afterEach` 用于清理
- 测试文件顶部的辅助函数用于创建测试数据

**React 组件测试：**
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

## Mock

**框架：** Vitest 内置 `vi` 对象

**模式：**
```typescript
// Mock 整个模块
vi.mock('fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    access: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  };
});

// Mock 特定函数
vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 } as never);

// 监视方法
const spy = vi.spyOn(event, 'preventDefault');

// 测试间清除 mock
beforeEach(() => {
  vi.clearAllMocks();
});
```

**需要 Mock 的：**
- 文件系统操作（`fs/promises`）
- Electron API（`app`、`BrowserWindow`）
- 外部服务和网络调用
- 用于隔离单元测试的模块级依赖

**不需要 Mock 的：**
- 纯工具函数
- 类型定义
- 测试辅助函数

## Fixture 和工厂

**测试数据：**
```typescript
// 测试数据工厂函数
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

// Fixture 数组
const ITEMS: DiffItem[] = [
  makeDiffItem({ matchId: 'item-1', matchType: 'identical', summary: '第一章 总则' }),
  makeDiffItem({ matchId: 'item-2', matchType: 'modified', summary: '第二章', similarity: 0.8 }),
];
```

**位置：**
- 内联在测试文件中（无独立 fixture 文件）
- 测试文件顶部的辅助函数
- `tests/` 目录中的共享 fixture 使用内联构造

## 覆盖率

**要求：** 未强制（未配置覆盖率阈值）

**查看覆盖率：**
```bash
# 未配置 - 需要 vitest --coverage 标志
# package.json 中无覆盖率脚本
```

## 测试类型

**单元测试：**
- 范围：单个函数、组件、store
- 位置：与源文件共置
- 框架：Vitest + Testing Library（React）
- 示例：`result-store.test.ts`、`keyboard-handler.test.tsx`、`file-validator.test.ts`

**集成测试：**
- 范围：跨模块工作流（parser -> diff -> report）
- 位置：`tests/integration/`
- 框架：Vitest
- 示例：`comparison-flow.test.ts`、`resilience-stress.test.ts`

**E2E 测试：**
- 范围：完整应用工作流
- 位置：`tests/e2e/`
- 框架：Playwright（Electron）
- 示例：`v022-workflow.test.ts`、`document-comparison-workflow.test.ts`
- 注意：E2E 测试使用 vitest 风格导入但通过 Playwright 运行

**基准测试：**
- 范围：性能回归检测
- 位置：`tests/benchmark/`
- 框架：Vitest 配合自定义 `benchmark-harness`
- 示例：`performance.test.ts`

**V0.3 评估测试：**
- 范围：相似性检测的金标评估
- 位置：`tests/v03/`
- 框架：Vitest
- 示例：`evaluate-gold.test.ts`、`jaccard-baseline.test.ts`

**Rust 测试：**
- 范围：Document AST 序列化、差异算法
- 位置：内联 `#[cfg(test)]` 模块
- 框架：`cargo test` 配合 `assert_eq!`、`assert!`
- 示例：`bidlens-engine/crates/document-ast/src/lib.rs`

## 常见模式

**异步测试：**
```typescript
it('returns FILE_NOT_FOUND when file does not exist', async () => {
  vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
  const result = await validateFile('/nonexistent/file.docx');
  expect(result.exists).toBe(false);
  expect(result.error?.code).toBe('FILE_NOT_FOUND');
});
```

**错误测试：**
```typescript
it('returns FILE_TOO_LARGE when file exceeds 100MB', async () => {
  vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
  vi.mocked(fs.stat).mockResolvedValueOnce({ size: 200 * 1024 * 1024 } as never);
  const result = await validateFile('/large/file.docx');
  expect(result.exceedsLimit).toBe(true);
  expect(result.error?.code).toBe('FILE_TOO_LARGE');
});
```

**Store 测试：**
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

**组件事件测试：**
```typescript
it('calls onCellClick when clicked', () => {
  const onClick = vi.fn();
  const { container } = render(<Component content="test" onCellClick={onClick} />);
  fireEvent.click(container.querySelector('td')!);
  expect(onClick).toHaveBeenCalledWith([2, 3]);
});
```

**键盘事件测试：**
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

**Rust 序列化往返测试：**
```rust
#[test]
fn test_serialization_roundtrip() {
  let format = TextFormat { bold: Some(true), ... };
  let json = serde_json::to_string(&format).unwrap();
  let deserialized: TextFormat = serde_json::from_str(&json).unwrap();
  assert_eq!(format, deserialized);
}
```

## 测试工具

**设置文件：**
- `apps/desktop/src/test-setup.ts`：导入 `@testing-library/jest-dom/vitest` 用于 DOM 匹配器

**辅助函数：**
- `cn()` 来自 `@/lib/utils`，用于测试中的类名合并
- 自定义 `renderHandler()` 模式用于带 mock 回调的组件测试
- 工厂函数（`makeDiffItem`、`makeCompareResult`）用于测试数据

## 差距和说明

**测试良好的部分：**
- Zustand store（result-store、app-store）覆盖了全面的边界用例
- UI 组件（TableCellView、KeyboardHandler、FilterBar）
- 文件校验服务
- 文档解析（docx-parser）
- 报告生成
- 集成流程

**测试覆盖差距：**
- 未强制覆盖率阈值
- 未配置覆盖率报告
- 部分 IPC 处理器测试可能缺失
- E2E 测试较少（Playwright 配置存在但测试有限）
- 无视觉回归测试

**测试约定：**
- 使用 `it()` 而非 `test()` 作为测试块
- 使用 `describe()` 进行分组
- 测试 fixture 中使用中文文本（领域适配）
- `vi.fn()` 用于 mock 函数，`vi.mock()` 用于模块 mock
- React 测试中 `afterEach` 使用 `cleanup()` from Testing Library

---

*测试分析：2026-07-22*
