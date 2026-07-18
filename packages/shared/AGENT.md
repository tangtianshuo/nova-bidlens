# AGENT.md - Shared 共享层

> 层级：共享类型与逻辑
> 路径：packages/shared/
> 最后更新：2026-07-17

---

## 一、模块概述

### 1.1 职责

Shared模块是BidLens的核心共享层，负责：
- 定义所有数据类型（Document AST、Diff AST、Table Diff等）
- 定义IPC通信契约（BidLensApi接口）
- 实现纯逻辑功能（差异计算、解析器）
- 跨平台兼容（可在Node.js和浏览器运行）

### 1.2 设计原则

- **零依赖**：不依赖任何UI框架（React、Electron）
- **纯TypeScript**：使用ESM，严格类型
- **可测试**：所有函数都有单元测试
- **向后兼容**：类型扩展不破坏现有接口

### 1.3 目录结构

`
packages/shared/
├── src/
│   ├── index.ts              # 主入口
│   ├── ipc.ts                # IPC契约定义
│   ├── document-ast.ts       # Document AST类型
│   ├── diff-ast.ts           # Diff AST类型
│   ├── table-diff.ts         # Table Diff类型与工具
│   ├── parser/
│   │   ├── docx-table.ts     # Word表格解析
│   │   ├── docx-table.test.ts
│   │   ├── docx-format.ts    # 格式解析（规划中）
│   │   └── pdf-parser.ts     # PDF解析（规划中）
│   └── utils/
│       ├── similarity.ts     # 相似度算法
│       └── diff-helpers.ts   # 差异工具函数
├── dist/                     # 构建产物
├── package.json
└── tsconfig.json
`

---

## 二、核心类型定义

### 2.1 Document AST

`	ypescript
// document-ast.ts
export interface DocumentAst {
    id: string;
    filename: string;
    sha256: string;
    pageCount?: number;
    wordCount: number;
    parserVersion: string;
    blocks: BlockNode[];
}

export type BlockNode = 
    | { type: 'paragraph'; } & ParagraphNode
    | { type: 'table'; } & TableNode
    | { type: 'heading'; } & HeadingNode
    | { type: 'list'; } & ListNode;

export interface ParagraphNode {
    id: string;
    runs: RunNode[];
    pageStart?: number;
    pageEnd?: number;
    paragraphFormat?: ParagraphFormat;
}

export interface RunNode {
    id: string;
    text: string;
    format?: TextFormat;
}

export interface TableNode {
    id: string;
    rows: TableRow[];
    pageStart?: number;
    pageEnd?: number;
    properties?: TableProperties;
}

export interface TableRow {
    id: string;
    cells: TableCell[];
    rowType: 'header' | 'body' | 'footer';
}

export interface TableCell {
    id: string;
    content: BlockNode[];
    span?: CellSpan;
    properties?: CellProperties;
    nestedTable?: TableNode;
}

export interface CellSpan {
    rowSpan: number;
    colSpan: number;
}
`

### 2.2 格式类型

`	ypescript
// document-ast.ts (续)
export interface TextFormat {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    strikethrough?: boolean;
}

export interface ParagraphFormat {
    alignment?: 'left' | 'center' | 'right' | 'justify';
    indentLeft?: number;
    indentRight?: number;
    indentFirstLine?: number;
    lineSpacing?: number;
    spaceBefore?: number;
    spaceAfter?: number;
}
`

### 2.3 Diff AST

`	ypescript
// diff-ast.ts
export interface DiffAst {
    taskId: string;
    docAId: string;
    docBId: string;
    items: DiffItem[];
    summary: DiffSummary;
}

export interface DiffItem {
    matchId: string;
    matchType: MatchType;
    confidence: number;
    similarity: number;
    sourceA?: string;
    sourceB?: string;
    nodeIdsA: string[];
    nodeIdsB: string[];
    summary: string;
    tableDiff?: TableDiffResult;
    formatDiffs?: FormatDiff[];
}

export type MatchType = 
    | 'identical'
    | 'modified'
    | 'added'
    | 'deleted'
    | 'moved'
    | 'split'
    | 'merged'
    | 'uncertain';

export interface DiffSummary {
    totalItems: number;
    identicalCount: number;
    modifiedCount: number;
    addedCount: number;
    deletedCount: number;
    movedCount: number;
}
`

### 2.4 Table Diff

`	ypescript
// table-diff.ts
export interface TableDiffResult {
    tableMatchType: TableMatchType;
    structuralChanges: StructuralChange[];
    cellDiffs: CellDiff[];
    confidence: number;
}

export type TableMatchType = 
    | 'identical'
    | 'structure_changed'
    | 'content_changed'
    | 'mixed_changes';

export interface CellDiff {
    position: [number, number]; // [row, col]
    changeType: CellChangeType;
    oldContent?: string;
    newContent?: string;
    similarity: number;
    oldSpan?: CellSpan;
    newSpan?: CellSpan;
    spanChanged: boolean;
    nestedTableDiff?: TableDiffResult;
}

export type CellChangeType = 
    | 'identical'
    | 'modified'
    | 'added'
    | 'deleted'
    | 'span_changed';
`

---

## 三、IPC契约

`	ypescript
// ipc.ts
export interface BidLensApi {
    // 比对任务
    startCompare: (request: CompareRequest) => Promise<{ taskId: string }>;
    cancelCompare: (taskId: string) => Promise<void>;
    onCompareProgress: (callback: (progress: CompareProgress) => void) => void;
    
    // 文件操作
    openFileDialog: () => Promise<string | null>;
    saveFileDialog: (defaultName: string) => Promise<string | null>;
    
    // 导出
    exportReport: (diffAst: DiffAst, format: ExportFormat) => Promise<string>;
}

export interface CompareRequest {
    fileAPath: string;
    fileBPath: string;
    options?: CompareOptions;
}

export interface CompareOptions {
    similarityThreshold?: number;
    enableTableDiff?: boolean;
    enableFormatDiff?: boolean;
    matchStrategy?: 'position' | 'content' | 'hybrid';
    similarityAlgorithm?: 'jaccard' | 'levenshtein' | 'cosine' | 'hybrid';
}

export interface CompareProgress {
    taskId: string;
    stage: 'parsing' | 'comparing' | 'generating';
    progress: number; // 0-100
    message?: string;
}
`

---

## 四、解析器

### 4.1 Word表格解析

`	ypescript
// parser/docx-table.ts
export function parseDocxTable(tableElement: HTMLElement): ParsedTable {
    const rows: ParsedRow[] = [];
    const trElements = tableElement.querySelectorAll('tr');
    
    trElements.forEach((tr, rowIndex) => {
        const cells: ParsedCell[] = [];
        tr.querySelectorAll('td, th').forEach((td) => {
            cells.push({
                id: generateId(),
                content: extractCellContent(td),
                colSpan: parseInt(td.getAttribute('colspan') || '1'),
                rowSpan: parseInt(td.getAttribute('rowspan') || '1'),
            });
        });
        rows.push({ id: generateId(), cells, rowType: detectRowType(tr) });
    });
    
    return { id: generateId(), rows, properties: extractTableProperties(tableElement) };
}

export function convertToTableNode(parsed: ParsedTable): TableNode {
    // 转换为Document AST格式
}
`

### 4.2 格式解析（规划中）

`	ypescript
// parser/docx-format.ts
export function extractTextFormat(element: HTMLElement): TextFormat {
    return {
        bold: isBold(element),
        italic: isItalic(element),
        underline: hasUnderline(element),
        fontFamily: element.style.fontFamily,
        fontSize: parseFloat(element.style.fontSize),
        color: element.style.color,
    };
}

export function extractParagraphFormat(element: HTMLElement): ParagraphFormat {
    return {
        alignment: parseAlignment(element.style.textAlign),
        indentLeft: parseFloat(element.style.marginLeft),
        lineSpacing: parseFloat(element.style.lineHeight),
    };
}
`

---

## 五、工具函数

### 5.1 相似度算法

`	ypescript
// utils/similarity.ts
export function jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

export function levenshteinSimilarity(a: string, b: string): number {
    const distance = levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

export function cosineSimilarity(a: string, b: string): number {
    const vecA = textToVector(a);
    const vecB = textToVector(b);
    return dotProduct(vecA, vecB) / (magnitude(vecA) * magnitude(vecB));
}

export function computeSimilarity(
    a: string, 
    b: string, 
    algorithm: SimilarityAlgorithm
): number {
    switch (algorithm) {
        case 'jaccard': return jaccardSimilarity(a, b);
        case 'levenshtein': return levenshteinSimilarity(a, b);
        case 'cosine': return cosineSimilarity(a, b);
        case 'hybrid': return hybridSimilarity(a, b);
    }
}
`

---

## 六、开发指南

### 6.1 命令

`ash
# 构建
pnpm --filter @bidlens/shared build

# 测试
pnpm --filter @bidlens/shared test

# 类型检查
pnpm --filter @bidlens/shared type-check
`

### 6.2 添加新类型

`	ypescript
// 1. 在对应文件中定义接口
// src/my-types.ts
export interface MyNewType {
    id: string;
    // ...
}

// 2. 在index.ts中导出
// src/index.ts
export { MyNewType } from './my-types';

// 3. 编写测试
// src/my-types.test.ts
`

### 6.3 添加新解析器

`	ypescript
// 1. 创建解析器文件
// src/parser/my-parser.ts
export function parseMyFormat(input: unknown): ParsedResult {
    // 实现解析逻辑
}

// 2. 创建测试文件
// src/parser/my-parser.test.ts

// 3. 导出解析器
// src/index.ts
export { parseMyFormat } from './parser/my-parser';
`

---

## 七、测试

### 7.1 测试覆盖要求

- 所有公共函数必须有单元测试
- 边界情况必须覆盖
- 类型序列化/反序列化必须测试

### 7.2 运行测试

`ash
# 运行所有测试
pnpm --filter @bidlens/shared test

# 运行特定测试
pnpm vitest run packages/shared/src/parser/docx-table.test.ts

# 查看覆盖率
pnpm --filter @bidlens/shared test -- --coverage
`

---

## 八、版本管理

### 8.1 版本号规则

- 主版本：不兼容的API变更
- 次版本：向后兼容的功能新增
- 修订号：向后兼容的问题修正

### 8.2 发布流程

`ash
# 1. 更新版本号
pnpm version patch|minor|major

# 2. 构建
pnpm build

# 3. 发布（如果需要）
pnpm publish
`

---

## 九、相关文档

- [总架构设计](../../docs/01-总体架构设计.md)
- [数据结构设计](../../docs/05-数据结构设计.md)
- [IPC协议设计](../../docs/06-IPC通信协议设计.md)

## 四、导出策略（重要）

### 4.1 双入口导出

Shared 包提供两个导出入口，适应不同运行环境：

| 入口 | 路径 | 适用环境 | 包含内容 |
|------|------|----------|----------|
| **完整导出** | @bidlens/shared | Node.js (主进程) | 类型 + 解析器 + 工具函数 |
| **类型导出** | @bidlens/shared/types-only | 浏览器 (渲染进程) | 仅类型 + 纯 JS 工具函数 |

### 4.2 为什么需要双入口

**问题：** docx4js 等解析器依赖 Node.js 模块（crypto, vents），在浏览器环境中会被 Vite externalize，导致运行时报错。

**解决方案：** 创建 	ypes-only.ts 文件，只导出浏览器安全的内容。

### 4.3 导出内容对照

`typescript
// packages/shared/src/types-only.ts

// ✅ 导出类型（浏览器安全）
export type { DocumentAst, DiffItem, CompareResult } from './...';
export type { ParsedComment } from './parser/docx-comments.js';

// ✅ 导出纯 JS 工具函数（浏览器安全）
export { isTableDiffItem } from './diff-ast.js';
export { getCellChangeColor, getCellDiffTooltip } from './table-diff.js';
export const BIDLENS_VERSION = '0.1.0';

// ❌ 不导出（依赖 Node.js）
// export { Docx4jsParser } from './parser/docx/index.js';
// export { PdfParser } from './parser/pdf/index.js';
// export { parseDocument } from './parser/index.js';
`

### 4.4 新增导出检查清单

**新增类型时：**
- [ ] 类型定义添加到 	ypes-only.ts
- [ ] 使用 xport type 语法

**新增工具函数时：**
- [ ] 检查是否依赖 Node.js 模块
- [ ] 如不依赖，添加到 	ypes-only.ts
- [ ] 如依赖 Node.js，只从 index.ts 导出

**新增解析器时：**
- [ ] 只从 index.ts 导出
- [ ] 不要添加到 	ypes-only.ts

