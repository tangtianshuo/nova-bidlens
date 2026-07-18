# 解析器接口文档

> 版本：v1.0 | 最后更新：2026-07-17

---

## 一、概述

解析器接口定义了文档解析的统一契约，所有格式适配器必须实现此接口。

---

## 二、核心接口

### 2.1 DocumentParser

```typescript
interface DocumentParser {
  readonly id: string;
  readonly name: string;
  readonly supportedExtensions: string[];
  readonly mimeTypes: string[];
  readonly priority: number;

  canParse(input: ParseInput): Promise<boolean>;
  parse(input: ParseInput, options: ParseOptions): Promise<ParseResult>;
}
```

### 2.2 ParseInput

```typescript
interface ParseInput {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
}
```

### 2.3 ParseOptions

```typescript
interface ParseOptions {
  fidelityLevel: 1 | 2 | 3 | 4 | 5;
  extractComments: boolean;
  extractRevisions: boolean;
  extractImages: boolean;
  maxPages: number;
  timeout: number;
}
```

### 2.4 ParseResult

```typescript
interface ParseResult {
  success: boolean;
  ast?: DocumentAst;
  warnings: ParseWarning[];
  duration: number;
  parserId: string;
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 三、保真级别

| 级别 | 提取内容 | 典型场景 |
|------|----------|----------|
| L1 | 纯文本 + 段落结构 | 快速概览 |
| L2 | L1 + 基础样式 | 标准比对 |
| L3 | L2 + 完整样式 + 编号 | 精确比对 |
| L4 | L3 + 图片占位 + 表格列宽 | 高保真 |
| L5 | L4 + 批注 + 修订 | 全量提取 |

---

## 四、适配器注册

```typescript
class ParserRegistry {
  register(parser: DocumentParser): void;
  findByExtension(ext: string): DocumentParser | null;
  findById(id: string): DocumentParser | null;
  getAll(): DocumentParser[];
}
```

---

## 五、现有适配器

| 适配器 | 支持格式 | 位置 |
|--------|----------|------|
| DocxParser | .docx | packages/shared/src/parser/ |
| PdfParser | .pdf | packages/shared/src/parser/ |
