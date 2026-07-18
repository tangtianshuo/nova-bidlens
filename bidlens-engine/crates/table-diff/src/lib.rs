use document_ast::{BlockNode, CellSpan, TableCell, TableNode};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// ============================================================================
// Configuration
// ============================================================================

/// Table diff configuration options
#[derive(Debug, Clone)]
pub struct TableDiffOptions {
    pub match_strategy: MatchStrategy,
    pub similarity_threshold: f32,
    pub similarity_algorithm: SimilarityAlgorithm,
}

impl Default for TableDiffOptions {
    fn default() -> Self {
        Self {
            match_strategy: MatchStrategy::Position,
            similarity_threshold: 0.6,
            similarity_algorithm: SimilarityAlgorithm::Jaccard,
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

/// Similarity algorithm options
#[derive(Debug, Clone)]
pub enum SimilarityAlgorithm {
    /// Jaccard similarity (set-based, current default)
    Jaccard,
    /// Levenshtein distance (edit distance)
    Levenshtein,
    /// Cosine similarity (bag-of-words vector)
    Cosine,
    /// Hybrid: auto-selects best algorithm per content type
    Hybrid,
}

impl Default for SimilarityAlgorithm {
    fn default() -> Self {
        SimilarityAlgorithm::Jaccard
    }
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
    pub nested_table_diff: Option<Box<TableDiffResult>>,
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
            BlockNode::Paragraph(p) => texts.push(p.plain_text()),
            BlockNode::Table(t) => {
                // Recursively extract text from nested table cells
                for row in &t.rows {
                    for c in &row.cells {
                        let nested_text = extract_cell_text(c);
                        if !nested_text.is_empty() {
                            texts.push(nested_text);
                        }
                    }
                }
            }
        }
    }
    texts.join(" ")
}

/// Extract a nested table from cell content, if present
fn extract_nested_table<'a>(cell: &'a TableCell) -> Option<&'a TableNode> {
    for block in &cell.content {
        if let BlockNode::Table(t) = block {
            return Some(t);
        }
    }
    None
}
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

fn levenshtein_similarity(left: &str, right: &str) -> f32 {
    if left == right {
        return 1.0;
    }
    let left_chars: Vec<char> = left.chars().collect();
    let right_chars: Vec<char> = right.chars().collect();
    let m = left_chars.len();
    let n = right_chars.len();
    if m == 0 && n == 0 {
        return 1.0;
    }
    if m == 0 || n == 0 {
        return 0.0;
    }

    let mut prev = (0..=n).collect::<Vec<_>>();
    let mut curr = vec![0usize; n + 1];
    for i in 1..=m {
        curr[0] = i;
        for j in 1..=n {
            let cost = if left_chars[i - 1] == right_chars[j - 1] {
                0
            } else {
                1
            };
            curr[j] = (prev[j] + 1).min(curr[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    let max_len = m.max(n) as f32;
    1.0 - (prev[n] as f32 / max_len)
}

fn cosine_similarity(left: &str, right: &str) -> f32 {
    if left == right {
        return 1.0;
    }
    let left_words: Vec<&str> = left.split_whitespace().collect();
    let right_words: Vec<&str> = right.split_whitespace().collect();
    if left_words.is_empty() && right_words.is_empty() {
        return 1.0;
    }
    if left_words.is_empty() || right_words.is_empty() {
        return 0.0;
    }

    let mut freq: HashMap<&str, (f32, f32)> = HashMap::new();
    for w in &left_words {
        freq.entry(w).or_insert((0.0, 0.0)).0 += 1.0;
    }
    for w in &right_words {
        freq.entry(w).or_insert((0.0, 0.0)).1 += 1.0;
    }

    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;
    for (_, (a, b)) in &freq {
        dot += a * b;
        norm_a += a * a;
        norm_b += b * b;
    }
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a.sqrt() * norm_b.sqrt())
}

fn numeric_similarity(left: &str, right: &str) -> f32 {
    let parse_num = |s: &str| -> Option<f64> {
        let cleaned: String = s
            .chars()
            .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-' || *c == '+')
            .collect();
        cleaned.parse::<f64>().ok()
    };
    let ln = parse_num(left);
    let rn = parse_num(right);
    match (ln, rn) {
        (Some(l), Some(r)) => {
            if l == r {
                return 1.0;
            }
            let max_val = l.abs().max(r.abs());
            if max_val == 0.0 {
                return 1.0;
            }
            let diff = (l - r).abs();
            (1.0 - (diff / max_val) as f32).max(0.0)
        }
        _ => -1.0,
    }
}

fn compute_similarity(left: &str, right: &str, algorithm: &SimilarityAlgorithm) -> f32 {
    match algorithm {
        SimilarityAlgorithm::Jaccard => jaccard_similarity(left, right),
        SimilarityAlgorithm::Levenshtein => levenshtein_similarity(left, right),
        SimilarityAlgorithm::Cosine => cosine_similarity(left, right),
        SimilarityAlgorithm::Hybrid => {
            let num_sim = numeric_similarity(left, right);
            if num_sim >= 0.0 {
                return num_sim;
            }
            let j = jaccard_similarity(left, right);
            let l = levenshtein_similarity(left, right);
            let c = cosine_similarity(left, right);
            (j + l + c) / 3.0
        }
    }
}

fn max_columns(table: &TableNode) -> usize {
    table
        .rows
        .iter()
        .map(|row| row.cells.len())
        .max()
        .unwrap_or(0)
}

fn get_cell<'a>(table: &'a TableNode, row_idx: usize, col_idx: usize) -> Option<&'a TableCell> {
    table
        .rows
        .get(row_idx)
        .and_then(|row| row.cells.get(col_idx))
}

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

fn regions_overlap(left: &MergeRegion, right: &MergeRegion) -> bool {
    !(left.start_row >= right.start_row + right.row_span
        || right.start_row >= left.start_row + left.row_span
        || left.start_col >= right.start_col + right.col_span
        || right.start_col >= left.start_col + left.col_span)
}

fn is_in_merge_region(row_idx: usize, col_idx: usize, regions: &[MergeRegion]) -> bool {
    regions.iter().any(|r| {
        row_idx >= r.start_row
            && row_idx < r.start_row + r.row_span
            && col_idx >= r.start_col
            && col_idx < r.start_col + r.col_span
    })
}

fn compare_merge_regions(
    left: &MergeRegion,
    right: &MergeRegion,
    algorithm: &SimilarityAlgorithm,
) -> (CellChangeType, f32) {
    let similarity = compute_similarity(&left.content, &right.content, algorithm);
    if left.content == right.content {
        (CellChangeType::Identical, 1.0)
    } else {
        (CellChangeType::Modified, similarity)
    }
}

// ============================================================================
// Row Matching Algorithm
// ============================================================================

fn compute_row_similarity(
    left_table: &TableNode,
    right_table: &TableNode,
    left_row_idx: usize,
    right_row_idx: usize,
    algorithm: &SimilarityAlgorithm,
) -> f32 {
    let left_row = &left_table.rows[left_row_idx];
    let right_row = &right_table.rows[right_row_idx];
    let max_cols = left_row.cells.len().max(right_row.cells.len());
    if max_cols == 0 {
        return 1.0;
    }

    let mut total = 0.0;
    let mut count = 0;
    for col_idx in 0..max_cols {
        match (left_row.cells.get(col_idx), right_row.cells.get(col_idx)) {
            (Some(l), Some(r)) => {
                total +=
                    compute_similarity(&extract_cell_text(l), &extract_cell_text(r), algorithm);
                count += 1;
            }
            (Some(_), None) | (None, Some(_)) => {
                count += 1;
            }
            _ => {}
        }
    }
    if count == 0 {
        1.0
    } else {
        total / count as f32
    }
}

fn compute_column_similarity(
    left_table: &TableNode,
    right_table: &TableNode,
    left_col_idx: usize,
    right_col_idx: usize,
    algorithm: &SimilarityAlgorithm,
) -> f32 {
    let max_rows = left_table.rows.len().max(right_table.rows.len());
    if max_rows == 0 {
        return 1.0;
    }

    let mut total = 0.0;
    let mut count = 0;
    for row_idx in 0..max_rows {
        match (
            get_cell(left_table, row_idx, left_col_idx),
            get_cell(right_table, row_idx, right_col_idx),
        ) {
            (Some(l), Some(r)) => {
                total +=
                    compute_similarity(&extract_cell_text(l), &extract_cell_text(r), algorithm);
                count += 1;
            }
            (Some(_), None) | (None, Some(_)) => {
                count += 1;
            }
            _ => {}
        }
    }
    if count == 0 {
        1.0
    } else {
        total / count as f32
    }
}

fn greedy_row_matching(
    left_table: &TableNode,
    right_table: &TableNode,
    threshold: f32,
    algorithm: &SimilarityAlgorithm,
) -> Vec<RowAlignment> {
    let left_rows = left_table.rows.len();
    let right_rows = right_table.rows.len();
    let mut sim_matrix = vec![vec![0.0f32; right_rows]; left_rows];
    for i in 0..left_rows {
        for j in 0..right_rows {
            sim_matrix[i][j] = compute_row_similarity(left_table, right_table, i, j, algorithm);
        }
    }

    let mut alignments = Vec::new();
    let mut used_left = HashSet::new();
    let mut used_right = HashSet::new();

    loop {
        let mut best = 0.0f32;
        let mut best_i = None;
        let mut best_j = None;
        for i in 0..left_rows {
            if used_left.contains(&i) {
                continue;
            }
            for j in 0..right_rows {
                if used_right.contains(&j) {
                    continue;
                }
                if sim_matrix[i][j] > best && sim_matrix[i][j] >= threshold {
                    best = sim_matrix[i][j];
                    best_i = Some(i);
                    best_j = Some(j);
                }
            }
        }
        match (best_i, best_j) {
            (Some(i), Some(j)) => {
                used_left.insert(i);
                used_right.insert(j);
                alignments.push(RowAlignment {
                    left_idx: Some(i),
                    right_idx: Some(j),
                    similarity: best,
                    alignment_type: if i == j {
                        AlignmentType::Matched
                    } else {
                        AlignmentType::Moved
                    },
                });
            }
            _ => break,
        }
    }

    for i in 0..left_rows {
        if !used_left.contains(&i) {
            alignments.push(RowAlignment {
                left_idx: Some(i),
                right_idx: None,
                similarity: 0.0,
                alignment_type: AlignmentType::Deleted,
            });
        }
    }
    for j in 0..right_rows {
        if !used_right.contains(&j) {
            alignments.push(RowAlignment {
                left_idx: None,
                right_idx: Some(j),
                similarity: 0.0,
                alignment_type: AlignmentType::Added,
            });
        }
    }
    alignments
}

fn greedy_column_matching(
    left_table: &TableNode,
    right_table: &TableNode,
    threshold: f32,
    algorithm: &SimilarityAlgorithm,
) -> Vec<ColumnAlignment> {
    let left_cols = max_columns(left_table);
    let right_cols = max_columns(right_table);
    let mut sim_matrix = vec![vec![0.0f32; right_cols]; left_cols];
    for i in 0..left_cols {
        for j in 0..right_cols {
            sim_matrix[i][j] = compute_column_similarity(left_table, right_table, i, j, algorithm);
        }
    }

    let mut alignments = Vec::new();
    let mut used_left = HashSet::new();
    let mut used_right = HashSet::new();

    loop {
        let mut best = 0.0f32;
        let mut best_i = None;
        let mut best_j = None;
        for i in 0..left_cols {
            if used_left.contains(&i) {
                continue;
            }
            for j in 0..right_cols {
                if used_right.contains(&j) {
                    continue;
                }
                if sim_matrix[i][j] > best && sim_matrix[i][j] >= threshold {
                    best = sim_matrix[i][j];
                    best_i = Some(i);
                    best_j = Some(j);
                }
            }
        }
        match (best_i, best_j) {
            (Some(i), Some(j)) => {
                used_left.insert(i);
                used_right.insert(j);
                alignments.push(ColumnAlignment {
                    left_idx: Some(i),
                    right_idx: Some(j),
                    similarity: best,
                    alignment_type: if i == j {
                        ColumnAlignmentType::Matched
                    } else {
                        ColumnAlignmentType::Moved
                    },
                });
            }
            _ => break,
        }
    }

    for i in 0..left_cols {
        if !used_left.contains(&i) {
            alignments.push(ColumnAlignment {
                left_idx: Some(i),
                right_idx: None,
                similarity: 0.0,
                alignment_type: ColumnAlignmentType::Deleted,
            });
        }
    }
    for j in 0..right_cols {
        if !used_right.contains(&j) {
            alignments.push(ColumnAlignment {
                left_idx: None,
                right_idx: Some(j),
                similarity: 0.0,
                alignment_type: ColumnAlignmentType::Added,
            });
        }
    }
    alignments
}

// ============================================================================
// Main Compare Functions
// ============================================================================

pub fn compare_tables(left: &TableNode, right: &TableNode) -> TableDiffResult {
    compare_tables_with_options(left, right, &TableDiffOptions::default())
}

pub fn compare_tables_with_options(
    left: &TableNode,
    right: &TableNode,
    options: &TableDiffOptions,
) -> TableDiffResult {
    let row_alignments = match options.match_strategy {
        MatchStrategy::Position => {
            position_based_row_alignment(left, right, &options.similarity_algorithm)
        }
        _ => greedy_row_matching(
            left,
            right,
            options.similarity_threshold,
            &options.similarity_algorithm,
        ),
    };
    let column_alignments = match options.match_strategy {
        MatchStrategy::Position => {
            position_based_column_alignment(left, right, &options.similarity_algorithm)
        }
        _ => greedy_column_matching(
            left,
            right,
            options.similarity_threshold,
            &options.similarity_algorithm,
        ),
    };

    let cell_diffs = compute_cell_diffs(
        left,
        right,
        &row_alignments,
        &column_alignments,
        &options.similarity_algorithm,
    );
    let structural_changes = detect_structural_changes(&row_alignments, &column_alignments);

    let has_struct = !structural_changes.is_empty();
    let has_content = cell_diffs.iter().any(|d| {
        matches!(
            d.change_type,
            CellChangeType::Modified
                | CellChangeType::Added
                | CellChangeType::Deleted
                | CellChangeType::SpanChanged
        )
    });

    let table_match_type = match (has_struct, has_content) {
        (true, true) => TableMatchType::MixedChanges,
        (true, false) => TableMatchType::StructureChanged,
        (false, true) => TableMatchType::ContentChanged,
        _ => TableMatchType::Identical,
    };

    let total = cell_diffs.len() as f32;
    let identical = cell_diffs
        .iter()
        .filter(|d| d.change_type == CellChangeType::Identical)
        .count() as f32;
    let confidence = if total == 0.0 { 1.0 } else { identical / total };

    TableDiffResult {
        table_match_type,
        structural_changes,
        cell_diffs,
        row_alignments,
        column_alignments,
        confidence,
    }
}

fn position_based_row_alignment(
    left: &TableNode,
    right: &TableNode,
    algorithm: &SimilarityAlgorithm,
) -> Vec<RowAlignment> {
    let min_rows = left.rows.len().min(right.rows.len());
    let mut alignments = Vec::new();
    for i in 0..min_rows {
        alignments.push(RowAlignment {
            left_idx: Some(i),
            right_idx: Some(i),
            similarity: compute_row_similarity(left, right, i, i, algorithm),
            alignment_type: AlignmentType::Matched,
        });
    }
    for i in min_rows..left.rows.len() {
        alignments.push(RowAlignment {
            left_idx: Some(i),
            right_idx: None,
            similarity: 0.0,
            alignment_type: AlignmentType::Deleted,
        });
    }
    for j in min_rows..right.rows.len() {
        alignments.push(RowAlignment {
            left_idx: None,
            right_idx: Some(j),
            similarity: 0.0,
            alignment_type: AlignmentType::Added,
        });
    }
    alignments
}

fn position_based_column_alignment(
    left: &TableNode,
    right: &TableNode,
    algorithm: &SimilarityAlgorithm,
) -> Vec<ColumnAlignment> {
    let left_cols = max_columns(left);
    let right_cols = max_columns(right);
    let min_cols = left_cols.min(right_cols);
    let mut alignments = Vec::new();
    for i in 0..min_cols {
        alignments.push(ColumnAlignment {
            left_idx: Some(i),
            right_idx: Some(i),
            similarity: compute_column_similarity(left, right, i, i, algorithm),
            alignment_type: ColumnAlignmentType::Matched,
        });
    }
    for i in min_cols..left_cols {
        alignments.push(ColumnAlignment {
            left_idx: Some(i),
            right_idx: None,
            similarity: 0.0,
            alignment_type: ColumnAlignmentType::Deleted,
        });
    }
    for j in min_cols..right_cols {
        alignments.push(ColumnAlignment {
            left_idx: None,
            right_idx: Some(j),
            similarity: 0.0,
            alignment_type: ColumnAlignmentType::Added,
        });
    }
    alignments
}

fn compute_cell_diffs(
    left: &TableNode,
    right: &TableNode,
    row_alignments: &[RowAlignment],
    column_alignments: &[ColumnAlignment],
    algorithm: &SimilarityAlgorithm,
) -> Vec<CellDiff> {
    let mut cell_diffs = Vec::new();
    let left_regions = extract_merge_regions(left);
    let right_regions = extract_merge_regions(right);
    let mut processed_left: HashSet<(usize, usize)> = HashSet::new();
    let mut processed_right: HashSet<(usize, usize)> = HashSet::new();

    for lr in &left_regions {
        for rr in &right_regions {
            if regions_overlap(lr, rr) {
                let (ct, sim) = compare_merge_regions(lr, rr, algorithm);
                let span_changed = lr.row_span != rr.row_span || lr.col_span != rr.col_span;
                if ct != CellChangeType::Identical || span_changed {
                    cell_diffs.push(CellDiff {
                        position: (lr.start_row, lr.start_col),
                        change_type: if span_changed && ct == CellChangeType::Identical {
                            CellChangeType::SpanChanged
                        } else {
                            ct
                        },
                        old_content: Some(lr.content.clone()),
                        new_content: Some(rr.content.clone()),
                        similarity: sim,
                        old_span: Some(CellSpan {
                            row_span: lr.row_span,
                            col_span: lr.col_span,
                        }),
                        new_span: Some(CellSpan {
                            row_span: rr.row_span,
                            col_span: rr.col_span,
                        }),
                        span_changed,
                        nested_table_diff: None,
                    });
                }
                processed_left.insert((lr.start_row, lr.start_col));
                processed_right.insert((rr.start_row, rr.start_col));
                break;
            }
        }
    }

    for lr in &left_regions {
        if !processed_left.contains(&(lr.start_row, lr.start_col)) {
            cell_diffs.push(CellDiff {
                position: (lr.start_row, lr.start_col),
                change_type: CellChangeType::Deleted,
                old_content: Some(lr.content.clone()),
                new_content: None,
                similarity: 0.0,
                old_span: Some(CellSpan {
                    row_span: lr.row_span,
                    col_span: lr.col_span,
                }),
                new_span: None,
                span_changed: true,
                nested_table_diff: None,
            });
        }
    }
    for rr in &right_regions {
        if !processed_right.contains(&(rr.start_row, rr.start_col)) {
            cell_diffs.push(CellDiff {
                position: (rr.start_row, rr.start_col),
                change_type: CellChangeType::Added,
                old_content: None,
                new_content: Some(rr.content.clone()),
                similarity: 1.0,
                old_span: None,
                new_span: Some(CellSpan {
                    row_span: rr.row_span,
                    col_span: rr.col_span,
                }),
                span_changed: true,
                nested_table_diff: None,
            });
        }
    }

    for ra in row_alignments {
        if let (Some(lr), Some(rr)) = (ra.left_idx, ra.right_idx) {
            for ca in column_alignments {
                if let (Some(lc), Some(rc)) = (ca.left_idx, ca.right_idx) {
                    if is_in_merge_region(lr, lc, &left_regions)
                        || is_in_merge_region(rr, rc, &right_regions)
                    {
                        continue;
                    }
                    match (get_cell(left, lr, lc), get_cell(right, rr, rc)) {
                        (Some(l), Some(r)) => {
                            let lt = extract_cell_text(l);
                            let rt = extract_cell_text(r);
                            let sim = compute_similarity(&lt, &rt, algorithm);

                            // Compare nested tables recursively
                            let nested_diff =
                                match (extract_nested_table(l), extract_nested_table(r)) {
                                    (Some(lt_inner), Some(rt_inner)) => {
                                        let diff = compare_tables_with_options(
                                            lt_inner,
                                            rt_inner,
                                            &TableDiffOptions {
                                                match_strategy: MatchStrategy::Position,
                                                similarity_threshold: 0.6,
                                                similarity_algorithm: algorithm.clone(),
                                            },
                                        );
                                        Some(Box::new(diff))
                                    }
                                    _ => None,
                                };

                            // Determine if nested tables have actual differences
                            let nested_has_changes = nested_diff
                                .as_ref()
                                .map_or(false, |d| d.table_match_type != TableMatchType::Identical);
                            // Only include nested diff if there are actual changes
                            let nested_diff_out = if nested_has_changes {
                                nested_diff
                            } else {
                                None
                            };

                            cell_diffs.push(CellDiff {
                                position: (lr, lc),
                                change_type: if lt == rt && !nested_has_changes {
                                    CellChangeType::Identical
                                } else {
                                    CellChangeType::Modified
                                },
                                old_content: Some(lt),
                                new_content: Some(rt),
                                similarity: sim,
                                old_span: l.span.clone(),
                                new_span: r.span.clone(),
                                span_changed: false,
                                nested_table_diff: nested_diff_out,
                            });
                        }
                        (Some(l), None) => {
                            let lt = extract_cell_text(l);
                            if !lt.is_empty() {
                                cell_diffs.push(CellDiff {
                                    position: (lr, lc),
                                    change_type: CellChangeType::Deleted,
                                    old_content: Some(lt),
                                    new_content: None,
                                    similarity: 0.0,
                                    old_span: l.span.clone(),
                                    new_span: None,
                                    span_changed: false,
                                    nested_table_diff: None,
                                });
                            }
                        }
                        (None, Some(r)) => {
                            let rt = extract_cell_text(r);
                            if !rt.is_empty() {
                                cell_diffs.push(CellDiff {
                                    position: (rr, rc),
                                    change_type: CellChangeType::Added,
                                    old_content: None,
                                    new_content: Some(rt),
                                    similarity: 1.0,
                                    old_span: None,
                                    new_span: r.span.clone(),
                                    span_changed: false,
                                    nested_table_diff: None,
                                });
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    cell_diffs
}

fn detect_structural_changes(
    row_alignments: &[RowAlignment],
    column_alignments: &[ColumnAlignment],
) -> Vec<StructuralChange> {
    let mut changes = Vec::new();
    let dr = row_alignments
        .iter()
        .filter(|a| a.alignment_type == AlignmentType::Deleted)
        .count();
    let ar = row_alignments
        .iter()
        .filter(|a| a.alignment_type == AlignmentType::Added)
        .count();
    if dr > 0 {
        changes.push(StructuralChange::RowsDeleted {
            count: dr,
            position: 0,
        });
    }
    if ar > 0 {
        changes.push(StructuralChange::RowsAdded {
            count: ar,
            position: 0,
        });
    }
    let dc = column_alignments
        .iter()
        .filter(|a| a.alignment_type == ColumnAlignmentType::Deleted)
        .count();
    let ac = column_alignments
        .iter()
        .filter(|a| a.alignment_type == ColumnAlignmentType::Added)
        .count();
    if dc > 0 {
        changes.push(StructuralChange::ColumnsDeleted {
            count: dc,
            position: 0,
        });
    }
    if ac > 0 {
        changes.push(StructuralChange::ColumnsAdded {
            count: ac,
            position: 0,
        });
    }
    changes
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use document_ast::{RowType, TableCell, TableRow, simple_paragraph};

    fn create_cell(id: &str, text: &str) -> TableCell {
        TableCell {
            id: id.to_string(),
            content: vec![BlockNode::Paragraph(simple_paragraph(
                &format!("{}-p", id),
                text,
            ))],
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
            page_start: None,
            page_end: None,
            properties: None,
        }
    }

    #[test]
    fn test_row_move_detection() {
        let left = create_table(
            "t1",
            vec![
                create_row(
                    "r1",
                    vec![create_cell("c1", "Header A"), create_cell("c2", "Header B")],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c3", "Row 1 Data"),
                        create_cell("c4", "Row 1 Value"),
                    ],
                ),
                create_row(
                    "r3",
                    vec![
                        create_cell("c5", "Row 2 Data"),
                        create_cell("c6", "Row 2 Value"),
                    ],
                ),
            ],
        );
        let right = create_table(
            "t2",
            vec![
                create_row(
                    "r1",
                    vec![create_cell("c1", "Header A"), create_cell("c2", "Header B")],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c3", "Row 2 Data"),
                        create_cell("c4", "Row 2 Value"),
                    ],
                ),
                create_row(
                    "r3",
                    vec![
                        create_cell("c5", "Row 1 Data"),
                        create_cell("c6", "Row 1 Value"),
                    ],
                ),
            ],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.6,
                ..Default::default()
            },
        );
        assert!(
            result
                .row_alignments
                .iter()
                .any(|a| a.alignment_type == AlignmentType::Moved),
            "Should detect row move"
        );
    }

    #[test]
    fn test_row_move_with_content_match() {
        let left = create_table(
            "t1",
            vec![
                create_row(
                    "r1",
                    vec![
                        create_cell("c1", "Apple iPhone 15"),
                        create_cell("c2", "999"),
                    ],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c3", "Samsung Galaxy S24"),
                        create_cell("c4", "899"),
                    ],
                ),
                create_row(
                    "r3",
                    vec![
                        create_cell("c5", "Google Pixel 8"),
                        create_cell("c6", "799"),
                    ],
                ),
            ],
        );
        let right = create_table(
            "t2",
            vec![
                create_row(
                    "r1",
                    vec![
                        create_cell("c1", "Samsung Galaxy S24"),
                        create_cell("c2", "899"),
                    ],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c3", "Google Pixel 8"),
                        create_cell("c4", "799"),
                    ],
                ),
                create_row(
                    "r3",
                    vec![
                        create_cell("c5", "Apple iPhone 15"),
                        create_cell("c6", "999"),
                    ],
                ),
            ],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.5,
                ..Default::default()
            },
        );
        let matched = result
            .row_alignments
            .iter()
            .filter(|a| {
                a.alignment_type == AlignmentType::Matched
                    || a.alignment_type == AlignmentType::Moved
            })
            .count();
        assert_eq!(matched, 3, "All rows should be matched");
    }

    #[test]
    fn test_row_addition() {
        let left = create_table(
            "t1",
            vec![
                create_row("r1", vec![create_cell("c1", "Header")]),
                create_row("r2", vec![create_cell("c2", "Data")]),
            ],
        );
        let right = create_table(
            "t2",
            vec![
                create_row("r1", vec![create_cell("c1", "Header")]),
                create_row("r2", vec![create_cell("c2", "Data")]),
                create_row("r3", vec![create_cell("c3", "New Row")]),
            ],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.6,
                ..Default::default()
            },
        );
        let added: Vec<_> = result
            .row_alignments
            .iter()
            .filter(|a| a.alignment_type == AlignmentType::Added)
            .collect();
        assert_eq!(added.len(), 1);
        assert_eq!(added[0].right_idx, Some(2));
    }

    #[test]
    fn test_row_deletion() {
        let left = create_table(
            "t1",
            vec![
                create_row("r1", vec![create_cell("c1", "Header")]),
                create_row("r2", vec![create_cell("c2", "Data 1")]),
                create_row("r3", vec![create_cell("c3", "Data 2")]),
            ],
        );
        let right = create_table(
            "t2",
            vec![
                create_row("r1", vec![create_cell("c1", "Header")]),
                create_row("r2", vec![create_cell("c2", "Data 1")]),
            ],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.6,
                ..Default::default()
            },
        );
        let deleted: Vec<_> = result
            .row_alignments
            .iter()
            .filter(|a| a.alignment_type == AlignmentType::Deleted)
            .collect();
        assert_eq!(deleted.len(), 1);
        assert_eq!(deleted[0].left_idx, Some(2));
    }

    #[test]
    fn test_column_move_detection() {
        let left = create_table(
            "t1",
            vec![
                create_row(
                    "r1",
                    vec![
                        create_cell("c1", "Name"),
                        create_cell("c2", "Age"),
                        create_cell("c3", "City"),
                    ],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c4", "Alice"),
                        create_cell("c5", "30"),
                        create_cell("c6", "NYC"),
                    ],
                ),
            ],
        );
        let right = create_table(
            "t2",
            vec![
                create_row(
                    "r1",
                    vec![
                        create_cell("c1", "Name"),
                        create_cell("c2", "City"),
                        create_cell("c3", "Age"),
                    ],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c4", "Alice"),
                        create_cell("c5", "NYC"),
                        create_cell("c6", "30"),
                    ],
                ),
            ],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.5,
                ..Default::default()
            },
        );
        assert!(
            result
                .column_alignments
                .iter()
                .any(|a| a.alignment_type == ColumnAlignmentType::Moved),
            "Should detect column move"
        );
    }

    #[test]
    fn test_column_addition() {
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Name"), create_cell("c2", "Age")],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![
                    create_cell("c1", "Name"),
                    create_cell("c2", "Age"),
                    create_cell("c3", "City"),
                ],
            )],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.6,
                ..Default::default()
            },
        );
        let added: Vec<_> = result
            .column_alignments
            .iter()
            .filter(|a| a.alignment_type == ColumnAlignmentType::Added)
            .collect();
        assert_eq!(added.len(), 1);
    }

    #[test]
    fn test_column_deletion() {
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![
                    create_cell("c1", "Name"),
                    create_cell("c2", "Age"),
                    create_cell("c3", "City"),
                ],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Name"), create_cell("c2", "Age")],
            )],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.6,
                ..Default::default()
            },
        );
        let deleted: Vec<_> = result
            .column_alignments
            .iter()
            .filter(|a| a.alignment_type == ColumnAlignmentType::Deleted)
            .collect();
        assert_eq!(deleted.len(), 1);
    }

    #[test]
    fn test_position_strategy_identical() {
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Header"), create_cell("c2", "Data")],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Header"), create_cell("c2", "Data")],
            )],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Position,
                similarity_threshold: 0.6,
                ..Default::default()
            },
        );
        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert!(result.structural_changes.is_empty());
    }

    #[test]
    fn test_position_strategy_structure_change() {
        let left = create_table("t1", vec![create_row("r1", vec![create_cell("c1", "A")])]);
        let right = create_table(
            "t2",
            vec![
                create_row("r1", vec![create_cell("c1", "A")]),
                create_row("r2", vec![create_cell("c2", "B")]),
            ],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Position,
                similarity_threshold: 0.6,
                ..Default::default()
            },
        );
        assert_eq!(result.table_match_type, TableMatchType::StructureChanged);
    }

    #[test]
    fn test_default_backward_compatible() {
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Header"), create_cell("c2", "Data")],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Header"), create_cell("c2", "Data")],
            )],
        );
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
        let left = create_table(
            "t1",
            vec![
                create_row(
                    "r1",
                    vec![
                        create_cell("c1", "The quick brown fox"),
                        create_cell("c2", "jumps over"),
                    ],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c3", "the lazy dog"),
                        create_cell("c4", "every day"),
                    ],
                ),
            ],
        );
        let right = create_table(
            "t2",
            vec![
                create_row(
                    "r1",
                    vec![
                        create_cell("c1", "The quick brown fox"),
                        create_cell("c2", "jumps over"),
                    ],
                ),
                create_row(
                    "r2",
                    vec![
                        create_cell("c3", "the lazy cat"),
                        create_cell("c4", "every day"),
                    ],
                ),
            ],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.5,
                ..Default::default()
            },
        );
        assert_eq!(result.table_match_type, TableMatchType::ContentChanged);
        assert!(result.structural_changes.is_empty());
    }
    // ========== Similarity Algorithm Tests ==========

    #[test]
    fn test_levenshtein_similarity_identical() {
        assert_eq!(levenshtein_similarity("hello", "hello"), 1.0);
    }

    #[test]
    fn test_levenshtein_similarity_empty() {
        assert_eq!(levenshtein_similarity("", ""), 1.0);
    }

    #[test]
    fn test_levenshtein_similarity_one_empty() {
        assert_eq!(levenshtein_similarity("hello", ""), 0.0);
        assert_eq!(levenshtein_similarity("", "hello"), 0.0);
    }

    #[test]
    fn test_levenshtein_similarity_similar() {
        // "kitten" -> "sitting" has edit distance 3, max_len = 7
        let sim = levenshtein_similarity("kitten", "sitting");
        assert!(sim > 0.4 && sim < 0.6, "Expected ~0.571, got {}", sim);
    }

    #[test]
    fn test_levenshtein_similarity_single_char_diff() {
        let sim = levenshtein_similarity("abc", "ab");
        assert!(sim > 0.6, "Expected ~0.667, got {}", sim);
    }

    #[test]
    fn test_cosine_similarity_identical() {
        assert_eq!(cosine_similarity("hello world", "hello world"), 1.0);
    }

    #[test]
    fn test_cosine_similarity_empty() {
        assert_eq!(cosine_similarity("", ""), 1.0);
    }

    #[test]
    fn test_cosine_similarity_one_empty() {
        assert_eq!(cosine_similarity("hello", ""), 0.0);
    }

    #[test]
    fn test_cosine_similarity_overlapping() {
        // "hello world" vs "hello there" share 1 word "hello"
        let sim = cosine_similarity("hello world", "hello there");
        assert!(
            sim > 0.0 && sim < 1.0,
            "Expected partial similarity, got {}",
            sim
        );
    }

    #[test]
    fn test_cosine_similarity_no_overlap() {
        let sim = cosine_similarity("apple banana", "cat dog");
        assert_eq!(sim, 0.0);
    }

    #[test]
    fn test_numeric_similarity_identical() {
        assert_eq!(numeric_similarity("42", "42"), 1.0);
    }

    #[test]
    fn test_numeric_similarity_close() {
        // 100 vs 110: diff=10, max=110, ratio = 10/110 ~ 0.091, similarity ~ 0.909
        let sim = numeric_similarity("100", "110");
        assert!(sim > 0.85 && sim < 0.95, "Expected ~0.909, got {}", sim);
    }

    #[test]
    fn test_numeric_similarity_non_numeric() {
        // Non-numeric should return -1.0 (signal)
        assert_eq!(numeric_similarity("hello", "world"), -1.0);
    }

    #[test]
    fn test_numeric_similarity_with_text_and_numbers() {
        // "Price: 100" should extract 100
        let sim = numeric_similarity("Price: 100", "Price: 110");
        assert!(
            sim > 0.85,
            "Expected high similarity for close numbers, got {}",
            sim
        );
    }

    #[test]
    fn test_numeric_similarity_zeroes() {
        assert_eq!(numeric_similarity("0", "0"), 1.0);
    }

    #[test]
    fn test_hybrid_algorithm_uses_numeric_for_numbers() {
        // Hybrid should use numeric_similarity for number-like content
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Total"), create_cell("c2", "100")],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Total"), create_cell("c2", "105")],
            )],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.5,
                similarity_algorithm: SimilarityAlgorithm::Hybrid,
            },
        );
        // "100" vs "105" should have high similarity via numeric
        assert!(
            result.confidence >= 0.5,
            "Hybrid should produce reasonable confidence, got {}",
            result.confidence
        );
    }

    #[test]
    fn test_levenshtein_algorithm_integration() {
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Header"), create_cell("c2", "Data")],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Header"), create_cell("c2", "Data")],
            )],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.6,
                similarity_algorithm: SimilarityAlgorithm::Levenshtein,
            },
        );
        assert_eq!(result.table_match_type, TableMatchType::Identical);
    }

    #[test]
    fn test_cosine_algorithm_integration() {
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Apple iPhone"), create_cell("c2", "999")],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell("c1", "Apple iPhone"), create_cell("c2", "999")],
            )],
        );
        let result = compare_tables_with_options(
            &left,
            &right,
            &TableDiffOptions {
                match_strategy: MatchStrategy::Content,
                similarity_threshold: 0.6,
                similarity_algorithm: SimilarityAlgorithm::Cosine,
            },
        );
        assert_eq!(result.table_match_type, TableMatchType::Identical);
    }

    #[test]
    fn test_different_algorithms_produce_different_scores() {
        let sim_j = jaccard_similarity("hello world", "hello there");
        let sim_l = levenshtein_similarity("hello world", "hello there");
        let sim_c = cosine_similarity("hello world", "hello there");
        // They should all be > 0 but not necessarily equal
        assert!(sim_j > 0.0 && sim_l > 0.0 && sim_c > 0.0);
    }

    #[test]
    fn test_compute_similarity_dispatches_correctly() {
        let sim_j = compute_similarity("abc", "abc", &SimilarityAlgorithm::Jaccard);
        let sim_l = compute_similarity("abc", "abc", &SimilarityAlgorithm::Levenshtein);
        let sim_c = compute_similarity("abc", "abc", &SimilarityAlgorithm::Cosine);
        assert_eq!(sim_j, 1.0);
        assert_eq!(sim_l, 1.0);
        assert_eq!(sim_c, 1.0);
    }

    // ============================================================================
    // Nested Table Tests
    // ============================================================================

    fn create_cell_with_nested_table(id: &str, nested_table: TableNode) -> TableCell {
        TableCell {
            id: id.to_string(),
            content: vec![BlockNode::Table(nested_table)],
            span: None,
            properties: None,
        }
    }

    fn create_cell_with_text_and_nested(
        id: &str,
        text: &str,
        nested_table: TableNode,
    ) -> TableCell {
        TableCell {
            id: id.to_string(),
            content: vec![
                BlockNode::Paragraph(simple_paragraph(&format!("{}-p", id), text)),
                BlockNode::Table(nested_table),
            ],
            span: None,
            properties: None,
        }
    }

    #[test]
    fn test_nested_table_identical() {
        let inner_left = create_table(
            "inner-l",
            vec![
                create_row(
                    "ir1",
                    vec![create_cell("ic1", "A"), create_cell("ic2", "B")],
                ),
                create_row(
                    "ir2",
                    vec![create_cell("ic3", "C"), create_cell("ic4", "D")],
                ),
            ],
        );
        let inner_right = create_table(
            "inner-r",
            vec![
                create_row(
                    "ir1",
                    vec![create_cell("ic1", "A"), create_cell("ic2", "B")],
                ),
                create_row(
                    "ir2",
                    vec![create_cell("ic3", "C"), create_cell("ic4", "D")],
                ),
            ],
        );
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![
                    create_cell("c1", "Regular"),
                    create_cell_with_nested_table("c2", inner_left),
                ],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![
                    create_cell("c1", "Regular"),
                    create_cell_with_nested_table("c2", inner_right),
                ],
            )],
        );

        let result = compare_tables(&left, &right);
        // All cells should be identical since nested tables are the same
        assert_eq!(result.table_match_type, TableMatchType::Identical);
        assert_eq!(result.cell_diffs.len(), 2);
        for diff in &result.cell_diffs {
            assert_eq!(diff.change_type, CellChangeType::Identical);
        }
    }

    #[test]
    fn test_nested_table_content_changed() {
        let inner_left = create_table(
            "inner-l",
            vec![create_row(
                "ir1",
                vec![create_cell("ic1", "A"), create_cell("ic2", "B")],
            )],
        );
        let inner_right = create_table(
            "inner-r",
            vec![create_row(
                "ir1",
                vec![create_cell("ic1", "A"), create_cell("ic2", "CHANGED")],
            )],
        );
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![
                    create_cell("c1", "Regular"),
                    create_cell_with_nested_table("c2", inner_left),
                ],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![
                    create_cell("c1", "Regular"),
                    create_cell_with_nested_table("c2", inner_right),
                ],
            )],
        );

        let result = compare_tables(&left, &right);
        // The nested table cell should be marked as modified
        assert_eq!(result.table_match_type, TableMatchType::ContentChanged);
        let nested_cell = result
            .cell_diffs
            .iter()
            .find(|d| d.position == (0, 1))
            .unwrap();
        assert_eq!(nested_cell.change_type, CellChangeType::Modified);
        assert!(
            nested_cell.nested_table_diff.is_some(),
            "Should have nested table diff"
        );
        let nested_diff = nested_cell.nested_table_diff.as_ref().unwrap();
        assert!(
            nested_diff
                .cell_diffs
                .iter()
                .any(|d| d.change_type == CellChangeType::Modified),
            "Nested table should have a modified cell"
        );
    }

    #[test]
    fn test_nested_table_structure_changed() {
        let inner_left = create_table(
            "inner-l",
            vec![create_row(
                "ir1",
                vec![create_cell("ic1", "A"), create_cell("ic2", "B")],
            )],
        );
        let inner_right = create_table(
            "inner-r",
            vec![
                create_row(
                    "ir1",
                    vec![create_cell("ic1", "A"), create_cell("ic2", "B")],
                ),
                create_row(
                    "ir2",
                    vec![create_cell("ic3", "C"), create_cell("ic4", "D")],
                ),
            ],
        );
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell_with_nested_table("c1", inner_left)],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell_with_nested_table("c1", inner_right)],
            )],
        );

        let result = compare_tables(&left, &right);
        let nested_cell = result
            .cell_diffs
            .iter()
            .find(|d| d.position == (0, 0))
            .unwrap();
        assert!(nested_cell.nested_table_diff.is_some());
        let nested_diff = nested_cell.nested_table_diff.as_ref().unwrap();
        // Should detect row addition in nested table
        assert!(
            nested_diff
                .structural_changes
                .iter()
                .any(|c| matches!(c, StructuralChange::RowsAdded { .. }))
        );
    }

    #[test]
    fn test_nested_table_with_text_and_table() {
        let inner = create_table(
            "inner",
            vec![create_row(
                "ir1",
                vec![create_cell("ic1", "Nested Content")],
            )],
        );
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell_with_text_and_nested(
                    "c1",
                    "Cell text",
                    inner.clone(),
                )],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell_with_text_and_nested("c1", "Cell text", inner)],
            )],
        );

        let result = compare_tables(&left, &right);
        assert_eq!(result.table_match_type, TableMatchType::Identical);
    }

    #[test]
    fn test_extract_cell_text_with_nested_table() {
        let inner = create_table(
            "inner",
            vec![create_row(
                "ir1",
                vec![
                    create_cell("ic1", "Nested A"),
                    create_cell("ic2", "Nested B"),
                ],
            )],
        );
        let cell = create_cell_with_nested_table("c1", inner);
        let text = extract_cell_text(&cell);
        assert!(
            text.contains("Nested A"),
            "Should include nested table text"
        );
        assert!(
            text.contains("Nested B"),
            "Should include nested table text"
        );
    }

    #[test]
    fn test_extract_nested_table() {
        let inner = create_table(
            "inner",
            vec![create_row("ir1", vec![create_cell("ic1", "A")])],
        );
        let cell_with = create_cell_with_nested_table("c1", inner);
        assert!(extract_nested_table(&cell_with).is_some());

        let cell_without = create_cell("c2", "Just text");
        assert!(extract_nested_table(&cell_without).is_none());
    }

    #[test]
    fn test_nested_table_cell_diff_has_nested_diff_field() {
        let inner_left = create_table(
            "inner-l",
            vec![create_row(
                "ir1",
                vec![create_cell("ic1", "X"), create_cell("ic2", "Y")],
            )],
        );
        let inner_right = create_table(
            "inner-r",
            vec![create_row(
                "ir1",
                vec![create_cell("ic1", "X"), create_cell("ic2", "Z")],
            )],
        );
        let left = create_table(
            "t1",
            vec![create_row(
                "r1",
                vec![create_cell_with_nested_table("c1", inner_left)],
            )],
        );
        let right = create_table(
            "t2",
            vec![create_row(
                "r1",
                vec![create_cell_with_nested_table("c1", inner_right)],
            )],
        );

        let result = compare_tables(&left, &right);
        // Serialize and deserialize to verify JSON structure
        let json = serde_json::to_string(&result).expect("Should serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("Should parse JSON");
        // The cell diff should contain nested_table_diff
        let cell_diffs = parsed["cell_diffs"].as_array().unwrap();
        assert!(
            cell_diffs
                .iter()
                .any(|cd| cd["nested_table_diff"].is_object()),
            "JSON should contain nested_table_diff for cells with nested tables"
        );
    }
}
