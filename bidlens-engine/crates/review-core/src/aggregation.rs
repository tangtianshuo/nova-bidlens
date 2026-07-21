//! Finding aggregation, directional coverage, file-pair assessment, and project risk.
//!
//! Combines evidence from all detectors into per-pair `RiskFinding`s, computes
//! directional coverage, assesses file pairs, and derives project-level risk.

use std::collections::{HashMap, HashSet};

use sha2::{Digest, Sha256};

use crate::{
    detectors::{EntityEvidence, FactEvidence, TableEvidence, TextEvidence},
    DirectionalCoverage, Evidence, FindingCount, FilePairAssessment, MatchBasis,
    ProjectRiskAssessment, RiskAnalysisStatus, RiskFinding, RiskLevel,
    RiskLevelOrIncomplete, ScoreBreakdown,
};
use crate::scoring::PresetConfig;

const RULE_VERSION: &str = "0.3.0";

// ============================================================================
// Public API
// ============================================================================

/// Aggregate detector evidence into per-submission-pair `RiskFinding`s.
///
/// 1. Converts all evidence types to canonical `Evidence`
/// 2. Groups by (min(sub_a, sub_b), max(sub_a, sub_b)) — unordered pair
/// 3. Deduplicates: same (source_node, target_node, match_basis) keeps highest score
/// 4. Generates deterministic finding ID from hash of pair + sorted evidence IDs + rule_version
/// 5. Skips groups with evidence from only one submission
pub fn aggregate_findings(
    text_evidence: &[TextEvidence],
    table_evidence: &[TableEvidence],
    entity_evidence: &[EntityEvidence],
    fact_evidence: &[FactEvidence],
    rule_version: &str,
) -> Vec<RiskFinding> {
    // Collect all evidence as canonical Evidence
    let mut all_evidence: Vec<Evidence> = Vec::new();

    for te in text_evidence {
        all_evidence.push(te.evidence.clone());
    }
    for te in table_evidence {
        all_evidence.push(table_evidence_to_evidence(te));
    }
    for ee in entity_evidence {
        all_evidence.push(entity_evidence_to_evidence(ee));
    }
    for fe in fact_evidence {
        all_evidence.push(fe.evidence.clone());
    }

    // Group by unordered submission pair
    let mut groups: HashMap<(String, String), Vec<Evidence>> = HashMap::new();
    for ev in all_evidence {
        let (a, b) = pair_key(&ev.source_submission_id, &ev.target_submission_id);
        groups.entry((a, b)).or_default().push(ev);
    }

    // Build findings
    let mut findings = Vec::new();
    for ((sub_a, sub_b), evidence_list) in groups {
        // Must have evidence from at least 2 different submissions
        // (already guaranteed by pair construction, but verify evidence coverage)
        let unique_subs: HashSet<String> = evidence_list
            .iter()
            .flat_map(|e| [e.source_submission_id.clone(), e.target_submission_id.clone()])
            .collect();
        if unique_subs.len() < 2 {
            continue;
        }

        // Deduplicate: (source_node, target_node, match_basis) -> keep highest score
        let deduped = deduplicate_evidence(evidence_list);

        if deduped.is_empty() {
            continue;
        }

        // Deterministic finding ID
        let finding_id = compute_finding_id(&sub_a, &sub_b, &deduped, rule_version);

        // Determine dominant detector type (most evidence)
        let detector_type = dominant_detector_type(&deduped);

        // Compute score breakdown from evidence
        let score_breakdown = compute_score_breakdown_from_evidence(&deduped, rule_version);

        // Risk level from final score
        let risk_level = classify_score(score_breakdown.final_score);

        // Involved submission IDs
        let mut involved: Vec<String> = unique_subs.into_iter().collect();
        involved.sort();

        findings.push(RiskFinding {
            id: finding_id,
            detector_type,
            risk_level,
            involved_submission_ids: involved,
            evidence: deduped,
            symmetric_similarity: score_breakdown.final_score,
            directional_coverage: vec![],
            confidence_score: score_breakdown.final_score,
            score_breakdown,
            rule_version: rule_version.to_string(),
            review_status: crate::FindingReviewStatus::Pending,
            important: false,
            review_note: String::new(),
            reviewed_at: None,
        });
    }

    findings.sort_by(|a, b| a.id.cmp(&b.id));
    findings
}

/// Compute directional coverage for all submission pairs.
///
/// DirectionalCoverage(from=A, to=B): fraction of evidence nodes from A that match B.
/// A->B and B->A are computed asymmetrically.
pub fn compute_directional_coverage(
    findings: &[RiskFinding],
    submission_ids: &[String],
) -> Vec<DirectionalCoverage> {
    // For each ordered pair (from, to), collect unique source_node_ids from `from`
    // that have evidence matching `to`.
    let mut matched_nodes: HashMap<(String, String), HashSet<String>> = HashMap::new();
    let mut total_nodes: HashMap<String, HashSet<String>> = HashMap::new();

    for finding in findings {
        for ev in &finding.evidence {
            // Track nodes for both source and target submissions
            total_nodes
                .entry(ev.source_submission_id.clone())
                .or_default()
                .insert(ev.source_node_id.clone());
            total_nodes
                .entry(ev.target_submission_id.clone())
                .or_default()
                .insert(ev.target_node_id.clone());

            // Record that source_node from source matches target
            matched_nodes
                .entry((ev.source_submission_id.clone(), ev.target_submission_id.clone()))
                .or_default()
                .insert(ev.source_node_id.clone());
            // And that target_node from target matches source (reverse direction)
            matched_nodes
                .entry((ev.target_submission_id.clone(), ev.source_submission_id.clone()))
                .or_default()
                .insert(ev.target_node_id.clone());
        }
    }

    let mut coverages = Vec::new();

    for from_id in submission_ids {
        for to_id in submission_ids {
            if from_id == to_id {
                continue;
            }
            let total = total_nodes
                .get(from_id)
                .map(|s| s.len())
                .unwrap_or(0);
            let matched = matched_nodes
                .get(&(from_id.clone(), to_id.clone()))
                .map(|s| s.len())
                .unwrap_or(0);

            let coverage = if total == 0 {
                0.0
            } else {
                matched as f64 / total as f64
            };

            coverages.push(DirectionalCoverage {
                from_id: from_id.clone(),
                to_id: to_id.clone(),
                coverage,
            });
        }
    }

    coverages
}

/// Assess each file pair from findings.
///
/// - symmetric_similarity: max final_score across findings for this pair
/// - risk_level: classified from symmetric_similarity using preset thresholds
/// - directional_coverage_ab/ba: from pre-computed coverages
pub fn assess_file_pairs(
    findings: &[RiskFinding],
    submission_ids: &[String],
    preset: &PresetConfig,
) -> Vec<FilePairAssessment> {
    // Index findings by unordered pair
    let mut pair_findings: HashMap<(String, String), Vec<&RiskFinding>> = HashMap::new();
    for finding in findings {
        let (a, b) = pair_key(
            &finding.involved_submission_ids[0],
            &finding.involved_submission_ids[1],
        );
        pair_findings.entry((a, b)).or_default().push(finding);
    }

    // Index directional coverages (recompute from findings)
    let coverages = compute_directional_coverage(findings, submission_ids);
    let coverage_map: HashMap<(String, String), f64> = coverages
        .into_iter()
        .map(|c| ((c.from_id, c.to_id), c.coverage))
        .collect();

    let mut assessments = Vec::new();

    for i in 0..submission_ids.len() {
        for j in (i + 1)..submission_ids.len() {
            let a = &submission_ids[i];
            let b = &submission_ids[j];
            let key = pair_key(a, b);

            let findings_for_pair = pair_findings.get(&key).cloned().unwrap_or_default();

            let symmetric_similarity = findings_for_pair
                .iter()
                .map(|f| f.score_breakdown.final_score)
                .fold(0.0_f64, f64::max);

            let risk_level = preset.classify(symmetric_similarity);

            let finding_count = count_findings(&findings_for_pair);

            let cov_ab = coverage_map.get(&(a.clone(), b.clone())).copied().unwrap_or(0.0);
            let cov_ba = coverage_map.get(&(b.clone(), a.clone())).copied().unwrap_or(0.0);

            let mut sorted_pairs = findings_for_pair.clone();
            sorted_pairs.sort_by(|x, y| {
                y.score_breakdown
                    .final_score
                    .partial_cmp(&x.score_breakdown.final_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            let top_finding_ids: Vec<String> =
                sorted_pairs.iter().take(5).map(|f| f.id.clone()).collect();

            // Use the first finding's rule_version, or default
            let rule_version = findings_for_pair
                .first()
                .map(|f| f.rule_version.clone())
                .unwrap_or_else(|| RULE_VERSION.to_string());

            assessments.push(FilePairAssessment {
                id: format!("fpa-{}-{}", a, b),
                project_id: String::new(), // ponytail: filled by orchestrator
                submission_a_id: a.clone(),
                submission_b_id: b.clone(),
                directional_coverage_ab: cov_ab,
                directional_coverage_ba: cov_ba,
                symmetric_similarity,
                risk_level,
                top_finding_ids,
                finding_count,
                rule_version,
                analysis_status: RiskAnalysisStatus::Complete,
            });
        }
    }

    assessments
}

/// Compute project-level risk from file pair assessments.
///
/// - Weighted contribution from each file pair (not count-only)
/// - If any required detector failed, risk is Incomplete
pub fn compute_project_risk(
    file_pairs: &[FilePairAssessment],
    findings: &[RiskFinding],
    preset: &PresetConfig,
    failed_detectors: &[crate::DetectorType],
    project_id: &str,
) -> ProjectRiskAssessment {
    // Incomplete propagation
    if !failed_detectors.is_empty() {
        return ProjectRiskAssessment {
            id: format!("pra-{project_id}"),
            project_id: project_id.to_string(),
            level: RiskLevelOrIncomplete::Incomplete,
            raw_rule_score: 0.0,
            top_contributing_finding_ids: vec![],
            preset: preset.preset,
            rule_version: RULE_VERSION.to_string(),
            analysis_status: RiskAnalysisStatus::Partial,
            high_value_finding_count: 0,
            involved_submission_count: 0,
            strong_entity_hit_count: 0,
            tender_discount_applied: false,
            incomplete_reason: Some(format!(
                "Detectors failed: {}",
                failed_detectors
                    .iter()
                    .map(|d| format!("{:?}", d))
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
        };
    }

    // Weighted project risk: each file pair contributes proportionally
    // Weight = symmetric_similarity^2 (higher-risk pairs contribute more)
    let (weighted_score, total_weight) = file_pairs.iter().fold((0.0, 0.0), |(ws, tw), fp| {
        let w = fp.symmetric_similarity.powi(2);
        (ws + fp.symmetric_similarity * w, tw + w)
    });

    let raw_rule_score = if total_weight > 0.0 {
        weighted_score / total_weight
    } else {
        0.0
    };

    let level = match preset.classify(raw_rule_score) {
        RiskLevel::High => RiskLevelOrIncomplete::High,
        RiskLevel::Medium => RiskLevelOrIncomplete::Medium,
        RiskLevel::Low => RiskLevelOrIncomplete::Low,
    };

    // Top contributing findings (by score, take top 10)
    let mut sorted_findings: Vec<_> = findings.iter().collect();
    sorted_findings.sort_by(|a, b| {
        b.score_breakdown
            .final_score
            .partial_cmp(&a.score_breakdown.final_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let top_contributing_finding_ids: Vec<String> =
        sorted_findings.iter().take(10).map(|f| f.id.clone()).collect();

    // Count high-value findings
    let high_value_finding_count = findings
        .iter()
        .filter(|f| f.risk_level == RiskLevel::High)
        .count() as u32;

    // Unique submission count
    let mut subs: HashSet<&str> = HashSet::new();
    for f in findings {
        for s in &f.involved_submission_ids {
            subs.insert(s);
        }
    }

    // Strong entity hit count
    let strong_entity_hit_count = findings
        .iter()
        .flat_map(|f| &f.evidence)
        .filter(|e| e.match_basis == MatchBasis::Entity)
        .count() as u32;

    // Tender discount applied?
    let tender_discount_applied = findings
        .iter()
        .any(|f| f.score_breakdown.tender_discount > 0.0);

    ProjectRiskAssessment {
        id: format!("pra-{project_id}"),
        project_id: project_id.to_string(),
        level,
        raw_rule_score,
        top_contributing_finding_ids,
        preset: preset.preset,
        rule_version: RULE_VERSION.to_string(),
        analysis_status: RiskAnalysisStatus::Complete,
        high_value_finding_count,
        involved_submission_count: subs.len() as u32,
        strong_entity_hit_count,
        tender_discount_applied,
        incomplete_reason: None,
    }
}

// ============================================================================
// Helpers
// ============================================================================

/// Canonical unordered pair key: (min, max) of the two submission IDs.
fn pair_key(a: &str, b: &str) -> (String, String) {
    if a <= b {
        (a.to_string(), b.to_string())
    } else {
        (b.to_string(), a.to_string())
    }
}

/// Deduplicate evidence: same (source_node, target_node, match_basis) keeps highest score.
fn deduplicate_evidence(evidence: Vec<Evidence>) -> Vec<Evidence> {
    let mut best: HashMap<(String, String, MatchBasis), Evidence> = HashMap::new();
    for ev in evidence {
        let key = (
            ev.source_node_id.clone(),
            ev.target_node_id.clone(),
            ev.match_basis,
        );
        let should_insert = match best.get(&key) {
            Some(existing) => ev.similarity_score > existing.similarity_score,
            None => true,
        };
        if should_insert {
            best.insert(key, ev);
        }
    }
    best.into_values().collect()
}

/// Compute deterministic finding ID from pair + sorted evidence IDs + rule_version.
fn compute_finding_id(
    sub_a: &str,
    sub_b: &str,
    evidence: &[Evidence],
    rule_version: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sub_a.as_bytes());
    hasher.update(sub_b.as_bytes());

    let mut evidence_ids: Vec<&str> = evidence.iter().map(|e| e.id.as_str()).collect();
    evidence_ids.sort();
    for eid in &evidence_ids {
        hasher.update(eid.as_bytes());
    }
    hasher.update(rule_version.as_bytes());

    let result = hasher.finalize();
    hex_encode(&result[..16])
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>()
}

/// Determine dominant detector type by evidence count.
fn dominant_detector_type(evidence: &[Evidence]) -> crate::DetectorType {
    let mut counts: HashMap<crate::DetectorType, usize> = HashMap::new();
    for ev in evidence {
        *counts.entry(ev.detector_type).or_insert(0) += 1;
    }
    counts
        .into_iter()
        .max_by_key(|(_, c)| *c)
        .map(|(dt, _)| dt)
        .unwrap_or(crate::DetectorType::Text)
}

/// Compute a ScoreBreakdown from aggregated evidence.
fn compute_score_breakdown_from_evidence(
    evidence: &[Evidence],
    _rule_version: &str,
) -> ScoreBreakdown {
    let mut max_lexical = 0.0_f64;
    let mut max_structural = 0.0_f64;
    let mut max_entity = 0.0_f64;
    let mut max_fact = 0.0_f64;
    let mut max_exact = 0.0_f64;

    for ev in evidence {
        match ev.match_basis {
            MatchBasis::Lexical => {
                if ev.similarity_score > max_lexical {
                    max_lexical = ev.similarity_score;
                }
                if (ev.similarity_score - 1.0).abs() < f64::EPSILON {
                    max_exact = 1.0;
                }
            }
            MatchBasis::Semantic => {
                if ev.similarity_score > max_lexical {
                    max_lexical = ev.similarity_score;
                }
            }
            MatchBasis::Structural => {
                if ev.similarity_score > max_structural {
                    max_structural = ev.similarity_score;
                }
            }
            MatchBasis::Entity => {
                if ev.similarity_score > max_entity {
                    max_entity = ev.similarity_score;
                }
            }
            MatchBasis::Fact => {
                if ev.similarity_score > max_fact {
                    max_fact = ev.similarity_score;
                }
            }
        }
    }

    crate::scoring::compute_score(
        max_exact,
        max_lexical,
        max_structural,
        max_entity,
        max_fact,
        0.0, // tender_discount — applied by orchestrator
        0.0, // template_discount — applied by orchestrator
        0.0, // fact_conflict_penalty — applied by orchestrator
    )
}

/// Classify score to risk level (Standard thresholds as default).
fn classify_score(score: f64) -> RiskLevel {
    if score >= 0.75 {
        RiskLevel::High
    } else if score >= 0.5 {
        RiskLevel::Medium
    } else {
        RiskLevel::Low
    }
}

fn count_findings(findings: &[&RiskFinding]) -> FindingCount {
    let mut counts = FindingCount {
        high: 0,
        medium: 0,
        low: 0,
    };
    for f in findings {
        match f.risk_level {
            RiskLevel::High => counts.high += 1,
            RiskLevel::Medium => counts.medium += 1,
            RiskLevel::Low => counts.low += 1,
        }
    }
    counts
}

/// Convert TableEvidence to canonical Evidence for aggregation.
fn table_evidence_to_evidence(te: &TableEvidence) -> Evidence {
    Evidence {
        id: te.id.clone(),
        detector_type: crate::DetectorType::Table,
        match_basis: te.match_basis,
        similarity_score: te.similarity_score,
        source_submission_id: te.source_submission_id.clone(),
        source_node_id: format!("table-{}", te.source_table_index),
        source_original_text: format!(
            "table[{}] rows {}..{} cols {}..{}",
            te.source_table_index,
            te.source_row_range.0,
            te.source_row_range.1,
            te.source_col_range.0,
            te.source_col_range.1,
        ),
        source_normalized_text: String::new(),
        source_section_path: vec![],
        source_page_range: None,
        source_table_location: Some(crate::TableLocation {
            table_index: te.source_table_index,
            row_index: te.source_row_range.0,
            cell_index: None,
            header_context: vec![],
        }),
        target_submission_id: te.target_submission_id.clone(),
        target_node_id: format!("table-{}", te.target_table_index),
        target_original_text: format!(
            "table[{}] rows {}..{} cols {}..{}",
            te.target_table_index,
            te.target_row_range.0,
            te.target_row_range.1,
            te.target_col_range.0,
            te.target_col_range.1,
        ),
        target_normalized_text: String::new(),
        target_section_path: vec![],
        target_page_range: None,
        target_table_location: Some(crate::TableLocation {
            table_index: te.target_table_index,
            row_index: te.target_row_range.0,
            cell_index: None,
            header_context: vec![],
        }),
        context_before: String::new(),
        context_after: String::new(),
        tender_filtered: te.tender_filtered,
        tender_filter_reason: te.tender_filter_reason.clone(),
        rule_version: te.rule_version.clone(),
    }
}

/// Convert EntityEvidence to canonical Evidence for aggregation.
fn entity_evidence_to_evidence(ee: &EntityEvidence) -> Evidence {
    Evidence {
        id: ee.id.clone(),
        detector_type: crate::DetectorType::Entity,
        match_basis: ee.match_basis,
        similarity_score: ee.similarity_score,
        source_submission_id: ee.source_submission_id.clone(),
        source_node_id: ee.source_node_id.clone(),
        source_original_text: ee.source_original_text.clone(),
        source_normalized_text: String::new(),
        source_section_path: ee.source_section_path.clone(),
        source_page_range: ee.source_page_range,
        source_table_location: None,
        target_submission_id: ee.target_submission_id.clone(),
        target_node_id: ee.target_node_id.clone(),
        target_original_text: ee.target_original_text.clone(),
        target_normalized_text: String::new(),
        target_section_path: ee.target_section_path.clone(),
        target_page_range: ee.target_page_range,
        target_table_location: None,
        context_before: ee.context_before.clone(),
        context_after: ee.context_after.clone(),
        tender_filtered: false,
        tender_filter_reason: None,
        rule_version: ee.rule_version.clone(),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        detectors::TextEvidence, detectors::TextMatchType, DetectorType, Evidence,
        MatchBasis,
    };

    fn make_text_evidence(
        id: &str,
        source_sub: &str,
        source_node: &str,
        target_sub: &str,
        target_node: &str,
        score: f64,
        basis: MatchBasis,
    ) -> TextEvidence {
        TextEvidence {
            evidence: Evidence {
                id: id.to_string(),
                detector_type: DetectorType::Text,
                match_basis: basis,
                similarity_score: score,
                source_submission_id: source_sub.to_string(),
                source_node_id: source_node.to_string(),
                source_original_text: String::new(),
                source_normalized_text: String::new(),
                source_section_path: vec![],
                source_page_range: None,
                source_table_location: None,
                target_submission_id: target_sub.to_string(),
                target_node_id: target_node.to_string(),
                target_original_text: String::new(),
                target_normalized_text: String::new(),
                target_section_path: vec![],
                target_page_range: None,
                target_table_location: None,
                context_before: String::new(),
                context_after: String::new(),
                tender_filtered: false,
                tender_filter_reason: None,
                rule_version: RULE_VERSION.to_string(),
            },
            text_match_type: TextMatchType::Exact,
            ngram_similarity: score,
            edit_distance_ratio: score,
        }
    }

    #[test]
    fn aggregate_single_pair() {
        let text_ev = vec![
            make_text_evidence("e1", "sub-1", "n1", "sub-2", "n2", 0.9, MatchBasis::Lexical),
            make_text_evidence("e2", "sub-1", "n3", "sub-2", "n4", 0.8, MatchBasis::Lexical),
        ];

        let findings = aggregate_findings(
            &text_ev,
            &[],
            &[],
            &[],
            RULE_VERSION,
        );

        assert_eq!(findings.len(), 1);
        let f = &findings[0];
        assert_eq!(f.evidence.len(), 2);
        assert_eq!(f.involved_submission_ids.len(), 2);
        assert!(f.involved_submission_ids.contains(&"sub-1".to_string()));
        assert!(f.involved_submission_ids.contains(&"sub-2".to_string()));
        assert!(!f.id.is_empty());
    }

    #[test]
    fn aggregate_deduplicates_same_node_basis() {
        // Two text evidence items with same (source_node, target_node, match_basis)
        // Should keep the one with higher score
        let text_ev = vec![
            make_text_evidence("e1", "sub-1", "n1", "sub-2", "n2", 0.7, MatchBasis::Lexical),
            make_text_evidence("e2", "sub-1", "n1", "sub-2", "n2", 0.95, MatchBasis::Lexical),
        ];

        let findings = aggregate_findings(&text_ev, &[], &[], &[], RULE_VERSION);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].evidence.len(), 1);
        assert!((findings[0].evidence[0].similarity_score - 0.95).abs() < f64::EPSILON);
    }

    #[test]
    fn aggregate_separate_pairs() {
        let text_ev = vec![
            make_text_evidence("e1", "sub-1", "n1", "sub-2", "n2", 0.9, MatchBasis::Lexical),
            make_text_evidence("e2", "sub-1", "n1", "sub-3", "n3", 0.8, MatchBasis::Lexical),
        ];

        let findings = aggregate_findings(&text_ev, &[], &[], &[], RULE_VERSION);
        assert_eq!(findings.len(), 2);
    }

    #[test]
    fn deterministic_finding_id() {
        let text_ev = vec![
            make_text_evidence("e1", "sub-1", "n1", "sub-2", "n2", 0.9, MatchBasis::Lexical),
        ];

        let f1 = aggregate_findings(&text_ev, &[], &[], &[], RULE_VERSION);
        let f2 = aggregate_findings(&text_ev, &[], &[], &[], RULE_VERSION);
        assert_eq!(f1[0].id, f2[0].id);
    }

    #[test]
    fn directional_coverage_asymmetric() {
        // sub-1 has 2 nodes: n1 matches sub-2, n3 does not.
        // sub-2 has 1 node: n2 matches sub-1.
        let text_ev = vec![
            make_text_evidence("e1", "sub-1", "n1", "sub-2", "n2", 0.9, MatchBasis::Lexical),
            make_text_evidence("e2", "sub-1", "n3", "sub-3", "n4", 0.5, MatchBasis::Lexical),
        ];

        let findings = aggregate_findings(&text_ev, &[], &[], &[], RULE_VERSION);
        let subs = vec![
            "sub-1".to_string(),
            "sub-2".to_string(),
            "sub-3".to_string(),
        ];
        let coverages = compute_directional_coverage(&findings, &subs);

        let cov_1_2 = coverages
            .iter()
            .find(|c| c.from_id == "sub-1" && c.to_id == "sub-2")
            .unwrap();
        let cov_1_3 = coverages
            .iter()
            .find(|c| c.from_id == "sub-1" && c.to_id == "sub-3")
            .unwrap();

        // sub-1 has 2 nodes total (n1, n3). n1 matches sub-2 => coverage = 1/2
        assert!((cov_1_2.coverage - 0.5).abs() < f64::EPSILON);
        // n3 matches sub-3 => coverage = 1/2
        assert!((cov_1_3.coverage - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn file_pair_assessment_basic() {
        let text_ev = vec![
            make_text_evidence("e1", "sub-1", "n1", "sub-2", "n2", 0.95, MatchBasis::Lexical),
        ];
        let findings = aggregate_findings(&text_ev, &[], &[], &[], RULE_VERSION);
        let subs = vec!["sub-1".to_string(), "sub-2".to_string()];
        let preset = PresetConfig::for_preset(crate::RiskPreset::Standard);

        let assessments = assess_file_pairs(&findings, &subs, &preset);
        assert_eq!(assessments.len(), 1);
        assert_eq!(assessments[0].submission_a_id, "sub-1");
        assert_eq!(assessments[0].submission_b_id, "sub-2");
        assert!(assessments[0].symmetric_similarity > 0.0);
    }

    #[test]
    fn project_risk_weighted() {
        // score 1.0 with Lexical basis → max_exact=1.0 → final_score=0.5
        // score 0.4 with Lexical basis → max_lexical=0.4 → final_score=0.2
        let text_ev = vec![
            make_text_evidence("e1", "sub-1", "n1", "sub-2", "n2", 1.0, MatchBasis::Lexical),
            make_text_evidence("e2", "sub-1", "n3", "sub-3", "n4", 0.4, MatchBasis::Lexical),
        ];
        let findings = aggregate_findings(&text_ev, &[], &[], &[], RULE_VERSION);
        let subs = vec![
            "sub-1".to_string(),
            "sub-2".to_string(),
            "sub-3".to_string(),
        ];
        let preset = PresetConfig::for_preset(crate::RiskPreset::Standard);
        let pairs = assess_file_pairs(&findings, &subs, &preset);

        let risk = compute_project_risk(&pairs, &findings, &preset, &[], "proj-1");

        // Weighted score: w1=0.5^2=0.25, w2=0.2^2=0.04
        // (0.5*0.25 + 0.2*0.04) / (0.25+0.04) = 0.133/0.29 ≈ 0.4586
        // Standard: High>=0.75, Medium>=0.5 → Low
        assert!(matches!(risk.level, RiskLevelOrIncomplete::Low));
        assert!((risk.raw_rule_score - 0.4586).abs() < 0.01);
        assert_eq!(risk.analysis_status, RiskAnalysisStatus::Complete);
        assert!(risk.incomplete_reason.is_none());
        assert_eq!(risk.involved_submission_count, 3);
        // Weighted formula gives different result than simple average (0.35)
        assert!(risk.raw_rule_score > 0.35);
    }

    #[test]
    fn project_risk_incomplete_on_failed_detector() {
        let preset = PresetConfig::for_preset(crate::RiskPreset::Standard);
        let risk = compute_project_risk(&[], &[], &preset, &[DetectorType::Text], "proj-1");

        assert!(matches!(risk.level, RiskLevelOrIncomplete::Incomplete));
        assert_eq!(risk.analysis_status, RiskAnalysisStatus::Partial);
        assert!(risk.incomplete_reason.is_some());
    }
}
