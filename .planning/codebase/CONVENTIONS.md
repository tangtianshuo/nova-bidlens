# 编码规范

**分析日期：** 2026-07-22

## 命名模式

**文件命名：**
- 所有 TypeScript 文件使用 kebab-case：`result-store.ts`、`keyboard-handler.tsx`、`file-validator.ts`
- 测试文件使用 `.test.ts` / `.test.tsx` 后缀，与源文件共置：`result-store.test.ts` 在 `result-store.ts` 旁边
- Rust 文件使用 snake_case：`document_ast.rs`、`diff_engine.rs`

**函数命名：**
- 所有函数使用 camelCase：`validateFile()`、`parseDocumentXmlToAst()`、`createError()`
- React 组件使用 PascalCase：`TableCellView`、`FilterBar`、`KeyboardHandler`
- Zustand store 使用 `use` 前缀：`useAppStore`、`useResultStore`

**变量命名：**
- 变量和参数使用 camelCase：`filePath`、`matchType`、`selectedItemId`
- 常量使用 UPPER_SNAKE_CASE：`MAX_FILE_SIZE_BYTES`、`FILTER_STORAGE_KEY`、`ALL_MATCH_TYPES`

**类型命名：**
- 接口和类型使用 PascalCase：`DiffItem`、`ReviewAnnotation`、`FileValidationResult`
- 联合类型使用字符串字面量：`'identical' | 'modified' | 'added'`
- 泛型参数：单个大写字母 `K`、`T`，或描述性名称 `TState`

## 代码风格

**格式化：**
- 项目根目录未检测到 Prettier 或 ESLint 配置
- 所有 tsconfig 启用 TypeScript 严格模式（`"strict": true`）
- 缩进：2 空格（所有文件一致）
- 字符串使用单引号
- 多行结构使用尾逗号

**代码检查：**
- 未找到 ESLint 配置
- 通过 TypeScript 编译器进行 lint 检查：`tsc -p tsconfig.json --noEmit`
- Rust：标准 `cargo clippy` 约定

## 导入组织

**顺序：**
1. 外部包（`react`、`zustand`、`@radix-ui/*`、`vitest`）
2. 内部工作区包（`@bidlens/shared`、`@bidlens/shared/types-only`）
3. 相对导入（`./`、`../../`）
4. 仅类型导入使用 `import type` 语法

**路径别名：**
- `@/*` 映射到 `apps/desktop/src/renderer/*`（在 tsconfig 和 vite 中配置）
- 共享包通过 `@bidlens/shared` 和 `@bidlens/shared/types-only` 访问
- Rust 使用路径依赖：`document-ast = { path = "crates/document-ast" }`

**ESM 约定：**
- 所有 TypeScript 模块使用 ESM（package.json 中 `"type": "module"`）
- 共享包中相对导入需要扩展名：`./compare-task.js`
- 桌面渲染器使用 Vite bundler resolution（不需要扩展名）

## 错误处理

**模式：**
- 结构化错误带错误码：`createError('FILE_NOT_FOUND', message, { retryable: false })`
- 错误码定义为联合类型，在 `packages/shared/src/compare-task.ts`：`ErrorCode`
- 工厂函数模式：`packages/shared/src/errors.ts` 中的 `createError()`
- 校验使用 try-catch 提前返回：参见 `apps/desktop/src/main/services/file-validator.ts`
- Rust 使用 `anyhow` 进行错误处理，返回 `Result<T>` 类型

**错误结构：**
```typescript
interface StructuredError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  phase?: ComparePhase;
  diagnosticId?: string;
}
```

## 日志

**框架：** `console.log` / `console.error` / `console.warn`

**模式：**
- 主进程使用带前缀的日志：`console.log('[Main] Creating window')`
- 渲染器控制台消息通过 `console-message` 事件转发到主进程
- 无结构化日志框架

## 状态管理

**Zustand Store：**
- 位置：`apps/desktop/src/renderer/stores/`
- 模式：`create<StateInterface>((set, get) => ({ ... }))`
- 派生状态使用纯函数（辅助函数无副作用）
- 过滤状态持久化到 `localStorage`，带序列化/反序列化辅助函数
- Store action 是状态对象上的方法

**Store 结构：**
```typescript
// 先定义状态接口
interface ResultState {
  result: CompareResult | null;
  items: DiffItem[];
  // ...actions
  loadResult: (result: CompareResult) => void;
}

// 纯辅助函数（无副作用）
function buildItemMap(items: DiffItem[]): ItemMap { ... }

// 创建 store
export const useResultStore = create<ResultState>((set, get) => ({
  result: null,
  loadResult: (result) => { ... },
}));
```

## 组件模式

**React 组件：**
- 仅使用函数组件（无类组件）
- 需要 ref 转发的 UI 原语使用 `React.forwardRef`
- 转发组件设置 `displayName`
- Props 接口内联定义或单独导出

**UI 组件（shadcn 风格）：**
- 位置：`apps/desktop/src/renderer/components/ui/`
- 使用 `class-variance-authority`（cva）定义变体
- 使用 `@/lib/utils` 中的 `cn()` 工具合并类名
- CSS 自定义属性用于主题：`var(--color-accent)`、`var(--color-border)`
- Tailwind 4 配合 `@tailwindcss/vite` 插件

**组件文件结构：**
```
components/
├── ui/              # 可复用原语（button、badge、dialog）
├── feedback/        # 错误边界、加载状态、横幅
├── layout/          # 应用外壳、顶部栏
└── [feature].tsx    # 功能特定组件
```

## 模块设计

**导出方式：**
- 优先使用命名导出而非默认导出
- 桶文件：`packages/shared/src/index.ts` 重新导出所有模块
- 仅类型导出通过 `types-only.ts` 实现 tree-shaking
- UI 组件同时导出组件和变体：`export { Button, buttonVariants }`

**共享包：**
- 双输出 ESM/CJS 构建：`tsc -p tsconfig.json && tsc -p tsconfig.cjs.json`
- 入口点：`.` 和 `./types-only`
- 所有类型在 shared 中定义，由 desktop 消费

## 注释

**何时添加注释：**
- 公共 API 函数和接口使用 JSDoc
- 章节分隔线使用 `// ---------------------------------------------------------------------------`
- 解析器/注册表代码中领域特定解释使用中文注释
- 代码级注释使用英文

**JSDoc 模式：**
```typescript
/**
 * 校验单个文件并检测其能力
 */
export async function validateFile(filePath: string): Promise<FileValidationResult> {
```

## IPC 约定

**模式：**
- IPC 契约定义在 `packages/shared/src/ipc.ts`
- 请求/响应接口：`CreateRiskProjectRequest` / `CreateRiskProjectResponse`
- 处理器注册：主进程中的 `registerCompareHandlers(win)`
- 预加载桥接通过 `contextBridge.exposeInMainWorld('bidlens', api)`
- 事件订阅返回取消订阅函数：`onRiskProgress(handler): () => void`

## TypeScript 配置

**渲染器（Vite）：**
- Target: ES2022, Module: ESNext, JSX: react-jsx
- 严格模式，noEmit（Vite 处理打包）
- 路径别名：`@/*` -> `src/renderer/*`

**主进程（Electron）：**
- Target: ES2022, Module: CommonJS, ModuleResolution: Node
- 严格模式，esModuleInterop
- 输出到 `dist/`

**共享包：**
- Target: ES2022, Module: ESNext, ModuleResolution: Bundler
- 严格模式，生成声明文件
- 双构建 ESM（`dist/`）和 CJS（`dist/cjs/`）

---

*规范分析：2026-07-22*
