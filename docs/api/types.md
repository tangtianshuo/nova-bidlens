# TypeScript 类型定义

> 版本：v1.0 | 最后更新：2026-07-17
> 源码：packages/shared/src/

---

## 一、文档类型

### 1.1 DocumentAst

```typescript
interface DocumentAst {
  id: string;
  filename: string;
  sha256: string;
  pageCount: number | null;
  wordCount: number;
  parserVersion: string;
  blocks: BlockNode[];
}
```

### 1.2 BlockNode

```typescript
type BlockNode = ParagraphNode | SectionNode | ListNode | TableNode;

interface ParagraphNode {
  type: 'paragraph';
  id: NodeId;
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
}

interface SectionNode {
  type: 'section';
  id: NodeId;
  title: string;
  level: number;
  children: BlockNode[];
  pageStart: number | null;
  pageEnd: number | null;
}

interface ListNode {
  type: 'list';
  id: NodeId;
  ordered: boolean;
  items: ParagraphNode[];
  pageStart: number | null;
  pageEnd: number | null;
}

interface TableNode {
  type: 'table';
  id: NodeId;
  rows: string[][];
  pageStart: number | null;
  pageEnd: number | null;
}
```

---

## 二、差异类型

### 2.1 DiffAst

```typescript
interface DiffAst {
  taskId: string;
  docAId: string;
  docBId: string;
  items: DiffItem[];
  summary: DiffSummary;
}
```

### 2.2 DiffItem

```typescript
interface DiffItem {
  matchId: string;
  matchType: MatchType;
  confidence: number;
  similarity: number;
  sourceA: string | null;
  sourceB: string | null;
  nodeIdsA: string[];
  nodeIdsB: string[];
  summary: string;
  tableDiff?: TableDiffResult;
  formatDiff?: FormatDiffResult;
}

type MatchType = 'identical' | 'modified' | 'added' | 'deleted' | 'moved' | 'split' | 'merged' | 'uncertain';
```

---

## 三、表格差异类型

### 3.1 TableDiffResult

```typescript
interface TableDiffResult {
  cellDiffs: CellDiff[];
  structuralChanges: StructuralChange[];
}

interface CellDiff {
  position: [number, number];  // [row, col]
  changeType: 'added' | 'deleted' | 'modified';
  oldContent?: string;
  newContent?: string;
}
```

---

## 四、格式差异类型

### 4.1 FormatDiffResult

```typescript
interface FormatDiffResult {
  textFormatChanges: TextFormatChange[];
  paragraphFormatChanges: ParagraphFormatChange[];
}

interface TextFormatChange {
  property: string;
  oldValue: any;
  newValue: any;
}
```
