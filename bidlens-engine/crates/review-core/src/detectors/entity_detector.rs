use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::sparse_index::CandidatePair;
use crate::scoring::PresetConfig;
use crate::{EntityStrength, EntityType, MatchBasis, RiskLevel, ReviewNode};

const RULE_VERSION: &str = "0.3.0";
const CONTEXT_WINDOW_CHARS: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityEvidence {
    pub id: String,
    pub entity_type: EntityType,
    pub entity_strength: EntityStrength,
    pub original_value: String,
    pub normalized_value: String,
    pub source_submission_id: String,
    pub source_node_id: String,
    pub source_original_text: String,
    pub source_section_path: Vec<String>,
    pub source_page_range: Option<(u32, u32)>,
    pub target_submission_id: String,
    pub target_node_id: String,
    pub target_original_text: String,
    pub target_section_path: Vec<String>,
    pub target_page_range: Option<(u32, u32)>,
    pub context_before: String,
    pub context_after: String,
    pub match_basis: MatchBasis,
    pub similarity_score: f64,
    pub risk_level: RiskLevel,
    pub confidence: f64,
    pub rule_version: String,
}

pub struct EntityDetector;

impl EntityDetector {
    /// Detect entity-based evidence from candidate pairs.
    ///
    /// Only processes candidates with `basis == Entity`. For each pair, matches
    /// source and target entities by normalized value and produces evidence.
    ///
    /// Strong entity match -> risk level Medium (high only when combined with
    /// other detector evidence by the aggregator).
    /// Weak entity match alone -> risk level Low at most.
    pub fn detect(
        candidates: &[CandidatePair],
        nodes: &[ReviewNode],
        _preset: &PresetConfig,
    ) -> Vec<EntityEvidence> {
        let node_map: HashMap<&str, &ReviewNode> =
            nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        let mut seen: std::collections::HashSet<(String, String, String)> =
            std::collections::HashSet::new();
        let mut evidence_list = Vec::new();

        for candidate in candidates {
            if candidate.basis != MatchBasis::Entity {
                continue;
            }

            // Collect source entities indexed by normalized value
            let mut source_by_norm: HashMap<&str, Vec<(&crate::Entity, &ReviewNode)>> =
                HashMap::new();
            for nid in &candidate.source_node_ids {
                if let Some(node) = node_map.get(nid.as_str()) {
                    for entity in &node.entities {
                        source_by_norm
                            .entry(entity.normalized_value.as_str())
                            .or_default()
                            .push((entity, node));
                    }
                }
            }

            // Match target entities against source
            for nid in &candidate.target_node_ids {
                let Some(target_node) = node_map.get(nid.as_str()) else {
                    continue;
                };
                for target_entity in &target_node.entities {
                    let Some(source_matches) =
                        source_by_norm.get(target_entity.normalized_value.as_str())
                    else {
                        continue;
                    };

                    for (source_entity, source_node) in source_matches {
                        // Deduplicate by (source_node, target_node, normalized_value)
                        let dedup_key = (
                            source_node.id.clone(),
                            target_node.id.clone(),
                            target_entity.normalized_value.clone(),
                        );
                        if !seen.insert(dedup_key) {
                            continue;
                        }

                        let (context_before, context_after) =
                            extract_context(&target_node.original_text, &target_entity.original_value);

                        let (risk_level, similarity_score) = match target_entity.strength {
                            EntityStrength::Strong => (RiskLevel::Medium, 1.0),
                            EntityStrength::Weak => (RiskLevel::Low, 0.7),
                        };

                        evidence_list.push(EntityEvidence {
                            id: uuid::Uuid::new_v4().to_string(),
                            entity_type: target_entity.entity_type.clone(),
                            entity_strength: target_entity.strength,
                            original_value: target_entity.original_value.clone(),
                            normalized_value: target_entity.normalized_value.clone(),
                            source_submission_id: source_entity.submission_id.clone(),
                            source_node_id: source_entity.node_id.clone(),
                            source_original_text: source_node.original_text.clone(),
                            source_section_path: source_node.section_path.clone(),
                            source_page_range: source_node.page_range,
                            target_submission_id: target_entity.submission_id.clone(),
                            target_node_id: target_entity.node_id.clone(),
                            target_original_text: target_node.original_text.clone(),
                            target_section_path: target_node.section_path.clone(),
                            target_page_range: target_node.page_range,
                            context_before,
                            context_after,
                            match_basis: MatchBasis::Entity,
                            similarity_score,
                            risk_level,
                            confidence: target_entity.confidence,
                            rule_version: RULE_VERSION.to_string(),
                        });
                    }
                }
            }
        }

        evidence_list
    }
}

fn extract_context(text: &str, entity_value: &str) -> (String, String) {
    let Some(pos) = text.find(entity_value) else {
        return (String::new(), String::new());
    };

    let before = &text[..pos];
    let after = &text[pos + entity_value.len()..];

    (
        take_last_chars(before, CONTEXT_WINDOW_CHARS),
        take_first_chars(after, CONTEXT_WINDOW_CHARS),
    )
}

fn take_last_chars(s: &str, n: usize) -> String {
    s.chars().rev().take(n).collect::<Vec<_>>().into_iter().rev().collect()
}

fn take_first_chars(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scoring::PresetConfig;
    use crate::{Entity, EntityStrength, EntityType, RiskPreset, ReviewNodeType};

    fn make_node_with_entities(
        id: &str,
        submission_id: &str,
        text: &str,
        entities: Vec<Entity>,
    ) -> ReviewNode {
        ReviewNode {
            id: id.to_string(),
            source_ast_node_id: String::new(),
            submission_id: submission_id.to_string(),
            node_type: ReviewNodeType::Paragraph,
            section_path: vec![],
            order_index: 0,
            page_range: None,
            original_text: text.to_string(),
            normalized_text: crate::normalize_text(text),
            content_hash: crate::content_hash(text),
            labels: vec![],
            entities,
            key_facts: vec![],
            is_key_node: false,
            table_location: None,
        }
    }

    fn strong_entity(
        entity_type: EntityType,
        normalized: &str,
        original: &str,
        submission_id: &str,
        node_id: &str,
    ) -> Entity {
        Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            strength: EntityStrength::Strong,
            entity_type,
            normalized_value: normalized.to_string(),
            original_value: original.to_string(),
            confidence: 0.95,
        }
    }

    fn weak_entity(
        entity_type: EntityType,
        normalized: &str,
        original: &str,
        submission_id: &str,
        node_id: &str,
    ) -> Entity {
        Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            strength: EntityStrength::Weak,
            entity_type,
            normalized_value: normalized.to_string(),
            original_value: original.to_string(),
            confidence: 0.7,
        }
    }

    fn preset() -> PresetConfig {
        PresetConfig::for_preset(RiskPreset::Standard)
    }

    #[test]
    fn strong_entity_match_produces_medium_risk() {
        let credit_a = strong_entity(
            EntityType::CreditCode,
            "91110000MA01KPG5X1",
            "91110000MA01KPG5X1",
            "sub-1",
            "n1",
        );
        let credit_b = strong_entity(
            EntityType::CreditCode,
            "91110000MA01KPG5X1",
            "91110000MA01KPG5X1",
            "sub-2",
            "n2",
        );

        let nodes = vec![
            make_node_with_entities("n1", "sub-1", "信用代码：91110000MA01KPG5X1", vec![credit_a]),
            make_node_with_entities("n2", "sub-2", "统一社会信用代码 91110000MA01KPG5X1", vec![credit_b]),
        ];

        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Entity,
            score: 1.0,
        }];

        let evidence = EntityDetector::detect(&candidates, &nodes, &preset());
        assert_eq!(evidence.len(), 1);
        assert_eq!(evidence[0].risk_level, RiskLevel::Medium);
        assert_eq!(evidence[0].entity_strength, EntityStrength::Strong);
        assert_eq!(evidence[0].entity_type, EntityType::CreditCode);
        assert_eq!(evidence[0].similarity_score, 1.0);
        assert_eq!(evidence[0].match_basis, MatchBasis::Entity);
    }

    #[test]
    fn weak_entity_match_produces_low_risk() {
        let name_a = weak_entity(
            EntityType::CompanyName,
            "北京建设有限公司",
            "北京建设有限公司",
            "sub-1",
            "n1",
        );
        let name_b = weak_entity(
            EntityType::CompanyName,
            "北京建设有限公司",
            "北京建设有限公司",
            "sub-2",
            "n2",
        );

        let nodes = vec![
            make_node_with_entities("n1", "sub-1", "投标人：北京建设有限公司", vec![name_a]),
            make_node_with_entities("n2", "sub-2", "投标单位为北京建设有限公司", vec![name_b]),
        ];

        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Entity,
            score: 1.0,
        }];

        let evidence = EntityDetector::detect(&candidates, &nodes, &preset());
        assert_eq!(evidence.len(), 1);
        assert_eq!(evidence[0].risk_level, RiskLevel::Low);
        assert_eq!(evidence[0].entity_strength, EntityStrength::Weak);
        assert_eq!(evidence[0].entity_type, EntityType::CompanyName);
        assert!((evidence[0].similarity_score - 0.7).abs() < f64::EPSILON);
    }

    #[test]
    fn no_entity_candidates_returns_empty() {
        let nodes = vec![
            make_node_with_entities("n1", "sub-1", "一些文本", vec![]),
            make_node_with_entities("n2", "sub-2", "另一些文本", vec![]),
        ];

        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Lexical,
            score: 1.0,
        }];

        let evidence = EntityDetector::detect(&candidates, &nodes, &preset());
        assert!(evidence.is_empty());
    }

    #[test]
    fn non_entity_basis_candidates_skipped() {
        let credit_a = strong_entity(
            EntityType::CreditCode,
            "91110000MA01KPG5X1",
            "91110000MA01KPG5X1",
            "sub-1",
            "n1",
        );
        let nodes = vec![
            make_node_with_entities("n1", "sub-1", "信用代码：91110000MA01KPG5X1", vec![credit_a]),
        ];

        // Non-entity basis should be skipped
        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Fact,
            score: 1.0,
        }];

        let evidence = EntityDetector::detect(&candidates, &nodes, &preset());
        assert!(evidence.is_empty());
    }

    #[test]
    fn context_window_populated() {
        let credit_a = strong_entity(
            EntityType::CreditCode,
            "91110000MA01KPG5X1",
            "91110000MA01KPG5X1",
            "sub-1",
            "n1",
        );
        let credit_b = strong_entity(
            EntityType::CreditCode,
            "91110000MA01KPG5X1",
            "91110000MA01KPG5X1",
            "sub-2",
            "n2",
        );

        let nodes = vec![
            make_node_with_entities("n1", "sub-1", "信用代码：91110000MA01KPG5X1", vec![credit_a]),
            make_node_with_entities(
                "n2",
                "sub-2",
                "本公司统一社会信用代码为91110000MA01KPG5X1特此证明",
                vec![credit_b],
            ),
        ];

        let candidates = vec![CandidatePair {
            source_id: "sub-1".to_string(),
            target_id: "sub-2".to_string(),
            source_node_ids: vec!["n1".to_string()],
            target_node_ids: vec!["n2".to_string()],
            basis: MatchBasis::Entity,
            score: 1.0,
        }];

        let evidence = EntityDetector::detect(&candidates, &nodes, &preset());
        assert_eq!(evidence.len(), 1);
        assert_eq!(evidence[0].context_before, "本公司统一社会信用代码为");
        assert_eq!(evidence[0].context_after, "特此证明");
    }
}
