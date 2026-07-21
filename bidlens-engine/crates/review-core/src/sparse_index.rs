//! Sparse indexes for fast candidate pair recall.
//!
//! Each index implements `SparseIndex` and can be composed via `RecallIndex`.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};

use crate::{MatchBasis, ReviewNode};

// ============================================================================
// Trait and shared types
// ============================================================================

/// A candidate pair produced by a sparse index.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidatePair {
    pub source_id: String,
    pub target_id: String,
    pub source_node_ids: Vec<String>,
    pub target_node_ids: Vec<String>,
    pub basis: MatchBasis,
    pub score: f64,
}

/// Trait for sparse recall indexes.
pub trait SparseIndex {
    /// Index all nodes from a single submission.
    fn index_document(&mut self, submission_id: &str, nodes: &[ReviewNode]);

    /// Find candidate pairs across the given submission IDs.
    fn find_candidates(&self, submission_ids: &[String]) -> Vec<CandidatePair>;
}

// ============================================================================
// ExactHashIndex
// ============================================================================

/// SHA-256 hash of normalized text → exact matches.
pub struct ExactHashIndex {
    /// hash → Vec<(submission_id, node_id)>
    index: HashMap<String, Vec<(String, String)>>,
}

impl ExactHashIndex {
    pub fn new() -> Self {
        Self {
            index: HashMap::new(),
        }
    }
}

impl SparseIndex for ExactHashIndex {
    fn index_document(&mut self, submission_id: &str, nodes: &[ReviewNode]) {
        for node in nodes {
            if node.normalized_text.is_empty() {
                continue;
            }
            let hash = sha256_hex(node.normalized_text.as_bytes());
            self.index
                .entry(hash)
                .or_default()
                .push((submission_id.to_string(), node.id.clone()));
        }
    }

    fn find_candidates(&self, submission_ids: &[String]) -> Vec<CandidatePair> {
        let id_set: HashSet<&str> = submission_ids.iter().map(|s| s.as_str()).collect();
        let mut pairs = Vec::new();
        let mut seen = HashSet::new();

        for entries in self.index.values() {
            // Group by submission_id
            let mut by_sub: HashMap<&str, Vec<&str>> = HashMap::new();
            for (sid, nid) in entries {
                if id_set.contains(sid.as_str()) {
                    by_sub.entry(sid.as_str()).or_default().push(nid);
                }
            }
            if by_sub.len() < 2 {
                continue;
            }
            // Generate pairs between different submissions
            let subs: Vec<&str> = by_sub.keys().copied().collect();
            for i in 0..subs.len() {
                for j in (i + 1)..subs.len() {
                    let (a, b) = (subs[i], subs[j]);
                    let key = if a < b {
                        format!("{}:{}", a, b)
                    } else {
                        format!("{}:{}", b, a)
                    };
                    if seen.insert(key) {
                        pairs.push(CandidatePair {
                            source_id: a.to_string(),
                            target_id: b.to_string(),
                            source_node_ids: by_sub[a].iter().map(|s| s.to_string()).collect(),
                            target_node_ids: by_sub[b].iter().map(|s| s.to_string()).collect(),
                            basis: MatchBasis::Lexical,
                            score: 1.0,
                        });
                    }
                }
            }
        }
        pairs
    }
}

// ============================================================================
// CharNgramIndex
// ============================================================================

/// Character n-gram (n=3) Jaccard similarity → near-duplicates.
pub struct CharNgramIndex {
    /// submission_id → Vec<(node_id, ngram_set)>
    documents: Vec<(String, String, HashSet<String>)>,
    threshold: f64,
}

impl CharNgramIndex {
    pub fn new(threshold: f64) -> Self {
        Self {
            documents: Vec::new(),
            threshold,
        }
    }

    fn extract_ngrams(text: &str, n: usize) -> HashSet<String> {
        let chars: Vec<char> = text.chars().collect();
        if chars.len() < n {
            let s: String = chars.iter().collect();
            return HashSet::from([s]);
        }
        chars
            .windows(n)
            .map(|w| w.iter().collect::<String>())
            .collect()
    }
}

impl SparseIndex for CharNgramIndex {
    fn index_document(&mut self, submission_id: &str, nodes: &[ReviewNode]) {
        for node in nodes {
            if node.normalized_text.is_empty() {
                continue;
            }
            let ngrams = Self::extract_ngrams(&node.normalized_text, 3);
            self.documents
                .push((submission_id.to_string(), node.id.clone(), ngrams));
        }
    }

    fn find_candidates(&self, submission_ids: &[String]) -> Vec<CandidatePair> {
        let id_set: HashSet<&str> = submission_ids.iter().map(|s| s.as_str()).collect();
        let mut pairs = Vec::new();
        let mut seen = HashSet::new();

        for i in 0..self.documents.len() {
            let (ref sid_a, ref nid_a, ref ngrams_a) = self.documents[i];
            if !id_set.contains(sid_a.as_str()) {
                continue;
            }
            for j in (i + 1)..self.documents.len() {
                let (ref sid_b, ref nid_b, ref ngrams_b) = self.documents[j];
                if sid_a == sid_b || !id_set.contains(sid_b.as_str()) {
                    continue;
                }
                let jaccard = jaccard_similarity(ngrams_a, ngrams_b);
                if jaccard >= self.threshold {
                    let key = pair_key(sid_a, nid_a, sid_b, nid_b);
                    if seen.insert(key) {
                        pairs.push(CandidatePair {
                            source_id: sid_a.clone(),
                            target_id: sid_b.clone(),
                            source_node_ids: vec![nid_a.clone()],
                            target_node_ids: vec![nid_b.clone()],
                            basis: MatchBasis::Lexical,
                            score: jaccard,
                        });
                    }
                }
            }
        }
        pairs
    }
}

// ============================================================================
// EntityIndex
// ============================================================================

/// Normalized entity names → entity-based candidates.
pub struct EntityIndex {
    /// normalized_value → Vec<(submission_id, node_id)>
    index: HashMap<String, Vec<(String, String)>>,
}

impl EntityIndex {
    pub fn new() -> Self {
        Self {
            index: HashMap::new(),
        }
    }
}

impl SparseIndex for EntityIndex {
    fn index_document(&mut self, submission_id: &str, nodes: &[ReviewNode]) {
        for node in nodes {
            for entity in &node.entities {
                self.index
                    .entry(entity.normalized_value.clone())
                    .or_default()
                    .push((submission_id.to_string(), node.id.clone()));
            }
        }
    }

    fn find_candidates(&self, submission_ids: &[String]) -> Vec<CandidatePair> {
        let id_set: HashSet<&str> = submission_ids.iter().map(|s| s.as_str()).collect();
        let mut pairs = Vec::new();
        let mut seen = HashSet::new();

        for entries in self.index.values() {
            let mut by_sub: HashMap<&str, Vec<&str>> = HashMap::new();
            for (sid, nid) in entries {
                if id_set.contains(sid.as_str()) {
                    by_sub.entry(sid.as_str()).or_default().push(nid);
                }
            }
            if by_sub.len() < 2 {
                continue;
            }
            let subs: Vec<&str> = by_sub.keys().copied().collect();
            for i in 0..subs.len() {
                for j in (i + 1)..subs.len() {
                    let (a, b) = (subs[i], subs[j]);
                    let key = format!("entity:{}:{}", a.min(b), a.max(b));
                    if seen.insert(key) {
                        pairs.push(CandidatePair {
                            source_id: a.to_string(),
                            target_id: b.to_string(),
                            source_node_ids: by_sub[a].iter().map(|s| s.to_string()).collect(),
                            target_node_ids: by_sub[b].iter().map(|s| s.to_string()).collect(),
                            basis: MatchBasis::Entity,
                            score: 1.0,
                        });
                    }
                }
            }
        }
        pairs
    }
}

// ============================================================================
// FactIndex
// ============================================================================

/// Normalized fact values → fact-based candidates.
pub struct FactIndex {
    /// normalized_value → Vec<(submission_id, node_id)>
    index: HashMap<String, Vec<(String, String)>>,
}

impl FactIndex {
    pub fn new() -> Self {
        Self {
            index: HashMap::new(),
        }
    }
}

impl SparseIndex for FactIndex {
    fn index_document(&mut self, submission_id: &str, nodes: &[ReviewNode]) {
        for node in nodes {
            for fact in &node.key_facts {
                self.index
                    .entry(fact.normalized_value.clone())
                    .or_default()
                    .push((submission_id.to_string(), node.id.clone()));
            }
        }
    }

    fn find_candidates(&self, submission_ids: &[String]) -> Vec<CandidatePair> {
        let id_set: HashSet<&str> = submission_ids.iter().map(|s| s.as_str()).collect();
        let mut pairs = Vec::new();
        let mut seen = HashSet::new();

        for entries in self.index.values() {
            let mut by_sub: HashMap<&str, Vec<&str>> = HashMap::new();
            for (sid, nid) in entries {
                if id_set.contains(sid.as_str()) {
                    by_sub.entry(sid.as_str()).or_default().push(nid);
                }
            }
            if by_sub.len() < 2 {
                continue;
            }
            let subs: Vec<&str> = by_sub.keys().copied().collect();
            for i in 0..subs.len() {
                for j in (i + 1)..subs.len() {
                    let (a, b) = (subs[i], subs[j]);
                    let key = format!("fact:{}:{}", a.min(b), a.max(b));
                    if seen.insert(key) {
                        pairs.push(CandidatePair {
                            source_id: a.to_string(),
                            target_id: b.to_string(),
                            source_node_ids: by_sub[a].iter().map(|s| s.to_string()).collect(),
                            target_node_ids: by_sub[b].iter().map(|s| s.to_string()).collect(),
                            basis: MatchBasis::Fact,
                            score: 1.0,
                        });
                    }
                }
            }
        }
        pairs
    }
}

// ============================================================================
// TableSignatureIndex
// ============================================================================

/// Table row/column signatures → table candidates.
/// A signature is a SHA-256 of the concatenation of normalized cell values in a row.
pub struct TableSignatureIndex {
    /// signature → Vec<(submission_id, node_id)>
    index: HashMap<String, Vec<(String, String)>>,
}

impl TableSignatureIndex {
    pub fn new() -> Self {
        Self {
            index: HashMap::new(),
        }
    }
}

impl SparseIndex for TableSignatureIndex {
    fn index_document(&mut self, submission_id: &str, nodes: &[ReviewNode]) {
        for node in nodes {
            // Only index table rows and cells
            if node.table_location.is_none() {
                continue;
            }
            let sig = sha256_hex(node.normalized_text.as_bytes());
            self.index
                .entry(sig)
                .or_default()
                .push((submission_id.to_string(), node.id.clone()));
        }
    }

    fn find_candidates(&self, submission_ids: &[String]) -> Vec<CandidatePair> {
        let id_set: HashSet<&str> = submission_ids.iter().map(|s| s.as_str()).collect();
        let mut pairs = Vec::new();
        let mut seen = HashSet::new();

        for entries in self.index.values() {
            let mut by_sub: HashMap<&str, Vec<&str>> = HashMap::new();
            for (sid, nid) in entries {
                if id_set.contains(sid.as_str()) {
                    by_sub.entry(sid.as_str()).or_default().push(nid);
                }
            }
            if by_sub.len() < 2 {
                continue;
            }
            let subs: Vec<&str> = by_sub.keys().copied().collect();
            for i in 0..subs.len() {
                for j in (i + 1)..subs.len() {
                    let (a, b) = (subs[i], subs[j]);
                    let key = format!("table:{}:{}", a.min(b), a.max(b));
                    if seen.insert(key) {
                        pairs.push(CandidatePair {
                            source_id: a.to_string(),
                            target_id: b.to_string(),
                            source_node_ids: by_sub[a].iter().map(|s| s.to_string()).collect(),
                            target_node_ids: by_sub[b].iter().map(|s| s.to_string()).collect(),
                            basis: MatchBasis::Structural,
                            score: 1.0,
                        });
                    }
                }
            }
        }
        pairs
    }
}

// ============================================================================
// RecallIndex — composite index combining all sub-indexes
// ============================================================================

/// Combines all sparse indexes, deduplicates candidates, returns sorted unique pairs.
pub struct RecallIndex {
    exact_hash: ExactHashIndex,
    char_ngram: CharNgramIndex,
    entity: EntityIndex,
    fact: FactIndex,
    table_sig: TableSignatureIndex,
}

impl RecallIndex {
    /// Create a new composite index with default n-gram threshold (0.5).
    pub fn new() -> Self {
        Self {
            exact_hash: ExactHashIndex::new(),
            char_ngram: CharNgramIndex::new(0.5),
            entity: EntityIndex::new(),
            fact: FactIndex::new(),
            table_sig: TableSignatureIndex::new(),
        }
    }

    /// Create with a custom n-gram similarity threshold.
    pub fn with_ngram_threshold(threshold: f64) -> Self {
        Self {
            exact_hash: ExactHashIndex::new(),
            char_ngram: CharNgramIndex::new(threshold),
            entity: EntityIndex::new(),
            fact: FactIndex::new(),
            table_sig: TableSignatureIndex::new(),
        }
    }

    /// Index a submission's nodes across all sub-indexes.
    pub fn index_document(&mut self, submission_id: &str, nodes: &[ReviewNode]) {
        self.exact_hash.index_document(submission_id, nodes);
        self.char_ngram.index_document(submission_id, nodes);
        self.entity.index_document(submission_id, nodes);
        self.fact.index_document(submission_id, nodes);
        self.table_sig.index_document(submission_id, nodes);
    }

    /// Find all candidate pairs across the given submissions, deduplicated and sorted by score descending.
    pub fn find_candidates(&self, submission_ids: &[String]) -> Vec<CandidatePair> {
        let mut all = Vec::new();
        all.extend(self.exact_hash.find_candidates(submission_ids));
        all.extend(self.char_ngram.find_candidates(submission_ids));
        all.extend(self.entity.find_candidates(submission_ids));
        all.extend(self.fact.find_candidates(submission_ids));
        all.extend(self.table_sig.find_candidates(submission_ids));

        // Deduplicate by (source, target) pair — keep highest score
        let mut best: HashMap<String, CandidatePair> = HashMap::new();
        for pair in all {
            let key = pair_key(&pair.source_id, "", &pair.target_id, "");
            let entry = best.entry(key).or_insert_with(|| pair.clone());
            if pair.score > entry.score {
                *entry = pair;
            }
        }

        let mut result: Vec<CandidatePair> = best.into_values().collect();
        result.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        result
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    result
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>()
}

fn jaccard_similarity(a: &HashSet<String>, b: &HashSet<String>) -> f64 {
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

fn pair_key(sid_a: &str, nid_a: &str, sid_b: &str, nid_b: &str) -> String {
    // Stable key regardless of order
    let a = format!("{}:{}", sid_a, nid_a);
    let b = format!("{}:{}", sid_b, nid_b);
    if a < b {
        format!("{}|{}", a, b)
    } else {
        format!("{}|{}", b, a)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{EntityType, EntityStrength, ReviewNodeType};

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
            normalized_text: crate::normalize_text(text),
            content_hash: crate::content_hash(text),
            labels: vec![],
            entities: vec![],
            key_facts: vec![],
            is_key_node: false,
            table_location: None,
        }
    }

    fn make_node_with_entity(id: &str, text: &str, entity_val: &str) -> ReviewNode {
        let mut node = make_node(id, text);
        node.entities.push(crate::Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: node.submission_id.clone(),
            node_id: node.id.clone(),
            strength: EntityStrength::Strong,
            entity_type: EntityType::CreditCode,
            normalized_value: entity_val.to_string(),
            original_value: entity_val.to_string(),
            confidence: 0.95,
        });
        node
    }

    fn make_node_with_fact(id: &str, text: &str, fact_val: &str) -> ReviewNode {
        use crate::KeyFactType;
        let mut node = make_node(id, text);
        node.key_facts.push(crate::KeyFact {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: node.submission_id.clone(),
            node_id: node.id.clone(),
            fact_type: KeyFactType::Amount,
            normalized_value: fact_val.to_string(),
            original_value: fact_val.to_string(),
            unit: Some("万元".to_string()),
            confidence: 0.9,
        });
        node
    }

    #[test]
    fn exact_hash_finds_duplicates() {
        let mut idx = ExactHashIndex::new();
        let n1 = make_node("n1", "本项目采用公开招标");
        let n2 = make_node("n2", "本项目采用公开招标"); // same text
        let n3 = make_node("n3", "完全不同的内容");

        idx.index_document("sub-1", &[n1]);
        idx.index_document("sub-2", &[n2, n3]);

        let pairs = idx.find_candidates(&["sub-1".into(), "sub-2".into()]);
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].basis, MatchBasis::Lexical);
    }

    #[test]
    fn exact_hash_no_self_pairs() {
        let mut idx = ExactHashIndex::new();
        let n1 = make_node("n1", "重复内容");
        let n2 = make_node("n2", "重复内容");
        idx.index_document("sub-1", &[n1, n2]);

        let pairs = idx.find_candidates(&["sub-1".into()]);
        assert!(pairs.is_empty());
    }

    #[test]
    fn char_ngram_finds_similar() {
        let mut idx = CharNgramIndex::new(0.3);
        let n1 = make_node("n1", "本项目采用公开招标方式进行采购");
        let n2 = make_node("n2", "本项目采用公开招标方式进行招标"); // very similar

        idx.index_document("sub-1", &[n1]);
        idx.index_document("sub-2", &[n2]);

        let pairs = idx.find_candidates(&["sub-1".into(), "sub-2".into()]);
        assert!(!pairs.is_empty());
        assert!(pairs[0].score >= 0.3);
    }

    #[test]
    fn entity_index_finds_shared_entities() {
        let mut idx = EntityIndex::new();
        let n1 = make_node_with_entity("n1", "投标方甲", "91110000MA01KPG5X1");
        let n2 = make_node_with_entity("n2", "投标方乙", "91110000MA01KPG5X1");

        idx.index_document("sub-1", &[n1]);
        idx.index_document("sub-2", &[n2]);

        let pairs = idx.find_candidates(&["sub-1".into(), "sub-2".into()]);
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].basis, MatchBasis::Entity);
    }

    #[test]
    fn fact_index_finds_shared_facts() {
        let mut idx = FactIndex::new();
        let n1 = make_node_with_fact("n1", "总价1500万元", "1500");
        let n2 = make_node_with_fact("n2", "报价1500万元", "1500");

        idx.index_document("sub-1", &[n1]);
        idx.index_document("sub-2", &[n2]);

        let pairs = idx.find_candidates(&["sub-1".into(), "sub-2".into()]);
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].basis, MatchBasis::Fact);
    }

    #[test]
    fn recall_index_deduplicates_and_sorts() {
        let mut recall = RecallIndex::new();
        // Same text → exact hash match
        let n1 = make_node("n1", "完全相同的内容");
        let n2 = make_node("n2", "完全相同的内容");
        recall.index_document("sub-1", &[n1]);
        recall.index_document("sub-2", &[n2]);

        let pairs = recall.find_candidates(&["sub-1".into(), "sub-2".into()]);
        // Should appear once (deduped across indexes), sorted by score desc
        assert!(!pairs.is_empty());
        for w in pairs.windows(2) {
            assert!(w[0].score >= w[1].score);
        }
    }

    #[test]
    fn jaccard_identical_sets() {
        let a: HashSet<String> = ["a", "b", "c"].iter().map(|s| s.to_string()).collect();
        let b = a.clone();
        assert!((jaccard_similarity(&a, &b) - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn jaccard_disjoint_sets() {
        let a: HashSet<String> = ["a", "b"].iter().map(|s| s.to_string()).collect();
        let b: HashSet<String> = ["c", "d"].iter().map(|s| s.to_string()).collect();
        assert!((jaccard_similarity(&a, &b) - 0.0).abs() < f64::EPSILON);
    }
}
