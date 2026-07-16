use document_ast::{BlockNode, TableNode};
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellDiff {
    pub position: (usize, usize), // (row, col)
    pub change_type: CellChangeType,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
    pub similarity: f32,
}

/// Extract text content from a cell's content blocks
fn extract_cell_text(cell: &document_ast::TableCell) -> String {
    let mut texts = Vec::new();
    for block in &cell.content {
        match block {
            BlockNode::Paragraph(p) => texts.push(p.text.clone()),
            _ => {} // Ignore nested tables for now
        }
    }
    texts.join(" ")
}

/// Calculate Jaccard similarity between two strings using word tokens
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

/// Get the maximum number of columns in a table
fn max_columns(table: &TableNode) -> usize {
    table.rows.iter()
        .map(|row| row.cells.len())
        .max()
        .unwrap_or(0)
}

/// Compare two tables and return a diff result
pub fn compare_tables(left: &TableNode, right: &TableNode) -> TableDiffResult {
    let left_rows = left.rows.len();
    let right_rows = right.rows.len();
    let left_cols = max_columns(left);
    let right_cols = max_columns(right);
    
    let mut structural_changes = Vec::new();
    let mut cell_diffs = Vec::new();
    let mut has_structural_changes = false;
    let mut has_content_changes = false;
    
    // Detect structural changes
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
    
    // Compare cells for the common rows and columns
    let common_rows = left_rows.min(right_rows);
    for row_idx in 0..common_rows {
        let left_row = &left.rows[row_idx];
        let right_row = &right.rows[row_idx];
        let common_cols = left_row.cells.len().min(right_row.cells.len());
        
        for col_idx in 0..common_cols {
            let left_text = extract_cell_text(&left_row.cells[col_idx]);
            let right_text = extract_cell_text(&right_row.cells[col_idx]);
            
            let similarity = jaccard_similarity(&left_text, &right_text);
            
            if left_text == right_text {
                cell_diffs.push(CellDiff {
                    position: (row_idx, col_idx),
                    change_type: CellChangeType::Identical,
                    old_content: Some(left_text.clone()),
                    new_content: Some(right_text.clone()),
                    similarity: 1.0,
                });
            } else {
                has_content_changes = true;
                cell_diffs.push(CellDiff {
                    position: (row_idx, col_idx),
                    change_type: CellChangeType::Modified,
                    old_content: Some(left_text.clone()),
                    new_content: Some(right_text.clone()),
                    similarity,
                });
            }
        }
        
        // Handle cells that exist in left but not in right (for this row)
        // These are part of structural column deletion, not content changes
        for col_idx in common_cols..left_row.cells.len() {
            let left_text = extract_cell_text(&left_row.cells[col_idx]);
            cell_diffs.push(CellDiff {
                position: (row_idx, col_idx),
                change_type: CellChangeType::Deleted,
                old_content: Some(left_text),
                new_content: None,
                similarity: 0.0,
            });
        }
        
        // Handle cells that exist in right but not in left (for this row)
        // These are part of structural column addition, not content changes
        for col_idx in common_cols..right_row.cells.len() {
            let right_text = extract_cell_text(&right_row.cells[col_idx]);
            cell_diffs.push(CellDiff {
                position: (row_idx, col_idx),
                change_type: CellChangeType::Added,
                old_content: None,
                new_content: Some(right_text),
                similarity: 0.0,
            });
        }
    }
    
    // Handle rows that exist in left but not in right
    for row_idx in common_rows..left_rows {
        for col_idx in 0..left.rows[row_idx].cells.len() {
            let left_text = extract_cell_text(&left.rows[row_idx].cells[col_idx]);
            cell_diffs.push(CellDiff {
                position: (row_idx, col_idx),
                change_type: CellChangeType::Deleted,
                old_content: Some(left_text),
                new_content: None,
                similarity: 0.0,
            });
        }
    }
    
    // Handle rows that exist in right but not in left
    for row_idx in common_rows..right_rows {
        for col_idx in 0..right.rows[row_idx].cells.len() {
            let right_text = extract_cell_text(&right.rows[row_idx].cells[col_idx]);
            cell_diffs.push(CellDiff {
                position: (row_idx, col_idx),
                change_type: CellChangeType::Added,
                old_content: None,
                new_content: Some(right_text),
                similarity: 0.0,
            });
        }
    }
    
    // Calculate overall confidence based on cell similarities
    let identical_count = cell_diffs.iter()
        .filter(|d| d.change_type == CellChangeType::Identical)
        .count();
    let total_cells = cell_diffs.len();
    
    let confidence = if total_cells == 0 {
        1.0
    } else {
        identical_count as f32 / total_cells as f32
    };
    
    // Determine match type
    let table_match_type = match (has_structural_changes, has_content_changes) {
        (false, false) => TableMatchType::Identical,
        (true, false) => TableMatchType::StructureChanged,
        (false, true) => TableMatchType::ContentChanged,
        (true, true) => TableMatchType::MixedChanges,
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
    use document_ast::{ParagraphNode, RowType, TableCell, TableRow};

    fn create_cell(id: &str, text: &str) -> TableCell {
        TableCell {
            id: id.to_string(),
            content: vec![BlockNode::Paragraph(ParagraphNode {
                id: format!("{id}-p"),
                text: text.to_string(),
                page_start: None,
                page_end: None,
            })],
            span: None,
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
            page_start: Some(1),
            page_end: Some(1),
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

        let right = left.clone();
        let result = compare_tables(&left, &right);

        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert!(result.structural_changes.is_empty());
        assert!(result.cell_diffs.iter().all(|d| d.change_type == CellChangeType::Identical));
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn test_content_modification() {
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

        assert_eq!(result.table_match_type, TableMatchType::StructureChanged);
        
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
}
