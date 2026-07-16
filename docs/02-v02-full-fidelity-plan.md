# BidLens V0.2 全保真增强 - 详细开发计划

> 版本：v1.0
> 日期：2026-07-16
> 状态：待开发

---

## 一、项目概述

### 1.1 目标
在V0.1语义比对MVP基础上，实现全保真文档比对能力，包括：
- 复杂表格比对（合并单元格、嵌套表格）
- 格式差异检测与展示
- 批注/修订比对
- PDF文本版支持

### 1.2 技术决策回顾

| 决策项 | 选择 |
|--------|------|
| 表格支持 | 复杂表格（合并单元格、嵌套表格） |
| 格式面板 | 单独的格式差异面板 |
| 格式粒度 | 混合模式（段落级+可展开字符级） |
| 格式展示 | 分类列表视图 |
| 表格对齐 | 智能对齐 |
| 表格匹配 | 基于内容相似度 |
| 批注展示 | 内联标记+悬浮提示 |
| PDF支持 | 分阶段（V0.2文本版） |
| 报告导出 | 分章节汇总 |

---

## 二、Sprint 1：表格基础支持（2周）

### 2.1 任务清单

#### Task 1.1: 扩展Document AST支持表格节点
**优先级：** P0
**估时：** 2天
**描述：**
- 扩展BlockNode枚举，新增Table变体
- 定义TableNode、TableRow、TableCell、CellSpan结构体
- 实现序列化/反序列化
- 编写单元测试

**验收标准：**
- [ ] BlockNode::Table可以正确序列化为JSON
- [ ] 支持嵌套内容（单元格内可包含段落）
- [ ] 支持合并单元格信息（row_span, col_span）
- [ ] 所有单元测试通过

**技术细节：**
`ust
// crates/document-ast/src/lib.rs

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BlockNode {
    Paragraph(ParagraphNode),
    Table(TableNode),
    Heading(HeadingNode),
    List(ListNode),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableNode {
    pub id: String,
    pub rows: Vec<TableRow>,
    pub page_start: Option<usize>,
    pub page_end: Option<usize>,
    pub properties: Option<TableProperties>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableRow {
    pub id: String,
    pub cells: Vec<TableCell>,
    pub row_type: RowType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableCell {
    pub id: String,
    pub content: Vec<BlockNode>,
    pub span: Option<CellSpan>,
    pub properties: Option<CellProperties>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CellSpan {
    pub row_span: usize,
    pub col_span: usize,
}
`

---

#### Task 1.2: 实现Word表格解析
**优先级：** P0
**估时：** 3天
**依赖：** Task 1.1
**描述：**
- 使用mammoth.js或docx-parser解析Word表格
- 提取表格结构（行列数、合并单元格）
- 提取单元格内容并转换为BlockNode
- 处理表格属性（边框、宽度等）

**验收标准：**
- [ ] 能正确解析简单表格（无合并单元格）
- [ ] 能正确识别表头、表体、表尾
- [ ] 单元格内容正确转换为ParagraphNode
- [ ] 处理空单元格和跨行跨列

**技术细节：**
`	ypescript
// packages/shared/src/parser/docx-table.ts

export interface ParsedTable {
  id: string;
  rows: ParsedRow[];
  properties?: TableProperties;
}

export function parseDocxTable(tableElement: any): ParsedTable {
  // 1. 提取表格属性
  // 2. 遍历行
  // 3. 遍历单元格
  // 4. 处理合并单元格（gridSpan, vMerge）
  // 5. 提取单元格内容
}
`

---

#### Task 1.3: 实现简单表格比对（相同结构）
**优先级：** P0
**估时：** 3天
**依赖：** Task 1.1
**描述：**
- 创建	able-diff crate
- 实现相同结构表格的逐单元格比对
- 定义TableDiffItem、CellDiff结构
- 支持识别：相同、修改、新增、删除

**验收标准：**
- [ ] 相同结构表格能正确比对
- [ ] 单元格内容变化能被检测
- [ ] 合并单元格变化能被检测
- [ ] 返回结构化的差异结果

**技术细节：**
`ust
// crates/table-diff/src/lib.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableDiffResult {
    pub table_match_type: TableMatchType,
    pub structural_changes: Vec<StructuralChange>,
    pub cell_diffs: Vec<CellDiff>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TableMatchType {
    Identical,
    StructureChanged,
    ContentChanged,
    MixedChanges,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellDiff {
    pub position: (usize, usize), // (row, col)
    pub change_type: CellChangeType,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
    pub similarity: f32,
}

pub fn compare_tables(left: &TableNode, right: &TableNode) -> TableDiffResult {
    // 1. 比较结构（行列数）
    // 2. 逐单元格比对内容
    // 3. 计算相似度
    // 4. 返回差异结果
}
`

---

#### Task 1.4: 表格差异在工作台中展示
**优先级：** P0
**估时：** 2天
**依赖：** Task 1.2, Task 1.3
**描述：**
- 在三栏工作台中识别表格节点
- 以表格形式渲染差异
- 用颜色标记差异单元格
- 支持表格内导航

**验收标准：**
- [ ] 表格在工作台中正确渲染
- [ ] 差异单元格有明显视觉标记
- [ ] 点击差异可跳转到对应位置
- [ ] 支持表格横向滚动

---

### 2.2 Sprint 1 交付物

| 交付物 | 说明 |
|--------|------|
| 扩展的document-ast crate | 支持TableNode |
| 表格解析模块 | Word表格解析 |
| table-diff crate | 简单表格比对 |
| 更新的工作台 | 表格差异展示 |
| 单元测试 | 覆盖率 > 90% |

---

## 三、Sprint 2：表格高级特性（2周）

### 3.1 任务清单

#### Task 2.1: 合并单元格支持
**优先级：** P0
**估时：** 3天
**描述：**
- 完善CellSpan的解析和比对
- 处理跨行(rowSpan)和跨列(colSpan)
- 检测合并/拆分变化

**验收标准：**
- [ ] 正确解析合并单元格
- [ ] 检测合并区域的内容变化
- [ ] 检测合并/拆分的结构变化

---

#### Task 2.2: 智能行列对齐算法
**优先级：** P0
**估时：** 4天
**描述：**
- 实现基于内容相似度的行匹配
- 处理行新增、删除、移动
- 处理列新增、删除、移动

**验收标准：**
- [ ] 行列数不同时能智能对齐
- [ ] 相似行能被正确匹配
- [ ] 新增/删除的行列被正确标记

**技术细节：**
`ust
// 智能对齐算法
fn align_rows(left: &[TableRow], right: &[TableRow]) -> Vec<RowAlignment> {
    // 1. 计算每对行的相似度矩阵
    // 2. 使用贪心或动态规划找最优匹配
    // 3. 标记未匹配的行
}
`

---

#### Task 2.3: 基于内容相似度的匹配
**优先级：** P0
**估时：** 2天
**依赖：** Task 2.2
**描述：**
- 实现单元格内容相似度计算
- 支持文本相似度（Jaccard、编辑距离）
- 支持数字相似度（百分比差异）

**验收标准：**
- [ ] 文本相似度计算准确
- [ ] 数字差异检测准确
- [ ] 相似度阈值可配置

---

#### Task 2.4: 嵌套表格支持
**优先级：** P1
**估时：** 2天
**描述：**
- 单元格内支持嵌套表格
- 递归解析和比对
- 嵌套深度限制（建议最多3层）

**验收标准：**
- [ ] 单元格内嵌套表格正确解析
- [ ] 嵌套表格能正确比对
- [ ] 嵌套深度超限有提示

---

### 3.2 Sprint 2 交付物

| 交付物 | 说明 |
|--------|------|
| 完善的table-diff | 支持合并单元格、智能对齐 |
| 相似度算法模块 | 文本/数字相似度 |
| 嵌套表格支持 | 递归解析比对 |
| 更新的测试用例 | 覆盖复杂场景 |

---

## 四、Sprint 3：格式信息支持（2周）

### 4.1 任务清单

#### Task 3.1: 扩展AST支持格式属性
**优先级：** P1
**估时：** 2天
**描述：**
- 定义TextFormat、ParagraphFormat结构
- 扩展ParagraphNode支持格式信息
- 扩展TableCell支持格式信息

**验收标准：**
- [ ] 格式信息正确序列化
- [ ] 格式属性可选（Option类型）
- [ ] 向后兼容（无格式信息时正常工作）

---

#### Task 3.2: 提取文本格式
**优先级：** P1
**估时：** 2天
**描述：**
- 从Word解析中提取文本格式
- 字体、字号、颜色、粗体、斜体等
- 保留格式范围信息

**验收标准：**
- [ ] 常见文本格式能被提取
- [ ] 格式范围正确标记
- [ ] 无格式文本有默认值

---

#### Task 3.3: 提取段落格式
**优先级：** P1
**估时：** 2天
**描述：**
- 从Word解析中提取段落格式
- 对齐方式、缩进、行距等
- 段落样式名称

**验收标准：**
- [ ] 段落格式正确提取
- [ ] 样式名称保留
- [ ] 默认值处理

---

#### Task 3.4: 格式差异计算引擎
**优先级：** P1
**估时：** 3天
**描述：**
- 创建ormat-diff模块
- 实现格式属性级比较
- 支持段落级和字符级粒度

**验收标准：**
- [ ] 格式差异能被检测
- [ ] 支持混合模式（默认段落级，可展开字符级）
- [ ] 差异结果结构化

---

#### Task 3.5: 分类列表视图的格式面板
**优先级：** P1
**估时：** 3天
**描述：**
- 在工作台中添加格式差异面板
- 按格式类型分组：字体、颜色、段落等
- 每组显示变化数量，可折叠展开
- 点击差异可跳转到对应位置

**验收标准：**
- [ ] 格式差异面板正确显示
- [ ] 分类清晰，便于浏览
- [ ] 点击可跳转
- [ ] 可折叠/展开

---

### 4.2 Sprint 3 交付物

| 交付物 | 说明 |
|--------|------|
| 扩展的AST | 支持格式属性 |
| 格式提取模块 | Word格式解析 |
| format-diff模块 | 格式差异计算 |
| 格式差异面板 | 分类列表视图 |

---

## 五、Sprint 4：批注/修订支持（2周）

### 5.1 任务清单

#### Task 4.1: 扩展AST支持批注/修订
**优先级：** P1
**估时：** 2天
**描述：**
- 定义Comment、Revision结构
- 定义CommentRange、RevisionType
- 扩展DocumentAst支持批注/修订列表

**验收标准：**
- [ ] 批注/修订结构正确序列化
- [ ] 支持批注回复
- [ ] 支持修订状态（接受/拒绝）

---

#### Task 4.2: Word批注解析
**优先级：** P1
**估时：** 2天
**描述：**
- 从Word文档中提取批注
- 解析批注锚点位置
- 解析批注内容和作者
- 解析批注回复链

**验收标准：**
- [ ] 批注内容正确提取
- [ ] 锚点位置正确关联
- [ ] 回复链正确解析

---

#### Task 4.3: Word修订跟踪解析
**优先级：** P1
**估时：** 3天
**描述：**
- 从Word文档中提取修订
- 解析修订类型（插入、删除、格式修改）
- 解析修订作者和时间
- 解析修订状态

**验收标准：**
- [ ] 修订内容正确提取
- [ ] 修订类型正确识别
- [ ] 修订状态正确解析

---

#### Task 4.4: 批注/修订比对引擎
**优先级：** P1
**估时：** 3天
**描述：**
- 比对两个文档的批注差异
- 比对两个文档的修订差异
- 基于锚点位置匹配

**验收标准：**
- [ ] 新增/删除的批注能被检测
- [ ] 修改的批注能被检测
- [ ] 修订差异能被检测

---

#### Task 4.5: 内联标记+悬浮提示展示
**优先级：** P1
**估时：** 2天
**描述：**
- 在文本中标记批注/修订位置
- 使用下划线、背景色等视觉标记
- 鼠标悬浮显示详细内容
- 保持阅读流畅性

**验收标准：**
- [ ] 批注位置有明显标记
- [ ] 悬浮显示详细内容
- [ ] 不遮挡主要内容
- [ ] 样式美观

---

### 5.2 Sprint 4 交付物

| 交付物 | 说明 |
|--------|------|
| 扩展的AST | 支持批注/修订 |
| 批注解析模块 | Word批注提取 |
| 修订解析模块 | Word修订提取 |
| 批注/修订比对 | 差异检测 |
| 内联展示 | 标记+悬浮提示 |

---

## 六、Sprint 5：PDF支持与报告（2周）

### 6.1 任务清单

#### Task 5.1: 文本版PDF解析支持
**优先级：** P1
**估时：** 3天
**描述：**
- 集成pdf-parse库
- 提取PDF文本内容
- 保留页面信息
- 转换为DocumentAst

**验收标准：**
- [ ] 文本版PDF能被解析
- [ ] 页面信息正确保留
- [ ] 转换为标准DocumentAst

---

#### Task 5.2: 分章节汇总报告导出
**优先级：** P1
**估时：** 3天
**描述：**
- 扩展报告导出支持新差异类型
- 按章节组织：内容差异、表格差异、格式差异、批注/修订差异
- 每章节独立统计
- 支持Markdown和HTML格式

**验收标准：**
- [ ] 报告包含所有差异类型
- [ ] 章节结构清晰
- [ ] 统计信息准确
- [ ] Markdown和HTML格式正确

---

#### Task 5.3: 集成测试与端到端测试
**优先级：** P0
**估时：** 3天
**描述：**
- 编写集成测试用例
- 编写端到端测试用例
- 测试文档准备
- 测试覆盖率检查

**验收标准：**
- [ ] 集成测试覆盖所有API
- [ ] 端到端测试覆盖主要场景
- [ ] 测试覆盖率 > 85%
- [ ] 所有测试通过

---

#### Task 5.4: 性能优化记录
**优先级：** P2
**估时：** 2天
**描述：**
- 记录性能瓶颈
- 制定优化方案
- 作为技术债记录

**验收标准：**
- [ ] 性能瓶颈文档化
- [ ] 优化方案制定
- [ ] 技术债务清单更新

---

### 6.2 Sprint 5 交付物

| 交付物 | 说明 |
|--------|------|
| PDF解析模块 | 文本版PDF支持 |
| 报告导出 | 分章节汇总 |
| 测试套件 | 集成+端到端测试 |
| 技术债文档 | 性能优化记录 |

---

## 七、依赖关系图

`
Sprint 1 (表格基础)
├── Task 1.1: AST扩展 ─────────────────────┐
├── Task 1.2: Word表格解析 ──┐              │
├── Task 1.3: 简单表格比对 ──┼── 依赖1.1   │
└── Task 1.4: 工作台展示 ────┘  依赖1.2,1.3│
                                           │
Sprint 2 (表格高级)                         │
├── Task 2.1: 合并单元格 ───────────────────┤
├── Task 2.2: 智能对齐 ─────────────────────┤
├── Task 2.3: 内容相似度 ── 依赖2.2         │
└── Task 2.4: 嵌套表格 ─────────────────────┘
                                          
Sprint 3 (格式支持)
├── Task 3.1: AST格式扩展
├── Task 3.2: 文本格式提取
├── Task 3.3: 段落格式提取
├── Task 3.4: 格式差异计算
└── Task 3.5: 格式面板

Sprint 4 (批注修订)
├── Task 4.1: AST批注扩展
├── Task 4.2: 批注解析
├── Task 4.3: 修订解析
├── Task 4.4: 批注比对
└── Task 4.5: 内联展示

Sprint 5 (PDF与报告)
├── Task 5.1: PDF解析
├── Task 5.2: 报告导出
├── Task 5.3: 测试
└── Task 5.4: 性能记录
`

---

## 八、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 表格解析兼容性 | 高 | 中 | 建立测试文档库，覆盖主流Word版本 |
| 合并单元格复杂度 | 高 | 中 | 渐进式实现，先简单后复杂 |
| 格式提取准确性 | 中 | 中 | 参考成熟库，充分测试 |
| 批注锚点定位 | 中 | 低 | 处理边界情况，充分测试 |
| 性能问题 | 高 | 低 | 记录技术债，后续优化 |

---

## 九、验收标准汇总

### 9.1 功能验收
- [ ] 支持复杂表格比对（合并单元格、嵌套表格）
- [ ] 格式差异检测准确
- [ ] 批注/修订能被检测和展示
- [ ] PDF文本版能被解析
- [ ] 报告导出包含所有差异类型

### 9.2 质量验收
- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试覆盖所有API
- [ ] 端到端测试覆盖主要场景
- [ ] 所有测试通过

### 9.3 性能验收
- [ ] 100页文档解析 < 10秒
- [ ] 表格比对响应 < 3秒
- [ ] 格式差异计算 < 2秒

---

## 十、附录

### 10.1 参考文档
- V0.1架构设计文档
- Document AST规范
- IPC通信协议

### 10.2 相关资源
- mammoth.js文档
- pdf-parse文档
- Rust serde文档

---

**文档状态：** 待审批
**下一步：** 评审并开始Sprint 1开发
