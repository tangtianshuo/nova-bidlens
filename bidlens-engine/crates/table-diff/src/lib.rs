use document_ast::{BlockNode, CellSpan, TableCell, TableNode};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

// ============================================================================
// Configuration
// ============================================================================

/// Table diff configuration options
#[derive(Debug, Clone)]
pub struct TableDiffOptions {
    pub match_strategy: MatchStrategy,
    pub similarity_threshold: f32,
}

impl Default for TableDiffOptions {
    fn default() -> Self {
        Self {
            match_strategy: MatchStrategy::Position,
            similarity_threshold: 0.6,
        }
    }
}

/// Matching strategy
#[derive(Debug, Clone)]
pub enum MatchStrategy {
    /// Strict position-based matching (existing logic)
    Position,
    /// Content similarity-based matching
    Content,
    /// Hybrid: prefer position, fallback to content
    Hybrid,
}

// ============================================================================
// Data Structures
// ============================================================================

/// Table diff result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableDiffResult {
    pub table_match_type: TableMatchType,
    pub structural_changes: Vec<StructuralChange>,
    pub cell_diffs: Vec<CellDiff>,
    pub row_alignments: Vec<RowAlignment>,
    pub column_alignments: Vec<ColumnAlignment>,
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
    SpanChanged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellDiff {
    pub position: (usize, usize),
    pub change_type: CellChangeType,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
    pub similarity: f32,
    pub old_span: Option<CellSpan>,
    pub new_span: Option<CellSpan>,
    pub span_changed: bool,
}

/// Row alignment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowAlignment {
    pub left_idx: Option<usize>,
    pub right_idx: Option<usize>,
    pub similarity: f32,
    pub alignment_type: AlignmentType,
}

/// Row alignment type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlignmentType {
    Matched,
    Added,
    Deleted,
    Moved,
}

/// Column alignment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnAlignment {
    pub left_idx: Option<usize>,
    pub right_idx: Option<usize>,
    pub similarity: f32,
    pub alignment_type: ColumnAlignmentType,
}

/// Column alignment type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ColumnAlignmentType {
    Matched,
    Added,
    Deleted,
    Moved,
}

/// Merge region info
#[derive(Debug, Clone)]
struct MergeRegion {
    start_row: usize,
    start_col: usize,
    row_span: usize,
    col_span: usize,
    content: String,
}

// ============================================================================
// Utility Functions
// ============================================================================

fn extract_cell_text(cell: &TableCell) -> String {
    let mut texts = Vec::new();
    for block in &cell.content {
        match block {
            BlockNode::Paragraph(p) => texts.push(p.text.clone()),
            _ => {}
        }
    }
    texts.join(" ")
}

fn jaccard_similarity(left: &str, right: &str) -> f32 {
    if left == right { return 1.0; }
    let left_words: HashSet<&str> = left.split_whitespace().collect();
    let right_words: HashSet<&str> = right.split_whitespace().collect();
    if left_words.is_empty() && right_words.is_empty() { return 1.0; }
    let intersection = left_words.intersection(&right_words).count() as f32;
    let union = left_words.union(&right_words).count() as f32;
    if union == 0.0 { 0.0 } else { intersection / union }
}

fn max_columns(table: &TableNode) -> usize {
    table.rows.iter().map(|row| row.cells.len()).max().unwrap_or(0)
}

fn get_cell<'a>(table: &'a TableNode, row_idx: usize, col_idx: usize) -> Option<&'a TableCell> {
    table.rows.get(row_idx).and_then(|row| row.cells.get(col_idx))
}

fn extract_merge_regions(table: &TableNode) -> Vec<MergeRegion> {
    let mut regions = Vec::new();
    for (row_idx, row) in table.rows.iter().enumerate() {
        for (col_idx, cell) in row.cells.iter().enumerate() {
            if let Some(span) = &cell.span {
                if span.row_span > 1 || span.col_span > 1 {
                    regions.push(MergeRegion {
                        start_row: row_idx, start_col: col_idx,
                        row_span: span.row_span, col_span: span.col_span,
                        content: extract_cell_text(cell),
                    });
                }
            }
        }
    }
    regions
}

fn regions_overlap(left: &MergeRegion, right: &MergeRegion) -> bool {
    !(left.start_row >= right.start_row + right.row_span
        || right.start_row >= left.start_row + left.row_span
        || left.start_col >= right.start_col + right.col_span
        || right.start_col >= left.start_col + left.col_span)
}

fn is_in_merge_region(row_idx: usize, col_idx: usize, regions: &[MergeRegion]) -> bool {
    regions.iter().any(|r| {
        row_idx >= r.start_row && row_idx < r.start_row + r.row_span
            && col_idx >= r.start_col && col_idx < r.start_col + r.col_span
    })
}

fn compare_merge_regions(left: &MergeRegion, right: &MergeRegion) -> (CellChangeType, f32) {
    let similarity = jaccard_similarity(&left.content, &right.content);
    if left.content == right.content { (CellChangeType::Identical, 1.0) }
    else { (CellChangeType::Modified, similarity) }
}

// ============================================================================
// Row Matching Algorithm
// ============================================================================

fn compute_row_similarity(left_table: &TableNode, right_table: &TableNode,
                          left_row_idx: usize, right_row_idx: usize) -> f32 {
    let left_row = &left_table.rows[left_row_idx];
    let right_row = &right_table.rows[right_row_idx];
    let max_cols = left_row.cells.len().max(right_row.cells.len());
    if max_cols == 0 { return 1.0; }

    let mut total = 0.0;
    let mut count = 0;
    for col_idx in 0..max_cols {
        match (left_row.cells.get(col_idx), right_row.cells.get(col_idx)) {
            (Some(l), Some(r)) => { total += jaccard_similarity(&extract_cell_text(l), &extract_cell_text(r)); count += 1; }
            (Some(_), None) | (None, Some(_)) => { count += 1; }
            _ => {}
        }
    }
    if count == 0 { 1.0 } else { total / count as f32 }
}

fn compute_column_similarity(left_table: &TableNode, right_table: &TableNode,
                             left_col_idx: usize, right_col_idx: usize) -> f32 {
    let max_rows = left_table.rows.len().max(right_table.rows.len());
    if max_rows == 0 { return 1.0; }

    let mut total = 0.0;
    let mut count = 0;
    for row_idx in 0..max_rows {
        match (get_cell(left_table, row_idx, left_col_idx), get_cell(right_table, row_idx, right_col_idx)) {
            (Some(l), Some(r)) => { total += jaccard_similarity(&extract_cell_text(l), &extract_cell_text(r)); count += 1; }
            (Some(_), None) | (None, Some(_)) => { count += 1; }
            _ => {}
        }
    }
    if count == 0 { 1.0 } else { total / count as f32 }
}

fn greedy_row_matching(left_table: &TableNode, right_table: &TableNode,
                       threshold: f32) -> Vec<RowAlignment> {
    let left_rows = left_table.rows.len();
    let right_rows = right_table.rows.len();
    let mut sim_matrix = vec![vec![0.0f32; right_rows]; left_rows];
    for i in 0..left_rows { for j in 0..right_rows {
        sim_matrix[i][j] = compute_row_similarity(left_table, right_table, i, j);
    }}

    let mut alignments = Vec::new();
    let mut used_left = HashSet::new();
    let mut used_right = HashSet::new();

    loop {
        let mut best = 0.0f32;
        let mut best_i = None;
        let mut best_j = None;
        for i in 0..left_rows {
            if used_left.contains(&i) { continue; }
            for j in 0..right_rows {
                if used_right.contains(&j) { continue; }
                if sim_matrix[i][j] > best && sim_matrix[i][j] >= threshold {
                    best = sim_matrix[i][j]; best_i = Some(i); best_j = Some(j);
                }
            }
        }
        match (best_i, best_j) {
            (Some(i), Some(j)) => {
                used_left.insert(i); used_right.insert(j);
                alignments.push(RowAlignment {
                    left_idx: Some(i), right_idx: Some(j), similarity: best,
                    alignment_type: if i == j { AlignmentType::Matched } else { AlignmentType::Moved },
                });
            }
            _ => break,
        }
    }

    for i in 0..left_rows { if !used_left.contains(&i) {
        alignments.push(RowAlignment { left_idx: Some(i), right_idx: None, similarity: 0.0, alignment_type: AlignmentType::Deleted });
    }}
    for j in 0..right_rows { if !used_right.contains(&j) {
        alignments.push(RowAlignment { left_idx: None, right_idx: Some(j), similarity: 0.0, alignment_type: AlignmentType::Added });
    }}
    alignments
}

fn greedy_column_matching(left_table: &TableNode, right_table: &TableNode,
                          threshold: f32) -> Vec<ColumnAlignment> {
    let left_cols = max_columns(left_table);
    let right_cols = max_columns(right_table);
    let mut sim_matrix = vec![vec![0.0f32; right_cols]; left_cols];
    for i in 0..left_cols { for j in 0..right_cols {
        sim_matrix[i][j] = compute_column_similarity(left_table, right_table, i, j);
    }}

    let mut alignments = Vec::new();
    let mut used_left = HashSet::new();
    let mut used_right = HashSet::new();

    loop {
        let mut best = 0.0f32;
        let mut best_i = None;
        let mut best_j = None;
        for i in 0..left_cols {
            if used_left.contains(&i) { continue; }
            for j in 0..right_cols {
                if used_right.contains(&j) { continue; }
                if sim_matrix[i][j] > best && sim_matrix[i][j] >= threshold {
                    best = sim_matrix[i][j]; best_i = Some(i); best_j = Some(j);
                }
            }
        }
        match (best_i, best_j) {
            (Some(i), Some(j)) => {
                used_left.insert(i); used_right.insert(j);
                alignments.push(ColumnAlignment {
                    left_idx: Some(i), right_idx: Some(j), similarity: best,
                    alignment_type: if i == j { ColumnAlignmentType::Matched } else { ColumnAlignmentType::Moved },
                });
            }
            _ => break,
        }
    }

    for i in 0..left_cols { if !used_left.contains(&i) {
        alignments.push(ColumnAlignment { left_idx: Some(i), right_idx: None, similarity: 0.0, alignment_type: ColumnAlignmentType::Deleted });
    }}
    for j in 0..right_cols { if !used_right.contains(&j) {
        alignments.push(ColumnAlignment { left_idx: None, right_idx: Some(j), similarity: 0.0, alignment_type: ColumnAlignmentType::Added });
    }}
    alignments
}

// ============================================================================
// Main Compare Functions
// ============================================================================

pub fn compare_tables(left: &TableNode, right: &TableNode) -> TableDiffResult {
    compare_tables_with_options(left, right, &TableDiffOptions::default())
}

pub fn compare_tables_with_options(left: &TableNode, right: &TableNode,
                                   options: &TableDiffOptions) -> TableDiffResult {
    let row_alignments = match options.match_strategy {
        MatchStrategy::Position => position_based_row_alignment(left, right),
        _ => greedy_row_matching(left, right, options.similarity_threshold),
    };
    let column_alignments = match options.match_strategy {
        MatchStrategy::Position => position_based_column_alignment(left, right),
        _ => greedy_column_matching(left, right, options.similarity_threshold),
    };

    let cell_diffs = compute_cell_diffs(left, right, &row_alignments, &column_alignments);
    let structural_changes = detect_structural_changes(&row_alignments, &column_alignments);

    let has_struct = !structural_changes.is_empty();
    let has_content = cell_diffs.iter().any(|d| matches!(d.change_type,
        CellChangeType::Modified | CellChangeType::Added | CellChangeType::Deleted | CellChangeType::SpanChanged));

    let table_match_type = match (has_struct, has_content) {
        (true, true) => TableMatchType::MixedChanges,
        (true, false) => TableMatchType::StructureChanged,
        (false, true) => TableMatchType::ContentChanged,
        _ => TableMatchType::Identical,
    };

    let total = cell_diffs.len() as f32;
    let identical = cell_diffs.iter().filter(|d| d.change_type == CellChangeType::Identical).count() as f32;
    let confidence = if total == 0.0 { 1.0 } else { identical / total };

    TableDiffResult { table_match_type, structural_changes, cell_diffs, row_alignments, column_alignments, confidence }
}

fn position_based_row_alignment(left: &TableNode, right: &TableNode) -> Vec<RowAlignment> {
    let min_rows = left.rows.len().min(right.rows.len());
    let mut alignments = Vec::new();
    for i in 0..min_rows {
        alignments.push(RowAlignment { left_idx: Some(i), right_idx: Some(i),
            similarity: compute_row_similarity(left, right, i, i), alignment_type: AlignmentType::Matched });
    }
    for i in min_rows..left.rows.len() {
        alignments.push(RowAlignment { left_idx: Some(i), right_idx: None, similarity: 0.0, alignment_type: AlignmentType::Deleted });
    }
    for j in min_rows..right.rows.len() {
        alignments.push(RowAlignment { left_idx: None, right_idx: Some(j), similarity: 0.0, alignment_type: AlignmentType::Added });
    }
    alignments
}

fn position_based_column_alignment(left: &TableNode, right: &TableNode) -> Vec<ColumnAlignment> {
    let left_cols = max_columns(left);
    let right_cols = max_columns(right);
    let min_cols = left_cols.min(right_cols);
    let mut alignments = Vec::new();
    for i in 0..min_cols {
        alignments.push(ColumnAlignment { left_idx: Some(i), right_idx: Some(i),
            similarity: compute_column_similarity(left, right, i, i), alignment_type: ColumnAlignmentType::Matched });
    }
    for i in min_cols..left_cols {
        alignments.push(ColumnAlignment { left_idx: Some(i), right_idx: None, similarity: 0.0, alignment_type: ColumnAlignmentType::Deleted });
    }
    for j in min_cols..right_cols {
        alignments.push(ColumnAlignment { left_idx: None, right_idx: Some(j), similarity: 0.0, alignment_type: ColumnAlignmentType::Added });
    }
    alignments
}

fn compute_cell_diffs(left: &TableNode, right: &TableNode,
                      row_alignments: &[RowAlignment], column_alignments: &[ColumnAlignment]) -> Vec<CellDiff> {
    let mut cell_diffs = Vec::new();
    let left_regions = extract_merge_regions(left);
    let right_regions = extract_merge_regions(right);
    let mut processed_left: HashSet<(usize, usize)> = HashSet::new();
    let mut processed_right: HashSet<(usize, usize)> = HashSet::new();

    for lr in &left_regions { for rr in &right_regions {
        if regions_overlap(lr, rr) {
            let (ct, sim) = compare_merge_regions(lr, rr);
            let span_changed = lr.row_span != rr.row_span || lr.col_span != rr.col_span;
            if ct != CellChangeType::Identical || span_changed {
                cell_diffs.push(CellDiff {
                    position: (lr.start_row, lr.start_col),
                    change_type: if span_changed && ct == CellChangeType::Identical { CellChangeType::SpanChanged } else { ct },
                    old_content: Some(lr.content.clone()), new_content: Some(rr.content.clone()), similarity: sim,
                    old_span: Some(CellSpan { row_span: lr.row_span, col_span: lr.col_span }),
                    new_span: Some(CellSpan { row_span: rr.row_span, col_span: rr.col_span }), span_changed,
                });
            }
            processed_left.insert((lr.start_row, lr.start_col));
            processed_right.insert((rr.start_row, rr.start_col));
            break;
        }
    }}

    for lr in &left_regions { if !processed_left.contains(&(lr.start_row, lr.start_col)) {
        cell_diffs.push(CellDiff { position: (lr.start_row, lr.start_col), change_type: CellChangeType::Deleted,
            old_content: Some(lr.content.clone()), new_content: None, similarity: 0.0,
            old_span: Some(CellSpan { row_span: lr.row_span, col_span: lr.col_span }), new_span: None, span_changed: true });
    }}
    for rr in &right_regions { if !processed_right.contains(&(rr.start_row, rr.start_col)) {
        cell_diffs.push(CellDiff { position: (rr.start_row, rr.start_col), change_type: CellChangeType::Added,
            old_content: None, new_content: Some(rr.content.clone()), similarity: 1.0, old_span: None,
            new_span: Some(CellSpan { row_span: rr.row_span, col_span: rr.col_span }), span_changed: true });
    }}

    for ra in row_alignments { if let (Some(lr), Some(rr)) = (ra.left_idx, ra.right_idx) {
        for ca in column_alignments { if let (Some(lc), Some(rc)) = (ca.left_idx, ca.right_idx) {
            if is_in_merge_region(lr, lc, &left_regions) || is_in_merge_region(rr, rc, &right_regions) { continue; }
            match (get_cell(left, lr, lc), get_cell(right, rr, rc)) {
                (Some(l), Some(r)) => {
                    let lt = extract_cell_text(l); let rt = extract_cell_text(r);
                    let sim = jaccard_similarity(&lt, &rt);
                    cell_diffs.push(CellDiff { position: (lr, lc),
                        change_type: if lt == rt { CellChangeType::Identical } else { CellChangeType::Modified },
                        old_content: Some(lt), new_content: Some(rt), similarity: sim,
                        old_span: l.span.clone(), new_span: r.span.clone(), span_changed: false });
                }
                (Some(l), None) => { let lt = extract_cell_text(l); if !lt.is_empty() {
                    cell_diffs.push(CellDiff { position: (lr, lc), change_type: CellChangeType::Deleted,
                        old_content: Some(lt), new_content: None, similarity: 0.0,
                        old_span: l.span.clone(), new_span: None, span_changed: false }); }}
                (None, Some(r)) => { let rt = extract_cell_text(r); if !rt.is_empty() {
                    cell_diffs.push(CellDiff { position: (rr, rc), change_type: CellChangeType::Added,
                        old_content: None, new_content: Some(rt), similarity: 1.0,
                        old_span: None, new_span: r.span.clone(), span_changed: false }); }}
                _ => {}
            }
        }}
    }}
    cell_diffs
}

fn detect_structural_changes(row_alignments: &[RowAlignment], column_alignments: &[ColumnAlignment]) -> Vec<StructuralChange> {
    let mut changes = Vec::new();
    let dr = row_alignments.iter().filter(|a| a.alignment_type == AlignmentType::Deleted).count();
    let ar = row_alignments.iter().filter(|a| a.alignment_type == AlignmentType::Added).count();
    if dr > 0 { changes.push(StructuralChange::RowsDeleted { count: dr, position: 0 }); }
    if ar > 0 { changes.push(StructuralChange::RowsAdded { count: ar, position: 0 }); }
    let dc = column_alignments.iter().filter(|a| a.alignment_type == ColumnAlignmentType::Deleted).count();
    let ac = column_alignments.iter().filter(|a| a.alignment_type == ColumnAlignmentType::Added).count();
    if dc > 0 { changes.push(StructuralChange::ColumnsDeleted { count: dc, position: 0 }); }
    if ac > 0 { changes.push(StructuralChange::ColumnsAdded { count: ac, position: 0 }); }
    changes
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use document_ast::{CellSpan, TableCell, TableRow, RowType, ParagraphNode};

    fn create_cell(id: &str, text: &str) -> TableCell {
        TableCell { id: id.to_string(), content: vec![BlockNode::Paragraph(ParagraphNode {
            id: format!("{}-p", id), text: text.to_string(), page_start: None, page_end: None,
        })], span: None, properties: None }
    }
    fn create_row(id: &str, cells: Vec<TableCell>) -> TableRow {
        TableRow { id: id.to_string(), cells, row_type: RowType::Body }
    }
    fn create_table(id: &str, rows: Vec<TableRow>) -> TableNode {
        TableNode { id: id.to_string(), rows, page_start: None, page_end: None, properties: None }
    }

    #[test]
    fn test_row_move_detection() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Header A"), create_cell("c2", "Header B")]),
            create_row("r2", vec![create_cell("c3", "Row 1 Data"), create_cell("c4", "Row 1 Value")]),
            create_row("r3", vec![create_cell("c5", "Row 2 Data"), create_cell("c6", "Row 2 Value")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Header A"), create_cell("c2", "Header B")]),
            create_row("r2", vec![create_cell("c3", "Row 2 Data"), create_cell("c4", "Row 2 Value")]),
            create_row("r3", vec![create_cell("c5", "Row 1 Data"), create_cell("c6", "Row 1 Value")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.6,
        });
        assert!(result.row_alignments.iter().any(|a| a.alignment_type == AlignmentType::Moved), "Should detect row move");
    }

    #[test]
    fn test_row_move_with_content_match() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Apple iPhone 15"), create_cell("c2", "999")]),
            create_row("r2", vec![create_cell("c3", "Samsung Galaxy S24"), create_cell("c4", "899")]),
            create_row("r3", vec![create_cell("c5", "Google Pixel 8"), create_cell("c6", "799")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Samsung Galaxy S24"), create_cell("c2", "899")]),
            create_row("r2", vec![create_cell("c3", "Google Pixel 8"), create_cell("c4", "799")]),
            create_row("r3", vec![create_cell("c5", "Apple iPhone 15"), create_cell("c6", "999")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.5,
        });
        let matched = result.row_alignments.iter()
            .filter(|a| a.alignment_type == AlignmentType::Matched || a.alignment_type == AlignmentType::Moved).count();
        assert_eq!(matched, 3, "All rows should be matched");
    }

    #[test]
    fn test_row_addition() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Header")]),
            create_row("r2", vec![create_cell("c2", "Data")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Header")]),
            create_row("r2", vec![create_cell("c2", "Data")]),
            create_row("r3", vec![create_cell("c3", "New Row")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.6,
        });
        let added: Vec<_> = result.row_alignments.iter().filter(|a| a.alignment_type == AlignmentType::Added).collect();
        assert_eq!(added.len(), 1);
        assert_eq!(added[0].right_idx, Some(2));
    }

    #[test]
    fn test_row_deletion() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Header")]),
            create_row("r2", vec![create_cell("c2", "Data 1")]),
            create_row("r3", vec![create_cell("c3", "Data 2")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Header")]),
            create_row("r2", vec![create_cell("c2", "Data 1")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.6,
        });
        let deleted: Vec<_> = result.row_alignments.iter().filter(|a| a.alignment_type == AlignmentType::Deleted).collect();
        assert_eq!(deleted.len(), 1);
        assert_eq!(deleted[0].left_idx, Some(2));
    }

    #[test]
    fn test_column_move_detection() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Name"), create_cell("c2", "Age"), create_cell("c3", "City")]),
            create_row("r2", vec![create_cell("c4", "Alice"), create_cell("c5", "30"), create_cell("c6", "NYC")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Name"), create_cell("c2", "City"), create_cell("c3", "Age")]),
            create_row("r2", vec![create_cell("c4", "Alice"), create_cell("c5", "NYC"), create_cell("c6", "30")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.5,
        });
        assert!(result.column_alignments.iter().any(|a| a.alignment_type == ColumnAlignmentType::Moved), "Should detect column move");
    }

    #[test]
    fn test_column_addition() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Name"), create_cell("c2", "Age")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Name"), create_cell("c2", "Age"), create_cell("c3", "City")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.6,
        });
        let added: Vec<_> = result.column_alignments.iter().filter(|a| a.alignment_type == ColumnAlignmentType::Added).collect();
        assert_eq!(added.len(), 1);
    }

    #[test]
    fn test_column_deletion() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Name"), create_cell("c2", "Age"), create_cell("c3", "City")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Name"), create_cell("c2", "Age")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.6,
        });
        let deleted: Vec<_> = result.column_alignments.iter().filter(|a| a.alignment_type == ColumnAlignmentType::Deleted).collect();
        assert_eq!(deleted.len(), 1);
    }

    #[test]
    fn test_position_strategy_identical() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Header"), create_cell("c2", "Data")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Header"), create_cell("c2", "Data")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Position, similarity_threshold: 0.6,
        });
        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert!(result.structural_changes.is_empty());
    }

    #[test]
    fn test_position_strategy_structure_change() {
        let left = create_table("t1", vec![create_row("r1", vec![create_cell("c1", "A")])]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "A")]),
            create_row("r2", vec![create_cell("c2", "B")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Position, similarity_threshold: 0.6,
        });
        assert_eq!(result.table_match_type, TableMatchType::StructureChanged);
    }

    #[test]
    fn test_default_backward_compatible() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "Header"), create_cell("c2", "Data")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "Header"), create_cell("c2", "Data")]),
        ]);
        let result = compare_tables(&left, &right);
        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert!(result.structural_changes.is_empty());
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn test_empty_tables() {
        let left = create_table("t1", vec![]);
        let right = create_table("t2", vec![]);
        let result = compare_tables(&left, &right);
        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert!(result.row_alignments.is_empty());
        assert!(result.column_alignments.is_empty());
    }

    #[test]
    fn test_similar_content_matching() {
        let left = create_table("t1", vec![
            create_row("r1", vec![create_cell("c1", "The quick brown fox"), create_cell("c2", "jumps over")]),
            create_row("r2", vec![create_cell("c3", "the lazy dog"), create_cell("c4", "every day")]),
        ]);
        let right = create_table("t2", vec![
            create_row("r1", vec![create_cell("c1", "The quick brown fox"), create_cell("c2", "jumps over")]),
            create_row("r2", vec![create_cell("c3", "the lazy cat"), create_cell("c4", "every day")]),
        ]);
        let result = compare_tables_with_options(&left, &right, &TableDiffOptions {
            match_strategy: MatchStrategy::Content, similarity_threshold: 0.5,
        });
        assert_eq!(result.table_match_type, TableMatchType::ContentChanged);
        assert!(result.structural_changes.is_empty());
    }
}
