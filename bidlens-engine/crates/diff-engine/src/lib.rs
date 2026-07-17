use document_ast::{paragraphs, DocumentAst};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CompareOptions {
    pub similarity_threshold: f32,
}

impl Default for CompareOptions {
    fn default() -> Self {
        Self {
            similarity_threshold: 0.45,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MatchType {
    Identical,
    Modified,
    Added,
    Deleted,
    Moved,
    Split,
    Merged,
    Uncertain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffItem {
    pub match_id: String,
    pub match_type: MatchType,
    pub confidence: f32,
    pub similarity: f32,
    pub source_a: Option<String>,
    pub source_b: Option<String>,
    pub node_ids_a: Vec<String>,
    pub node_ids_b: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffAst {
    pub task_id: String,
    pub doc_a_id: String,
    pub doc_b_id: String,
    pub items: Vec<DiffItem>,
}

pub fn compare_documents(
    left: &DocumentAst,
    right: &DocumentAst,
    options: CompareOptions,
) -> DiffAst {
    let left_nodes = paragraphs(left);
    let right_nodes = paragraphs(right);
    let mut used_right = HashSet::new();
    let mut items = Vec::new();

    for (left_id, left_text) in &left_nodes {
        let best = right_nodes
            .iter()
            .enumerate()
            .filter(|(idx, _)| !used_right.contains(idx))
            .map(|(idx, (right_id, right_text))| {
                (idx, right_id.as_str(), right_text.as_str(), jaccard(left_text.as_str(), right_text.as_str()))
            })
            .max_by(|a, b| a.3.total_cmp(&b.3));

        if let Some((idx, right_id, right_text, score)) =
            best.filter(|candidate| candidate.3 >= options.similarity_threshold)
        {
            used_right.insert(idx);
            items.push(DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: if left_text == right_text {
                    MatchType::Identical
                } else {
                    MatchType::Modified
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
            items.push(DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: MatchType::Deleted,
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

    for (idx, (right_id, right_text)) in right_nodes.iter().enumerate() {
        if !used_right.contains(&idx) {
            items.push(DiffItem {
                match_id: Uuid::new_v4().to_string(),
                match_type: MatchType::Added,
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

    DiffAst {
        task_id: Uuid::new_v4().to_string(),
        doc_a_id: left.id.clone(),
        doc_b_id: right.id.clone(),
        items,
    }
}

fn jaccard(left: &str, right: &str) -> f32 {
    let a = left.chars().collect::<HashSet<_>>();
    let b = right.chars().collect::<HashSet<_>>();
    let intersection = a.intersection(&b).count() as f32;
    let union = a.union(&b).count() as f32;

    if union == 0.0 {
        0.0
    } else {
        intersection / union
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use document_ast::{simple_paragraph, BlockNode, DocumentAst};

    #[test]
    fn detects_modified_added_and_deleted_chunks() {
        let left = doc("a", &["投标人应提供营业执照", "旧条款"]);
        let right = doc("b", &["投标人须提供营业执照", "新增条款"]);
        let diff = compare_documents(&left, &right, CompareOptions::default());

        assert!(diff.items.iter().any(|item| item.match_type == MatchType::Modified));
        assert!(diff.items.iter().any(|item| item.match_type == MatchType::Added));
        assert!(diff.items.iter().any(|item| item.match_type == MatchType::Deleted));
    }

    fn doc(id: &str, texts: &[&str]) -> DocumentAst {
        DocumentAst {
            id: id.to_string(),
            filename: format!("{id}.docx"),
            sha256: id.to_string(),
            page_count: None,
            word_count: texts.iter().map(|text| text.chars().count()).sum(),
            parser_version: "test".to_string(),
            blocks: texts.iter().enumerate().map(|(idx, text)| {
                BlockNode::Paragraph(simple_paragraph(&format!("{id}-p{idx}"), text))
            }).collect()
        }
    }
}


