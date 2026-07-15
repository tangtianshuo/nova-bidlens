# 4. Node 解析层模块设计

## 4.1 Node 层职责与架构

### 4.1.1 职责边界

Node 解析层位于 Electron main process 中, 承担文档解析和 Rust 子进程管理两大核心职责。它是前端 UI 与底层引擎之间的桥梁。

```
┌─────────────────────────────────────────────────────────┐
│                    整体架构定位                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐    IPC     ┌──────────────────────┐     │
│  │  Renderer   │◄────────►│    Main Process       │     │
│  │  (React)    │  invoke   │  ┌──────────────────┐│     │
│  │             │  on       │  │   Node 解析层     ││     │
│  │             │           │  │  ┌────────────┐  ││     │
│  │             │           │  │  │ Parser     │  ││     │
│  │             │           │  │  │ Adapters   │  ││     │
│  │             │           │  │  └────────────┘  ││     │
│  │             │           │  │  ┌────────────┐  ││     │
│  │             │           │  │  │ Rust Proc  │  ││     │
│  │             │           │  │  │ Manager    │  ││     │
│  │             │           │  │  └────────────┘  ││     │
│  │             │           │  │  ┌────────────┐  ││     │
│  │             │           │  │  │ Cache      │  ││     │
│  │             │           │  │  │ Manager    │  ││     │
│  │             │           │  │  └────────────┘  ││     │
│  │             │           │  └──────────────────┘│     │
│  └────────────┘           └──────────────────────┘     │
│                                    │  stdio JSON-RPC    │
│                                    ▼                    │
│                           ┌──────────────────┐         │
│                           │   Rust Engine    │         │
│                           │  (子进程)         │         │
│                           └──────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### 4.1.2 核心职责清单

| 职责 | 说明 | 涉及模块 |
|------|------|----------|
| 文档解析 | 将 .docx/.pdf/.md 等格式转换为 DocumentAST | Parser Adapters |
| AST 构建 | 从原始解析结果构建规范化的 JSON AST | AST Builder |
| 文档缓存 | 基于 SHA256 的解析结果缓存 | Cache Manager |
| Rust 进程管理 | spawn/kill/restart/health check | Rust Process Manager |
| IPC 分发 | 处理 renderer 进程的 invoke 请求 | IPC Handlers |
| 任务编排 | 协调解析 → 嵌入 → 比对的完整流水线 | Task Orchestrator |

### 4.1.3 模块依赖关系

```
                    IPC Handlers (入口)
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     Task Orchestrator  Cache      Plugin
            │          Manager     Loader
            ▼
    ┌───────┴───────┐
    ▼               ▼
Parser Adapters   Rust Proc
    │             Manager
    ▼               │
AST Builder         ▼
    │           JSON-RPC
    ▼           Client
Cache Write         │
                    ▼
               Rust Engine
```

---

## 4.2 Parser 适配器框架

### 4.2.1 核心接口定义

```typescript
// shared/types/parser.ts

/**
 * 文档解析器统一接口
 * 所有格式适配器必须实现此接口
 */
interface DocumentParser {
  /** 适配器唯一标识 */
  readonly id: string;

  /** 适配器名称 (用户可读) */
  readonly name: string;

  /** 支持的文件扩展名列表 */
  readonly supportedExtensions: string[];

  /** 支持的 MIME 类型列表 */
  readonly mimeTypes: string[];

  /** 优先级 (数字越小越优先, 用于多个适配器匹配同一扩展名的情况) */
  readonly priority: number;

  /**
   * 检查是否能处理给定文件
   * 可进行更深层的检查 (如读取文件头魔数)
   */
  canParse(input: ParseInput): Promise<boolean>;

  /**
   * 执行解析
   * @param input - 解析输入
   * @param options - 解析选项
   * @param onProgress - 进度回调
   * @returns 解析结果
   */
  parse(
    input: ParseInput,
    options: ParseOptions,
    onProgress?: (progress: ParseProgress) => void
  ): Promise<ParseResult>;
}

/**
 * 解析输入
 */
interface ParseInput {
  /** 文件绝对路径 */
  filePath: string;

  /** 文件名 (含扩展名) */
  fileName: string;

  /** 文件大小 (bytes) */
  fileSize: number;

  /** MIME 类型 (可选, 由检测模块填充) */
  mimeType?: string;
}

/**
 * 解析选项
 */
interface ParseOptions {
  /** 保真级别 1-5 */
  fidelityLevel: 1 | 2 | 3 | 4 | 5;

  /** 是否提取批注 */
  extractComments: boolean;

  /** 是否提取修订记录 */
  extractRevisions: boolean;

  /** 是否提取图片 */
  extractImages: boolean;

  /** 图片提取模式 */
  imageMode: 'skip' | 'placeholder' | 'base64';

  /** 最大解析页数 (0 = 不限制) */
  maxPages: number;

  /** 超时时间 (ms, 0 = 不限制) */
  timeout: number;

  /** 自定义选项 (传递给特定适配器) */
  custom?: Record<string, unknown>;
}

/**
 * 解析结果
 */
interface ParseResult {
  /** 是否成功 */
  success: boolean;

  /** Document AST (成功时有值) */
  ast?: DocumentAST;

  /** 解析警告 (非致命问题) */
  warnings: ParseWarning[];

  /** 解析耗时 (ms) */
  duration: number;

  /** 使用的适配器 ID */
  parserId: string;

  /** 错误信息 (失败时有值) */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 解析警告
 */
interface ParseWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  location?: {
    nodeId?: string;
    page?: number;
    paragraph?: number;
  };
}

/**
 * 解析进度
 */
interface ParseProgress {
  /** 当前阶段 */
  stage: 'reading' | 'extracting' | 'building' | 'normalizing' | 'caching';

  /** 阶段进度 0-100 */
  percent: number;

  /** 阶段描述 (用户可读) */
  detail?: string;
}
```

### 4.2.2 适配器注册与发现机制

```typescript
// parser/registry.ts
class ParserRegistry {
  private parsers: Map<string, DocumentParser> = new Map();
  private extensionIndex: Map<string, DocumentParser[]> = new Map();

  /** 注册适配器 */
  register(parser: DocumentParser): void {
    this.parsers.set(parser.id, parser);

    // 建立扩展名索引 (按优先级排序)
    for (const ext of parser.supportedExtensions) {
      const list = this.extensionIndex.get(ext.toLowerCase()) ?? [];
      list.push(parser);
      list.sort((a, b) => a.priority - b.priority);
      this.extensionIndex.set(ext.toLowerCase(), list);
    }
  }

  /** 按文件扩展名查找适配器 */
  findByExtension(ext: string): DocumentParser | null {
    const list = this.extensionIndex.get(ext.toLowerCase());
    return list?.[0] ?? null;
  }

  /** 按 ID 查找适配器 */
  findById(id: string): DocumentParser | null {
    return this.parsers.get(id) ?? null;
  }

  /** 获取所有已注册适配器 */
  getAll(): DocumentParser[] {
    return Array.from(this.parsers.values());
  }
}
```

### 4.2.3 适配器选择逻辑

```
┌────────────────────────────────────────────────────┐
│              适配器选择流程                           │
├────────────────────────────────────────────────────┤
│                                                     │
│  输入: filePath                                      │
│       │                                              │
│       ▼                                              │
│  提取扩展名 (.docx)                                  │
│       │                                              │
│       ▼                                              │
│  扩展名索引查找 → [docxParser, mammothParser]         │
│       │                                              │
│       ▼                                              │
│  按优先级遍历                                        │
│       │                                              │
│       ├──► canParse() = true → 使用该适配器           │
│       │                                              │
│       └──► canParse() = false → 尝试下一个           │
│                │                                     │
│                └──► 全部失败 → 抛出 FORMAT_NOT_SUPPORTED │
│                                                     │
└────────────────────────────────────────────────────┘
```

`canParse()` 方法除了检查扩展名, 还可以进行更深层的验证。例如 Word 适配器会检查文件头是否为有效的 ZIP 魔数 (`PK\x03\x04`), 以此区分真正的 .docx 文件和伪装成 .docx 的其他文件。

---

## 4.3 Word 适配器详细设计

### 4.3.1 mammoth vs docx4js 选型对比

| 维度 | mammoth | docx4js | 选型结论 |
|------|---------|---------|----------|
| npm 周下载量 | ~200K | ~5K | mammoth 社区更大 |
| TypeScript 支持 | @types/mammoth | 内建 | 平手 |
| 样式提取 | 有限 (HTML转换时) | 原生支持 | docx4js 更优 |
| 批注/修订 | 不支持 | 部分支持 | 都不完善 |
| 图片处理 | 提取为Buffer | 提取为Buffer | 平手 |
| 编号检测 | 不支持 | 部分支持 | 都不完善 |
| 维护状态 | 活跃 | 较慢 | mammoth 更优 |
| 文档质量 | 好 | 一般 | mammoth 更优 |

**结论**: 主解析引擎采用 docx4js (样式提取能力更强), mammoth 作为备用引擎和 HTML 转换用途。对于两个库都不支持的功能 (如批注、高级编号), 基于 JSZip 直接解析底层 XML 实现。

### 4.3.2 解析流程

```
┌─────────────────────────────────────────────────────────┐
│              Word (.docx) 解析流程                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  .docx 文件                                              │
│     │                                                    │
│     ▼                                                    │
│  ┌──────────────┐                                       │
│  │ 1. ZIP 解压   │  JSZip 读取 Buffer                    │
│  │              │  提取 word/document.xml                 │
│  │              │  提取 word/styles.xml                   │
│  │              │  提取 word/numbering.xml                │
│  │              │  提取 word/comments.xml                 │
│  │              │  提取 word/footer*.xml, header*.xml     │
│  │              │  提取 word/media/* (图片)               │
│  └──────┬───────┘                                       │
│         ▼                                                │
│  ┌──────────────┐                                       │
│  │ 2. XML 解析   │  fast-xml-parser 解析各 XML 文件       │
│  │              │  构建内存中的 XML 节点树                 │
│  └──────┬───────┘                                       │
│         ▼                                                │
│  ┌──────────────┐                                       │
│  │ 3. 语义提取   │  遍历 XML 节点树                       │
│  │              │  识别段落、文本、表格、图片              │
│  │              │  提取样式信息                           │
│  │              │  检测编号列表                           │
│  │              │  提取批注/修订                          │
│  └──────┬───────┘                                       │
│         ▼                                                │
│  ┌──────────────┐                                       │
│  │ 4. AST 构建   │  生成 DocumentAST 节点树               │
│  │              │  分配节点 ID                            │
│  │              │  规范化样式                             │
│  │              │  收集警告                               │
│  └──────┬───────┘                                       │
│         ▼                                                │
│  ┌──────────────┐                                       │
│  │ 5. 缓存写入   │  SHA256 → gzip → SQLite               │
│  └──────────────┘                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4.3.3 保真级别 (Fidelity Level) 设计

保真级别决定了从文档中提取信息的深度, 级别越高, 提取越完整但耗时也越长:

| 级别 | 提取内容 | 典型场景 | 预估耗时 (50页) |
|------|----------|----------|-----------------|
| L1 | 纯文本 + 段落结构 | 快速概览 | ~2s |
| L2 | L1 + 基础样式 (加粗/斜体/字号) | 标准比对 | ~3s |
| L3 | L2 + 完整样式 (行距/缩进/对齐) + 编号 | 精确比对 | ~5s |
| L4 | L3 + 图片占位 + 表格列宽 + 页眉页脚 | 高保真 | ~8s |
| L5 | L4 + 批注 + 修订 + 书签 + 域代码 | 全量提取 | ~12s |

```typescript
// parser/word/fidelity.ts
class FidelityExtractor {
  constructor(private level: number) {}

  extractParagraph(pNode: XMLNode): Partial<ParagraphNode> {
    const result: Partial<ParagraphNode> = {};

    // L1: 始终提取文本
    result.textRuns = this.extractTextRuns(pNode);

    // L2+: 基础样式
    if (this.level >= 2) {
      result.style = this.extractBasicStyle(pNode);
    }

    // L3+: 完整样式 + 编号
    if (this.level >= 3) {
      result.style = { ...result.style, ...this.extractFullStyle(pNode) };
      result.numbering = this.extractNumbering(pNode);
    }

    // L5+: 批注关联
    if (this.level >= 5) {
      result.commentIds = this.extractCommentRefs(pNode);
      result.revisions = this.extractRevisions(pNode);
    }

    return result;
  }
}
```

### 4.3.4 编号检测

Word 文档的编号体系是最复杂的解析难点之一。采用三重检测策略:

```
┌─────────────────────────────────────────────────┐
│              编号检测策略                          │
├─────────────────────────────────────────────────┤
│                                                  │
│  策略1: abstractNum 解析 (优先)                   │
│  ┌─────────────────────────────────────────────┐│
│  │ 解析 word/numbering.xml                      ││
│  │ 提取 abstractNum 定义 (编号模板)              ││
│  │ 提取 num → abstractNum 映射关系               ││
│  │ 匹配段落的 numId → 推导编号格式               ││
│  │                                              ││
│  │ 示例: abstractNum[1].level[0]                ││
│  │   format: decimal, text: "%1.", start: 1     ││
│  │   → 生成: 1. 2. 3. ...                       ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  策略2: 正则匹配 (补充)                          │
│  ┌─────────────────────────────────────────────┐│
│  │ 对文本前缀进行正则匹配:                       ││
│  │ /^(\d+\.)\s/         → "1. " "2. "           ││
│  │ /^(\d+\.\d+)\s/      → "1.1 " "2.3 "         ││
│  │ /^(\(\d+\))\s/       → "(1) " "(2) "         ││
│  │ /^([①②③...])\s/    → "① " "② "              ││
│  │ /^([一二三...])\s*、/ → "一、" "二、"          ││
│  │ /^([a-z]\))/         → "a)" "b)"              ││
│  └─────────────────────────────────────────────┘│
│                                                  │
│  策略3: 异常检测 (兜底)                          │
│  ┌─────────────────────────────────────────────┐│
│  │ 检测两种策略的冲突:                           ││
│  │ - abstractNum 说没有编号, 但文本有编号前缀    ││
│  │ - abstractNum 说有编号, 但文本没有对应前缀    ││
│  │ - 编号层级跳跃 (如从1.1直接到1.3)            ││
│  │                                              ││
│  │ 冲突时: 记录警告, 以文本实际内容为准          ││
│  └─────────────────────────────────────────────┘│
│                                                  │
└─────────────────────────────────────────────────┘
```

### 4.3.5 大文件处理策略

V0.1 版本采用 Buffer 整体读入策略, 原因如下:
- .docx 本质是 ZIP 压缩包, ZIP 格式需要完整读取才能解压
- 50 页 Word 文档通常 < 5MB, 内存压力可控
- 简化实现, 降低第一版的复杂度

后续版本 (V0.3+) 将引入流式处理:
- 大文件预检: > 50MB 时提示用户确认
- 分块 XML 解析: 使用 SAX 风格的流式 XML 解析器
- 增量 AST 构建: 边解析边构建, 避免全部加载到内存

### 4.3.6 错误处理与降级策略

```typescript
// parser/word/error-handling.ts
class WordParseErrorHandler {
  /**
   * 尝试从错误中恢复
   * 返回已成功解析的部分 AST, 而非完全失败
   */
  async recoverFromError(
    error: ParseError,
    partialAST: Partial<DocumentAST>
  ): Promise<ParseResult> {
    switch (error.code) {
      case 'ZIP_CORRUPTED':
        // 尝试用 mammoth 的容错模式重新解析
        return this.fallbackToMammoth(error.filePath);

      case 'XML_MALFORMED':
        // 跳过损坏的段落, 继续解析其余内容
        return this.skipAndContinue(partialAST, error.skippedNodes);

      case 'IMAGE_READ_FAILED':
        // 跳过损坏的图片, 用占位符替代
        return this.replaceWithPlaceholder(partialAST, error.imageRefs);

      case 'TIMEOUT':
        // 返回已解析的部分结果
        return this.returnPartial(partialAST);

      default:
        throw error;
    }
  }
}
```

---

## 4.4 未来适配器设计 (V0.4+)

### 4.4.1 PDF 适配器

基于 pdf.js (Mozilla PDF.js) 实现，核心挑战在于 PDF 是**纯展示格式**，没有语义结构（无段落/标题/表格概念），需要通过启发式算法重建。

```
PDF 解析流程 (5 阶段):

.pdf
  │
  ▼
Stage 1: 提取 (pdfjs.getDocument → page.getTextContent)
  │        输出: TextItem[] (每个字符的 x, y, width, height, font, text)
  │
  ▼
Stage 2: 行构建 (按 y 坐标聚类)
  │        算法: y 坐标差 < 行高 × 0.3 → 同一行
  │        输出: Line[] { y, x_start, x_end, items[], font_info }
  │
  ▼
Stage 3: 段落构建 (按行间距分组)
  │        算法: 相邻行 y 差 > 行高 × 1.5 → 新段落
  │        输出: RawParagraph[] { lines[], x_indent }
  │
  ▼
Stage 4: 结构推断 (启发式规则)
  │        - 标题: font_size > body_size × 1.3 → Heading1/2/3
  │        - 列表: x_indent > threshold + "•/1./-" 前缀
  │        - 表格: 矩形线条坐标 → TableCell 网格重建
  │        输出: BlockNode[] (Section, Paragraph, Table, List)
  │
  ▼
Stage 5: 构建 DocumentAST
         标准化输出格式，与 Word 适配器一致
```

**关键挑战与应对策略**：

| 挑战 | 描述 | 应对策略 |
|------|------|---------|
| 标题推断 | 无语义标记，仅靠字体大小 | 多级阈值: body_size × {1.3, 1.5, 1.8, 2.2} → H4-H1 |
| 段落边界 | 行间距不均匀 | 动态阈值: 中位行距 × 1.5 |
| 表格重建 | 无线/虚线表格难以识别 | 结合文本对齐模式 + 列对齐检测 |
| 多栏布局 | 双栏/三栏 PDF | 检测 x 坐标分布聚类，按列分别处理 |
| 页眉页脚 | 每页重复出现的内容 | 跨页去重: 位置相同 + 内容相似 → 识别为页眉/页脚 |
| 编码问题 | 某些 PDF 使用自定义编码 | pdf.js 内置 CMap 支持，覆盖大部分中文 PDF |

**保真度级别**：
- L1-L3: 可实现（文本、段落、页眉页脚）
- L4: 困难（PDF 无绝对定位语义，坐标仅为渲染参数）
- L5: 不支持（PDF 无批注/修订的语义结构）

### 4.4.2 Markdown 适配器

基于 unified/remark 生态，直接获取 Markdown AST (MDAST)，再转换为 DocumentAST。映射关系天然直接，因为两者都是语义化树形结构。

```
.md → remark.parse() → MDAST → transformToDocAST() → DocumentAST

MDAST → DocumentAST 映射表:
─────────────────────────────────────────────────────
MDAST Node           → DocumentAST Node
─────────────────────────────────────────────────────
root                 → Document
heading (depth=1-6)  → Section (headingLevel=1-6)
paragraph            → Paragraph
strong               → TextRun (bold=true)
emphasis             → TextRun (italic=true)
link                 → Hyperlink
image                → Image
list (ordered=false) → List (listType='bullet')
list (ordered=true)  → List (listType='number')
listItem             → ListItem
code                 → Paragraph (monospace style)
blockquote           → Paragraph (indent + italic style)
table                → Table
tableRow             → TableRow
tableCell            → TableCell
thematicBreak        → PageBreak
html                 → Paragraph (raw content)
─────────────────────────────────────────────────────
```

**特殊处理**：
1. **Fenced code block**：映射为 `Paragraph` + `codeBlock` 属性（Document AST 暂无 CodeBlock 节点）
2. **嵌套列表**：通过 `depth` 字段控制 `ListItem` 的嵌套层级
3. **Footnotes**（`[^1]`）：映射为 `Footnote` 节点
4. **Front Matter**（`---` YAML）：解析为 `Metadata` 节点

**保真度级别**：
- L1-L3: 完全支持（Markdown 结构语义完整）
- L4-L5: 不适用（Markdown 无绝对定位、批注、修订概念）

### 4.4.3 HTML 适配器

基于 DOMParser 解析 HTML, 提取结构和样式:

```
.html → DOMParser.parseFromString() → DOM Tree → extractStructure() → DocumentAST
```

需要处理内联 CSS、class 样式、外部样式表引用等复杂情况。

### 4.4.4 Image 适配器 (OCR)

基于 PaddleOCR 实现图片文字识别:

```
.png/.jpg → PaddleOCR.detect() → 文字区域 + 坐标
          → PaddleOCR.recognize() → 文字内容
          → 按坐标排列为段落 → DocumentAST
```

---

## 4.5 Rust 子进程管理

### 4.5.1 生命周期管理

```typescript
// rust/process-manager.ts
class RustProcessManager {
  private process: ChildProcess | null = null;
  private healthCheckTimer: NodeJS.Timer | null = null;
  private restartCount: number = 0;
  private readonly maxRestarts: number = 3;

  /** 启动 Rust 子进程 */
  async spawn(): Promise<void> {
    const rustBin = this.resolveRustBinaryPath();

    this.process = spawn(rustBin, [], {
      stdio: ['pipe', 'pipe', 'pipe'],  // stdin, stdout, stderr
      env: {
        RUST_LOG: 'info',
        ...process.env,
      },
    });

    this.process.stdout!.on('data', (data) => this.handleMessage(data));
    this.process.stderr!.on('data', (data) => this.handleStderr(data));
    this.process.on('exit', (code, signal) => this.handleExit(code, signal));
    this.process.on('error', (err) => this.handleSpawnError(err));

    // 等待 Rust 进程就绪
    await this.waitForReady(5000);

    // 启动心跳
    this.startHealthCheck();
  }

  /** 健康检查 (ping/pong 心跳) */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const pong = await this.rpc.call('ping', {}, 2000);
        if (pong !== 'pong') {
          this.handleUnhealthy('unexpected response');
        }
      } catch {
        this.handleUnhealthy('timeout');
      }
    }, 10_000);  // 每10秒一次心跳
  }

  /** 崩溃处理 */
  private handleExit(code: number | null, signal: string | null): void {
    this.stopHealthCheck();

    if (this.restartCount < this.maxRestarts) {
      this.restartCount++;
      console.warn(`[Rust] 进程退出 (code=${code}, signal=${signal}), 正在重启 (${this.restartCount}/${this.maxRestarts})...`);
      this.spawn();
    } else {
      console.error(`[Rust] 进程持续崩溃, 已达最大重启次数`);
      // 通知 renderer 进程
      this.notifyRenderer('rust:crashed', { code, signal });
    }
  }

  /** 杀死进程 */
  async kill(): Promise<void> {
    this.stopHealthCheck();
    if (this.process) {
      this.process.kill('SIGTERM');

      // 等待优雅退出, 3秒后强制杀死
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 3000);

        this.process!.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });

      this.process = null;
    }
  }
}
```

### 4.5.2 stdio JSON-RPC 通信协议

```
┌──────────────────────────────────────────────────┐
│           stdio JSON-RPC 消息格式                  │
├──────────────────────────────────────────────────┤
│                                                   │
│  请求 (Node → Rust):                              │
│  {"id":1,"method":"embed","params":{"text":"..."}}│
│                                                   │
│  响应 (Rust → Node):                              │
│  {"id":1,"result":{"vector":[0.1,0.2,...]}}       │
│                                                   │
│  错误 (Rust → Node):                              │
│  {"id":1,"error":{"code":-1,"message":"..."}}     │
│                                                   │
│  通知 (Rust → Node, 无id):                        │
│  {"method":"progress","params":{"percent":45}}    │
│                                                   │
│  分隔符: 每条消息以换行符 \n 分隔                   │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 4.5.3 日志收集

Rust 子进程的 stderr 重定向到日志文件:

```typescript
private handleStderr(data: Buffer): void {
  const lines = data.toString('utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    // 解析 Rust 的 tracing 日志格式
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(INFO|WARN|ERROR|DEBUG)\s+(.+)$/);
    if (match) {
      const [, timestamp, level, message] = match;
      this.logger.log(level.toLowerCase(), `[Rust] ${message}`, { timestamp });
    } else {
      this.logger.debug(`[Rust:raw] ${line}`);
    }
  }
}
```

---

## 4.6 文档缓存管理

### 4.6.1 缓存键计算

```typescript
// cache/hash.ts
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

// 缓存键格式: sha256_hash:fidelity_level
// 例如: "a1b2c3d4...e5f6:3"
function buildCacheKey(filePath: string, fidelityLevel: number): string {
  const hash = computeFileHash(filePath);
  return `${hash}:${fidelityLevel}`;
}
```

### 4.6.2 SQLite 缓存 Schema

```sql
CREATE TABLE IF NOT EXISTS doc_cache (
  cache_key     TEXT PRIMARY KEY,           -- SHA256:fidelity
  file_path     TEXT NOT NULL,              -- 原始文件路径
  file_name     TEXT NOT NULL,              -- 文件名
  file_size     INTEGER NOT NULL,           -- 文件大小
  fidelity      INTEGER NOT NULL,           -- 保真级别
  ast_data      BLOB NOT NULL,              -- gzip 压缩的 DocumentAST JSON
  ast_size      INTEGER NOT NULL,           -- 压缩前大小 (bytes)
  compressed_size INTEGER NOT NULL,         -- 压缩后大小 (bytes)
  warnings_json TEXT,                       -- 警告列表 JSON
  parser_id     TEXT NOT NULL,              -- 使用的解析器
  duration_ms   INTEGER NOT NULL,           -- 解析耗时
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  accessed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  access_count  INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cache_accessed ON doc_cache(accessed_at);
```

### 4.6.3 缓存读写流程

```
┌──────────────────────────────────────────────────────┐
│                 缓存读写流程                            │
├──────────────────────────────────────────────────────┤
│                                                       │
│  解析请求                                              │
│     │                                                  │
│     ▼                                                  │
│  计算 cache_key = SHA256(file) + ":" + fidelity        │
│     │                                                  │
│     ▼                                                  │
│  ┌─ SQLite 查询 cache_key ─┐                         │
│  │                          │                         │
│  ├── 命中 ──────────────────┤── 未命中 ──────────────┤
│  │   │                      │   │                     │
│  │   ▼                      │   ▼                     │
│  │  gzip解压 ast_data       │  执行解析               │
│  │   │                      │   │                     │
│  │   ▼                      │   ▼                     │
│  │  JSON.parse → AST        │  AST → JSON.stringify   │
│  │   │                      │   │                     │
│  │   ▼                      │   ▼                     │
│  │  更新 accessed_at        │  gzip 压缩              │
│  │  更新 access_count       │   │                     │
│  │   │                      │   ▼                     │
│  │   ▼                      │  写入 SQLite             │
│  └─ 返回 AST ──────────────┘── 返回 AST ─────────────┘
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 4.6.4 缓存失效策略

采用 **LRU + 磁盘空间上限** 双重策略:

```typescript
// cache/eviction.ts
class CacheEvictionPolicy {
  private readonly maxCacheSize: number;  // bytes
  private readonly maxEntries: number;

  /**
   * 检查是否需要清理缓存
   * 在每次写入新缓存后调用
   */
  async enforce(db: Database): Promise<void> {
    const stats = this.getCacheStats(db);

    // 策略1: 条目数上限
    if (stats.entryCount > this.maxEntries) {
      const excess = stats.entryCount - this.maxEntries;
      await this.evictLRU(db, excess);
    }

    // 策略2: 磁盘空间上限
    if (stats.totalSize > this.maxCacheSize) {
      const excessBytes = stats.totalSize - this.maxCacheSize;
      await this.evictBySize(db, excessBytes);
    }
  }

  /** 按 LRU 淘汰指定数量的缓存条目 */
  private async evictLRU(db: Database, count: number): Promise<void> {
    db.exec(`
      DELETE FROM doc_cache WHERE cache_key IN (
        SELECT cache_key FROM doc_cache
        ORDER BY accessed_at ASC
        LIMIT ${count}
      )
    `);
  }
}
```

---

## 4.7 AST 构建流程

### 4.7.1 转换管线

从原始解析结果到规范化 DocumentAST 的完整管线:

```
┌─────────────────────────────────────────────────────────┐
│              AST 构建管线                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  原始解析结果 (XML节点 / PDF坐标 / MD节点)                │
│     │                                                    │
│     ▼                                                    │
│  ┌──────────────────────┐                               │
│  │ Stage 1: 结构提取     │  识别文档层级结构               │
│  │  - 段落边界检测       │  Section → Paragraph → TextRun │
│  │  - 表格结构识别       │                                │
│  │  - 列表层级推断       │                                │
│  └──────────┬───────────┘                               │
│             ▼                                            │
│  ┌──────────────────────┐                               │
│  │ Stage 2: 样式提取     │  从源格式提取样式属性            │
│  │  - 字体/字号/颜色     │  → 内联样式对象                 │
│  │  - 加粗/斜体/下划线   │                                │
│  │  - 行距/缩进/对齐     │                                │
│  └──────────┬───────────┘                               │
│             ▼                                            │
│  ┌──────────────────────┐                               │
│  │ Stage 3: ID 分配      │  为每个节点生成唯一 ID           │
│  │  - 路径式 ID          │  doc::s1::p3::r2              │
│  │  - 全局唯一性保证     │                                │
│  └──────────┬───────────┘                               │
│             ▼                                            │
│  ┌──────────────────────┐                               │
│  │ Stage 4: 样式规范化   │  统一单位、合并继承样式          │
│  │  - 单位转换 (pt→px)  │                                │
│  │  - 样式继承链解析     │                                │
│  │  - 默认值填充         │                                │
│  └──────────┬───────────┘                               │
│             ▼                                            │
│  ┌──────────────────────┐                               │
│  │ Stage 5: 校验与警告   │  检查 AST 完整性               │
│  │  - 必填字段检查       │                                │
│  │  - 异常值检测         │                                │
│  │  - 警告收集           │                                │
│  └──────────┬───────────┘                               │
│             ▼                                            │
│        DocumentAST                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4.7.2 节点 ID 分配算法

```typescript
// ast/id-allocator.ts
class NodeIdAllocator {
  private counters: Map<string, number> = new Map();

  /**
   * 为子节点分配 ID
   * @param parentPath 父节点路径 (如 "doc::s1::p3")
   * @param nodeType 节点类型缩写 (如 "r" for TextRun)
   * @returns 子节点完整路径 (如 "doc::s1::p3::r2")
   */
  allocate(parentPath: string, nodeType: string): string {
    const key = `${parentPath}::${nodeType}`;
    const count = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, count);
    return `${parentPath}::${nodeType}${count}`;
  }

  /** 重置计数器 (用于新文档) */
  reset(): void {
    this.counters.clear();
  }
}

// 使用示例
const allocator = new NodeIdAllocator();
const docId = 'doc';
const sectionId = allocator.allocate(docId, 's');      // doc::s1
const paraId = allocator.allocate(sectionId, 'p');      // doc::s1::p1
const runId = allocator.allocate(paraId, 'r');          // doc::s1::p1::r1
```

### 4.7.3 样式规范化

```typescript
// ast/style-normalizer.ts
class StyleNormalizer {
  /** 单位转换表 */
  private unitConversions: Record<string, (v: number) => number> = {
    'pt': (v) => v,                    // Point 保持不变
    'px': (v) => v * 0.75,            // Pixel → Point
    'em': (v) => v * 12,              // Em → Point (基准12pt)
    'cm': (v) => v * 28.35,           // Centimeter → Point
    'in': (v) => v * 72,              // Inch → Point
    'half-points': (v) => v / 2,      // Word 内部单位 → Point
    'twips': (v) => v / 20,           // Twip → Point
  };

  /** 规范化段落样式 */
  normalizeParagraphStyle(raw: RawParagraphStyle): NormalizedStyle {
    return {
      fontSize: this.normalizeFontSize(raw.fontSize),
      fontFamily: raw.fontFamily ?? '宋体',
      bold: raw.bold ?? false,
      italic: raw.italic ?? false,
      underline: raw.underline ?? 'none',
      color: this.normalizeColor(raw.color),
      backgroundColor: this.normalizeColor(raw.backgroundColor),
      lineHeight: this.normalizeLineHeight(raw.lineHeight),
      textAlign: raw.textAlign ?? 'left',
      textIndent: this.normalizeLength(raw.textIndent),
      marginLeft: this.normalizeLength(raw.marginLeft),
      marginRight: this.normalizeLength(raw.marginRight),
      marginTop: this.normalizeLength(raw.marginTop),
      marginBottom: this.normalizeLength(raw.marginBottom),
    };
  }

  /** 合并段落样式与行内样式 */
  mergeStyles(paragraph: NormalizedStyle, inline: NormalizedStyle): NormalizedStyle {
    // 行内样式覆盖段落样式
    return { ...paragraph, ...inline };
  }
}
```

### 4.7.4 警告收集

```typescript
// ast/warning-collector.ts
class WarningCollector {
  private warnings: ParseWarning[] = [];

  add(code: string, message: string, severity: ParseWarning['severity'], location?: any): void {
    this.warnings.push({ code, message, severity, location });
  }

  getWarnings(): ParseWarning[] {
    return [...this.warnings];
  }

  /** 常见警告码 */
  static readonly CODES = {
    EMPTY_PARAGRAPH: 'W001',           // 空段落
    MISSING_STYLE: 'W002',             // 缺少样式定义
    BROKEN_IMAGE: 'W003',              // 图片引用损坏
    NUMBERING_MISMATCH: 'W004',        // 编号不一致
    NESTING_TOO_DEEP: 'W005',          // 嵌套层级过深 (>10)
    UNEXPECTED_ELEMENT: 'W006',        // 未知的 XML 元素
    STYLE_INHERITANCE_BREAK: 'W007',   // 样式继承链断裂
    EMPTY_TABLE_CELL: 'W008',          // 空表格单元格
    COMMENT_ORPHAN: 'W009',            // 孤立批注 (无关联文本)
    REVISION_CONFLICT: 'W010',         // 修订冲突
  } as const;
}
```

---

> **本章小结**: Node 解析层作为 Electron main process 的核心模块, 通过适配器模式支持多种文档格式的统一解析。Word 适配器基于 docx4js + JSZip + XML 解析的组合方案, 实现了 L1-L5 五级保真度的渐进式提取。Rust 子进程通过 stdio JSON-RPC 通信, 具备心跳检测和自动重启能力。SHA256 缓存机制避免重复解析, LRU + 空间上限的双策略确保缓存不会无限增长。AST 构建管线通过五阶段转换, 将原始解析结果规范化为统一的 DocumentAST。
