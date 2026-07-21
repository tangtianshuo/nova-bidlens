//! Tender baseline matching — filter nodes that match baseline (tender document) content.

use serde::{Deserialize, Serialize};

use crate::{normalize_text, ReviewNode};

/// A parsed tender baseline document used to filter out boilerplate content.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenderBaseline {
    pub id: String,
    pub project_id: String,
    pub submission_id: String,
    pub content_hash: String,
    pub normalized_paragraphs: Vec<String>,
}

/// Result of comparing a review node against the tender baseline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenderFilterResult {
    pub node_id: String,
    pub filtered: bool,
    pub reason: Option<String>,
}

/// Compare each node's normalized text against baseline paragraphs.
/// Returns a `TenderFilterResult` per input node. Filtered nodes are NOT deleted —
/// callers should set `tender_filtered` on the node and propagate the reason to evidence.
pub fn filter_tender_content(
    nodes: &[ReviewNode],
    baseline: &TenderBaseline,
) -> Vec<TenderFilterResult> {
    // Pre-normalize baseline paragraphs once for O(1) lookup.
    let baseline_set: std::collections::HashSet<&str> = baseline
        .normalized_paragraphs
        .iter()
        .map(|s| s.as_str())
        .collect();

    nodes
        .iter()
        .map(|node| {
            let norm = normalize_text(&node.original_text);
            if baseline_set.contains(norm.as_str()) {
                TenderFilterResult {
                    node_id: node.id.clone(),
                    filtered: true,
                    reason: Some("matches tender baseline paragraph".to_string()),
                }
            } else {
                TenderFilterResult {
                    node_id: node.id.clone(),
                    filtered: false,
                    reason: None,
                }
            }
        })
        .collect()
}

/// Build a `TenderBaseline` from raw paragraph texts (normalizes them in-place).
pub fn build_baseline(
    id: &str,
    project_id: &str,
    submission_id: &str,
    content_hash: &str,
    paragraphs: &[String],
) -> TenderBaseline {
    TenderBaseline {
        id: id.to_string(),
        project_id: project_id.to_string(),
        submission_id: submission_id.to_string(),
        content_hash: content_hash.to_string(),
        normalized_paragraphs: paragraphs.iter().map(|p| normalize_text(p)).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ReviewNode, ReviewNodeType};

    fn make_node(id: &str, text: &str) -> ReviewNode {
        ReviewNode {
            id: id.to_string(),
            source_ast_node_id: String::new(),
            submission_id: "sub-1".to_string(),
            node_type: ReviewNodeType::Paragraph,
            section_path: vec![],
            order_index: 0,
            page_range: None,
            original_text: text.to_string(),
            normalized_text: String::new(),
            content_hash: String::new(),
            labels: vec![],
            entities: vec![],
            key_facts: vec![],
            is_key_node: false,
            table_location: None,
        }
    }

    #[test]
    fn filters_matching_paragraphs() {
        let baseline = build_baseline(
            "b1", "proj-1", "sub-tender", "hash",
            &[
                "本项目采用公开招标方式进行采购".to_string(),
                "投标人须具备相应资质".to_string(),
            ],
        );

        let nodes = vec![
            make_node("n1", "本项目采用公开招标方式进行采购"), // exact match after normalize
            make_node("n2", "投标人须具备相应资质"),
            make_node("n3", "我公司承诺工期为180天"),         // not in baseline
        ];

        let results = filter_tender_content(&nodes, &baseline);
        assert_eq!(results.len(), 3);
        assert!(results[0].filtered);
        assert!(results[0].reason.is_some());
        assert!(results[1].filtered);
        assert!(!results[2].filtered);
        assert!(results[2].reason.is_none());
    }

    #[test]
    fn normalization_handles_punctuation_differences() {
        let baseline = build_baseline(
            "b1", "proj-1", "sub-tender", "hash",
            &["投标文件（正本）".to_string()],
        );

        // Same content with ASCII parens — after normalization both become "投标文件正本"
        let nodes = vec![make_node("n1", "投标文件(正本)")];
        let results = filter_tender_content(&nodes, &baseline);
        assert!(results[0].filtered);
    }

    #[test]
    fn empty_baseline_filters_nothing() {
        let baseline = build_baseline("b1", "proj-1", "sub-tender", "hash", &[]);
        let nodes = vec![make_node("n1", "任意内容")];
        let results = filter_tender_content(&nodes, &baseline);
        assert!(!results[0].filtered);
    }
}
