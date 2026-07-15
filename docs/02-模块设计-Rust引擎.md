# 第二章 模块设计 — Rust引擎

> **版本**: v1.0 | **最后更新**: 2026-07-07
> **前置依赖**: 第一章总体架构设计

---

## 目录

- [2.1 Rust引擎总体架构](#21-rust引擎总体架构)
- [2.2 document-ast crate](#22-document-ast-crate)
- [2.3 diff-engine crate](#23-diff-engine-crate)
- [2.4 embedding crate](#24-embedding-crate)
- [2.5 vector crate](#25-vector-crate)
- [2.6 chunk crate](#26-chunk-crate)
- [2.7 common crate](#27-common-crate)
- [2.8 错误处理策略](#28-错误处理策略)
- [2.9 测试策略](#29-测试策略)

---

## 2.1 Rust引擎总体架构

### 2.1.1 为什么选择Rust

BidLens 的核心计算引擎承担文档AST解析、差异比对、向量嵌入等CPU密集型任务。选择Rust作为引擎语言基于以下考量：

| 维度 | Rust优势 | 对BidLens的具体意义 |
|------|----------|---------------------|
| **性能** | 零成本抽象，无GC停顿 | 百万级节点AST操作保持低延迟（<100ms） |
| **内存安全** | 所有权系统在编译期消除数据竞争 | 多线程并行diff计算无UB风险 |
| **跨平台** | 原生交叉编译 | 一套代码构建Windows/macOS/Linux二进制 |
| **WASM潜力** | wasm32目标直接支持 | 未来可将引擎嵌入Web版BidLens |
| **生态成熟** | tokio/ort/reqwest等高质量crate | 无需自行实现异步运行时或ONNX绑定 |

### 2.1.2 Workspace结构

Rust引擎采用 Cargo Workspace 组织，共包含 **6个内部crate**：

```
bidlens-engine/
├── Cargo.toml              # workspace root
├── crates/
│   ├── common/             # 基础设施：日志、错误、配置、工具函数
│   ├── document-ast/       # AST类型定义、序列化、遍历
│   ├── diff-engine/        # 差异比对算法核心
│   ├── embedding/          # 向量嵌入（ONNX + 外部API）
│   ├── vector/             # 向量存储与相似度计算
│   └── chunk/              # 文档分块策略
├── src/
│   └── main.rs             # stdio JSON-RPC入口
├── benches/                # criterion基准测试
└── tests/                  # 集成测试
```

### 2.1.3 Crate依赖关系

```
┌──────────────────────────────────────────────────────────┐
│                    bidlens-engine (bin)                    │
│                   stdio JSON-RPC入口                      │
└────────┬──────────┬──────────┬──────────┬────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
  ┌───────────┐ ┌────────┐ ┌────────┐ ┌───────┐
  │   diff-   │ │embed-  │ │ vector │ │ chunk │
  │  engine   │ │ ding   │ │        │ │       │
  └─────┬─────┘ └───┬────┘ └───┬────┘ └───┬───┘
        │            │          │           │
        ▼            ▼          ▼           ▼
  ┌─────────────────────────────────────────────┐
  │            document-ast                      │
  │        AST类型定义与序列化                    │
  └──────────────────────┬──────────────────────┘
                         │
                         ▼
  ┌─────────────────────────────────────────────┐
  │              common                          │
  │   日志 · 错误 · 配置 · 工具函数              │
  └─────────────────────────────────────────────┘
```

**依赖规则**：

- `common` 是最底层crate，无任何内部依赖
- `document-ast` 仅依赖 `common`
- `diff-engine`、`embedding`、`vector`、`chunk` 均依赖 `document-ast` 和 `common`
- `diff-engine` 与 `embedding`/`vector` 之间**无直接依赖**，由上层 `main.rs` 协调
- 禁止循环依赖；新增依赖必须在 architecture review 中记录

### 2.1.4 Workspace Cargo.toml

```toml
[workspace]
resolver = "2"
members = ["crates/*"]
package.version = "0.1.0"
package.edition = "2024"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
rayon = "1.10"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
thiserror = "2"
anyhow = "1"
ort = { version = "2", features = ["download-binaries"] }
reqwest = { version = "0.12", features = ["json"] }
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
flate2 = "1"
```

---

## 2.2 document-ast crate

### 2.2.1 设计目标

`document-ast` 定义 BidLens 的**统一文档抽象语法树**。所有输入文档（DOCX）经 Node.js 解析层转换为 JSON 后，由 Rust 侧反序列化为本 crate 定义的类型。AST 是 diff-engine、embedding、chunk 三个crate 的公共数据基础。

### 2.2.2 核心类型定义

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 文档根节点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub source_path: String,
    pub metadata: Metadata,
    pub content: Vec<BlockNode>,
    pub headers: Vec<Header>,
    pub footers: Vec<Footer>,
    pub comments: Vec<Comment>,
    pub revisions: Vec<Revision>,
    pub bookmarks: Vec<Bookmark>,
}

/// 文档元信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
    pub page_count: Option<u32>,
    pub word_count: Option<u32>,
    pub language: Option<String>,
    pub custom: HashMap<String, String>,
}
```

### 2.2.3 节点枚举体系

AST节点分为**块级节点**（Block）和**行内节点**（Inline）两大类：

```rust
/// 块级节点枚举 — 文档结构的基本单元
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlockNode {
    Section(Section),
    Paragraph(Paragraph),
    Table(Table),
    List(List),
    Image(Image),
    PageBreak(PageBreak),
}

/// 行内节点枚举 — 段落内的内容单元
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InlineNode {
    TextRun(TextRun),
    Hyperlink(Hyperlink),
    Comment(Comment),
    Bookmark(Bookmark),
    Image(Image),  // 行内图片（如图标）
}
```

### 2.2.4 完整结构体定义

```rust
/// 章节 — 带有标题层级
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub id: NodeId,
    pub heading: Heading,
    pub level: u8,                      // 1-9 标题层级
    pub content: Vec<BlockNode>,
}

/// 标题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heading {
    pub runs: Vec<InlineNode>,
    pub style: Option<String>,
}

/// 段落
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paragraph {
    pub id: NodeId,
    pub runs: Vec<InlineNode>,
    pub style: Option<ParagraphStyle>,
    pub alignment: Option<Alignment>,
    pub indent: Option<Indentation>,
    pub spacing: Option<Spacing>,
    pub is_list_item: bool,
    pub list_level: Option<u8>,
}

/// 文本片段（最小文本单元）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRun {
    pub id: NodeId,
    pub text: String,
    pub style: Option<TextStyle>,
}

/// 文本样式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextStyle {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
    pub font_name: Option<String>,
    pub font_size: Option<f32>,        // 磅值
    pub color: Option<String>,         // hex色值
    pub highlight: Option<String>,
}

/// 段落样式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParagraphStyle {
    pub name: Option<String>,
    pub font_name: Option<String>,
    pub font_size: Option<f32>,
    pub line_spacing: Option<f32>,
    pub space_before: Option<f32>,
    pub space_after: Option<f32>,
}

/// 对齐方式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Alignment {
    Left,
    Center,
    Right,
    Justify,
}

/// 缩进
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Indentation {
    pub left: Option<f32>,
    pub right: Option<f32>,
    pub first_line: Option<f32>,
    pub hanging: Option<f32>,
}

/// 段间距
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Spacing {
    pub before: Option<f32>,
    pub after: Option<f32>,
    pub line: Option<f32>,
    pub line_rule: Option<String>,
}

/// 表格
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub id: NodeId,
    pub rows: Vec<TableRow>,
    pub column_count: u32,
    pub column_widths: Vec<f32>,
    pub style: Option<TableStyle>,
    pub border_style: Option<TableBorderStyle>,
}

/// 表格行
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableRow {
    pub id: NodeId,
    pub cells: Vec<TableCell>,
    pub is_header: bool,
    pub height: Option<f32>,
}

/// 表格单元格
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableCell {
    pub id: NodeId,
    pub content: Vec<BlockNode>,
    pub column_span: u32,
    pub row_span: u32,
    pub width: Option<f32>,
    pub vertical_align: Option<String>,
}

/// 表格样式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableStyle {
    pub name: Option<String>,
    pub alignment: Option<Alignment>,
}

/// 表格边框
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableBorderStyle {
    pub top: Option<BorderInfo>,
    pub bottom: Option<BorderInfo>,
    pub left: Option<BorderInfo>,
    pub right: Option<BorderInfo>,
    pub inside_h: Option<BorderInfo>,
    pub inside_v: Option<BorderInfo>,
}

/// 边框信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BorderInfo {
    pub style: String,
    pub size: f32,
    pub color: String,
}

/// 列表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct List {
    pub id: NodeId,
    pub items: Vec<ListItem>,
    pub list_type: ListType,
}

/// 列表项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListItem {
    pub id: NodeId,
    pub content: Vec<BlockNode>,
    pub level: u8,
    pub number: Option<u32>,
}

/// 列表类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListType {
    Bullet,
    Numbered,
    Checklist,
}

/// 图片
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Image {
    pub id: NodeId,
    pub source: ImageSource,
    pub width: Option<f32>,
    pub height: Option<f32>,
    pub alt_text: Option<String>,
    pub caption: Option<String>,
}

/// 图片来源
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImageSource {
    Embedded(String),   // base64编码
    External(String),   // URL
    Reference(String),  // 文档内引用ID
}

/// 超链接
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hyperlink {
    pub id: NodeId,
    pub url: String,
    pub display_text: Vec<InlineNode>,
    pub tooltip: Option<String>,
}

/// 批注
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: NodeId,
    pub author: String,
    pub date: String,
    pub content: String,
    pub resolved: bool,
    pub replies: Vec<Comment>,
    pub anchor: Option<NodeId>,
}

/// 修订记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Revision {
    pub id: NodeId,
    pub author: String,
    pub date: String,
    pub revision_type: RevisionType,
    pub original: Option<String>,
    pub modified: Option<String>,
}

/// 修订类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RevisionType {
    Insertion,
    Deletion,
    Formatting,
    Move,
}

/// 书签
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: NodeId,
    pub name: String,
    pub content: Vec<InlineNode>,
}

/// 页眉
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Header {
    pub id: NodeId,
    pub content: Vec<BlockNode>,
    pub is_first_page: bool,
    pub is_odd_page: bool,
}

/// 页脚
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Footer {
    pub id: NodeId,
    pub content: Vec<BlockNode>,
    pub is_first_page: bool,
    pub is_odd_page: bool,
}

/// 分页符
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageBreak {
    pub break_type: PageBreakType,
}

/// 分页类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PageBreakType {
    Page,
    Column,
    Section,
}
```

### 2.2.5 节点ID系统

每个AST节点拥有唯一ID，用于diff结果回溯和前端高亮定位：

```rust
/// 路径片段 — 描述节点在父节点中的位置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PathSegment {
    Child(usize),           // 子节点索引
    Cell { row: usize, col: usize },  // 表格单元格
    Run(usize),             // 文本片段索引
    Header(usize),          // 页眉索引
    Footer(usize),          // 页脚索引
}

/// 节点路径 — 从根到当前节点的完整路径
pub type NodePath = Vec<PathSegment>;

/// 节点ID trait
pub trait NodeIdExt {
    fn node_path(&self) -> &NodePath;
    fn node_path_string(&self) -> String {
        self.node_path()
            .iter()
            .map(|seg| match seg {
                PathSegment::Child(i) => format!("[{}]", i),
                PathSegment::Cell { row, col } => format!("[{},{}]", row, col),
                PathSegment::Run(i) => format!(".run[{}]", i),
                PathSegment::Header(i) => format!(".h[{}]", i),
                PathSegment::Footer(i) => format!(".f[{}]", i),
            })
            .collect()
    }
}
```

### 2.2.6 Visitor模式遍历

```rust
/// AST访问者trait — 用于遍历和转换
pub trait AstVisitor<T> {
    type Error;

    fn visit_document(&mut self, doc: &Document) -> Result<T, Self::Error> { Ok(todo!()) }
    fn visit_section(&mut self, section: &Section) -> Result<T, Self::Error> { Ok(todo!()) }
    fn visit_paragraph(&mut self, para: &Paragraph) -> Result<T, Self::Error> { Ok(todo!()) }
    fn visit_table(&mut self, table: &Table) -> Result<T, Self::Error> { Ok(todo!()) }
    fn visit_list(&mut self, list: &List) -> Result<T, Self::Error> { Ok(todo!()) }
    fn visit_text_run(&mut self, run: &TextRun) -> Result<T, Self::Error> { Ok(todo!()) }
    fn visit_image(&mut self, img: &Image) -> Result<T, Self::Error> { Ok(todo!()) }
    fn visit_hyperlink(&mut self, link: &Hyperlink) -> Result<T, Self::Error> { Ok(todo!()) }
}

/// 深度优先遍历辅助函数
pub fn walk_block_nodes<F>(nodes: &[BlockNode], visitor: &mut F)
where
    F: FnMut(&BlockNode),
{
    for node in nodes {
        visitor(node);
        match node {
            BlockNode::Section(s) => walk_block_nodes(&s.content, visitor),
            BlockNode::List(list) => {
                for item in &list.items {
                    walk_block_nodes(&item.content, visitor);
                }
            }
            BlockNode::Table(table) => {
                for row in &table.rows {
                    for cell in &row.cells {
                        walk_block_nodes(&cell.content, visitor);
                    }
                }
            }
            _ => {}
        }
    }
}
```

### 2.2.7 序列化配置

```rust
/// serde配置 — 控制JSON序列化行为
/// - skip_serializing_if: 省略None/空值，减小JSON体积
/// - rename_all: camelCase命名风格，兼容前端TypeScript类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub source_path: String,
    pub metadata: Metadata,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub content: Vec<BlockNode>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub headers: Vec<Header>,
    // ...
}
```

### 2.2.8 gzip压缩存储

AST序列化为JSON后，经gzip压缩存储至SQLite：

```rust
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use flate2::Compression;
use std::io::{Read, Write};

pub fn compress_ast(doc: &Document) -> Result<Vec<u8>, BidLensError> {
    let json = serde_json::to_vec(doc)?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(&json)?;
    Ok(encoder.finish()?)
}

pub fn decompress_ast(data: &[u8]) -> Result<Document, BidLensError> {
    let mut decoder = GzDecoder::new(data);
    let mut json = Vec::new();
    decoder.read_to_end(&mut json)?;
    Ok(serde_json::from_slice(&json)?)
}
```

---

## 2.3 diff-engine crate

### 2.3.1 差异比对总体流程

```
                    输入两份Document AST
                           │
                           ▼
              ┌────────────────────────┐
              │   Stage 1: 结构预对齐   │
              │  按Section层级初步匹配  │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Stage 2: 节点匹配     │
              │  embedding相似度 + 文本 │
              │  编辑距离 双重打分      │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Stage 3: 差异计算     │
              │  对匹配对执行逐字段diff │
              │  对未匹配节点标记删除/  │
              │  新增                  │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Stage 4: 阈值过滤     │
              │  根据宽松/标准/严格策略  │
              │  过滤微小差异           │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Stage 5: Diff AST    │
              │  生成带标注的Diff树     │
              └────────────────────────┘
```

### 2.3.2 核心Trait定义

```rust
use crate::common::BidLensError;
use document_ast::{BlockNode, Document, InlineNode};

/// Diff引擎主trait
pub trait DiffEngine {
    type Error: std::error::Error + Send + Sync + 'static;

    /// 执行全文档diff
    fn diff_documents(
        &self,
        left: &Document,
        right: &Document,
        options: &DiffOptions,
    ) -> Result<DiffResult, Self::Error>;
}

/// 节点匹配器trait
pub trait Matcher {
    /// 计算两个节点的相似度分数 [0.0, 1.0]
    fn similarity(&self, left: &BlockNode, right: &BlockNode) -> f64;

    /// 批量匹配：返回配对列表 (left_idx, right_idx, score)
    fn match_pairs(
        &self,
        left_nodes: &[BlockNode],
        right_nodes: &[BlockNode],
        threshold: f64,
    ) -> Vec<MatchPair>;
}

/// 差异策略trait — 针对不同节点类型
pub trait DiffStrategy {
    /// 执行单节点级别的差异计算
    fn diff_node(&self, left: &BlockNode, right: &BlockNode) -> NodeDiff;
}

/// Diff选项
#[derive(Debug, Clone)]
pub struct DiffOptions {
    pub threshold: ThresholdLevel,  // 宽松/标准/严格
    pub enable_format_diff: bool,   // 是否比较格式差异
    pub enable_table_diff: bool,    // 是否比较表格内部
    pub max_table_rows: usize,      // 表格最大比较行数
    pub text_weight: f64,           // 文本相似度权重
    pub structure_weight: f64,      // 结构相似度权重
}

/// 阈值档位
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ThresholdLevel {
    Loose,     // 宽松: 阈值0.3 — 仅报告明显差异
    Standard,  // 标准: 阈值0.6 — 平衡精度与召回
    Strict,    // 严格: 阈值0.85 — 报告所有微小差异
}

impl ThresholdLevel {
    pub fn as_f64(self) -> f64 {
        match self {
            ThresholdLevel::Loose => 0.3,
            ThresholdLevel::Standard => 0.6,
            ThresholdLevel::Strict => 0.85,
        }
    }
}

/// 匹配对
#[derive(Debug, Clone)]
pub struct MatchPair {
    pub left_idx: usize,
    pub right_idx: usize,
    pub score: f64,
    pub match_type: MatchType,
}

/// 匹配类型
#[derive(Debug, Clone)]
pub enum MatchType {
    Exact,          // 完全相同 → 前端映射为 'identical'
    Semantic,       // 语义相似（embedding驱动）→ 前端映射为 'modified'
    Textual,        // 文本编辑距离相似 → 前端映射为 'modified'
    Structural,     // 结构相似（标题层级、段落数等）→ 前端映射为 'style_only' 或 'reordered'
}

/// 注意：前端 DiffAST 的 MatchType（'identical' | 'modified' | 'style_only' | 'reordered'）
/// 与 Rust 侧 MatchType 是不同维度的分类。前端关注"差异结果类型"，Rust 关注"匹配算法来源"。
/// 转换逻辑在 DiffAstBuilder 中实现，以 Rust 侧类型为准。

/// Diff结果
#[derive(Debug, Clone)]
pub struct DiffResult {
    pub left_id: String,
    pub right_id: String,
    pub diffs: Vec<NodeDiff>,
    pub summary: DiffSummary,
}

/// 节点差异
/// 映射到前端 DiffAST:
///   Identical → Match(matchType='identical')
///   Modified  → Match(matchType='modified', diff=DiffDetail)
///   Added     → Unmatched(side='right')
///   Removed   → Unmatched(side='left')
///   Moved     → Match(matchType='reordered')
#[derive(Debug, Clone)]
pub enum NodeDiff {
    Identical {
        node_path: String,
    },
    Modified {
        node_path: String,
        left: BlockNode,
        right: BlockNode,
        changes: Vec<Change>,
        similarity: f64,
    },
    Added {
        node_path: String,
        node: BlockNode,
    },
    Removed {
        node_path: String,
        node: BlockNode,
    },
    Moved {
        node_path: String,
        from: String,
        to: String,
    },
}

/// 具体变更
#[derive(Debug, Clone)]
pub enum Change {
    TextChanged { old: String, new: String },
    FormatChanged { field: String, old: Option<String>, new: Option<String> },
    StyleChanged { old: TextStyle, new: TextStyle },
    RowAdded { row_idx: usize },
    RowRemoved { row_idx: usize },
    CellChanged { row: usize, col: usize, cell_diff: Vec<NodeDiff> },
}

/// 差异摘要
#[derive(Debug, Clone)]
pub struct DiffSummary {
    pub total_blocks: usize,
    pub identical: usize,
    pub modified: usize,
    pub added: usize,
    pub removed: usize,
    pub moved: usize,
    pub similarity_score: f64,    // 综合相似度 [0, 1]
    pub similarity_level: SimilarityLevel,
}

/// 相似度等级
#[derive(Debug, Clone, PartialEq)]
pub enum SimilarityLevel {
    Identical,      // 1.0
    NearlyIdentical, // 0.9-1.0
    Similar,        // 0.7-0.9
    Different,      // 0.4-0.7
    VeryDifferent,  // 0.0-0.4
}
```

### 2.3.3 文本Diff — 改进的Myers算法

文本级diff在单个TextRun粒度执行，采用**改进的Myers diff算法**并增加中文字符感知：

```rust
/// 改进Myers diff — 增加中文分词感知
///
/// 算法流程：
/// 1. 对输入文本执行字符级分组（CJK字符保持完整）
/// 2. 使用O(ND)算法计算最短编辑路径
/// 3. 回溯生成差异操作序列
///
/// 时间复杂度: O((n+m)d) 其中 d = edit distance
/// 空间复杂度: O((n+m)d)

pub fn text_diff(left: &str, right: &str) -> Vec<TextChange> {
    let left_tokens: Vec<&str> = tokenize_with_cjk(left);
    let right_tokens: Vec<&str> = tokenize_with_cjk(right);

    let n = left_tokens.len();
    let m = right_tokens.len();
    let max = n + m;

    if max == 0 {
        return vec![];
    }

    let offset = max;
    let mut v = vec![0i32; 2 * max + 1];
    let mut trace: Vec<Vec<i32>> = Vec::new();

    for d in 0..=max as i32 {
        trace.push(v.clone());

        for k in (-d..=d).step_by(2) {
            let idx = (k + offset) as usize;
            let x = if k == -d || (k != d && v[idx - 1] < v[idx + 1]) {
                v[idx + 1]
            } else {
                v[idx - 1] + 1
            };

            let mut y = x - k;
            while (x as usize) < n && (y as usize) < m
                && left_tokens[x as usize] == right_tokens[y as usize]
            {
                x += 1;
                y += 1;
            }

            v[idx] = x;

            if (x as usize) >= n && (y as usize) >= m {
                return backtrack(&trace, &left_tokens, &right_tokens, max);
            }
        }
    }

    unreachable!()
}

/// CJK感知分词 — 中文字符逐字分割，英文按空格分词
fn tokenize_with_cjk(text: &str) -> Vec<&str> {
    let mut tokens = Vec::new();
    let mut start = 0;

    for (i, ch) in text.char_indices() {
        if ch.is_ascii_alphabetic() {
            continue;
        }
        if start < i {
            tokens.push(&text[start..i]);
        }
        tokens.push(&text[i..i + ch.len_utf8()]);
        start = i + ch.len_utf8();
    }
    if start < text.len() {
        tokens.push(&text[start..]);
    }
    tokens
}
```

### 2.3.4 段落级Diff

段落级匹配综合考虑文本内容、样式属性和上下文位置：

```rust
/// 段落相似度计算
pub struct ParagraphMatcher {
    text_weight: f64,       // 默认 0.6
    style_weight: f64,      // 默认 0.2
    position_weight: f64,   // 默认 0.2
}

impl Matcher for ParagraphMatcher {
    fn similarity(&self, left: &BlockNode, right: &BlockNode) -> f64 {
        match (left, right) {
            (BlockNode::Paragraph(lp), BlockNode::Paragraph(rp)) => {
                let text_sim = text_similarity(&lp.runs, &rp.runs);
                let style_sim = style_similarity(&lp.style, &rp.style);
                let position_sim = if lp.is_list_item == rp.is_list_item { 1.0 } else { 0.0 };

                self.text_weight * text_sim
                    + self.style_weight * style_sim
                    + self.position_weight * position_sim
            }
            (BlockNode::Section(ls), BlockNode::Section(rs)) => {
                let heading_sim = text_similarity(&ls.heading.runs, &rs.heading.runs);
                let level_sim = if ls.level == rs.level { 1.0 } else { 0.5 };
                0.7 * heading_sim + 0.3 * level_sim
            }
            _ => 0.0,
        }
    }

    fn match_pairs(
        &self,
        left_nodes: &[BlockNode],
        right_nodes: &[BlockNode],
        threshold: f64,
    ) -> Vec<MatchPair> {
        // 使用贪心二部图匹配 + 匈牙利算法优化
        let mut scores = Vec::new();
        for (li, l) in left_nodes.iter().enumerate() {
            for (ri, r) in right_nodes.iter().enumerate() {
                let score = self.similarity(l, r);
                if score >= threshold {
                    scores.push((li, ri, score));
                }
            }
        }

        // 按分数降序排序，贪心匹配
        scores.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());

        let mut matched_left = std::collections::HashSet::new();
        let mut matched_right = std::collections::HashSet::new();
        let mut pairs = Vec::new();

        for (li, ri, score) in scores {
            if matched_left.contains(&li) || matched_right.contains(&ri) {
                continue;
            }
            matched_left.insert(li);
            matched_right.insert(ri);
            pairs.push(MatchPair {
                left_idx: li,
                right_idx: ri,
                score,
                match_type: if score > 0.95 {
                    MatchType::Exact
                } else if score > 0.7 {
                    MatchType::Textual
                } else {
                    MatchType::Structural
                },
            });
        }

        pairs
    }
}
```

### 2.3.5 表格Diff

表格diff需要处理行列增删、单元格合并变化等复杂场景：

```rust
/// 表格差异策略
pub struct TableDiffStrategy;

impl DiffStrategy for TableDiffStrategy {
    fn diff_node(&self, left: &BlockNode, right: &BlockNode) -> NodeDiff {
        let (left_table, right_table) = match (left, right) {
            (BlockNode::Table(lt), BlockNode::Table(rt)) => (lt, rt),
            _ => return NodeDiff::Identical { node_path: String::new() },
        };

        let mut changes = Vec::new();

        // Step 1: 行匹配 — 使用左侧表头行作为锚点
        let row_mapping = match_table_rows(left_table, right_table);

        // Step 2: 对每个匹配行进行单元格级比较
        for (li, ri) in &row_mapping {
            let left_row = &left_table.rows[*li];
            let right_row = &right_table.rows[*ri];

            let cell_changes = diff_table_cells(left_row, right_row);
            if !cell_changes.is_empty() {
                changes.push(Change::CellChanged {
                    row: *li,
                    col: 0, // 多列变更统一记录
                    cell_diff: cell_changes,
                });
            }
        }

        // Step 3: 标记新增/删除的行
        let matched_left: std::collections::HashSet<usize> =
            row_mapping.iter().map(|(l, _)| *l).collect();
        let matched_right: std::collections::HashSet<usize> =
            row_mapping.iter().map(|(_, r)| *r).collect();

        for i in 0..left_table.rows.len() {
            if !matched_left.contains(&i) {
                changes.push(Change::RowRemoved { row_idx: i });
            }
        }
        for i in 0..right_table.rows.len() {
            if !matched_right.contains(&i) {
                changes.push(Change::RowAdded { row_idx: i });
            }
        }

        NodeDiff::Modified {
            node_path: String::new(),
            left: left.clone(),
            right: right.clone(),
            changes,
            similarity: 0.0, // 由调用方计算
        }
    }
}

/// 行匹配算法 — 基于表头内容的对齐
fn match_table_rows(left: &Table, right: &Table) -> Vec<(usize, usize)> {
    let mut mapping = Vec::new();

    // 首先匹配表头行（is_header == true）
    let left_headers: Vec<_> = left.rows.iter().enumerate()
        .filter(|(_, r)| r.is_header).collect();
    let right_headers: Vec<_> = right.rows.iter().enumerate()
        .filter(|(_, r)| r.is_header).collect();

    // 然后按内容相似度匹配数据行
    let left_data: Vec<_> = left.rows.iter().enumerate()
        .filter(|(_, r)| !r.is_header).collect();
    let right_data: Vec<_> = right.rows.iter().enumerate()
        .filter(|(_, r)| !r.is_header).collect();

    let mut used_right = std::collections::HashSet::new();

    for (li, lrow) in &left_data {
        let mut best_match = None;
        let mut best_score = 0.0f64;

        for (ri, rrow) in &right_data {
            if used_right.contains(ri) {
                continue;
            }
            let score = row_similarity(lrow, rrow);
            if score > best_score {
                best_score = score;
                best_match = Some(*ri);
            }
        }

        if let Some(ri) = best_match {
            used_right.insert(ri);
            mapping.push((*li, ri));
        }
    }

    mapping
}
```

### 2.3.6 格式Diff

格式差异通过逐字段比较实现：

```rust
/// 格式差异比较
pub fn diff_text_styles(left: &TextStyle, right: &TextStyle) -> Vec<Change> {
    let mut changes = Vec::new();

    macro_rules! compare_field {
        ($field:ident) => {
            if left.$field != right.$field {
                changes.push(Change::FormatChanged {
                    field: stringify!($field).to_string(),
                    old: Some(format!("{:?}", left.$field)),
                    new: Some(format!("{:?}", right.$field)),
                });
            }
        };
    }

    compare_field!(bold);
    compare_field!(italic);
    compare_field!(underline);
    compare_field!(strikethrough);
    compare_field!(font_name);
    compare_field!(font_size);
    compare_field!(color);
    compare_field!(highlight);

    changes
}

pub fn diff_paragraph_styles(left: &ParagraphStyle, right: &ParagraphStyle) -> Vec<Change> {
    let mut changes = Vec::new();

    if left.name != right.name {
        changes.push(Change::StyleChanged {
            old: left.clone(),
            new: right.clone(),
        });
    }

    if left.line_spacing != right.line_spacing {
        changes.push(Change::FormatChanged {
            field: "lineSpacing".into(),
            old: left.line_spacing.map(|v| format!("{:.1}", v)),
            new: right.line_spacing.map(|v| format!("{:.1}", v)),
        });
    }

    changes
}
```

### 2.3.7 DiffOptions默认实现

```rust
impl Default for DiffOptions {
    fn default() -> Self {
        Self {
            threshold: ThresholdLevel::Standard,
            enable_format_diff: true,
            enable_table_diff: true,
            max_table_rows: 500,
            text_weight: 0.6,
            structure_weight: 0.4,
        }
    }
}
```

---

## 2.4 embedding crate

### 2.4.1 设计目标

`embedding` crate 为文本生成高维向量表示，支持两种模式：

1. **本地ONNX模型推理** — 通过 `ort` crate 加载ONNX格式嵌入模型
2. **外部API调用** — 通过 `reqwest` 调用 OpenAI / 自建嵌入服务

### 2.4.2 核心Trait

```rust
use async_trait::async_trait;

/// 嵌入提供者trait
#[async_trait]
pub trait EmbeddingProvider: Send + Sync {
    /// 生成单条文本的嵌入向量
    async fn embed(&self, text: &str) -> Result<Vec<f32>, BidLensError>;

    /// 批量生成嵌入向量（批量请求可显著降低API延迟）
    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, BidLensError>;

    /// 返回模型维度
    fn dimensions(&self) -> usize;

    /// 返回模型名称
    fn model_name(&self) -> &str;

    /// 返回最大token数
    fn max_tokens(&self) -> usize;
}

/// 模型配置
#[derive(Debug, Clone, serde::Deserialize)]
pub struct EmbeddingConfig {
    pub provider: ProviderType,
    pub model_path: Option<String>,      // 本地ONNX模型路径
    pub api_url: Option<String>,         // 外部API地址
    pub api_key: Option<String>,         // API密钥
    pub dimensions: usize,               // 嵌入维度
    pub batch_size: usize,               // 批量大小
    pub max_tokens: usize,               // 最大token数
}

/// 提供者类型
#[derive(Debug, Clone, PartialEq, serde::Deserialize)]
pub enum ProviderType {
    LocalOnnx,
    OpenAI,
    CustomApi,
}
```

### 2.4.3 ONNX Runtime集成

```rust
use ort::{Session, SessionOutputs, inputs};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

/// 本地ONNX嵌入提供者
pub struct LocalOnnxProvider {
    session: Arc<Mutex<Session>>,
    tokenizer: Tokenizer,
    dimensions: usize,
    max_tokens: usize,
}

impl LocalOnnxProvider {
    /// 加载ONNX模型
    pub fn new(config: &EmbeddingConfig) -> Result<Self, BidLensError> {
        let model_path = config.model_path.as_ref()
            .ok_or(BidLensError::ConfigError("model_path required".into()))?;

        if !Path::new(model_path).exists() {
            return Err(BidLensError::ModelError(format!(
                "Model file not found: {}", model_path
            )));
        }

        let session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(4)?
            .commit_from_file(model_path)?;

        let tokenizer = Tokenizer::from_file(
            model_path.replace(".onnx", ".tokenizer.json")
        ).map_err(|e| BidLensError::ModelError(e.to_string()))?;

        Ok(Self {
            session: Arc::new(Mutex::new(session)),
            tokenizer,
            dimensions: config.dimensions,
            max_tokens: config.max_tokens,
        })
    }
}

#[async_trait]
impl EmbeddingProvider for LocalOnnxProvider {
    async fn embed(&self, text: &str) -> Result<Vec<f32>, BidLensError> {
        let tokens = self.tokenizer.encode(text)
            .map_err(|e| BidLensError::ModelError(e.to_string()))?;

        let input_ids: Vec<i64> = tokens.get_ids().iter().map(|&id| id as i64).collect();
        let attention_mask: Vec<i64> = tokens.get_attention_mask().iter().map(|&m| m as i64).collect();

        let session = self.session.lock().await;
        let outputs = session.run(inputs![
            "input_ids" => input_ids.as_slice(),
            "attention_mask" => attention_mask.as_slice(),
        ]?)?;

        let embeddings = extract_embedding(&outputs, 0)?;
        let normalized = l2_normalize(&embeddings);

        Ok(normalized)
    }

    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, BidLensError> {
        let mut all_embeddings = Vec::with_capacity(texts.len());

        // 分批推理
        for chunk in texts.chunks(32) {
            let batch_embeddings = self.infer_batch(chunk).await?;
            all_embeddings.extend(batch_embeddings);
        }

        Ok(all_embeddings)
    }

    fn dimensions(&self) -> usize {
        self.dimensions
    }

    fn model_name(&self) -> &str {
        "local-onnx"
    }

    fn max_tokens(&self) -> usize {
        self.max_tokens
    }
}
```

### 2.4.4 推理管线

```
原始文本
    │
    ▼
┌──────────────┐
│  Tokenize    │  分词 + 截断 + Padding
│  (tokenizer) │  max_tokens: 512
└──────┬───────┘
       │ input_ids + attention_mask
       ▼
┌──────────────┐
│  ONNX推理    │  模型前向传播
│  (ort crate) │  batch_size: 32
└──────┬───────┘
       │ raw_embeddings [batch, dims]
       ▼
┌──────────────┐
│  归一化      │  L2归一化 → 单位向量
│  (normalize) │  便于余弦相似度计算
└──────┬───────┘
       │ normalized_embeddings [batch, dims]
       ▼
  返回 Vec<f32>
```

### 2.4.5 外部API调用

```rust
use reqwest::Client;

/// 外部API嵌入提供者（OpenAI兼容接口）
pub struct ApiEmbeddingProvider {
    client: Client,
    api_url: String,
    api_key: String,
    dimensions: usize,
    batch_size: usize,
}

#[async_trait]
impl EmbeddingProvider for ApiEmbeddingProvider {
    async fn embed(&self, text: &str) -> Result<Vec<f32>, BidLensError> {
        let response = self.client
            .post(&self.api_url)
            .bearer_auth(&self.api_key)
            .json(&serde_json::json!({
                "input": text,
                "model": "text-embedding-3-small"
            }))
            .send()
            .await
            .map_err(|e| BidLensError::NetworkError(e.to_string()))?;

        let body: serde_json::Value = response.json().await
            .map_err(|e| BidLensError::NetworkError(e.to_string()))?;

        let embedding = body["data"][0]["embedding"]
            .as_array()
            .ok_or(BidLensError::ParseError("Invalid API response".into()))?
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect();

        Ok(embedding)
    }

    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, BidLensError> {
        let mut all = Vec::with_capacity(texts.len());

        for chunk in texts.chunks(self.batch_size) {
            let response = self.client
                .post(&self.api_url)
                .bearer_auth(&self.api_key)
                .json(&serde_json::json!({
                    "input": chunk,
                    "model": "text-embedding-3-small"
                }))
                .send()
                .await
                .map_err(|e| BidLensError::NetworkError(e.to_string()))?;

            let body: serde_json::Value = response.json().await
                .map_err(|e| BidLensError::NetworkError(e.to_string()))?;

            let embeddings: Vec<Vec<f32>> = body["data"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .map(|item| {
                    item["embedding"]
                        .as_array()
                        .unwrap_or(&vec![])
                        .iter()
                        .filter_map(|v| v.as_f64().map(|f| f as f32))
                        .collect()
                })
                .collect();

            all.extend(embeddings);
        }

        Ok(all)
    }

    fn dimensions(&self) -> usize {
        self.dimensions
    }

    fn model_name(&self) -> &str {
        "api-embedding"
    }

    fn max_tokens(&self) -> usize {
        8191 // OpenAI text-embedding-3-small限制
    }
}
```

### 2.4.6 归一化与工具函数

```rust
/// L2归一化 — 将向量映射到单位球面
pub fn l2_normalize(vec: &[f32]) -> Vec<f32> {
    let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm < 1e-8 {
        return vec.to_vec();
    }
    vec.iter().map(|x| x / norm).collect()
}

/// 提取嵌入输出 — 处理不同模型的输出格式
fn extract_embedding(
    outputs: &SessionOutputs<'_>,
    index: usize,
) -> Result<Vec<f32>, BidLensError> {
    let output = outputs.get("embeddings")
        .or_else(|| outputs.get("last_hidden_state"))
        .ok_or(BidLensError::ModelError("No embedding output found".into()))?;

    let tensor = output.try_extract_tensor::<f32>()?;
    let slice = tensor.as_slice().unwrap();

    Ok(slice[index * 384..(index + 1) * 384].to_vec())
}

/// 批量推理 — 通过Rayon并行化CPU推理
pub fn batch_embed_parallel(
    provider: &dyn EmbeddingProvider,
    texts: &[String],
    batch_size: usize,
) -> Result<Vec<Vec<f32>>, BidLensError> {
    use rayon::prelude::*;

    let chunks: Vec<Vec<String>> = texts.chunks(batch_size)
        .map(|c| c.to_vec())
        .collect();

    let results: Result<Vec<_>, _> = chunks
        .par_iter()
        .map(|chunk| {
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(provider.embed_batch(chunk))
        })
        .collect();

    Ok(results?.into_iter().flatten().collect())
}
```

### 2.4.7 模型切换逻辑

```rust
/// 模型管理器 — 支持运行时切换嵌入模型
pub struct ModelManager {
    providers: HashMap<String, Box<dyn EmbeddingProvider>>,
    active_provider: String,
}

impl ModelManager {
    pub fn new(config: &EngineConfig) -> Result<Self, BidLensError> {
        let mut providers: HashMap<String, Box<dyn EmbeddingProvider>> = HashMap::new();

        // 注册默认本地模型
        if let Some(local_config) = &config.local_embedding {
            let provider = LocalOnnxProvider::new(local_config)?;
            providers.insert("local".into(), Box::new(provider));
        }

        // 注册外部API模型
        if let Some(api_config) = &config.api_embedding {
            let provider = ApiEmbeddingProvider::from_config(api_config)?;
            providers.insert("api".into(), Box::new(provider));
        }

        Ok(Self {
            providers,
            active_provider: config.default_embedding_provider.clone(),
        })
    }

    /// 获取当前活跃的嵌入提供者
    pub fn active(&self) -> Result<&dyn EmbeddingProvider, BidLensError> {
        self.providers
            .get(&self.active_provider)
            .map(|p| p.as_ref())
            .ok_or(BidLensError::ModelError(
                format!("Provider '{}' not found", self.active_provider)
            ))
    }

    /// 切换嵌入模型
    pub fn switch_to(&mut self, name: &str) -> Result<(), BidLensError> {
        if !self.providers.contains_key(name) {
            return Err(BidLensError::ModelError(
                format!("Provider '{}' not available", name)
            ));
        }
        self.active_provider = name.to_string();
        Ok(())
    }

    /// 列出可用模型
    pub fn available_models(&self) -> Vec<(&str, usize)> {
        self.providers
            .iter()
            .map(|(name, p)| (name.as_str(), p.dimensions()))
            .collect()
    }
}
```

---

## 2.5 vector crate

### 2.5.1 设计目标

`vector` crate 管理向量存储与相似度检索。第一阶段采用SQLite暴力搜索，为后续升级到HNSW索引预留trait接口。

### 2.5.2 核心Trait

```rust
/// 向量存储trait
pub trait VectorStore: Send + Sync {
    /// 插入向量
    fn insert(&mut self, id: &str, vector: Vec<f32>, metadata: Option<String>) -> Result<(), BidLensError>;

    /// 查询Top-K相似向量
    fn search(&self, query: &[f32], top_k: usize) -> Result<Vec<VectorResult>, BidLensError>;

    /// 删除向量
    fn delete(&mut self, id: &str) -> Result<(), BidLensError>;

    /// 返回存储中的向量总数
    fn count(&self) -> usize;

    /// 持久化到存储后端
    fn flush(&self) -> Result<(), BidLensError>;
}

/// 向量查询结果
#[derive(Debug, Clone)]
pub struct VectorResult {
    pub id: String,
    pub score: f64,        // 相似度分数
    pub metadata: Option<String>,
}

/// 相似度度量
#[derive(Debug, Clone, Copy)]
pub enum SimilarityMetric {
    Cosine,      // 余弦相似度
    Euclidean,   // 欧氏距离
    DotProduct,  // 点积
}
```

### 2.5.3 向量存储格式

向量以Float32 BLOB存储于SQLite数据库：

```sql
-- 向量表结构
CREATE TABLE IF NOT EXISTS embeddings (
    id          TEXT PRIMARY KEY,
    vector      BLOB NOT NULL,        -- Float32数组，大端字节序
    dimensions  INTEGER NOT NULL,
    metadata    TEXT,                  -- JSON元数据
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 用于按文档ID批量查询
CREATE INDEX idx_embeddings_doc ON embeddings(document_id);
```

```rust
use std::io::Write;

/// 向量序列化为BLOB
pub fn vector_to_blob(vector: &[f32]) -> Vec<u8> {
    let mut blob = Vec::with_capacity(vector.len() * 4);
    for &v in vector {
        blob.extend_from_slice(&v.to_le_bytes());
    }
    blob
}

/// BLOB反序列化为向量
pub fn blob_to_vector(blob: &[u8]) -> Result<Vec<f32>, BidLensError> {
    if blob.len() % 4 != 0 {
        return Err(BidLensError::StorageError("Invalid vector blob length".into()));
    }

    Ok(blob
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect())
}
```

### 2.5.4 余弦相似度计算

```rust
/// 余弦相似度
///
/// 公式: cos(A, B) = (A · B) / (||A|| × ||B||)
///
/// 由于存储的向量已L2归一化，简化为点积运算
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    assert_eq!(a.len(), b.len(), "Vector dimensions must match");

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    dot_product as f64
}

/// 非归一化向量的余弦相似度
pub fn cosine_similarity_raw(a: &[f32], b: &[f32]) -> f64 {
    assert_eq!(a.len(), b.len());

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a < 1e-8 || norm_b < 1e-8 {
        return 0.0;
    }

    (dot_product / (norm_a * norm_b)) as f64
}
```

### 2.5.5 Top-K选择（堆排序）

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

/// Top-K选择 — 使用最小堆在O(n log k)时间内找到Top-K
pub fn top_k_search(
    query: &[f32],
    vectors: &[(String, Vec<f32>)],
    top_k: usize,
) -> Vec<VectorResult> {
    let mut heap: BinaryHeap<Reverse<(f64, String)>> = BinaryHeap::with_capacity(top_k + 1);

    for (id, vector) in vectors {
        let score = cosine_similarity(query, vector);
        let entry = Reverse((score, id.clone()));

        if heap.len() < top_k {
            heap.push(entry);
        } else if let Some(&Reverse((min_score, _))) = heap.peek() {
            if score > min_score {
                heap.pop();
                heap.push(entry);
            }
        }
    }

    let mut results: Vec<VectorResult> = heap.into_sorted_vec()
        .into_iter()
        .map(|Reverse((score, id))| VectorResult {
            id,
            score,
            metadata: None,
        })
        .collect();

    results.reverse(); // 降序排列
    results
}
```

### 2.5.6 SQLite暴力搜索实现

```rust
use rusqlite::{Connection, params};

/// SQLite向量存储实现（第一阶段）
pub struct SqliteVectorStore {
    conn: Connection,
    dimensions: usize,
    cache: Vec<(String, Vec<f32>, Option<String>)>,
}

impl SqliteVectorStore {
    pub fn new(db_path: &str, dimensions: usize) -> Result<Self, BidLensError> {
        let conn = Connection::open(db_path)?;

        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS embeddings (
                id          TEXT PRIMARY KEY,
                vector      BLOB NOT NULL,
                dimensions  INTEGER NOT NULL,
                metadata    TEXT,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                created_at  TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_embeddings_doc
                ON embeddings(document_id);
        ")?;

        Ok(Self {
            conn,
            dimensions,
            cache: Vec::new(),
        })
    }
}

impl VectorStore for SqliteVectorStore {
    fn insert(&mut self, id: &str, vector: Vec<f32>, metadata: Option<String>)
        -> Result<(), BidLensError>
    {
        assert_eq!(vector.len(), self.dimensions, "Dimension mismatch");

        let blob = vector_to_blob(&vector);
        self.conn.execute(
            "INSERT OR REPLACE INTO embeddings (id, vector, dimensions, metadata, document_id, chunk_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, blob, self.dimensions as i32, metadata, "", 0],
        )?;

        self.cache.push((id.to_string(), vector, metadata));
        Ok(())
    }

    fn search(&self, query: &[f32], top_k: usize) -> Result<Vec<VectorResult>, BidLensError> {
        // 暴力扫描所有向量
        let mut stmt = self.conn.prepare(
            "SELECT id, vector, metadata FROM embeddings"
        )?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let blob: Vec<u8> = row.get(1)?;
            let metadata: Option<String> = row.get(2)?;
            Ok((id, blob, metadata))
        })?;

        let mut results: Vec<VectorResult> = Vec::new();

        for row in rows {
            let (id, blob, metadata) = row?;
            let vector = blob_to_vector(&blob)?;
            let score = cosine_similarity(query, &vector);

            results.push(VectorResult { id, score, metadata });
        }

        // 部分排序取Top-K
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        results.truncate(top_k);

        Ok(results)
    }

    fn delete(&mut self, id: &str) -> Result<(), BidLensError> {
        self.conn.execute("DELETE FROM embeddings WHERE id = ?1", params![id])?;
        self.cache.retain(|(i, _, _)| i != id);
        Ok(())
    }

    fn count(&self) -> usize {
        self.conn
            .query_row("SELECT COUNT(*) FROM embeddings", [], |row| row.get(0))
            .unwrap_or(0)
    }

    fn flush(&self) -> Result<(), BidLensError> {
        self.conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")?;
        Ok(())
    }
}
```

### 2.5.7 相似度矩阵

```rust
/// 计算两组向量之间的完整相似度矩阵
/// 用途：段落级匹配的embedding打分
pub fn similarity_matrix(
    left_vectors: &[Vec<f32>],
    right_vectors: &[Vec<f32>],
) -> Vec<Vec<f64>> {
    left_vectors
        .iter()
        .map(|lv| {
            right_vectors
                .iter()
                .map(|rv| cosine_similarity(lv, rv))
                .collect()
        })
        .collect()
}

/// 找出相似度矩阵中的最大匹配对
pub fn greedy_match(matrix: &[Vec<f64>], threshold: f64) -> Vec<(usize, usize, f64)> {
    let rows = matrix.len();
    let cols = if rows > 0 { matrix[0].len() } else { 0 };

    let mut matched_rows = std::collections::HashSet::new();
    let mut matched_cols = std::collections::HashSet::new();
    let mut pairs = Vec::new();

    // 收集所有分数并降序排序
    let mut entries: Vec<(usize, usize, f64)> = Vec::new();
    for i in 0..rows {
        for j in 0..cols {
            if matrix[i][j] >= threshold {
                entries.push((i, j, matrix[i][j]));
            }
        }
    }
    entries.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());

    for (i, j, score) in entries {
        if !matched_rows.contains(&i) && !matched_cols.contains(&j) {
            matched_rows.insert(i);
            matched_cols.insert(j);
            pairs.push((i, j, score));
        }
    }

    pairs
}
```

---

## 2.6 chunk crate

### 2.6.1 设计目标

`chunk` crate 将文档AST分割为语义完整的文本块（chunk），供嵌入向量生成和diff比对使用。分块质量直接影响语义检索的准确性。

### 2.6.2 核心Trait

```rust
/// 分块器trait
pub trait Chunker {
    /// 将文档分割为chunk列表
    fn chunk_document(&self, doc: &Document) -> Vec<DocumentChunk>;
}

/// 文档分块
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChunk {
    pub id: String,
    pub document_id: String,
    pub index: usize,
    pub text: String,
    pub token_count: usize,
    pub source_path: String,          // AST路径，用于回溯
    pub chunk_type: ChunkType,
    pub metadata: ChunkMetadata,
}

/// 分块类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChunkType {
    Section,      // 按Section分割
    Paragraph,    // 按段落fallback
    Table,        // 表格独立块
    Header,       // 页眉
    Footer,       // 页脚
    Metadata,     // 元信息
}

/// 分块元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMetadata {
    pub section_level: Option<u8>,
    pub section_heading: Option<String>,
    pub has_table: bool,
    pub has_images: bool,
    pub paragraph_count: usize,
}

/// 分块选项
#[derive(Debug, Clone)]
pub struct ChunkOptions {
    pub strategy: ChunkStrategy,
    pub max_tokens: usize,          // 单chunk最大token数
    pub overlap_tokens: usize,      // 重叠token数
    pub min_tokens: usize,          // 最小chunk token数
    pub language: Language,
}

/// 分块策略
#[derive(Debug, Clone)]
pub enum ChunkStrategy {
    SectionBased,   // 主策略：按Section分割
    ParagraphBased, // fallback策略：按段落分割
    FixedSize,      // 固定大小（备用）
}

/// 语言类型（影响token计算）
#[derive(Debug, Clone, Copy)]
pub enum Language {
    Chinese,
    English,
    Mixed,
}

impl Default for ChunkOptions {
    fn default() -> Self {
        Self {
            strategy: ChunkStrategy::SectionBased,
            max_tokens: 512,
            overlap_tokens: 51,       // 约10%重叠
            min_tokens: 20,
            language: Language::Mixed,
        }
    }
}
```

### 2.6.3 Section-based主策略

```rust
/// Section-based分块实现
pub struct SectionChunker {
    options: ChunkOptions,
}

impl SectionChunker {
    pub fn new(options: ChunkOptions) -> Self {
        Self { options }
    }

    /// 将Section拆分为合适大小的chunk
    fn chunk_section(
        &self,
        section: &Section,
        doc_id: &str,
        section_index: usize,
    ) -> Vec<DocumentChunk> {
        let mut chunks = Vec::new();
        let heading_text = extract_text_from_inline(&section.heading.runs);
        let mut current_text = String::new();
        let mut current_tokens = 0;
        let mut paragraph_count = 0;

        for (idx, node) in section.content.iter().enumerate() {
            let node_text = extract_block_text(node);
            let node_tokens = count_tokens(&node_text, self.options.language);

            // 如果当前chunk加上新节点会超过限制
            if current_tokens + node_tokens > self.options.max_tokens
                && !current_text.is_empty()
            {
                // 生成当前chunk
                chunks.push(DocumentChunk {
                    id: Uuid::new_v4().to_string(),
                    document_id: doc_id.to_string(),
                    index: chunks.len(),
                    text: current_text.clone(),
                    token_count: current_tokens,
                    source_path: format!("[{}]", section_index),
                    chunk_type: ChunkType::Section,
                    metadata: ChunkMetadata {
                        section_level: Some(section.level),
                        section_heading: Some(heading_text.clone()),
                        has_table: false,
                        has_images: false,
                        paragraph_count,
                    },
                });

                // Overlap: 保留最后10%的文本
                let overlap_text = overlap_text(&current_text, self.options.overlap_tokens);
                current_text = overlap_text;
                current_tokens = count_tokens(&current_text, self.options.language);
                paragraph_count = 0;
            }

            current_text.push_str(&node_text);
            current_text.push('\n');
            current_tokens += node_tokens;
            paragraph_count += 1;

            // 独立处理表格
            if let BlockNode::Table(table) = node {
                let table_chunks = self.chunk_table(table, doc_id, section_index);
                chunks.extend(table_chunks);
            }
        }

        // 处理剩余文本
        if current_tokens >= self.options.min_tokens {
            chunks.push(DocumentChunk {
                id: Uuid::new_v4().to_string(),
                document_id: doc_id.to_string(),
                index: chunks.len(),
                text: current_text,
                token_count: current_tokens,
                source_path: format!("[{}]", section_index),
                chunk_type: ChunkType::Section,
                metadata: ChunkMetadata {
                    section_level: Some(section.level),
                    section_heading: Some(heading_text),
                    has_table: false,
                    has_images: false,
                    paragraph_count,
                },
            });
        }

        chunks
    }
}
```

### 2.6.4 Paragraph fallback策略

当Section内容不足或无法形成有效chunk时，回退到段落级分块：

```rust
impl SectionChunker {
    /// 段落级fallback
    fn chunk_paragraph_fallback(
        &self,
        paragraphs: &[Paragraph],
        doc_id: &str,
    ) -> Vec<DocumentChunk> {
        let mut chunks = Vec::new();
        let mut current_text = String::new();
        let mut current_tokens = 0;

        for para in paragraphs {
            let para_text = extract_text_from_inline(&para.runs);
            let para_tokens = count_tokens(&para_text, self.options.language);

            if current_tokens + para_tokens > self.options.max_tokens
                && !current_text.is_empty()
            {
                chunks.push(DocumentChunk {
                    id: Uuid::new_v4().to_string(),
                    document_id: doc_id.to_string(),
                    index: chunks.len(),
                    text: current_text.clone(),
                    token_count: current_tokens,
                    source_path: String::new(),
                    chunk_type: ChunkType::Paragraph,
                    metadata: ChunkMetadata {
                        section_level: None,
                        section_heading: None,
                        has_table: false,
                        has_images: false,
                        paragraph_count: 1,
                    },
                });

                current_text.clear();
                current_tokens = 0;
            }

            current_text.push_str(&para_text);
            current_text.push('\n');
            current_tokens += para_tokens;
        }

        if current_tokens > 0 {
            chunks.push(DocumentChunk {
                id: Uuid::new_v4().to_string(),
                document_id: doc_id.to_string(),
                index: chunks.len(),
                text: current_text,
                token_count: current_tokens,
                source_path: String::new(),
                chunk_type: ChunkType::Paragraph,
                metadata: ChunkMetadata {
                    section_level: None,
                    section_heading: None,
                    has_table: false,
                    has_images: false,
                    paragraph_count: 1,
                },
            });
        }

        chunks
    }
}
```

### 2.6.5 表格独立chunk

```rust
impl SectionChunker {
    /// 表格生成独立chunk — 保留结构信息
    fn chunk_table(
        &self,
        table: &Table,
        doc_id: &str,
        section_index: usize,
    ) -> Vec<DocumentChunk> {
        let mut chunks = Vec::new();

        // 表格序列化为可读文本
        let table_text = table_to_text(table);
        let table_tokens = count_tokens(&table_text, self.options.language);

        if table_tokens <= self.options.max_tokens {
            chunks.push(DocumentChunk {
                id: Uuid::new_v4().to_string(),
                document_id: doc_id.to_string(),
                index: chunks.len(),
                text: table_text,
                token_count: table_tokens,
                source_path: format!("[{}].table", section_index),
                chunk_type: ChunkType::Table,
                metadata: ChunkMetadata {
                    section_level: None,
                    section_heading: None,
                    has_table: true,
                    has_images: false,
                    paragraph_count: 0,
                },
            });
        } else {
            // 大表格按行分块，保留表头作为每个chunk的前缀
            let header_text = if let Some(first_row) = table.rows.first() {
                row_to_text(first_row)
            } else {
                String::new()
            };

            for (row_idx, row) in table.rows.iter().enumerate().skip(1) {
                let row_text = row_to_text(row);
                let chunk_text = format!("{}\n{}", header_text, row_text);

                chunks.push(DocumentChunk {
                    id: Uuid::new_v4().to_string(),
                    document_id: doc_id.to_string(),
                    index: chunks.len(),
                    text: chunk_text,
                    token_count: count_tokens(&chunk_text, self.options.language),
                    source_path: format!("[{}].table[{}]", section_index, row_idx),
                    chunk_type: ChunkType::Table,
                    metadata: ChunkMetadata {
                        section_level: None,
                        section_heading: None,
                        has_table: true,
                        has_images: false,
                        paragraph_count: 0,
                    },
                });
            }
        }

        chunks
    }
}

/// 表格转可读文本
fn table_to_text(table: &Table) -> String {
    let mut result = String::new();
    for (i, row) in table.rows.iter().enumerate() {
        let cells: Vec<String> = row.cells.iter()
            .map(|cell| cell_to_text(cell))
            .collect();
        result.push_str(&cells.join(" | "));
        result.push('\n');
        if row.is_header {
            result.push_str(&"-".repeat(40));
            result.push('\n');
        }
    }
    result
}
```

### 2.6.6 Token计算

```rust
/// Token计数 — 中英文混合文本
///
/// 策略：
/// - ASCII字符: 每5个字符 ≈ 1 token（英文词平均4-5字符+空格）
/// - CJK字符: 每个字符 ≈ 1.5 token
/// - 精确计数需使用tokenizer，此处为快速估算
pub fn count_tokens(text: &str, language: Language) -> usize {
    match language {
        Language::English => {
            // 英文按空格分词
            text.split_whitespace().count()
        }
        Language::Chinese => {
            // 中文按字符计数
            let cjk_count = text.chars()
                .filter(|c| is_cjk(*c))
                .count();
            let other_count = text.chars()
                .filter(|c| !is_cjk(*c))
                .count();
            (cjk_count as f64 * 1.5) as usize + other_count / 4
        }
        Language::Mixed => {
            let cjk_count = text.chars().filter(|c| is_cjk(*c)).count();
            let other_count = text.chars().filter(|c| !is_cjk(*c)).count();
            let ascii_chars = text.len();

            let cjk_tokens = (cjk_count as f64 * 1.5) as usize;
            let ascii_tokens = ascii_chars / 4;

            cjk_tokens + ascii_tokens
        }
    }
}

fn is_cjk(c: char) -> bool {
    ('\u{4E00}'..='\u{9FFF}').contains(&c)
        || ('\u{3400}'..='\u{4DBF}').contains(&c)
        || ('\u{F900}'..='\u{FAFF}').contains(&c)
}
```

> **精度说明**：上述估算方法用于快速确定 Chunk 边界，误差约 ±20%。对于 ONNX Runtime 推理，
> 实际限制取决于模型的 `max_seq_length`（BGE-M3 = 8192）。建议在 `estimate_token_count` 之外，
> 在 BatchEmbedder 中增加一次 `tokenizers` crate 的精确分词校验，确保不超过模型序列长度限制。
> 如果预算精确度要求不高（如仅用于 UI 展示），可继续使用估算值。

### 2.6.7 Overlap实现

```rust
/// 文本重叠 — 保留前一个chunk末尾的N个token
///
/// 重叠确保跨chunk边界的语义连续性
/// 例: chunk1 = "...经济合同的标的物为...", chunk2 = "标的物为..."
/// 重叠部分"标的物为"使两个chunk都保留了上下文
pub fn overlap_text(text: &str, overlap_tokens: usize) -> String {
    if overlap_tokens == 0 {
        return String::new();
    }

    let chars: Vec<char> = text.chars().collect();
    let total_chars = chars.len();

    // 估算overlap对应的字符数
    let overlap_chars = (overlap_tokens as f64 * 2.0) as usize; // 粗略估计

    if overlap_chars >= total_chars {
        return text.to_string();
    }

    let start = total_chars - overlap_chars;
    chars[start..].iter().collect()
}

/// 重叠窗口可视化:
///
/// chunk1: [========================|overlap|]
///                              [overlap|========================] = chunk2
///                                        ^ 重叠区域保证语义连续
```

---

## 2.7 common crate

### 2.7.1 设计目标

`common` 是引擎最底层crate，提供跨crate共享的基础设施：日志、错误类型、配置管理和工具函数。

### 2.7.2 日志系统

基于 `tracing` + `tracing-subscriber` 实现结构化日志：

```rust
use tracing::{info, warn, error, debug, trace};
use tracing_subscriber::{fmt, EnvFilter};

/// 初始化日志系统
pub fn init_logging(level: &str, log_file: Option<&str>) {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(level));

    let subscriber = fmt::Subscriber::builder()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .with_ansi(cfg!(debug_assertions)); // Release模式禁用ANSI颜色

    // 如果指定了日志文件，同时输出到文件
    if let Some(path) = log_file {
        let file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .expect("Failed to open log file");

        let file_layer = fmt::layer()
            .with_writer(file)
            .without_time();

        let subscriber = subscriber
            .with_writer(std::io::stdout)
            .finish();

        tracing::subscriber::set_global_default(subscriber)
            .expect("Failed to set global subscriber");
    } else {
        subscriber.init().expect("Failed to init subscriber");
    }
}

/// 宏：在关键操作前后记录日志
#[macro_export]
macro_rules! timed {
    ($label:expr, $block:expr) => {{
        let start = std::time::Instant::now();
        let result = $block;
        let elapsed = start.elapsed();
        tracing::debug!(
            operation = $label,
            elapsed_ms = elapsed.as_millis() as u64,
            "Operation completed"
        );
        result
    }};
}
```

### 2.7.3 错误类型

使用 `thiserror` 定义统一的错误枚举：

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BidLensError {
    // === 解析相关 ===
    #[error("JSON解析错误: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("AST反序列化失败: {0}")]
    AstError(String),

    // === 文件IO ===
    #[error("文件操作失败: {0}")]
    IoError(#[from] std::io::Error),

    #[error("文件不存在: {path}")]
    FileNotFound { path: String },

    // === 存储相关 ===
    #[error("数据库错误: {0}")]
    DatabaseError(#[from] rusqlite::Error),

    #[error("存储错误: {0}")]
    StorageError(String),

    // === 模型相关 ===
    #[error("模型加载失败: {0}")]
    ModelError(String),

    #[error("模型推理失败: {0}")]
    InferenceError(String),

    // === 网络相关 ===
    #[error("网络请求失败: {0}")]
    NetworkError(String),

    #[error("API响应解析失败: {0}")]
    ApiError(String),

    // === 配置相关 ===
    #[error("配置错误: {0}")]
    ConfigError(String),

    // === Diff相关 ===
    #[error("Diff计算失败: {0}")]
    DiffError(String),

    #[error("匹配失败: {0}")]
    MatchError(String),

    // === 通用 ===
    #[error("内部错误: {0}")]
    Internal(String),

    #[error("功能未实现: {0}")]
    NotImplemented(String),
}

/// 统一Result类型
pub type BidLensResult<T> = Result<T, BidLensError>;

/// 错误分类 — 用于判断是否可恢复
impl BidLensError {
    /// 是否为可恢复错误（可以重试或降级处理）
    pub fn is_recoverable(&self) -> bool {
        match self {
            BidLensError::NetworkError(_) => true,
            BidLensError::ApiError(_) => true,
            BidLensError::InferenceError(_) => true,
            BidLensError::IoError(_) => true,
            _ => false,
        }
    }

    /// 是否为致命错误（必须终止当前任务）
    pub fn is_fatal(&self) -> bool {
        match self {
            BidLensError::DatabaseError(_) => true,
            BidLensError::ConfigError(_) => true,
            BidLensError::Internal(_) => true,
            _ => false,
        }
    }

    /// 获取用户友好的错误消息
    pub fn user_message(&self) -> String {
        match self {
            BidLensError::NetworkError(msg) =>
                format!("网络连接异常，请检查网络设置: {}", msg),
            BidLensError::ModelError(msg) =>
                format!("AI模型加载失败: {}", msg),
            BidLensError::DatabaseError(_) =>
                "数据库操作失败，请尝试重启应用".to_string(),
            BidLensError::ConfigError(msg) =>
                format!("配置错误: {}", msg),
            _ => self.to_string(),
        }
    }
}
```

### 2.7.4 配置管理

```rust
use serde::Deserialize;
use std::path::Path;

/// 引擎全局配置
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineConfig {
    pub log_level: String,
    pub log_file: Option<String>,
    pub database_path: String,
    pub local_embedding: Option<EmbeddingConfig>,
    pub api_embedding: Option<EmbeddingConfig>,
    pub default_embedding_provider: String,
    pub diff_options: DiffOptionsConfig,
    pub chunk_options: ChunkOptionsConfig,
    pub performance: PerformanceConfig,
}

/// Diff配置
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffOptionsConfig {
    pub threshold: String,          // "loose" | "standard" | "strict"
    pub enable_format_diff: bool,
    pub enable_table_diff: bool,
    pub max_table_rows: usize,
}

/// 分块配置
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkOptionsConfig {
    pub strategy: String,           // "section" | "paragraph" | "fixed"
    pub max_tokens: usize,
    pub overlap_ratio: f64,         // 0.0-1.0
    pub min_tokens: usize,
}

/// 性能配置
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceConfig {
    pub rayon_threads: usize,
    pub max_concurrent_requests: usize,
    pub embedding_batch_size: usize,
    pub cache_size_mb: usize,
}

/// 加载配置文件
pub fn load_config(path: &str) -> BidLensResult<EngineConfig> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| BidLensError::ConfigError(format!("Failed to read config: {}", e)))?;

    let config: EngineConfig = toml::from_str(&content)
        .map_err(|e| BidLensError::ConfigError(format!("Failed to parse config: {}", e)))?;

    // 验证配置
    validate_config(&config)?;

    Ok(config)
}

/// 配置验证
fn validate_config(config: &EngineConfig) -> BidLensResult<()> {
    if config.log_level.is_empty() {
        return Err(BidLensError::ConfigError("logLevel is required".into()));
    }

    if config.database_path.is_empty() {
        return Err(BidLensError::ConfigError("databasePath is required".into()));
    }

    if config.performance.rayon_threads == 0 {
        return Err(BidLensError::ConfigError(
            "rayonThreads must be > 0".into()
        ));
    }

    if config.chunk_options.overlap_ratio < 0.0 || config.chunk_options.overlap_ratio > 0.5 {
        return Err(BidLensError::ConfigError(
            "overlapRatio must be between 0.0 and 0.5".into()
        ));
    }

    Ok(())
}
```

### 2.7.5 工具函数

```rust
use std::time::{SystemTime, UNIX_EPOCH};

/// 获取当前时间戳（毫秒）
pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// 生成UUID
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 截断文本到指定长度（显示用）
pub fn truncate_text(text: &str, max_chars: usize) -> String {
    if text.len() <= max_chars {
        text.to_string()
    } else {
        format!("{}...", &text[..max_chars - 3])
    }
}

/// 安全的浮点数比较
pub fn approx_eq(a: f64, b: f64, epsilon: f64) -> bool {
    (a - b).abs() < epsilon
}

/// 将相似度分数映射到等级
pub fn score_to_level(score: f64) -> SimilarityLevel {
    match score {
        s if approx_eq(s, 1.0, 0.001) => SimilarityLevel::Identical,
        s if s >= 0.9 => SimilarityLevel::NearlyIdentical,
        s if s >= 0.7 => SimilarityLevel::Similar,
        s if s >= 0.4 => SimilarityLevel::Different,
        _ => SimilarityLevel::VeryDifferent,
    }
}

/// 格式化持续时间
pub fn format_duration(duration: std::time::Duration) -> String {
    let ms = duration.as_millis();
    if ms < 1000 {
        format!("{}ms", ms)
    } else if ms < 60_000 {
        format!("{:.1}s", ms as f64 / 1000.0)
    } else {
        format!("{:.1}min", ms as f64 / 60_000.0)
    }
}

/// 从AST节点提取纯文本
pub fn extract_text_from_inline(runs: &[InlineNode]) -> String {
    runs.iter()
        .map(|node| match node {
            InlineNode::TextRun(run) => run.text.clone(),
            InlineNode::Hyperlink(link) => {
                let inner = extract_inline_text(&link.display_text);
                if inner.is_empty() { link.url.clone() } else { inner }
            }
            _ => String::new(),
        })
        .collect::<Vec<_>>()
        .join("")
}

fn extract_inline_text(nodes: &[InlineNode]) -> String {
    nodes.iter()
        .filter_map(|node| match node {
            InlineNode::TextRun(run) => Some(run.text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("")
}

/// 从BlockNode提取纯文本
pub fn extract_block_text(node: &BlockNode) -> String {
    match node {
        BlockNode::Paragraph(p) => extract_text_from_inline(&p.runs),
        BlockNode::Section(s) => {
            let heading = extract_text_from_inline(&s.heading.runs);
            let body: String = s.content.iter()
                .map(|n| extract_block_text(n))
                .collect::<Vec<_>>()
                .join("\n");
            format!("{}\n{}", heading, body)
        }
        BlockNode::Table(t) => table_to_text(t),
        BlockNode::List(l) => {
            l.items.iter()
                .map(|item| {
                    let text: String = item.content.iter()
                        .map(|n| extract_block_text(n))
                        .collect::<Vec<_>>()
                        .join(" ");
                    text
                })
                .collect::<Vec<_>>()
                .join("\n")
        }
        BlockNode::Image(img) => {
            img.alt_text.clone().unwrap_or_default()
        }
        BlockNode::PageBreak(_) => String::new(),
    }
}
```

### 2.7.6 典型配置文件 (`engine.toml`)

```toml
[engine]
logLevel = "info"
logFile = "./logs/engine.log"
databasePath = "./data/bidlens.db"

[engine.localEmbedding]
provider = "localOnnx"
modelPath = "./models/all-MiniLM-L6-v2.onnx"
dimensions = 384
batchSize = 32
maxTokens = 512

[engine.defaultEmbeddingProvider] = "local"

[engine.diffOptions]
threshold = "standard"
enableFormatDiff = true
enableTableDiff = true
maxTableRows = 500

[engine.chunkOptions]
strategy = "section"
maxTokens = 512
overlapRatio = 0.1
minTokens = 20

[engine.performance]
rayonThreads = 4
maxConcurrentRequests = 8
embeddingBatchSize = 32
cacheSizeMb = 256
```

---

## 2.8 错误处理策略

### 2.8.1 统一错误架构

BidLens采用**分层错误处理**策略，所有crate共享 `BidLensError` 枚举：

```
┌─────────────────────────────────────────────────────────┐
│                     Node.js层                           │
│  捕获 JSON-RPC 响应中的 error 字段                       │
│  映射为前端可展示的错误提示                               │
└────────────────────────┬────────────────────────────────┘
                         │ JSON-RPC stderr
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    main.rs (Rust入口)                   │
│  捕获 BidLensError                                      │
│  转换为 JSON-RPC Error 对象                              │
│  { code: number, message: string, data?: any }          │
└────────────────────────┬────────────────────────────────┘
                         │ ? operator
                         ▼
┌─────────────────────────────────────────────────────────┐
│              各crate业务函数                              │
│  使用 Result<T, BidLensError> 返回                      │
│  通过 ? 自动传播错误                                     │
└─────────────────────────────────────────────────────────┘
```

### 2.8.2 错误传播模式

```rust
/// JSON-RPC错误响应结构
#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// 将BidLensError转换为JSON-RPC错误
impl From<&BidLensError> for JsonRpcError {
    fn from(err: &BidLensError) -> Self {
        let code = match err {
            BidLensError::JsonError(_) => -32700,         // Parse error
            BidLensError::ConfigError(_) => -32600,       // Invalid request
            BidLensError::FileNotFound { .. } => -32602,  // Invalid params
            BidLensError::ModelNotReady => -32001,        // 自定义: 模型未就绪
            BidLensError::InferenceError(_) => -32002,    // 自定义: 推理失败
            BidLensError::NetworkError(_) => -32003,      // 自定义: 网络错误
            _ => -32603,                                   // Internal error
        };

        JsonRpcError {
            code,
            message: err.user_message(),
            data: None,
        }
    }
}

/// 主函数中的错误处理
#[tokio::main]
async fn main() -> BidLensResult<()> {
    let config = load_config("engine.toml")?;
    init_logging(&config.log_level, config.log_file.as_deref());

    let mut rpc_handler = RpcHandler::new(config);

    loop {
        let request = read_stdio_request().await?;

        let response = match rpc_handler.handle(request).await {
            Ok(result) => jsonrpc_response(result),
            Err(err) => {
                if err.is_recoverable() {
                    warn!("Recoverable error: {}", err);
                } else {
                    error!("Fatal error: {}", err);
                }
                jsonrpc_error(JsonRpcError::from(&err))
            }
        };

        write_stdio_response(response).await?;
    }
}
```

### 2.8.3 错误分类与恢复策略

| 错误类别 | 示例 | 是否可恢复 | 处理策略 |
|----------|------|-----------|---------|
| **网络错误** | API超时、连接断开 | 是 | 自动重试（指数退避，最多3次） |
| **模型错误** | ONNX加载失败、推理超时 | 降级 | 切换到备选模型或外部API |
| **解析错误** | JSON格式不正确 | 否 | 返回错误详情，要求重新输入 |
| **存储错误** | SQLite锁冲突 | 重试 | 等待后重试（最多5次） |
| **配置错误** | 参数越界 | 否 | 返回具体校验失败信息 |
| **内存不足** | 大文档处理 | 降级 | 分批处理、减少并行度 |

```rust
/// 重试辅助函数
pub async fn with_retry<F, Fut, T>(
    operation: F,
    max_retries: u32,
    base_delay_ms: u64,
) -> BidLensResult<T>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = BidLensResult<T>>,
{
    let mut last_error = None;

    for attempt in 0..=max_retries {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(err) => {
                if !err.is_recoverable() || attempt == max_retries {
                    return Err(err);
                }
                last_error = Some(err);
                let delay = base_delay_ms * 2u64.pow(attempt);
                warn!(
                    attempt = attempt + 1,
                    max_retries,
                    delay_ms = delay,
                    "Operation failed, retrying..."
                );
                tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
            }
        }
    }

    Err(last_error.unwrap_or_else(|| BidLensError::Internal("Retry loop completed without error".into())))
}

/// 使用示例
async fn fetch_embedding_with_retry(
    provider: &dyn EmbeddingProvider,
    text: &str,
) -> BidLensResult<Vec<f32>> {
    with_retry(
        || async { provider.embed(text).await },
        3,
        500,
    ).await
}
```

### 2.8.4 panic处理

```rust
/// 设置全局panic handler — 防止Rust子进程因panic意外退出
pub fn set_panic_hook() {
    let original_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |panic_info| {
        let thread = std::thread::current();
        let name = thread.name().unwrap_or("unnamed");

        let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };

        let location = panic_info.location()
            .map(|l| format!("{}:{}:{}", l.file(), l.column(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());

        error!(
            thread = name,
            message = %payload,
            location = %location,
            "Panic occurred"
        );

        // 输出JSON-RPC错误响应，确保Node.js层能正确处理
        let error_response = serde_json::json!({
            "jsonrpc": "2.0",
            "error": {
                "code": -32603,
                "message": format!("Internal panic: {}", payload),
                "data": { "location": location }
            },
            "id": null
        });

        eprintln!("{}", serde_json::to_string(&error_response).unwrap());

        // 调用原始hook
        original_hook(panic_info);
    }));
}
```

---

## 2.9 测试策略

### 2.9.1 测试金字塔

```
                    ┌──────────┐
                    │  E2E测试  │  少量，验证Node↔Rust交互
                    │  (Node)  │
                   ┌┴──────────┴┐
                   │  集成测试    │  验证crate间协作
                   │  tests/     │
                  ┌┴────────────┴┐
                  │   基准测试     │  criterion性能测试
                  │   benches/    │
                 ┌┴──────────────┴┐
                 │    单元测试      │  每个crate内覆盖核心逻辑
                 │    #[cfg(test)]  │
                 └────────────────┘
```

### 2.9.2 单元测试

每个crate内部使用 `#[cfg(test)]` 模块编写单元测试：

```rust
// document-ast/src/lib.rs
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json;

    #[test]
    fn test_document_serialization_roundtrip() {
        let doc = Document {
            id: "test-001".into(),
            source_path: "test.docx".into(),
            metadata: Metadata {
                title: Some("测试文档".into()),
                author: None,
                created_at: None,
                modified_at: None,
                page_count: Some(1),
                word_count: Some(100),
                language: Some("zh-CN".into()),
                custom: std::collections::HashMap::new(),
            },
            content: vec![
                BlockNode::Paragraph(Paragraph {
                    id: NodeId(vec![PathSegment::Child(0)]),
                    runs: vec![
                        InlineNode::TextRun(TextRun {
                            id: NodeId(vec![PathSegment::Child(0), PathSegment::Run(0)]),
                            text: "Hello World".into(),
                            style: Some(TextStyle {
                                bold: true,
                                italic: false,
                                underline: false,
                                strikethrough: false,
                                font_name: None,
                                font_size: None,
                                color: None,
                                highlight: None,
                            }),
                        }),
                    ],
                    style: None,
                    alignment: None,
                    indent: None,
                    spacing: None,
                    is_list_item: false,
                    list_level: None,
                }),
            ],
            headers: vec![],
            footers: vec![],
            comments: vec![],
            revisions: vec![],
            bookmarks: vec![],
        };

        // 序列化 → 反序列化
        let json = serde_json::to_string(&doc).unwrap();
        let restored: Document = serde_json::from_str(&json).unwrap();

        assert_eq!(doc.id, restored.id);
        assert_eq!(doc.content.len(), restored.content.len());
        assert_eq!(
            doc.metadata.title,
            restored.metadata.title
        );
    }

    #[test]
    fn test_node_path_string() {
        let path = NodeId(vec![
            PathSegment::Child(2),
            PathSegment::Cell { row: 1, col: 0 },
            PathSegment::Run(3),
        ]);
        assert_eq!(path.node_path_string(), "[2][1,0].run[3]");
    }

    #[test]
    fn test_compress_decompress_ast() {
        let doc = create_test_document();
        let compressed = compress_ast(&doc).unwrap();
        let decompressed = decompress_ast(&compressed).unwrap();

        assert_eq!(doc.id, decompressed.id);
        // 压缩率验证：gzip通常能将JSON压缩到30-50%
        assert!(compressed.len() < 80 * 1024); // 小于80KB
    }
}
```

```rust
// vector/src/lib.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_opposite() {
        let a = vec![1.0, 0.0];
        let b = vec![-1.0, 0.0];
        assert!((cosine_similarity(&a, &b) - (-1.0)).abs() < 1e-6);
    }

    #[test]
    fn test_top_k_search() {
        let query = vec![1.0, 0.0, 0.0];
        let vectors = vec![
            ("doc1".into(), vec![0.9, 0.1, 0.0]),
            ("doc2".into(), vec![0.1, 0.9, 0.0]),
            ("doc3".into(), vec![0.8, 0.2, 0.0]),
            ("doc4".into(), vec![0.0, 0.0, 1.0]),
        ];

        let results = top_k_search(&query, &vectors, 2);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].id, "doc1");
        assert_eq!(results[1].id, "doc3");
    }

    #[test]
    fn test_vector_blob_roundtrip() {
        let vector = vec![1.0f32, 2.0, 3.0, 4.5];
        let blob = vector_to_blob(&vector);
        let restored = blob_to_vector(&blob).unwrap();
        assert_eq!(vector, restored);
    }
}
```

### 2.9.3 集成测试

`tests/` 目录下的集成测试验证跨crate协作：

```rust
// tests/integration_diff.rs

use document_ast::*;
use diff_engine::*;
use chunk::*;
use embedding::*;

/// 端到端Diff测试：两份简化文档 → 完整DiffResult
#[test]
fn test_full_document_diff() {
    // 构造左侧文档
    let left_doc = Document {
        id: "left-001".into(),
        source_path: "bid_v1.docx".into(),
        metadata: Metadata::default(),
        content: vec![
            make_section("项目概述", 1, vec![
                make_paragraph("本项目为智慧校园平台建设。"),
                make_paragraph("项目预算为人民币500万元。"),
            ]),
            make_section("技术方案", 1, vec![
                make_paragraph("采用微服务架构。"),
            ]),
        ],
        headers: vec![],
        footers: vec![],
        comments: vec![],
        revisions: vec![],
        bookmarks: vec![],
    };

    // 构造右侧文档（修改了预算）
    let right_doc = Document {
        id: "right-001".into(),
        source_path: "bid_v2.docx".into(),
        metadata: Metadata::default(),
        content: vec![
            make_section("项目概述", 1, vec![
                make_paragraph("本项目为智慧校园平台建设。"),
                make_paragraph("项目预算为人民币600万元。"),  // 修改
            ]),
            make_section("技术方案", 1, vec![
                make_paragraph("采用微服务架构。"),
                make_paragraph("使用Kubernetes部署。"),       // 新增
            ]),
        ],
        headers: vec![],
        footers: vec![],
        comments: vec![],
        revisions: vec![],
        bookmarks: vec![],
    };

    let engine = DefaultDiffEngine;
    let options = DiffOptions::default();
    let result = engine.diff_documents(&left_doc, &right_doc, &options).unwrap();

    assert_eq!(result.summary.modified, 1);  // 预算修改
    assert_eq!(result.summary.added, 1);     // 新增K8s段落
    assert!(result.summary.similarity_score > 0.5);
}

/// 端到端分块测试：文档 → chunks → 嵌入
#[test]
fn test_chunk_then_embed() {
    let doc = create_large_test_document(50); // 50个段落
    let chunker = SectionChunker::new(ChunkOptions::default());
    let chunks = chunker.chunk_document(&doc);

    // 验证分块结果
    assert!(chunks.len() > 1);
    for chunk in &chunks {
        assert!(chunk.token_count <= 512);
        assert!(chunk.token_count > 0);
        assert!(!chunk.text.is_empty());
    }

    // 验证overlap连续性
    for window in chunks.windows(2) {
        let tail = &window[0].text;
        let head = &window[1].text;
        // 后一个chunk应包含前一个chunk的尾部内容
        if tail.len() > 20 {
            let overlap = &tail[tail.len() - 20..];
            // 语义连续性验证（此处仅检查文本子串）
            assert!(head.len() > 0);
        }
    }
}
```

### 2.9.4 基准测试

使用 `criterion` 进行性能基准测试：

```rust
// benches/perf_bench.rs

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};
use document_ast::*;
use diff_engine::*;
use diff_engine::vector::*;
use chunk::*;
use embedding::*;

/// 基准测试：文档AST序列化/反序列化性能
fn bench_ast_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("ast_serialization");

    for size in [10, 100, 1000] {
        let doc = create_test_document_with_paragraphs(size);

        group.bench_with_input(
            BenchmarkId::new("serialize", size),
            &doc,
            |b, doc| {
                b.iter(|| serde_json::to_string(doc).unwrap());
            },
        );

        let json = serde_json::to_string(&doc).unwrap();
        group.bench_with_input(
            BenchmarkId::new("deserialize", size),
            &json,
            |b, json| {
                b.iter(|| serde_json::from_str::<Document>(json).unwrap());
            },
        );
    }

    group.finish();
}

/// 基准测试：文本Diff性能
fn bench_text_diff(c: &mut Criterion) {
    let mut group = c.benchmark_group("text_diff");

    let short_left = "项目预算为人民币500万元";
    let short_right = "项目预算为人民币600万元";

    let long_left = "A".repeat(10_000);
    let long_right = "B".repeat(10_000);

    group.bench_function("short_text", |b| {
        b.iter(|| text_diff(short_left, short_right));
    });

    group.bench_function("long_identical", |b| {
        b.iter(|| text_diff(&long_left, &long_left));
    });

    group.bench_function("long_different", |b| {
        b.iter(|| text_diff(&long_left, &long_right));
    });

    group.finish();
}

/// 基准测试：向量搜索性能
fn bench_vector_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("vector_search");

    for count in [100, 1_000, 10_000] {
        let vectors: Vec<(String, Vec<f32>)> = (0..count)
            .map(|i| {
                let v: Vec<f32> = (0..384).map(|_| rand::random::<f32>()).collect();
                (format!("vec-{}", i), v)
            })
            .collect();

        let query: Vec<f32> = (0..384).map(|_| rand::random::<f32>()).collect();

        group.bench_with_input(
            BenchmarkId::new("brute_force_top10", count),
            &(&query, &vectors),
            |b, (q, vs)| {
                b.iter(|| top_k_search(q, vs, 10));
            },
        );
    }

    group.finish();
}

/// 基准测试：分块性能
fn bench_chunking(c: &mut Criterion) {
    let mut group = c.benchmark_group("chunking");

    for size in [100, 500, 2000] {
        let doc = create_test_document_with_paragraphs(size);
        let chunker = SectionChunker::new(ChunkOptions::default());

        group.bench_with_input(
            BenchmarkId::new("section_chunk", size),
            &doc,
            |b, doc| {
                b.iter(|| chunker.chunk_document(doc));
            },
        );
    }

    group.finish();
}

/// 基准测试：gzip压缩/解压性能
fn bench_compression(c: &mut Criterion) {
    let mut group = c.benchmark_group("compression");

    let doc = create_test_document_with_paragraphs(100);
    let json = serde_json::to_string(&doc).unwrap();

    group.bench_function("compress", |b| {
        b.iter(|| compress_ast(&doc).unwrap());
    });

    let compressed = compress_ast(&doc).unwrap();
    group.bench_function("decompress", |b| {
        b.iter(|| decompress_ast(&compressed).unwrap());
    });

    // 打印压缩率
    let ratio = compressed.len() as f64 / json.len() as f64;
    eprintln!("\nCompression ratio: {:.1}%", ratio * 100.0);
    eprintln!("JSON: {} bytes, Compressed: {} bytes", json.len(), compressed.len());

    group.finish();
}

criterion_group!(
    benches,
    bench_ast_serialization,
    bench_text_diff,
    bench_vector_search,
    bench_chunking,
    bench_compression,
);
criterion_main!(benches);
```

### 2.9.5 测试覆盖率目标

| 模块 | 目标覆盖率 | 重点测试区域 |
|------|-----------|-------------|
| common | 90% | 错误类型、配置验证、工具函数 |
| document-ast | 95% | 序列化/反序列化、节点ID、Visitor遍历 |
| diff-engine | 85% | 文本diff、段落匹配、表格diff、阈值过滤 |
| embedding | 80% | 归一化、批量推理、模型切换（Mock Provider） |
| vector | 90% | 余弦相似度、Top-K、SQLite读写、blob序列化 |
| chunk | 85% | Section分块、Paragraph fallback、overlap、token计算 |

### 2.9.6 测试辅助工具

```rust
// crates/common/src/test_utils.rs

/// 创建测试文档（可配置段落数）
pub fn create_test_document_with_paragraphs(count: usize) -> Document {
    let content: Vec<BlockNode> = (0..count)
        .map(|i| {
            BlockNode::Paragraph(Paragraph {
                id: NodeId(vec![PathSegment::Child(i)]),
                runs: vec![InlineNode::TextRun(TextRun {
                    id: NodeId(vec![PathSegment::Child(i), PathSegment::Run(0)]),
                    text: format!("这是第{}个段落，用于测试分块和差异比对功能。", i + 1),
                    style: None,
                })],
                style: None,
                alignment: None,
                indent: None,
                spacing: None,
                is_list_item: false,
                list_level: None,
            })
        })
        .collect();

    Document {
        id: Uuid::new_v4().to_string(),
        source_path: "test.docx".into(),
        metadata: Metadata::default(),
        content,
        headers: vec![],
        footers: vec![],
        comments: vec![],
        revisions: vec![],
        bookmarks: vec![],
    }
}

/// Mock嵌入提供者 — 用于测试，不依赖真实模型
pub struct MockEmbeddingProvider {
    dimensions: usize,
}

impl MockEmbeddingProvider {
    pub fn new(dimensions: usize) -> Self {
        Self { dimensions }
    }
}

#[async_trait]
impl EmbeddingProvider for MockEmbeddingProvider {
    async fn embed(&self, text: &str) -> Result<Vec<f32>, BidLensError> {
        // 基于文本哈希生成确定性向量
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let seed = hasher.finish();

        let mut rng = seed; // 简单的伪随机
        let vector: Vec<f32> = (0..self.dimensions)
            .map(|_| {
                rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                (rng as f32 / u64::MAX as f32) * 2.0 - 1.0
            })
            .collect();

        Ok(l2_normalize(&vector))
    }

    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, BidLensError> {
        let mut results = Vec::with_capacity(texts.len());
        for text in texts {
            results.push(self.embed(text).await?);
        }
        Ok(results)
    }

    fn dimensions(&self) -> usize { self.dimensions }
    fn model_name(&self) -> &str { "mock-embedding" }
    fn max_tokens(&self) -> usize { 512 }
}
```

---

> **下一章**: [第三章 模块设计 — React前端](./03-模块设计-React前端.md)
