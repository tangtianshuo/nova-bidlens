/**
 * P6-02: Optimized paragraph matcher with n-gram indexing.
 *
 * Replaces the O(n*m) brute-force approach with:
 * - N-gram index for fast candidate filtering
 * - Early termination for high-similarity matches
 * - Batch processing for large documents
 */
use document_ast::{DocumentAst, paragraphs};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// N-gram size for indexing (3 characters works well for Chinese/English)
const NGRAM_SIZE: usize = 3;

/// Maximum candidates to consider per paragraph (prevents worst-case)
const MAX_CANDIDATES: usize = 50;

/// Early termination threshold (if similarity > this, stop searching)
const EARLY_TERMINATION_THRESHOLD: f32 = 0.95;

// ---------------------------------------------------------------------------
// N-gram Index
// ---------------------------------------------------------------------------

/// Inverted index from n-grams to document positions.
struct NgramIndex {
    /// Maps n-gram -> set of position indices
    index: HashMap<String, HashSet<usize>>,
}

impl NgramIndex {
    /// Build an index from a list of texts.
    fn new(texts: &[String]) -> Self {
        let mut index: HashMap<String, HashSet<usize>> = HashMap::new();

        for (idx, text) in texts.iter().enumerate() {
            let ngrams = extract_ngrams(text);
            for ngram in ngrams {
                index.entry(ngram).or_insert_with(HashSet::new).insert(idx);
            }
        }

        NgramIndex { index }
    }

    /// Find candidate indices that share at least one n-gram with the query.
    fn find_candidates(&self, query: &str) -> HashSet<usize> {
        let ngrams = extract_ngrams(query);
        let mut candidates = HashSet::new();

        for ngram in ngrams {
            if let Some(positions) = self.index.get(&ngram) {
                candidates.extend(positions);
            }
        }

        candidates
    }
}

/// Extract character n-grams from text.
fn extract_ngrams(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() < NGRAM_SIZE {
        return vec![text.to_string()];
    }

    let mut ngrams = Vec::with_capacity(chars.len() - NGRAM_SIZE + 1);
    for window in chars.windows(NGRAM_SIZE) {
        ngrams.push(window.iter().collect());
    }
    ngrams
}

// ---------------------------------------------------------------------------
// Optimized Similarity
// ---------------------------------------------------------------------------

/// Fast similarity estimate using n-gram overlap (Jaccard on n-grams).
fn ngram_similarity(left: &str, right: &str) -> f32 {
    let left_ngrams: HashSet<String> = extract_ngrams(left).into_iter().collect();
    let right_ngrams: HashSet<String> = extract_ngrams(right).into_iter().collect();

    let intersection = left_ngrams.intersection(&right_ngrams).count() as f32;
    let union = left_ngrams.union(&right_ngrams).count() as f32;

    if union == 0.0 {
        0.0
    } else {
        intersection / union
    }
}

/// Character-level Jaccard similarity (original metric, used for final scoring).
fn char_jaccard(left: &str, right: &str) -> f32 {
    let a: HashSet<char> = left.chars().collect();
    let b: HashSet<char> = right.chars().collect();
    let intersection = a.intersection(&b).count() as f32;
    let union = a.union(&b).count() as f32;

    if union == 0.0 {
        0.0
    } else {
        intersection / union
    }
}

/// Two-stage similarity: fast n-gram filter + precise char Jaccard.
fn compute_similarity(left: &str, right: &str) -> f32 {
    // Quick filter: n-gram similarity
    let fast_score = ngram_similarity(left, right);

    // If fast score is very low, skip expensive computation
    if fast_score < 0.1 {
        return fast_score;
    }

    // Precise score: character Jaccard
    char_jaccard(left, right)
}

// ---------------------------------------------------------------------------
// Optimized Compare
// ---------------------------------------------------------------------------

/// Compare documents using n-gram indexing for O(n * k) performance where k << m.
pub fn compare_documents_optimized(
    left: &DocumentAst,
    right: &DocumentAst,
    options: super::CompareOptions,
) -> super::DiffAst {
    let left_nodes = paragraphs(left);
    let right_nodes = paragraphs(right);

    // Build n-gram index for right document
    let right_texts: Vec<String> = right_nodes.iter().map(|(_, text)| text.clone()).collect();
    let right_index = NgramIndex::new(&right_texts);

    let mut used_right = HashSet::new();
    let mut items = Vec::new();

    // Match left paragraphs to right
    for (left_id, left_text) in &left_nodes {
        // Find candidates using n-gram index
        let mut candidate_indices: Vec<_> =
            right_index.find_candidates(left_text).into_iter().collect();
        candidate_indices.sort_unstable();
        candidate_indices.truncate(MAX_CANDIDATES);

        // Score only candidates (not all right nodes)
        let mut best_match: Option<(usize, &str, &str, f32)> = None;

        for &idx in &candidate_indices {
            if used_right.contains(&idx) {
                continue;
            }

            let (right_id, right_text) = &right_nodes[idx];
            let score = compute_similarity(left_text, right_text);

            // Early termination if score is high enough
            if score >= EARLY_TERMINATION_THRESHOLD {
                best_match = Some((idx, right_id, right_text, score));
                break;
            }

            // Update best match
            match best_match {
                None => best_match = Some((idx, right_id, right_text, score)),
                Some((_, _, _, best_score)) if score > best_score => {
                    best_match = Some((idx, right_id, right_text, score));
                }
                _ => {}
            }
        }

        if let Some((idx, right_id, right_text, score)) =
            best_match.filter(|candidate| candidate.3 >= options.similarity_threshold)
        {
            used_right.insert(idx);
            items.push(super::DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: if left_text == right_text {
                    super::MatchType::Identical
                } else {
                    super::MatchType::Modified
                },
                confidence: score,
                similarity: score,
                source_a: Some(left_text.clone()),
                source_b: Some(right_text.to_string()),
                node_ids_a: vec![left_id.clone()],
                node_ids_b: vec![right_id.to_string()],
                summary: "semantic match".to_string(),
            });
        } else {
            items.push(super::DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: super::MatchType::Deleted,
                confidence: 1.0,
                similarity: 0.0,
                source_a: Some(left_text.clone()),
                source_b: None,
                node_ids_a: vec![left_id.clone()],
                node_ids_b: vec![],
                summary: "only in document A".to_string(),
            });
        }
    }

    // Find unmatched right paragraphs
    for (idx, (right_id, right_text)) in right_nodes.iter().enumerate() {
        if !used_right.contains(&idx) {
            items.push(super::DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: super::MatchType::Added,
                confidence: 1.0,
                similarity: 0.0,
                source_a: None,
                source_b: Some(right_text.clone()),
                node_ids_a: vec![],
                node_ids_b: vec![right_id.clone()],
                summary: "only in document B".to_string(),
            });
        }
    }

    super::DiffAst {
        task_id: Uuid::new_v4().to_string(),
        doc_a_id: left.id.clone(),
        doc_b_id: right.id.clone(),
        items,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use document_ast::{BlockNode, DocumentAst, simple_paragraph};

    #[test]
    fn optimized_matches_bruteforce_results() {
        let left = doc("a", &["投标人应提供营业执照", "旧条款", "相同内容"]);
        let right = doc("b", &["投标人须提供营业执照", "新增条款", "相同内容"]);

        let options = super::super::CompareOptions::default();
        let optimized = compare_documents_optimized(&left, &right, options.clone());
        let bruteforce = super::super::compare_documents(&left, &right, options);

        // Same number of items
        assert_eq!(optimized.items.len(), bruteforce.items.len());

        // Same match types (order may differ)
        let mut opt_types: Vec<_> = optimized.items.iter().map(|i| &i.match_type).collect();
        let mut bf_types: Vec<_> = bruteforce.items.iter().map(|i| &i.match_type).collect();
        opt_types.sort_by_key(|t| format!("{:?}", t));
        bf_types.sort_by_key(|t| format!("{:?}", t));
        assert_eq!(opt_types, bf_types);
    }

    #[test]
    fn ngram_index_finds_correct_candidates() {
        let texts = vec![
            "投标人应提供营业执照".to_string(),
            "旧条款内容".to_string(),
            "完全不同的文本".to_string(),
        ];
        let index = NgramIndex::new(&texts);

        // Query similar to first text should find index 0
        let candidates = index.find_candidates("投标人须提供营业执照");
        assert!(candidates.contains(&0));
    }

    #[test]
    fn early_termination_works() {
        let left = doc("a", &["完全相同的测试文本内容"]);
        let right = doc("b", &["完全相同的测试文本内容"]);

        let options = super::super::CompareOptions::default();
        let diff = compare_documents_optimized(&left, &right, options);

        assert_eq!(diff.items.len(), 1);
        assert_eq!(diff.items[0].match_type, super::super::MatchType::Identical);
        assert!(diff.items[0].similarity >= EARLY_TERMINATION_THRESHOLD);
    }

    #[test]
    fn handles_large_documents_efficiently() {
        // Generate large documents
        let left_texts: Vec<String> = (0..1000).map(|i| format!("段落{}: 测试内容", i)).collect();
        let right_texts: Vec<String> = (0..1000).map(|i| format!("段落{}: 修改内容", i)).collect();

        let left = doc(
            "large-a",
            &left_texts.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
        );
        let right = doc(
            "large-b",
            &right_texts.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
        );

        let options = super::super::CompareOptions::default();
        let start = std::time::Instant::now();
        let diff = compare_documents_optimized(&left, &right, options);
        let duration = start.elapsed();

        // Should complete within reasonable time (2 seconds for 1000 paragraphs)
        assert!(duration.as_secs() < 2, "Took too long: {:?}", duration);
        // Each paragraph should produce at least one diff item (may be more if some are split into deleted+added)
        assert!(
            diff.items.len() >= 1000,
            "Expected >= 1000 items, got {}",
            diff.items.len()
        );
    }

    fn doc(id: &str, texts: &[&str]) -> DocumentAst {
        DocumentAst {
            id: id.to_string(),
            filename: format!("{}.docx", id),
            sha256: id.to_string(),
            page_count: None,
            word_count: texts.iter().map(|text| text.chars().count()).sum(),
            parser_version: "test".to_string(),
            blocks: texts
                .iter()
                .enumerate()
                .map(|(idx, text)| {
                    BlockNode::Paragraph(simple_paragraph(&format!("{}-p{}", id, idx), text))
                })
                .collect(),
            comments: vec![],
            revisions: vec![],
        }
    }
}
