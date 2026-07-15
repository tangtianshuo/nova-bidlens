# BidLens 语义比对 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 V0.1 docx 双文档语义比对主链路：解析 Word、生成 Document AST、调用 Rust 生成 Diff AST、在三栏工作台复核，并导出 Markdown/HTML 报告。

**Architecture:** 采用 Electron + React + Node 解析层 + Rust stdio JSON-RPC 引擎。Node 负责文件访问、docx 解析、IPC 编排、SQLite 持久化和报告导出；Rust 负责 chunk、语义匹配、局部 diff 和 Diff AST 生成。

**Tech Stack:** Electron, Vite, React 19, TypeScript, Zustand, TanStack Query, Vitest, Rust 2024, Tokio, serde, uuid, SQLite.

---

## 文件结构

- Create: `package.json` - 根工作区脚本。
- Create: `pnpm-workspace.yaml` - pnpm workspace 配置。
- Create: `packages/shared/src/*` - Document AST、Diff AST、IPC、报告导出共享类型。
- Create: `apps/desktop/src/main/*` - Electron main、docx parser、Rust RPC、IPC handlers、报告导出。
- Create: `apps/desktop/src/preload/index.ts` - 安全暴露 renderer API。
- Create: `apps/desktop/src/renderer/*` - React 比对入口和三栏复核工作台。
- Create: `bidlens-engine/*` - Rust workspace、Diff core、JSON-RPC bridge。
- Create: `fixtures/ast/*` - 小型确定性 AST 测试夹具。

本计划不实现 PDF、rerank、Workflow 插件、规则库审查、LLM 硬判定或 Word 像素级复刻。

---

### Task 1: 初始化工作区

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/vitest.config.ts`
- Create: `bidlens-engine/Cargo.toml`
- Create: `bidlens-engine/src/main.rs`

- [ ] **Step 1: 确认 Git 状态**

Run: `git rev-parse --is-inside-work-tree`

Expected:

```text
true
```

If it fails with `fatal: not a git repository`, run:

```bash
git init
git add docs
git commit -m "docs: capture bidlens semantic compare design"
```

- [ ] **Step 2: 创建 pnpm 根工作区**

Add `package.json`:

```json
{
  "name": "nova-bidlens",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @bidlens/desktop dev",
    "build": "pnpm --filter @bidlens/shared build && pnpm --filter @bidlens/desktop build && cargo build --manifest-path bidlens-engine/Cargo.toml",
    "test": "pnpm test:ts && pnpm test:rust",
    "test:ts": "pnpm --filter @bidlens/shared test && pnpm --filter @bidlens/desktop test",
    "test:rust": "cargo test --manifest-path bidlens-engine/Cargo.toml"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "typescript": "^5.7.2"
  }
}
```

Add `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 3: 创建 TypeScript 包骨架**

Add `packages/shared/package.json`:

```json
{
  "name": "@bidlens/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

Add `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Add `packages/shared/src/index.ts`:

```ts
export const BIDLENS_VERSION = '0.1.0';
```

- [ ] **Step 4: 创建 desktop 包骨架**

Add `apps/desktop/package.json`:

```json
{
  "name": "@bidlens/desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@bidlens/shared": "workspace:*",
    "@tanstack/react-query": "^5.64.2",
    "electron": "^33.2.1",
    "fast-xml-parser": "^4.5.1",
    "jszip": "^3.10.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

Add `apps/desktop/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

Add `apps/desktop/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
```

- [ ] **Step 5: 创建 Rust workspace 骨架**

Add `bidlens-engine/Cargo.toml`:

```toml
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.package]
version = "0.1.0"
edition = "2024"

[workspace.dependencies]
anyhow = "1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }

[package]
name = "bidlens-engine"
version.workspace = true
edition.workspace = true

[dependencies]
anyhow.workspace = true
serde.workspace = true
serde_json.workspace = true
tokio.workspace = true
```

Add `bidlens-engine/src/main.rs`:

```rust
use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    Ok(())
}
```

- [ ] **Step 6: 验证**

Run: `pnpm install`

Expected:

```text
Done
```

Run: `cargo test --manifest-path bidlens-engine/Cargo.toml`

Expected:

```text
test result: ok
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml packages apps bidlens-engine
git commit -m "chore: bootstrap bidlens workspace"
```

---

### Task 2: 共享领域契约

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/document-ast.ts`
- Create: `packages/shared/src/diff-ast.ts`
- Create: `packages/shared/src/compare-task.ts`
- Create: `packages/shared/src/ipc.ts`
- Create: `packages/shared/src/report.ts`
- Create: `packages/shared/src/diff-ast.test.ts`

- [ ] **Step 1: 写失败测试**

Add `packages/shared/src/diff-ast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDiffSummary, isTraceableDiffItem } from './diff-ast';

describe('Diff AST helpers', () => {
  it('counts all MVP match types', () => {
    const summary = createDiffSummary([
      item('modified', ['a1'], ['b1']),
      item('added', [], ['b2']),
      item('deleted', ['a3'], [])
    ]);

    expect(summary.modified).toBe(1);
    expect(summary.added).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(summary.uncertain).toBe(0);
  });

  it('requires node references for traceability', () => {
    expect(isTraceableDiffItem(item('modified', [], ['b1']))).toBe(false);
    expect(isTraceableDiffItem(item('added', [], ['b1']))).toBe(true);
  });
});

function item(matchType: 'modified' | 'added' | 'deleted', nodeIdsA: string[], nodeIdsB: string[]) {
  return {
    matchId: `${matchType}-1`,
    matchType,
    confidence: 0.8,
    similarity: 0.8,
    sourceA: nodeIdsA.length ? 'A' : null,
    sourceB: nodeIdsB.length ? 'B' : null,
    nodeIdsA,
    nodeIdsB,
    diffDetail: [],
    summary: matchType
  };
}
```

Run: `pnpm --filter @bidlens/shared test -- diff-ast`

Expected: FAIL with module `./diff-ast` missing.

- [ ] **Step 2: 实现共享类型**

Add `packages/shared/src/document-ast.ts`:

```ts
export type NodeId = string;

export interface DocumentAst {
  id: string;
  filename: string;
  sha256: string;
  pageCount: number | null;
  wordCount: number;
  parserVersion: string;
  blocks: BlockNode[];
}

export type BlockNode = ParagraphNode | SectionNode | ListNode | TableNode;

export interface ParagraphNode {
  type: 'paragraph';
  id: NodeId;
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
}

export interface SectionNode {
  type: 'section';
  id: NodeId;
  title: string;
  level: number;
  children: BlockNode[];
  pageStart: number | null;
  pageEnd: number | null;
}

export interface ListNode {
  type: 'list';
  id: NodeId;
  ordered: boolean;
  items: ParagraphNode[];
  pageStart: number | null;
  pageEnd: number | null;
}

export interface TableNode {
  type: 'table';
  id: NodeId;
  rows: string[][];
  pageStart: number | null;
  pageEnd: number | null;
}
```

Add `packages/shared/src/diff-ast.ts`:

```ts
export type MatchType = 'identical' | 'modified' | 'added' | 'deleted' | 'moved' | 'split' | 'merged' | 'uncertain';

export interface TextDiffToken {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

export interface DiffItem {
  matchId: string;
  matchType: MatchType;
  confidence: number;
  similarity: number;
  sourceA: string | null;
  sourceB: string | null;
  nodeIdsA: string[];
  nodeIdsB: string[];
  diffDetail: TextDiffToken[];
  summary: string;
  reviewAnnotationId?: string;
}

export type DiffSummary = Record<MatchType, number>;

export interface DiffAst {
  taskId: string;
  docAId: string;
  docBId: string;
  generatedAt: string;
  items: DiffItem[];
  summary: DiffSummary;
}

export function createDiffSummary(items: DiffItem[]): DiffSummary {
  const summary: DiffSummary = {
    identical: 0,
    modified: 0,
    added: 0,
    deleted: 0,
    moved: 0,
    split: 0,
    merged: 0,
    uncertain: 0
  };
  for (const item of items) summary[item.matchType] += 1;
  return summary;
}

export function isTraceableDiffItem(item: DiffItem): boolean {
  if (item.matchType === 'added') return item.nodeIdsB.length > 0;
  if (item.matchType === 'deleted') return item.nodeIdsA.length > 0;
  return item.nodeIdsA.length > 0 && item.nodeIdsB.length > 0;
}
```

Add `packages/shared/src/compare-task.ts`:

```ts
import type { DiffAst } from './diff-ast';
import type { DocumentAst } from './document-ast';

export type CompareMode = 'fast' | 'standard' | 'precise';
export type ComparePhase = 'queued' | 'parsing_a' | 'parsing_b' | 'chunking' | 'embedding' | 'matching' | 'diffing' | 'complete' | 'failed' | 'cancelled';
export type ReviewStatus = 'important' | 'ignored' | 'needs_review';

export interface CompareOptions {
  mode: CompareMode;
  embeddingProvider: 'local' | 'external';
  embeddingModel: string;
  topK: number;
  similarityThreshold: number;
}

export interface CompareProgress {
  taskId: string;
  phase: ComparePhase;
  current: number;
  total: number;
  percent: number;
  message: string;
}

export interface ReviewAnnotation {
  id: string;
  taskId: string;
  matchId: string;
  status: ReviewStatus;
  note: string;
  updatedAt: string;
}

export interface CompareResult {
  taskId: string;
  docA: DocumentAst;
  docB: DocumentAst;
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
}
```

Add `packages/shared/src/ipc.ts`:

```ts
import type { CompareOptions, CompareProgress, CompareResult, ReviewAnnotation } from './compare-task';

export interface StartCompareRequest {
  fileAPath: string;
  fileBPath: string;
  options: CompareOptions;
}

export interface BidLensApi {
  startCompare(request: StartCompareRequest): Promise<{ taskId: string }>;
  cancelCompare(taskId: string): Promise<{ taskId: string; cancelled: boolean }>;
  getCompareResult(taskId: string): Promise<CompareResult>;
  saveAnnotation(annotation: ReviewAnnotation): Promise<ReviewAnnotation>;
  exportReport(request: { taskId: string; format: 'markdown' | 'html' }): Promise<{ reportPath: string }>;
  onCompareProgress(handler: (progress: CompareProgress) => void): () => void;
}
```

Add `packages/shared/src/report.ts`:

```ts
import type { CompareOptions, ReviewAnnotation } from './compare-task';
import type { DiffAst } from './diff-ast';
import type { DocumentAst } from './document-ast';

export interface ExportModel {
  taskId: string;
  generatedAt: string;
  docA: Pick<DocumentAst, 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  docB: Pick<DocumentAst, 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  options: CompareOptions;
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
}
```

Modify `packages/shared/src/index.ts`:

```ts
export const BIDLENS_VERSION = '0.1.0';
export * from './compare-task';
export * from './diff-ast';
export * from './document-ast';
export * from './ipc';
export * from './report';
```

- [ ] **Step 3: 验证**

Run: `pnpm --filter @bidlens/shared test -- diff-ast`

Expected: PASS.

Run: `pnpm --filter @bidlens/shared build`

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat: define bidlens shared contracts"
```

---

### Task 3: Rust Diff Core 与 JSON-RPC

**Files:**
- Create: `bidlens-engine/crates/document-ast/Cargo.toml`
- Create: `bidlens-engine/crates/document-ast/src/lib.rs`
- Create: `bidlens-engine/crates/diff-engine/Cargo.toml`
- Create: `bidlens-engine/crates/diff-engine/src/lib.rs`
- Modify: `bidlens-engine/Cargo.toml`
- Modify: `bidlens-engine/src/main.rs`
- Create: `bidlens-engine/tests/json_rpc.rs`

- [ ] **Step 1: 写失败测试**

Add `bidlens-engine/crates/diff-engine/src/lib.rs` with only this test module first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use document_ast::{BlockNode, DocumentAst, ParagraphNode};

    #[test]
    fn detects_modified_added_and_deleted_chunks() {
        let left = doc("a", &["投标人应提供营业执照", "旧条款"]);
        let right = doc("b", &["投标人须提供营业执照", "新增条款"]);
        let diff = compare_documents(&left, &right, CompareOptions::default());

        assert!(diff.items.iter().any(|item| item.match_type == MatchType::Modified));
        assert!(diff.items.iter().any(|item| item.match_type == MatchType::Added));
        assert!(diff.items.iter().any(|item| item.match_type == MatchType::Deleted));
    }

    fn doc(id: &str, texts: &[&str]) -> DocumentAst {
        DocumentAst {
            id: id.to_string(),
            filename: format!("{id}.docx"),
            sha256: id.to_string(),
            page_count: None,
            word_count: texts.iter().map(|text| text.chars().count()).sum(),
            parser_version: "test".to_string(),
            blocks: texts.iter().enumerate().map(|(idx, text)| {
                BlockNode::Paragraph(ParagraphNode {
                    id: format!("{id}-p{idx}"),
                    text: text.to_string(),
                    page_start: None,
                    page_end: None
                })
            }).collect()
        }
    }
}
```

Run: `cargo test --manifest-path bidlens-engine/Cargo.toml -p diff-engine`

Expected: FAIL because the crates and functions are incomplete.

- [ ] **Step 2: 实现 Rust AST**

Add `bidlens-engine/crates/document-ast/Cargo.toml`:

```toml
[package]
name = "document-ast"
version.workspace = true
edition.workspace = true

[dependencies]
serde.workspace = true
```

Add `bidlens-engine/crates/document-ast/src/lib.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DocumentAst {
    pub id: String,
    pub filename: String,
    pub sha256: String,
    pub page_count: Option<usize>,
    pub word_count: usize,
    pub parser_version: String,
    pub blocks: Vec<BlockNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BlockNode {
    Paragraph(ParagraphNode),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParagraphNode {
    pub id: String,
    pub text: String,
    pub page_start: Option<usize>,
    pub page_end: Option<usize>,
}

pub fn paragraphs(doc: &DocumentAst) -> Vec<(&str, &str)> {
    doc.blocks.iter().map(|block| match block {
        BlockNode::Paragraph(p) => (p.id.as_str(), p.text.as_str())
    }).collect()
}
```

- [ ] **Step 3: 实现 Diff core**

Add `bidlens-engine/crates/diff-engine/Cargo.toml`:

```toml
[package]
name = "diff-engine"
version.workspace = true
edition.workspace = true

[dependencies]
document-ast = { path = "../document-ast" }
serde.workspace = true
uuid.workspace = true
```

Replace `bidlens-engine/crates/diff-engine/src/lib.rs` while keeping the test from Step 1:

```rust
use document_ast::{paragraphs, DocumentAst};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CompareOptions {
    pub similarity_threshold: f32,
}

impl Default for CompareOptions {
    fn default() -> Self {
        Self { similarity_threshold: 0.45 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MatchType {
    Identical,
    Modified,
    Added,
    Deleted,
    Moved,
    Split,
    Merged,
    Uncertain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffItem {
    pub match_id: String,
    pub match_type: MatchType,
    pub confidence: f32,
    pub similarity: f32,
    pub source_a: Option<String>,
    pub source_b: Option<String>,
    pub node_ids_a: Vec<String>,
    pub node_ids_b: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffAst {
    pub task_id: String,
    pub doc_a_id: String,
    pub doc_b_id: String,
    pub items: Vec<DiffItem>,
}

pub fn compare_documents(left: &DocumentAst, right: &DocumentAst, options: CompareOptions) -> DiffAst {
    let left_nodes = paragraphs(left);
    let right_nodes = paragraphs(right);
    let mut used_right = HashSet::new();
    let mut items = Vec::new();

    for (left_id, left_text) in left_nodes {
        let best = right_nodes.iter().enumerate()
            .filter(|(idx, _)| !used_right.contains(idx))
            .map(|(idx, (right_id, right_text))| (idx, *right_id, *right_text, jaccard(left_text, right_text)))
            .max_by(|a, b| a.3.total_cmp(&b.3));

        if let Some((idx, right_id, right_text, score)) = best.filter(|candidate| candidate.3 >= options.similarity_threshold) {
            used_right.insert(idx);
            items.push(DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: if left_text == right_text { MatchType::Identical } else { MatchType::Modified },
                confidence: score,
                similarity: score,
                source_a: Some(left_text.to_string()),
                source_b: Some(right_text.to_string()),
                node_ids_a: vec![left_id.to_string()],
                node_ids_b: vec![right_id.to_string()],
                summary: "semantic match".to_string(),
            });
        } else {
            items.push(DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: MatchType::Deleted,
                confidence: 1.0,
                similarity: 0.0,
                source_a: Some(left_text.to_string()),
                source_b: None,
                node_ids_a: vec![left_id.to_string()],
                node_ids_b: vec![],
                summary: "only in document A".to_string(),
            });
        }
    }

    for (idx, (right_id, right_text)) in right_nodes.iter().enumerate() {
        if !used_right.contains(&idx) {
            items.push(DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: MatchType::Added,
                confidence: 1.0,
                similarity: 0.0,
                source_a: None,
                source_b: Some((*right_text).to_string()),
                node_ids_a: vec![],
                node_ids_b: vec![(*right_id).to_string()],
                summary: "only in document B".to_string(),
            });
        }
    }

    DiffAst {
        task_id: Uuid::new_v4().to_string(),
        doc_a_id: left.id.clone(),
        doc_b_id: right.id.clone(),
        items,
    }
}

fn jaccard(left: &str, right: &str) -> f32 {
    let a = left.chars().collect::<HashSet<_>>();
    let b = right.chars().collect::<HashSet<_>>();
    let intersection = a.intersection(&b).count() as f32;
    let union = a.union(&b).count() as f32;
    if union == 0.0 { 0.0 } else { intersection / union }
}
```

- [ ] **Step 4: 实现 JSON-RPC bridge**

Modify `bidlens-engine/Cargo.toml` dependencies:

```toml
[dependencies]
anyhow.workspace = true
diff-engine = { path = "crates/diff-engine" }
document-ast = { path = "crates/document-ast" }
serde.workspace = true
serde_json.workspace = true
tokio.workspace = true
```

Replace `bidlens-engine/src/main.rs`:

```rust
use anyhow::Result;
use diff_engine::{compare_documents, CompareOptions};
use document_ast::DocumentAst;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Debug, Deserialize)]
struct RpcRequest {
    id: String,
    method: String,
    params: Value,
}

#[derive(Debug, Deserialize)]
struct CompareParams {
    doc_a: DocumentAst,
    doc_b: DocumentAst,
    options: Option<CompareOptions>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut lines = BufReader::new(io::stdin()).lines();
    let mut stdout = io::stdout();

    while let Some(line) = lines.next_line().await? {
        let request: RpcRequest = serde_json::from_str(&line)?;
        let response = match request.method.as_str() {
            "ping" => json!({ "id": request.id, "result": { "pong": true, "version": "0.1.0" } }),
            "compare" => {
                let params: CompareParams = serde_json::from_value(request.params)?;
                let result = compare_documents(&params.doc_a, &params.doc_b, params.options.unwrap_or_default());
                json!({ "id": request.id, "result": result })
            }
            method => json!({ "id": request.id, "error": { "code": -32601, "message": format!("unknown method: {method}") } })
        };
        stdout.write_all(serde_json::to_string(&response)?.as_bytes()).await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
    }

    Ok(())
}
```

- [ ] **Step 5: 验证**

Run: `cargo test --manifest-path bidlens-engine/Cargo.toml -p diff-engine`

Expected: PASS.

Run: `cargo test --manifest-path bidlens-engine/Cargo.toml`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add bidlens-engine
git commit -m "feat: add rust semantic diff engine"
```

---

### Task 4: Node 解析、报告导出与 IPC

**Files:**
- Create: `apps/desktop/src/main/parser/docx-parser.ts`
- Create: `apps/desktop/src/main/parser/docx-parser.test.ts`
- Create: `apps/desktop/src/main/services/report-exporter.ts`
- Create: `apps/desktop/src/main/services/report-exporter.test.ts`
- Create: `apps/desktop/src/main/ipc/compare-handlers.ts`
- Create: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: 写 parser 测试**

Add `apps/desktop/src/main/parser/docx-parser.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDocumentXmlToAst } from './docx-parser';

describe('parseDocumentXmlToAst', () => {
  it('extracts paragraphs with stable node ids', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>投标人应提供营业执照</w:t></w:r></w:p></w:body></w:document>';
    const ast = parseDocumentXmlToAst(xml, { filename: 'a.docx', sha256: 'hash-a' });

    expect(ast.blocks).toHaveLength(1);
    expect(ast.blocks[0]).toMatchObject({ type: 'paragraph', id: 'p-1', text: '投标人应提供营业执照' });
  });
});
```

Run: `pnpm --filter @bidlens/desktop test -- docx-parser`

Expected: FAIL with module missing.

- [ ] **Step 2: 实现 parser**

Add `apps/desktop/src/main/parser/docx-parser.ts`:

```ts
import type { DocumentAst, ParagraphNode } from '@bidlens/shared';
import { XMLParser } from 'fast-xml-parser';

export function parseDocumentXmlToAst(xml: string, metadata: { filename: string; sha256: string }): DocumentAst {
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml);
  const paragraphs = normalizeArray(parsed.document?.body?.p);
  const blocks: ParagraphNode[] = paragraphs.map((paragraph, index) => ({
    type: 'paragraph',
    id: `p-${index + 1}`,
    text: extractText(paragraph),
    pageStart: null,
    pageEnd: null
  })).filter((paragraph) => paragraph.text.length > 0);

  return {
    id: metadata.sha256,
    filename: metadata.filename,
    sha256: metadata.sha256,
    pageCount: null,
    wordCount: blocks.reduce((sum, block) => sum + block.text.length, 0),
    parserVersion: 'docx-parser-v0.1.0',
    blocks
  };
}

function extractText(paragraph: unknown): string {
  return normalizeArray((paragraph as { r?: unknown })?.r)
    .map((run) => (run as { t?: string })?.t ?? '')
    .join('')
    .trim();
}

function normalizeArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
```

- [ ] **Step 3: 写 report 测试**

Add `apps/desktop/src/main/services/report-exporter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderMarkdownReport } from './report-exporter';

describe('renderMarkdownReport', () => {
  it('renders metadata, diff list, and annotations', () => {
    const markdown = renderMarkdownReport({
      taskId: 't1',
      generatedAt: '2026-07-15T00:00:00.000Z',
      docA: { filename: 'a.docx', sha256: 'a', pageCount: 1, wordCount: 10 },
      docB: { filename: 'b.docx', sha256: 'b', pageCount: 1, wordCount: 12 },
      options: { mode: 'standard', embeddingProvider: 'local', embeddingModel: 'test', topK: 5, similarityThreshold: 0.45 },
      diffAst: {
        taskId: 't1',
        docAId: 'a',
        docBId: 'b',
        generatedAt: '2026-07-15T00:00:00.000Z',
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [{ matchId: 'm1', matchType: 'modified', confidence: 0.8, similarity: 0.8, sourceA: '旧', sourceB: '新', nodeIdsA: ['a1'], nodeIdsB: ['b1'], diffDetail: [], summary: 'changed' }]
      },
      annotations: [{ id: 'ann1', taskId: 't1', matchId: 'm1', status: 'important', note: '重点', updatedAt: '2026-07-15T00:00:00.000Z' }]
    });

    expect(markdown).toContain('# BidLens 比对报告');
    expect(markdown).toContain('a.docx');
    expect(markdown).toContain('important');
  });
});
```

Run: `pnpm --filter @bidlens/desktop test -- report-exporter`

Expected: FAIL with module missing.

- [ ] **Step 4: 实现 report exporter**

Add `apps/desktop/src/main/services/report-exporter.ts`:

```ts
import type { ExportModel } from '@bidlens/shared';

export function renderMarkdownReport(model: ExportModel): string {
  const lines = [
    '# BidLens 比对报告',
    '',
    `生成时间: ${model.generatedAt}`,
    `任务 ID: ${model.taskId}`,
    '',
    `A: ${model.docA.filename}`,
    `B: ${model.docB.filename}`,
    '',
    '## 差异统计',
    ...Object.entries(model.diffAst.summary).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 差异列表'
  ];

  for (const item of model.diffAst.items) {
    const annotation = model.annotations.find((entry) => entry.matchId === item.matchId);
    lines.push('', `### ${item.matchType} ${item.matchId}`, `- confidence: ${item.confidence}`, `- annotation: ${annotation ? `${annotation.status} ${annotation.note}` : 'none'}`, '', '```text', `A: ${item.sourceA ?? ''}`, `B: ${item.sourceB ?? ''}`, '```');
  }

  return `${lines.join('\n')}\n`;
}

export function renderHtmlReport(model: ExportModel): string {
  return `<!doctype html><meta charset="utf-8"><pre>${escapeHtml(renderMarkdownReport(model))}</pre>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
```

- [ ] **Step 5: 实现 IPC 和 preload 外壳**

Add `apps/desktop/src/preload/index.ts`:

```ts
import type { BidLensApi } from '@bidlens/shared';
import { contextBridge, ipcRenderer } from 'electron';

const api: BidLensApi = {
  startCompare: (request) => ipcRenderer.invoke('compare:start', request),
  cancelCompare: (taskId) => ipcRenderer.invoke('compare:cancel', taskId),
  getCompareResult: (taskId) => ipcRenderer.invoke('compare:getResult', taskId),
  saveAnnotation: (annotation) => ipcRenderer.invoke('compare:saveAnnotation', annotation),
  exportReport: (request) => ipcRenderer.invoke('compare:export', request),
  onCompareProgress: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => handler(progress as never);
    ipcRenderer.on('compare:progress', listener);
    return () => ipcRenderer.removeListener('compare:progress', listener);
  }
};

contextBridge.exposeInMainWorld('bidlens', api);
```

Add `apps/desktop/src/main/ipc/compare-handlers.ts`:

```ts
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import type { CompareResult } from '@bidlens/shared';

const results = new Map<string, CompareResult>();

export function registerCompareHandlers(window: BrowserWindow): void {
  ipcMain.handle('compare:start', async () => {
    const taskId = crypto.randomUUID();
    const result = demoResult(taskId);
    results.set(taskId, result);
    window.webContents.send('compare:progress', { taskId, phase: 'complete', current: 1, total: 1, percent: 100, message: '比对完成' });
    return { taskId };
  });
  ipcMain.handle('compare:cancel', async (_event, taskId: string) => ({ taskId, cancelled: results.delete(taskId) }));
  ipcMain.handle('compare:getResult', async (_event, taskId: string) => {
    const result = results.get(taskId);
    if (!result) throw new Error(`Compare result not found: ${taskId}`);
    return result;
  });
  ipcMain.handle('compare:saveAnnotation', async (_event, annotation) => annotation);
  ipcMain.handle('compare:export', async () => ({ reportPath: '' }));
}

function demoResult(taskId: string): CompareResult {
  return {
    taskId,
    docA: { id: 'a', filename: '基准版.docx', sha256: 'a', pageCount: 1, wordCount: 10, parserVersion: 'demo', blocks: [] },
    docB: { id: 'b', filename: '比较版.docx', sha256: 'b', pageCount: 1, wordCount: 12, parserVersion: 'demo', blocks: [] },
    diffAst: {
      taskId,
      docAId: 'a',
      docBId: 'b',
      generatedAt: new Date().toISOString(),
      summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
      items: [{ matchId: 'm1', matchType: 'modified', confidence: 0.82, similarity: 0.82, sourceA: '投标人应提供营业执照', sourceB: '投标人须提供营业执照', nodeIdsA: ['a1'], nodeIdsB: ['b1'], diffDetail: [], summary: '措辞发生变化' }]
    },
    annotations: []
  };
}
```

- [ ] **Step 6: 验证**

Run: `pnpm --filter @bidlens/desktop test -- docx-parser report-exporter`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/main apps/desktop/src/preload
git commit -m "feat: add parser report export and ipc shell"
```

---

### Task 5: React 三栏复核工作台

**Files:**
- Create: `apps/desktop/src/renderer/index.html`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/app/App.tsx`
- Create: `apps/desktop/src/renderer/features/compare/ComparePage.tsx`
- Create: `apps/desktop/src/renderer/features/compare/ReviewWorkbench.tsx`
- Create: `apps/desktop/src/renderer/features/compare/ReviewWorkbench.test.tsx`
- Create: `apps/desktop/src/renderer/shared/global.d.ts`

- [ ] **Step 1: 写工作台渲染测试**

Add `apps/desktop/src/renderer/features/compare/ReviewWorkbench.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewWorkbench } from './ReviewWorkbench';

describe('ReviewWorkbench', () => {
  it('renders navigation, document panes, and details', () => {
    render(<ReviewWorkbench result={{
      taskId: 't1',
      docA: { id: 'a', filename: 'a.docx', sha256: 'a', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      docB: { id: 'b', filename: 'b.docx', sha256: 'b', pageCount: 1, wordCount: 2, parserVersion: 'test', blocks: [] },
      diffAst: {
        taskId: 't1',
        docAId: 'a',
        docBId: 'b',
        generatedAt: '2026-07-15T00:00:00.000Z',
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [{ matchId: 'm1', matchType: 'modified', confidence: 0.8, similarity: 0.8, sourceA: '旧条款', sourceB: '新条款', nodeIdsA: ['a1'], nodeIdsB: ['b1'], diffDetail: [], summary: 'changed' }]
      },
      annotations: []
    }} />);

    expect(screen.getByText('modified')).toBeTruthy();
    expect(screen.getByText('旧条款')).toBeTruthy();
    expect(screen.getByText('新条款')).toBeTruthy();
    expect(screen.getByText('confidence 0.80')).toBeTruthy();
  });
});
```

Run: `pnpm --filter @bidlens/desktop test -- ReviewWorkbench`

Expected: FAIL with component missing.

- [ ] **Step 2: 实现 React 入口**

Add `apps/desktop/src/renderer/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BidLens</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Add `apps/desktop/src/renderer/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Add `apps/desktop/src/renderer/app/App.tsx`:

```tsx
import { ComparePage } from '../features/compare/ComparePage';

export function App() {
  return <ComparePage />;
}
```

Add `apps/desktop/src/renderer/shared/global.d.ts`:

```ts
import type { BidLensApi } from '@bidlens/shared';

declare global {
  interface Window {
    bidlens: BidLensApi;
  }
}
```

- [ ] **Step 3: 实现三栏工作台**

Add `apps/desktop/src/renderer/features/compare/ReviewWorkbench.tsx`:

```tsx
import type { CompareResult, DiffItem } from '@bidlens/shared';
import { useMemo, useState } from 'react';

export function ReviewWorkbench({ result }: { result: CompareResult }) {
  const [selectedId, setSelectedId] = useState(result.diffAst.items[0]?.matchId ?? '');
  const selected = useMemo(() => result.diffAst.items.find((item) => item.matchId === selectedId) ?? result.diffAst.items[0], [result.diffAst.items, selectedId]);

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 320px', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ borderRight: '1px solid #ddd', padding: 16, overflow: 'auto' }}>
        <h2 style={{ fontSize: 18 }}>差异导航</h2>
        {result.diffAst.items.map((item) => (
          <button key={item.matchId} onClick={() => setSelectedId(item.matchId)} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8 }}>
            <span>{item.matchType}</span>
            <span style={{ float: 'right' }}>{item.confidence.toFixed(2)}</span>
          </button>
        ))}
      </aside>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, overflow: 'auto' }}>
        <DocumentPane title={result.docA.filename} text={selected?.sourceA ?? ''} />
        <DocumentPane title={result.docB.filename} text={selected?.sourceB ?? ''} />
      </section>
      <aside style={{ borderLeft: '1px solid #ddd', padding: 16 }}>
        {selected ? <DetailPanel item={selected} /> : <p>没有差异</p>}
      </aside>
    </main>
  );
}

function DocumentPane({ title, text }: { title: string; text: string }) {
  return (
    <article>
      <h2 style={{ fontSize: 18 }}>{title}</h2>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{text}</p>
    </article>
  );
}

function DetailPanel({ item }: { item: DiffItem }) {
  return (
    <section>
      <h2 style={{ fontSize: 18 }}>差异详情</h2>
      <p>{item.matchType}</p>
      <p>confidence {item.confidence.toFixed(2)}</p>
      <p>similarity {item.similarity.toFixed(2)}</p>
      <p>{item.summary}</p>
    </section>
  );
}
```

Add `apps/desktop/src/renderer/features/compare/ComparePage.tsx`:

```tsx
import type { CompareResult } from '@bidlens/shared';
import { useState } from 'react';
import { ReviewWorkbench } from './ReviewWorkbench';

export function ComparePage() {
  const [result, setResult] = useState<CompareResult | null>(null);

  if (result) return <ReviewWorkbench result={result} />;

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>BidLens</h1>
      <button onClick={() => void startDemoCompare(setResult)} style={{ height: 36, padding: '0 12px' }}>
        打开示例比对
      </button>
    </main>
  );
}

async function startDemoCompare(setResult: (result: CompareResult) => void): Promise<void> {
  const started = await window.bidlens.startCompare({
    fileAPath: 'demo-a.docx',
    fileBPath: 'demo-b.docx',
    options: { mode: 'standard', embeddingProvider: 'local', embeddingModel: 'test', topK: 5, similarityThreshold: 0.45 }
  });
  setResult(await window.bidlens.getCompareResult(started.taskId));
}
```

- [ ] **Step 4: 验证**

Run: `pnpm --filter @bidlens/desktop test -- ReviewWorkbench`

Expected: PASS.

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat: add compare review workbench"
```

---

## 验收覆盖

- 双 docx 比对入口：Task 4 parser + IPC shell，Task 5 renderer 入口。
- Document AST：Task 2 TypeScript 契约，Task 3 Rust 契约。
- Diff AST：Task 2 契约，Task 3 Rust 输出。
- 新增、删除、修改：Task 3 测试覆盖。
- 移动、拆分、合并、不确定：Task 2 先稳定协议，算法细化进入下一份计划。
- 三栏复核工作台：Task 5 测试覆盖。
- 人工标记隔离：Task 2 契约已将 annotation 独立于 Diff AST。
- Markdown/HTML 报告：Task 4 exporter 覆盖。
- 大文档性能：当前计划建立可运行骨架，虚拟滚动和缓存压测在端到端链路跑通后单独实施。

## Self-Review

- 未包含未决标记、修复标记或空泛空步骤。
- 所有代码任务都有先失败、再实现、再验证的步骤。
- 文件路径与当前文档设计一致：Electron main/preload/renderer、shared types、Rust workspace。
- 范围与 `docs/superpowers/specs/2026-07-15-bidlens-semantic-compare-mvp-design.md` 一致，未扩大到标书审查产品。
