# 编码规范

> 版本：v1.0 | 最后更新：2026-07-17

---

## 一、语言规范

### 1.1 项目语言

| 场景 | 语言 | 说明 |
|------|------|------|
| **UI文本** | 中文 (zh-CN) | 界面显示、提示信息 |
| **代码** | 英文 | 变量名、函数名、类名 |
| **注释** | 英文 | 代码注释、JSDoc |
| **提交信息** | 英文 | Git commit message |
| **文档** | 中文 | 设计文档、README |

---

## 二、TypeScript 规范

### 2.1 基本规则

- 使用 ESM 模块系统
- 启用严格模式 (`strict: true`)
- 优先使用 `interface` 而非 `type`
- 避免使用 `any`，使用 `unknown` 代替

### 2.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| **变量** | camelCase | `userName`, `isActive` |
| **函数** | camelCase | `getUserById`, `formatDate` |
| **类** | PascalCase | `UserService`, `DocumentParser` |
| **接口** | PascalCase | `DocumentAst`, `DiffItem` |
| **类型** | PascalCase | `MatchType`, `BlockNode` |
| **常量** | UPPER_SNAKE_CASE | `MAX_PAGES`, `DEFAULT_TIMEOUT` |
| **文件** | kebab-case | `user-service.ts`, `docx-parser.ts` |

### 2.3 导入规范

```typescript
// 1. Node.js 内置模块
import { createHash } from 'crypto';

// 2. 第三方库
import { XMLParser } from 'fast-xml-parser';

// 3. 项目内模块（使用相对路径）
import type { DocumentAst } from '../document-ast.js';

// 4. 类型导入使用 import type
import type { DiffItem } from './types.js';
```

### 2.4 错误处理

```typescript
// 使用 Result 模式
interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}
```

---

## 三、Rust 规范

### 3.1 基本规则

- 遵循 Rust 官方风格指南
- 使用 `rustfmt` 格式化代码
- 使用 `clippy` 进行代码检查

### 3.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| **变量** | snake_case | `user_name`, `is_active` |
| **函数** | snake_case | `get_user_by_id` |
| **结构体** | PascalCase | `DocumentAst` |
| **枚举** | PascalCase | `MatchType` |
| **常量** | SCREAMING_SNAKE_CASE | `MAX_PAGES` |
| **模块** | snake_case | `document_ast` |

### 3.3 错误处理

```rust
// 使用 anyhow 处理应用错误
use anyhow::{Result, Context};

fn parse_document(input: &str) -> Result<DocumentAst> {
    let content = std::fs::read_to_string(input)
        .context("Failed to read file")?;
    Ok(document)
}
```

---

## 四、注释规范

### 4.1 TypeScript 注释

```typescript
/**
 * 解析文档为 AST
 * 
 * @param input - 解析输入
 * @param options - 解析选项
 * @returns 解析结果
 */
async function parseDocument(
  input: ParseInput,
  options: ParseOptions
): Promise<ParseResult> {
  // 实现...
}
```

### 4.2 Rust 注释

```rust
/// 解析文档为 AST
///
/// # Arguments
/// * `input` - 解析输入
///
/// # Returns
/// 解析结果
fn parse_document(input: &str) -> Result<DocumentAst> {
    // 实现...
}
```

---

## 五、提交规范

### 5.1 Commit Message 格式

```
<type>(<scope>): <subject>
```

### 5.2 Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(parser): add PDF support` |
| `fix` | 修复 | `fix(diff): correct table comparison` |
| `docs` | 文档 | `docs: update API documentation` |
| `test` | 测试 | `test(parser): add unit tests` |
| `refactor` | 重构 | `refactor(engine): simplify diff logic` |
| `chore` | 构建/工具 | `chore: update dependencies` |

---

## 六、代码审查清单

- [ ] 命名是否符合规范
- [ ] 是否有适当的注释
- [ ] 错误处理是否完善
- [ ] 是否有单元测试
- [ ] 是否遵循架构约束
- [ ] 是否更新了相关文档
