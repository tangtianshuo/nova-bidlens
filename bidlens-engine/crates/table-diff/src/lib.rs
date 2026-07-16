use document_ast::{BlockNode, CellSpan, TableCell, TableNode};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableDiffResult {
    pub table_match_type: TableMatchType,
    pub structural_changes: Vec<StructuralChange>,
    pub cell_diffs: Vec<CellDiff>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TableMatchType {
    Identical,
    StructureChanged,
    ContentChanged,
    MixedChanges,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StructuralChange {
    RowsAdded { count: usize, position: usize },
    RowsDeleted { count: usize, position: usize },
    ColumnsAdded { count: usize, position: usize },
    ColumnsDeleted { count: usize, position: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CellChangeType {
    Identical,
    Modified,
    Added,
    Deleted,
    SpanChanged,  // 新增：仅合并信息变化
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellDiff {
    pub position: (usize, usize), // (row, col)
    pub change_type: CellChangeType,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
    pub similarity: f32,
    pub old_span: Option<CellSpan>,  // 新增：旧合并信息
    pub new_span: Option<CellSpan>,  // 新增：新合并信息
    pub span_changed: bool,          // 新增：标记合并信息是否变化
}

/// 合并区域信息
#[derive(Debug, Clone)]
struct MergeRegion {
    start_row: usize,
    start_col: usize,
    row_span: usize,
    col_span: usize,
    content: String,
}

/// 提取单元格文本内容
fn extract_cell_text(cell: &TableCell) -> String {
    let mut texts = Vec::new();
    for block in &cell.content {
        match block {
            BlockNode::Paragraph(p) => texts.push(p.text.clone()),
            _ => {} // 忽略嵌套表格
        }
    }
    texts.join(" ")
}

/// 计算两个字符串的Jaccard相似度
fn jaccard_similarity(left: &str, right: &str) -> f32 {
    if left == right {
        return 1.0;
    }
    
    let left_words: HashSet<&str> = left.split_whitespace().collect();
    let right_words: HashSet<&str> = right.split_whitespace().collect();
    
    if left_words.is_empty() && right_words.is_empty() {
        return 1.0;
    }
    
    let intersection = left_words.intersection(&right_words).count() as f32;
    let union = left_words.union(&right_words).count() as f32;
    
    if union == 0.0 {
        0.0
    } else {
        intersection / union
    }
}

/// 获取表格最大列数
fn max_columns(table: &TableNode) -> usize {
    table.rows.iter()
        .map(|row| row.cells.len())
        .max()
        .unwrap_or(0)
}

/// 提取表格中的合并区域
fn extract_merge_regions(table: &TableNode) -> Vec<MergeRegion> {
    let mut regions = Vec::new();
    
    for (row_idx, row) in table.rows.iter().enumerate() {
        for (col_idx, cell) in row.cells.iter().enumerate() {
            if let Some(span) = &cell.span {
                if span.row_span > 1 || span.col_span > 1 {
                    regions.push(MergeRegion {
                        start_row: row_idx,
                        start_col: col_idx,
                        row_span: span.row_span,
                        col_span: span.col_span,
                        content: extract_cell_text(cell),
                    });
                }
            }
        }
    }
    
    regions
}

/// 检查两个合并区域是否重叠
fn regions_overlap(left: &MergeRegion, right: &MergeRegion) -> bool {
    let left_end_row = left.start_row + left.row_span;
    let left_end_col = left.start_col + left.col_span;
    let right_end_row = right.start_row + right.row_span;
    let right_end_col = right.start_col + right.col_span;
    
    !(left.start_row >= right_end_row
        || right.start_row >= left_end_row
        || left.start_col >= right_end_col
        || right.start_col >= left_end_col)
}

/// 检查位置是否在合并区域内
fn is_in_merge_region(row_idx: usize, col_idx: usize, regions: &[MergeRegion]) -> bool {
    regions.iter().any(|r| {
        row_idx >= r.start_row
            && row_idx < r.start_row + r.row_span
            && col_idx >= r.start_col
            && col_idx < r.start_col + r.col_span
    })
}

/// 比较两个合并区域的内容
fn compare_merge_regions(left: &MergeRegion, right: &MergeRegion) -> (CellChangeType, f32) {
    let similarity = jaccard_similarity(&left.content, &right.content);
    
    if left.content == right.content {
        (CellChangeType::Identical, 1.0)
    } else if similarity > 0.5 {
        (CellChangeType::Modified, similarity)
    } else {
        (CellChangeType::Modified, similarity)
    }
}

/// 安全获取单元格
fn get_cell<'a>(table: &'a TableNode, row_idx: usize, col_idx: usize) -> Option<&'a TableCell> {
    table.rows.get(row_idx)
        .and_then(|row| row.cells.get(col_idx))
}

/// 比较两个表格并返回差异结果
pub fn compare_tables(left: &TableNode, right: &TableNode) -> TableDiffResult {
    let left_rows = left.rows.len();
    let right_rows = right.rows.len();
    let left_cols = max_columns(left);
    let right_cols = max_columns(right);
    
    let mut structural_changes = Vec::new();
    let mut cell_diffs = Vec::new();
    let mut has_structural_changes = false;
    let mut has_content_changes = false;
    let mut has_span_changes = false;
    
    // 检测结构变化
    if left_rows != right_rows {
        has_structural_changes = true;
        if right_rows > left_rows {
            structural_changes.push(StructuralChange::RowsAdded {
                count: right_rows - left_rows,
                position: left_rows,
            });
        } else {
            structural_changes.push(StructuralChange::RowsDeleted {
                count: left_rows - right_rows,
                position: right_rows,
            });
        }
    }
    
    if left_cols != right_cols {
        has_structural_changes = true;
        if right_cols > left_cols {
            structural_changes.push(StructuralChange::ColumnsAdded {
                count: right_cols - left_cols,
                position: left_cols,
            });
        } else {
            structural_changes.push(StructuralChange::ColumnsDeleted {
                count: left_cols - right_cols,
                position: right_cols,
            });
        }
    }
    
    // 提取合并区域
    let left_regions = extract_merge_regions(left);
    let right_regions = extract_merge_regions(right);
    
    // 跟踪已处理的合并区域
    let mut processed_left_regions: HashSet<(usize, usize)> = HashSet::new();
    let mut processed_right_regions: HashSet<(usize, usize)> = HashSet::new();
    
    // 比较匹配的合并区域
    for left_region in &left_regions {
        for right_region in &right_regions {
            if regions_overlap(left_region, right_region) {
                let (change_type, similarity) = compare_merge_regions(left_region, right_region);
                
                let span_changed = left_region.row_span != right_region.row_span
                    || left_region.col_span != right_region.col_span;
                
                if span_changed {
                    has_span_changes = true;
                }
                
                if change_type != CellChangeType::Identical || span_changed {
                    has_content_changes = true;
                    
                    cell_diffs.push(CellDiff {
                        position: (left_region.start_row, left_region.start_col),
                        change_type: if span_changed && change_type == CellChangeType::Identical {
                            CellChangeType::SpanChanged
                        } else {
                            change_type
                        },
                        old_content: Some(left_region.content.clone()),
                        new_content: Some(right_region.content.clone()),
                        similarity,
                        old_span: Some(CellSpan {
                            row_span: left_region.row_span,
                            col_span: left_region.col_span,
                        }),
                        new_span: Some(CellSpan {
                            row_span: right_region.row_span,
                            col_span: right_region.col_span,
                        }),
                        span_changed,
                    });
                }
                
                processed_left_regions.insert((left_region.start_row, left_region.start_col));
                processed_right_regions.insert((right_region.start_row, right_region.start_col));
                break;
            }
        }
    }
    
    // 处理未匹配的左侧合并区域（被拆分）
    for left_region in &left_regions {
        if !processed_left_regions.contains(&(left_region.start_row, left_region.start_col)) {
            has_content_changes = true;
            cell_diffs.push(CellDiff {
                position: (left_region.start_row, left_region.start_col),
                change_type: CellChangeType::Deleted,
                old_content: Some(left_region.content.clone()),
                new_content: None,
                similarity: 0.0,
                old_span: Some(CellSpan {
                    row_span: left_region.row_span,
                    col_span: left_region.col_span,
                }),
                new_span: None,
                span_changed: true,
            });
        }
    }
    
    // 处理未匹配的右侧合并区域（新增合并）
    for right_region in &right_regions {
        if !processed_right_regions.contains(&(right_region.start_row, right_region.start_col)) {
            has_content_changes = true;
            cell_diffs.push(CellDiff {
                position: (right_region.start_row, right_region.start_col),
                change_type: CellChangeType::Added,
                old_content: None,
                new_content: Some(right_region.content.clone()),
                similarity: 1.0,
                old_span: None,
                new_span: Some(CellSpan {
                    row_span: right_region.row_span,
                    col_span: right_region.col_span,
                }),
                span_changed: true,
            });
        }
    }
    
    // 比较普通单元格（跳过合并区域覆盖的单元格）
    let common_rows = left_rows.min(right_rows);
    let max_common_cols = left_cols.max(right_cols);
    
    for row_idx in 0..common_rows {
        for col_idx in 0..max_common_cols {
            // 检查是否在已处理的合并区域内
            if is_in_merge_region(row_idx, col_idx, &left_regions) 
                || is_in_merge_region(row_idx, col_idx, &right_regions) {
                continue;
            }
            
            let left_cell = get_cell(left, row_idx, col_idx);
            let right_cell = get_cell(right, row_idx, col_idx);
            
            match (left_cell, right_cell) {
                (Some(l_cell), Some(r_cell)) => {
                    let left_text = extract_cell_text(l_cell);
                    let right_text = extract_cell_text(r_cell);
                    let similarity = jaccard_similarity(&left_text, &right_text);
                    
                    if left_text == right_text {
                        cell_diffs.push(CellDiff {
                            position: (row_idx, col_idx),
                            change_type: CellChangeType::Identical,
                            old_content: Some(left_text),
                            new_content: Some(right_text),
                            similarity: 1.0,
                            old_span: l_cell.span.clone(),
                            new_span: r_cell.span.clone(),
                            span_changed: false,
                        });
                    } else {
                        has_content_changes = true;
                        cell_diffs.push(CellDiff {
                            position: (row_idx, col_idx),
                            change_type: CellChangeType::Modified,
                            old_content: Some(left_text),
                            new_content: Some(right_text),
                            similarity,
                            old_span: l_cell.span.clone(),
                            new_span: r_cell.span.clone(),
                            span_changed: false,
                        });
                    }
                }
                (Some(l_cell), None) => {
                    let left_text = extract_cell_text(l_cell);
                    if !left_text.is_empty() {
                        has_content_changes = true;
                        cell_diffs.push(CellDiff {
                            position: (row_idx, col_idx),
                            change_type: CellChangeType::Deleted,
                            old_content: Some(left_text),
                            new_content: None,
                            similarity: 0.0,
                            old_span: l_cell.span.clone(),
                            new_span: None,
                            span_changed: false,
                        });
                    }
                }
                (None, Some(r_cell)) => {
                    let right_text = extract_cell_text(r_cell);
                    if !right_text.is_empty() {
                        has_content_changes = true;
                        cell_diffs.push(CellDiff {
                            position: (row_idx, col_idx),
                            change_type: CellChangeType::Added,
                            old_content: None,
                            new_content: Some(right_text),
                            similarity: 1.0,
                            old_span: None,
                            new_span: r_cell.span.clone(),
                            span_changed: false,
                        });
                    }
                }
                (None, None) => {} // 两边都没有单元格，跳过
            }
        }
    }
    
    // 确定匹配类型
    let table_match_type = if has_structural_changes && (has_content_changes || has_span_changes) {
        TableMatchType::MixedChanges
    } else if has_structural_changes {
        TableMatchType::StructureChanged
    } else if has_content_changes || has_span_changes {
        TableMatchType::ContentChanged
    } else {
        TableMatchType::Identical
    };
    
    // 计算置信度
    let total_cells = cell_diffs.len() as f32;
    let identical_cells = cell_diffs.iter()
        .filter(|d| d.change_type == CellChangeType::Identical)
        .count() as f32;
    
    let confidence = if total_cells == 0.0 {
        1.0
    } else {
        identical_cells / total_cells
    };
    
    TableDiffResult {
        table_match_type,
        structural_changes,
        cell_diffs,
        confidence,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use document_ast::{CellSpan, TableCell, TableRow, RowType, ParagraphNode};

    fn create_cell(id: &str, text: &str) -> TableCell {
        TableCell {
            id: id.to_string(),
            content: vec![BlockNode::Paragraph(ParagraphNode {
                id: format!("{}-p", id),
                text: text.to_string(),
                page_start: None,
                page_end: None,
            })],
            span: None,
            properties: None,
        }
    }

    fn create_cell_with_span(id: &str, text: &str, row_span: usize, col_span: usize) -> TableCell {
        TableCell {
            id: id.to_string(),
            content: vec![BlockNode::Paragraph(ParagraphNode {
                id: format!("{}-p", id),
                text: text.to_string(),
                page_start: None,
                page_end: None,
            })],
            span: Some(CellSpan { row_span, col_span }),
            properties: None,
        }
    }

    fn create_row(id: &str, cells: Vec<TableCell>) -> TableRow {
        TableRow {
            id: id.to_string(),
            cells,
            row_type: RowType::Body,
        }
    }

    fn create_table(id: &str, rows: Vec<TableRow>) -> TableNode {
        TableNode {
            id: id.to_string(),
            rows,
            page_start: None,
            page_end: None,
            properties: None,
        }
    }

    #[test]
    fn test_identical_tables() {
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell("c1", "Header 1"),
                create_cell("c2", "Header 2"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "Value 1"),
                create_cell("c4", "Value 2"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell("c1", "Header 1"),
                create_cell("c2", "Header 2"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "Value 1"),
                create_cell("c4", "Value 2"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert!(result.structural_changes.is_empty());
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn test_content_change() {
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell("c1", "Header 1"),
                create_cell("c2", "Header 2"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "Original Value"),
                create_cell("c4", "Value 2"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell("c1", "Header 1"),
                create_cell("c2", "Header 2"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "Modified Value"),
                create_cell("c4", "Value 2"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::ContentChanged);
        assert!(result.structural_changes.is_empty());
        
        let modified_cells: Vec<_> = result.cell_diffs.iter()
            .filter(|d| d.change_type == CellChangeType::Modified)
            .collect();
        assert_eq!(modified_cells.len(), 1);
        assert_eq!(modified_cells[0].position, (1, 0));
        assert_eq!(modified_cells[0].old_content.as_deref(), Some("Original Value"));
        assert_eq!(modified_cells[0].new_content.as_deref(), Some("Modified Value"));
    }

    #[test]
    fn test_row_addition() {
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell("c1", "Header 1"),
                create_cell("c2", "Header 2"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell("c1", "Header 1"),
                create_cell("c2", "Header 2"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "New Value 1"),
                create_cell("c4", "New Value 2"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::StructureChanged);
        assert_eq!(result.structural_changes.len(), 1);
        
        match &result.structural_changes[0] {
            StructuralChange::RowsAdded { count, position } => {
                assert_eq!(*count, 1);
                assert_eq!(*position, 1);
            }
            _ => panic!("Expected RowsAdded"),
        }
    }

    #[test]
    fn test_column_deletion() {
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell("c1", "A"),
                create_cell("c2", "B"),
                create_cell("c3", "C"),
            ]),
            create_row("r2", vec![
                create_cell("c4", "D"),
                create_cell("c5", "E"),
                create_cell("c6", "F"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell("c1", "A"),
                create_cell("c2", "B"),
            ]),
            create_row("r2", vec![
                create_cell("c4", "D"),
                create_cell("c5", "E"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        // 列删除时，原有的单元格也会被标记为删除，所以是 MixedChanges
        assert_eq!(result.table_match_type, TableMatchType::MixedChanges);
        
        let has_cols_deleted = result.structural_changes.iter().any(|c| {
            matches!(c, StructuralChange::ColumnsDeleted { .. })
        });
        assert!(has_cols_deleted);
    }

    #[test]
    fn test_empty_tables() {
        let left = create_table("t1", vec![]);
        let right = create_table("t2", vec![]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert!(result.structural_changes.is_empty());
        assert!(result.cell_diffs.is_empty());
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn test_empty_vs_non_empty() {
        let left = create_table("t1", vec![]);
        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell("c1", "Value"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::StructureChanged);
        
        let has_rows_added = result.structural_changes.iter().any(|c| {
            matches!(c, StructuralChange::RowsAdded { .. })
        });
        assert!(has_rows_added);
    }

    #[test]
    fn test_mixed_changes() {
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell("c1", "Header"),
                create_cell("c2", "Data"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell("c1", "New Header"),
                create_cell("c2", "Data"),
                create_cell("c3", "Extra"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::MixedChanges);
        assert!(!result.structural_changes.is_empty());
        
        let has_modified = result.cell_diffs.iter()
            .any(|d| d.change_type == CellChangeType::Modified);
        assert!(has_modified);
    }

    #[test]
    fn test_span_change_only() {
        // 测试仅合并信息变化，内容不变
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell_with_span("c1", "Merged", 2, 1),
                create_cell("c2", "A"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "B"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell_with_span("c1", "Merged", 1, 2), // 改为跨列合并
                create_cell("c2", "A"),
            ]),
            create_row("r2", vec![
                create_cell_with_span("c3", "B", 1, 1),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::ContentChanged);
        
        let span_changed_cells: Vec<_> = result.cell_diffs.iter()
            .filter(|d| d.span_changed)
            .collect();
        assert!(!span_changed_cells.is_empty());
    }

    #[test]
    fn test_merge_split_detection() {
        // 测试合并变拆分
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell_with_span("c1", "Merged Cell", 2, 2),
                create_cell("c2", "A"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "B"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell("c1", "Merged Cell"),
                create_cell("c2", "A"),
                create_cell("c3", "C"),
            ]),
            create_row("r2", vec![
                create_cell("c4", "D"),
                create_cell("c5", "E"),
                create_cell("c6", "B"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        // 应该检测到合并区域被拆分
        let deleted_as_split: Vec<_> = result.cell_diffs.iter()
            .filter(|d| d.change_type == CellChangeType::Deleted && d.old_span.is_some())
            .collect();
        
        // 或者检测到新增的单元格
        let added_cells: Vec<_> = result.cell_diffs.iter()
            .filter(|d| d.change_type == CellChangeType::Added)
            .collect();
        
        assert!(!deleted_as_split.is_empty() || !added_cells.is_empty());
    }

    #[test]
    fn test_row_span_merge_content_change() {
        // 测试跨行合并的内容变化
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell_with_span("c1", "Old Merged", 2, 1),
                create_cell("c2", "A"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "B"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell_with_span("c1", "New Merged", 2, 1),
                create_cell("c2", "A"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "B"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::ContentChanged);
        
        let modified_merged: Vec<_> = result.cell_diffs.iter()
            .filter(|d| d.change_type == CellChangeType::Modified && d.old_span.is_some())
            .collect();
        
        assert_eq!(modified_merged.len(), 1);
        assert_eq!(modified_merged[0].old_content.as_deref(), Some("Old Merged"));
        assert_eq!(modified_merged[0].new_content.as_deref(), Some("New Merged"));
    }

    #[test]
    fn test_col_span_merge_content_change() {
        // 测试跨列合并的内容变化
        let left = create_table("t1", vec![
            create_row("r1", vec![
                create_cell_with_span("c1", "Old Horizontal", 1, 2),
                create_cell("c2", "A"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "B"),
                create_cell("c4", "C"),
                create_cell("c5", "D"),
            ]),
        ]);

        let right = create_table("t2", vec![
            create_row("r1", vec![
                create_cell_with_span("c1", "New Horizontal", 1, 2),
                create_cell("c2", "A"),
            ]),
            create_row("r2", vec![
                create_cell("c3", "B"),
                create_cell("c4", "C"),
                create_cell("c5", "D"),
            ]),
        ]);

        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::ContentChanged);
        
        let modified_merged: Vec<_> = result.cell_diffs.iter()
            .filter(|d| d.change_type == CellChangeType::Modified && d.old_span.is_some())
            .collect();
        
        assert_eq!(modified_merged.len(), 1);
        assert_eq!(modified_merged[0].position, (0, 0));
    }
}
