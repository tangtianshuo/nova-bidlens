# Requirements: v0.3.6 PDF 原文定位与数据提取

**Milestone Goal:** 实现点击关键审查点的提取文本后，弹出 PDF 阅读器并定位到对应原文位置

---

## 1. 数据层扩展

- [x] **PDF-01**: Mapper 保留 MinerU bbox 数据（`[x1, y1, x2, y2]`）到 DocumentAst 节点，不再丢弃
- [x] **PDF-02**: DocumentAst 的 ParagraphNode、TableNode 增加可选 `bbox` 和 `pageIdx` 字段，向后兼容
- [x] **PDF-03**: Evidence 模型增加可选 `sourceBbox`/`targetBbox` 字段（`{page, x1, y1, x2, y2}`），向后兼容
- [x] **PDF-04**: 新增 `risk:getPdfFile` IPC 端点，返回项目内指定 submission 的 PDF 文件路径

## 2. PDF 阅读器

- [x] **PDF-05**: 基于 pdfjs-dist 的应用内 PDF 渲染组件，支持 canvas 渲染
- [x] **PDF-06**: PDF 阅读器以弹出 Drawer 形式显示，点击外部区域自动关闭
- [x] **PDF-07**: PDF 阅读器支持翻页（上/下页按钮 + 滚动）
- [x] **PDF-08**: PDF 阅读器支持缩放（放大/缩小/适应宽度）

## 3. Evidence → PDF 定位

- [x] **PDF-09**: Evidence 卡片显示页码标签（如 "P1-2"），点击后打开 PDF Drawer 并滚动到对应页
- [x] **PDF-10**: 多文件项目时，根据 Evidence.submissionId 打开正确的 PDF 文件
- [x] **PDF-11**: 打开 PDF 后自动滚动到 evidence 所在页面

## 4. 高亮与交互

- [ ] **PDF-12**: PDF 页面上用半透明矩形框高亮 evidence 匹配区域（基于 bbox 坐标）
- [ ] **PDF-13**: 打开 PDF 后自动缩放使高亮区域填满视口（zoom-to-fit）
- [ ] **PDF-14**: 同一页面存在多个 evidence 时，全部高亮显示（批量高亮）
- [ ] **PDF-15**: 悬浮高亮区域显示 tooltip（匹配依据、相似度分数、段落路径）

## 5. 双栏对比

- [ ] **PDF-16**: 支持左右双栏同时显示源文件和目标文件的 PDF
- [ ] **PDF-17**: 双栏模式下，点击一侧 evidence 可同步滚动另一侧到对应位置

---

## Future Requirements（后续 milestone）

- PDF 内文本搜索（pdfjs-dist 内置）
- 页面缩略图侧边栏导航
- Digital PDF bbox 提取（pdf-parse 路径需单独提取坐标）

## Out of Scope

- PDF 编辑/批注 — 只读查看 + 高亮，不做编辑
- PDF OCR — MinerU 已处理，不在 viewer 中重复
- 外部 PDF 窗口 — 保持在应用内，不打断审查流程
- PDF 表单填写 — 与投标审查无关

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PDF-01 | Phase 14 | Complete |
| PDF-02 | Phase 14 | Complete |
| PDF-03 | Phase 14 | Complete |
| PDF-04 | Phase 14 | Complete |
| PDF-05 | Phase 14 | Complete |
| PDF-06 | Phase 14 | Complete |
| PDF-07 | Phase 14 | Complete |
| PDF-08 | Phase 14 | Complete |
| PDF-09 | Phase 15 | Complete |
| PDF-10 | Phase 15 | Complete |
| PDF-11 | Phase 15 | Complete |
| PDF-12 | Phase 16 | Pending |
| PDF-13 | Phase 16 | Pending |
| PDF-14 | Phase 16 | Pending |
| PDF-15 | Phase 16 | Pending |
| PDF-16 | Phase 17 | Pending |
| PDF-17 | Phase 17 | Pending |

**Coverage: 17/17 requirements mapped**
