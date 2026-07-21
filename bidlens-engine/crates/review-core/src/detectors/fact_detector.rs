//! Key-fact detector: compares extracted facts between submission pairs.
//!
//! Same facts (identical normalized values) are coordination signals.
//! Conflicting facts (different values for same kind) are also suspicious.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{
    scoring::PresetConfig, sparse_index::CandidatePair, DetectorType, Evidence, KeyFact,
    KeyFactType, MatchBasis, ReviewNode,
};

const RULE_VERSION: &str = "0.3.0";

/// Fact-specific evidence wrapping the base Evidence.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactEvidence {
    pub evidence: Evidence,
    pub source_fact: KeyFact,
    pub target_fact: KeyFact,
    pub same_fact: bool,
    pub conflict: bool,
    pub fact_conflict_penalty: f64,
}

pub struct FactDetector;

impl FactDetector {
    /// Detect fact-based evidence for all fact candidate pairs.
    pub fn detect(
        candidates: &[CandidatePair],
        nodes: &[ReviewNode],
        _preset: &PresetConfig,
    ) -> Vec<FactEvidence> {
        let node_map: HashMap<&str, &ReviewNode> =
            nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        let mut results = Vec::new();

        for pair in candidates {
            if pair.basis != MatchBasis::Fact {
                continue;
            }

            // Gather all source/target facts
            let source_facts = gather_facts(&pair.source_node_ids, &node_map);
            let target_facts = gather_facts(&pair.target_node_ids, &node_map);

            // Compare facts by kind
            for (src_node, src_fact) in &source_facts {
                for (tgt_node, tgt_fact) in &target_facts {
                    if src_fact.fact_type != tgt_fact.fact_type {
                        continue;
                    }

                    let same = src_fact.normalized_value == tgt_fact.normalized_value;
                    let conflict = !same;

                    let penalty = if conflict {
                        conflict_penalty(src_fact.fact_type)
                    } else {
                        0.0
                    };

                    let similarity = if same {
                        // Same fact + identical context text → max confidence
                        if src_node.normalized_text == tgt_node.normalized_text {
                            1.0
                        } else {
                            0.9
                        }
                    } else {
                        // Conflicting facts of same kind — still relevant at lower score
                        0.3
                    };

                    results.push(FactEvidence {
                        evidence: build_evidence(src_node, tgt_node, similarity),
                        source_fact: (*src_fact).clone(),
                        target_fact: (*tgt_fact).clone(),
                        same_fact: same,
                        conflict,
                        fact_conflict_penalty: penalty,
                    });
                }
            }
        }

        results
    }
}

/// Collect (node, fact) pairs from the given node IDs.
fn gather_facts<'a>(
    node_ids: &[String],
    node_map: &HashMap<&'a str, &'a ReviewNode>,
) -> Vec<(&'a ReviewNode, &'a KeyFact)> {
    let mut out = Vec::new();
    for nid in node_ids {
        if let Some(node) = node_map.get(nid.as_str()) {
            for fact in &node.key_facts {
                out.push((*node, fact));
            }
        }
    }
    out
}

/// Penalty weight for conflicting facts by kind.
fn conflict_penalty(fact_type: KeyFactType) -> f64 {
    match fact_type {
        KeyFactType::Amount => 0.15,
        KeyFactType::Ratio => 0.10,
        KeyFactType::Date => 0.10,
        KeyFactType::Period => 0.08,
        KeyFactType::Identifier => 0.12,
        KeyFactType::Qualification => 0.10,
        KeyFactType::Negation => 0.05,
        KeyFactType::Commitment => 0.08,
    }
}

/// Build an Evidence from two nodes.
fn build_evidence(source: &ReviewNode, target: &ReviewNode, similarity: f64) -> Evidence {
    Evidence {
        id: uuid::Uuid::new_v4().to_string(),
        detector_type: DetectorType::KeyFact,
        match_basis: MatchBasis::Fact,
        similarity_score: similarity,
        source_submission_id: source.submission_id.clone(),
        source_node_id: source.id.clone(),
        source_original_text: source.original_text.clone(),
        source_normalized_text: source.normalized_text.clone(),
        source_section_path: source.section_path.clone(),
        source_page_range: source.page_range,
        source_table_location: source.table_location.clone(),
        target_submission_id: target.submission_id.clone(),
        target_node_id: target.id.clone(),
        target_original_text: target.original_text.clone(),
        target_normalized_text: target.normalized_text.clone(),
        target_section_path: target.section_path.clone(),
        target_page_range: target.page_range,
        target_table_location: target.table_location.clone(),
        context_before: String::new(),
        context_after: String::new(),
        tender_filtered: false,
        tender_filter_reason: None,
        rule_version: RULE_VERSION.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ReviewNodeType;

    fn make_node(id: &str, sub_id: &str, text: &str) -> ReviewNode {
        ReviewNode {
            id: id.to_string(),
            source_ast_node_id: String::new(),
            submission_id: sub_id.to_string(),
            node_type: ReviewNodeType::Paragraph,
            section_path: vec![],
            order_index: 0,
            page_range: None,
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

    fn add_fact(node: &mut ReviewNode, fact_type: KeyFactType, original: &str, normalized: &str) {
        node.key_facts.push(KeyFact {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: node.submission_id.clone(),
            node_id: node.id.clone(),
            fact_type,
            normalized_value: normalized.to_string(),
            original_value: original.to_string(),
            unit: None,
            confidence: 0.9,
        });
    }

    #[test]
    fn same_fact_detected() {
        let mut n1 = make_node("n1", "sub-1", "总价1500万元");
        add_fact(&mut n1, KeyFactType::Amount, "1500万元", "1500");
        let mut n2 = make_node("n2", "sub-2", "报价1500万元");
        add_fact(&mut n2, KeyFactType::Amount, "1500万元", "1500");

        let pair = CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Fact,
            score: 1.0,
        };

        let preset = crate::scoring::PresetConfig::for_preset(crate::RiskPreset::Standard);
        let results = FactDetector::detect(&[pair], &[n1, n2], &preset);

        assert_eq!(results.len(), 1);
        assert!(results[0].same_fact);
        assert!(!results[0].conflict);
        assert_eq!(results[0].fact_conflict_penalty, 0.0);
        assert!(results[0].evidence.similarity_score >= 0.9);
    }

    #[test]
    fn conflicting_fact_detected() {
        let mut n1 = make_node("n1", "sub-1", "总价1500万元");
        add_fact(&mut n1, KeyFactType::Amount, "1500万元", "1500");
        let mut n2 = make_node("n2", "sub-2", "报价1800万元");
        add_fact(&mut n2, KeyFactType::Amount, "1800万元", "1800");

        let pair = CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Fact,
            score: 1.0,
        };

        let preset = crate::scoring::PresetConfig::for_preset(crate::RiskPreset::Standard);
        let results = FactDetector::detect(&[pair], &[n1, n2], &preset);

        assert_eq!(results.len(), 1);
        assert!(!results[0].same_fact);
        assert!(results[0].conflict);
        assert!(results[0].fact_conflict_penalty > 0.0);
        assert!(results[0].evidence.similarity_score < 0.5);
    }

    #[test]
    fn no_match_different_fact_types() {
        let mut n1 = make_node("n1", "sub-1", "总价1500万元，工期180天");
        add_fact(&mut n1, KeyFactType::Amount, "1500万元", "1500");
        let mut n2 = make_node("n2", "sub-2", "工期180天");
        add_fact(&mut n2, KeyFactType::Period, "180天", "180天");

        let pair = CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Fact,
            score: 1.0,
        };

        let preset = crate::scoring::PresetConfig::for_preset(crate::RiskPreset::Standard);
        let results = FactDetector::detect(&[pair], &[n1, n2], &preset);

        // Different fact types — no comparison made
        assert!(results.is_empty());
    }

    #[test]
    fn non_fact_candidate_skipped() {
        let mut n1 = make_node("n1", "sub-1", "text");
        add_fact(&mut n1, KeyFactType::Amount, "100万元", "100");
        let mut n2 = make_node("n2", "sub-2", "text");
        add_fact(&mut n2, KeyFactType::Amount, "100万元", "100");

        let pair = CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Lexical,
            score: 1.0,
        };

        let preset = crate::scoring::PresetConfig::for_preset(crate::RiskPreset::Standard);
        let results = FactDetector::detect(&[pair], &[n1, n2], &preset);
        assert!(results.is_empty());
    }
}
