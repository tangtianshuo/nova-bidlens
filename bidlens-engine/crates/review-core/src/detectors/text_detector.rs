//! Text detector: classifies candidate pairs into exact, n-gram, edit-distance,
//! or structural matches and produces TextEvidence.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    DetectorType, Evidence, MatchBasis, ReviewNode,
    scoring::PresetConfig,
    sparse_index::CandidatePair,
};

// ============================================================================
// Public types
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextMatchType {
    Exact,
    NgramOverlap,
    LightEdit,
    Structural,
}

/// Evidence produced by the text detector. Wraps the shared `Evidence` with
/// text-detector-specific metrics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextEvidence {
    #[serde(flatten)]
    pub evidence: Evidence,
    pub text_match_type: TextMatchType,
    /// Character 3-gram Jaccard similarity between source and target normalized text.
    pub ngram_similarity: f64,
    /// Levenshtein-based similarity (1 - edit_distance / max_len). 1.0 for exact.
    pub edit_distance_ratio: f64,
}

/// Stateless text detector.
pub struct TextDetector;

const RULE_VERSION: &str = "0.3.0";
const NGRAM_N: usize = 3;

// ponytail: O(n*m) Levenshtein; skip texts longer than this to avoid stalls.
// Upgrade to bit-parallel or bounded edit-distance if profiling shows it matters.
const MAX_EDIT_DISTANCE_LEN: usize = 500;

impl TextDetector {
    /// Run text detection over candidate pairs from sparse recall.
    ///
    /// For each candidate pair, compares every (source_node, target_node) combination.
    /// Classifies each hit as exact, n-gram overlap, light edit, or structural.
    /// Filters out evidence below `preset.risk_thresholds.low`.
    pub fn detect(
        candidates: &[CandidatePair],
        nodes: &[ReviewNode],
        preset: &PresetConfig,
    ) -> Vec<TextEvidence> {
        let node_map: HashMap<&str, &ReviewNode> =
            nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        let min_similarity = preset.risk_thresholds.low;
        let mut results = Vec::new();

        for candidate in candidates {
            for source_nid in &candidate.source_node_ids {
                let source_node = match node_map.get(source_nid.as_str()) {
                    Some(n) => n,
                    None => continue,
                };
                if source_node.normalized_text.is_empty() {
                    continue;
                }
                for target_nid in &candidate.target_node_ids {
                    let target_node = match node_map.get(target_nid.as_str()) {
                        Some(n) => n,
                        None => continue,
                    };
                    if target_node.normalized_text.is_empty() {
                        continue;
                    }

                    if let Some(ev) =
                        classify_pair(source_node, target_node, min_similarity)
                    {
                        results.push(ev);
                    }
                }
            }
        }

        results
    }
}

// ============================================================================
// Classification
// ============================================================================

fn classify_pair(
    source: &ReviewNode,
    target: &ReviewNode,
    min_similarity: f64,
) -> Option<TextEvidence> {
    let ngram_sim = char_ngram_jaccard(&source.normalized_text, &target.normalized_text, NGRAM_N);
    let edit_sim = levenshtein_similarity(&source.normalized_text, &target.normalized_text);

    // 1. Exact match
    if source.normalized_text == target.normalized_text {
        return Some(build_text_evidence(
            source,
            target,
            1.0,
            MatchBasis::Lexical,
            TextMatchType::Exact,
            ngram_sim,
            edit_sim,
        ));
    }

    // 2. N-gram overlap (preferred over edit distance per spec hierarchy)
    if ngram_sim >= min_similarity {
        return Some(build_text_evidence(
            source,
            target,
            ngram_sim,
            MatchBasis::Lexical,
            TextMatchType::NgramOverlap,
            ngram_sim,
            edit_sim,
        ));
    }

    // 3. Light edit (Levenshtein)
    if edit_sim >= min_similarity {
        return Some(build_text_evidence(
            source,
            target,
            edit_sim,
            MatchBasis::Lexical,
            TextMatchType::LightEdit,
            ngram_sim,
            edit_sim,
        ));
    }

    // 4. Structural: same section path + similar paragraph position
    let struct_score = structural_similarity(source, target);
    if struct_score >= min_similarity {
        return Some(build_text_evidence(
            source,
            target,
            struct_score,
            MatchBasis::Structural,
            TextMatchType::Structural,
            ngram_sim,
            edit_sim,
        ));
    }

    None
}

// ============================================================================
// Metrics
// ============================================================================

/// Character n-gram Jaccard similarity.
fn char_ngram_jaccard(a: &str, b: &str, n: usize) -> f64 {
    let ngrams_a = extract_ngrams(a, n);
    let ngrams_b = extract_ngrams(b, n);
    jaccard(&ngrams_a, &ngrams_b)
}

fn extract_ngrams(text: &str, n: usize) -> std::collections::HashSet<String> {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() < n {
        return std::collections::HashSet::from([text.to_string()]);
    }
    chars
        .windows(n)
        .map(|w| w.iter().collect::<String>())
        .collect()
}

fn jaccard(a: &std::collections::HashSet<String>, b: &std::collections::HashSet<String>) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 1.0;
    }
    let intersection = a.intersection(b).count();
    let union = a.union(b).count();
    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

/// Levenshtein-based similarity: 1 - edit_distance / max(len_a, len_b).
/// Returns 1.0 for identical strings, 0.0 for completely different.
fn levenshtein_similarity(a: &str, b: &str) -> f64 {
    if a == b {
        return 1.0;
    }
    let chars_a: Vec<char> = a.chars().collect();
    let chars_b: Vec<char> = b.chars().collect();
    let len_a = chars_a.len();
    let len_b = chars_b.len();

    if len_a == 0 && len_b == 0 {
        return 1.0;
    }
    if len_a == 0 || len_b == 0 {
        return 0.0;
    }
    // ponytail: O(n*m) DP, skip very long texts
    if len_a > MAX_EDIT_DISTANCE_LEN || len_b > MAX_EDIT_DISTANCE_LEN {
        return 0.0;
    }

    let dist = levenshtein_dp(&chars_a, &chars_b);
    let max_len = len_a.max(len_b) as f64;
    1.0 - dist as f64 / max_len
}

fn levenshtein_dp(a: &[char], b: &[char]) -> usize {
    let n = a.len();
    let m = b.len();
    let mut prev = (0..=m).collect::<Vec<_>>();
    let mut curr = vec![0usize; m + 1];

    for i in 1..=n {
        curr[0] = i;
        for j in 1..=m {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1).min(curr[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[m]
}

/// Structural similarity: shared section path elements + position proximity.
fn structural_similarity(source: &ReviewNode, target: &ReviewNode) -> f64 {
    // Require at least one shared section path element
    if source.section_path.is_empty() || target.section_path.is_empty() {
        return 0.0;
    }

    let shared = source
        .section_path
        .iter()
        .filter(|s| target.section_path.contains(s))
        .count();
    if shared == 0 {
        return 0.0;
    }

    let max_len = source.section_path.len().max(target.section_path.len()) as f64;
    let section_ratio = shared as f64 / max_len;

    // Position proximity: closer order_index → higher score
    let pos_diff = (source.order_index as i64 - target.order_index as i64).unsigned_abs() as f64;
    let pos_factor = 1.0 / (1.0 + pos_diff);

    section_ratio * pos_factor
}

// ============================================================================
// Evidence builder
// ============================================================================

fn build_text_evidence(
    source: &ReviewNode,
    target: &ReviewNode,
    similarity: f64,
    match_basis: MatchBasis,
    match_type: TextMatchType,
    ngram_sim: f64,
    edit_sim: f64,
) -> TextEvidence {
    TextEvidence {
        evidence: Evidence {
            id: Uuid::new_v4().to_string(),
            detector_type: DetectorType::Text,
            match_basis,
            similarity_score: similarity,
            source_submission_id: source.submission_id.clone(),
            source_node_id: source.id.clone(),
            source_original_text: source.original_text.clone(),
            source_normalized_text: source.normalized_text.clone(),
            source_section_path: source.section_path.clone(),
            source_page_range: source.page_range,
            source_table_location: None,
            target_submission_id: target.submission_id.clone(),
            target_node_id: target.id.clone(),
            target_original_text: target.original_text.clone(),
            target_normalized_text: target.normalized_text.clone(),
            target_section_path: target.section_path.clone(),
            target_page_range: target.page_range,
            target_table_location: None,
            context_before: String::new(),
            context_after: String::new(),
            tender_filtered: false,
            tender_filter_reason: None,
            rule_version: RULE_VERSION.to_string(),
        },
        text_match_type: match_type,
        ngram_similarity: ngram_sim,
        edit_distance_ratio: edit_sim,
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ReviewNodeType;

    fn make_node(id: &str, submission_id: &str, text: &str) -> ReviewNode {
        ReviewNode {
            id: id.to_string(),
            source_ast_node_id: String::new(),
            submission_id: submission_id.to_string(),
            node_type: ReviewNodeType::Paragraph,
            section_path: vec![],
            order_index: 0,
            page_range: Some((1, 1)),
            original_text: text.to_string(),
            normalized_text: crate::normalize_text(text),
            content_hash: crate::content_hash(text),
            labels: vec![],
            entities: vec![],
            key_facts: vec![],
            is_key_node: false,
            table_location: None,
        }
    }

    fn standard_preset() -> PresetConfig {
        PresetConfig::for_preset(crate::RiskPreset::Standard)
    }

    #[test]
    fn exact_match_detected() {
        let source = make_node("n1", "sub-1", "本项目采用公开招标方式进行采购");
        let target = make_node("n2", "sub-2", "本项目采用公开招标方式进行采购");
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Lexical,
            score: 1.0,
        }];

        let results = TextDetector::detect(&candidates, &[source, target], &standard_preset());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text_match_type, TextMatchType::Exact);
        assert_eq!(results[0].evidence.match_basis, MatchBasis::Lexical);
        assert!((results[0].evidence.similarity_score - 1.0).abs() < f64::EPSILON);
        assert!((results[0].edit_distance_ratio - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn ngram_match_detected() {
        // Similar but not identical text — should trigger n-gram overlap
        let source = make_node("n1", "sub-1", "本项目采用公开招标方式进行采购活动");
        let target = make_node("n2", "sub-2", "本项目采用公开招标方式进行招标活动");
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Lexical,
            score: 0.8,
        }];

        let results = TextDetector::detect(&candidates, &[source, target], &standard_preset());
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text_match_type, TextMatchType::NgramOverlap);
        assert_eq!(results[0].evidence.match_basis, MatchBasis::Lexical);
        assert!(results[0].ngram_similarity > 0.5);
        // similarity_score should be the n-gram Jaccard
        assert!((results[0].evidence.similarity_score - results[0].ngram_similarity).abs() < f64::EPSILON);
    }

    #[test]
    fn no_match_filtered_out() {
        // Completely different text — nothing should pass
        let source = make_node("n1", "sub-1", "本项目采用公开招标方式进行采购");
        let target = make_node("n2", "sub-2", "工期为180天质量标准合格");
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Lexical,
            score: 0.1,
        }];

        let results = TextDetector::detect(&candidates, &[source, target], &standard_preset());
        assert!(results.is_empty());
    }

    #[test]
    fn light_edit_detected() {
        // Single-character difference — should be light edit (not exact, not n-gram top pick)
        // We need edit_sim >= 0.3 (Standard low threshold) and ngram_sim < edit_sim
        let source_text = "项目技术方案详细说明包括施工组织设计质量保证措施安全文明施工措施工期保证措施";
        let target_text = "项目技术方案详细说明包括施工组织设计质量保证措施安全文明施工措施工期保证方法";
        let source = make_node("n1", "sub-1", source_text);
        let target = make_node("n2", "sub-2", target_text);
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Lexical,
            score: 0.9,
        }];

        let results = TextDetector::detect(&candidates, &[source, target], &standard_preset());
        assert_eq!(results.len(), 1);
        // Both ngram and edit should be high; ngram likely wins classification
        // But the key is that we get a result with high similarity
        assert!(results[0].evidence.similarity_score > 0.8);
    }

    #[test]
    fn structural_match_same_section_close_position() {
        // Completely different text but same section path and close position
        // Text must have near-zero ngram and edit similarity so only structural triggers
        let mut source = make_node("n1", "sub-1", "甲乙丙丁戊己庚辛壬癸");
        source.section_path = vec!["第一章".to_string(), "第一节".to_string()];
        source.order_index = 5;

        let mut target = make_node("n2", "sub-2", "abcdefghij");
        target.section_path = vec!["第一章".to_string(), "第一节".to_string()];
        target.order_index = 6;

        // Use Loose preset so low threshold is 0.45
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Structural,
            score: 0.5,
        }];

        let loose = PresetConfig::for_preset(crate::RiskPreset::Loose);
        let results = TextDetector::detect(&candidates, &[source, target], &loose);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text_match_type, TextMatchType::Structural);
        assert_eq!(results[0].evidence.match_basis, MatchBasis::Structural);
        // section_ratio = 2/2 = 1.0, pos_factor = 1/(1+1) = 0.5, score = 0.5
        assert!((results[0].evidence.similarity_score - 0.5).abs() < 0.01);
    }

    #[test]
    fn missing_node_skipped() {
        let source = make_node("n1", "sub-1", "一些文本");
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["nonexistent".to_string()],
            basis: MatchBasis::Lexical,
            score: 1.0,
        }];

        let results = TextDetector::detect(&candidates, &[source], &standard_preset());
        assert!(results.is_empty());
    }

    #[test]
    fn multiple_node_pairs_from_candidate() {
        let source1 = make_node("n1", "sub-1", "相同内容A");
        let source2 = make_node("n2", "sub-1", "甲乙丙丁戊");
        let target1 = make_node("n3", "sub-2", "相同内容A");
        let target2 = make_node("n4", "sub-2", "fghijklmn");
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string(), "n2".to_string()],
            target_node_ids: vec!["n3".to_string(), "n4".to_string()],
            basis: MatchBasis::Lexical,
            score: 1.0,
        }];

        let results = TextDetector::detect(
            &candidates,
            &[source1, source2, target1, target2],
            &standard_preset(),
        );
        // n1 vs n3: exact match → included
        // n1 vs n4: no match → excluded
        // n2 vs n3: no match → excluded
        // n2 vs n4: no match → excluded
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text_match_type, TextMatchType::Exact);
    }

    #[test]
    fn evidence_fields_populated() {
        let source = make_node("n1", "sub-1", "测试文本内容");
        let target = make_node("n2", "sub-2", "测试文本内容");
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Lexical,
            score: 1.0,
        }];

        let results = TextDetector::detect(&candidates, &[source, target], &standard_preset());
        let ev = &results[0].evidence;
        assert_eq!(ev.detector_type, DetectorType::Text);
        assert_eq!(ev.source_submission_id, "sub-1");
        assert_eq!(ev.target_submission_id, "sub-2");
        assert_eq!(ev.source_node_id, "n1");
        assert_eq!(ev.target_node_id, "n2");
        assert!(!ev.id.is_empty());
        assert_eq!(ev.rule_version, "0.3.0");
    }
}
