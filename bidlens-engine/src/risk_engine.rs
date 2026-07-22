//! Risk engine: JSON-RPC skeleton for the similarity risk review pipeline.

use document_ast::DocumentAst;
use review_core::{
    AnalysisPhase, DetectorType, ProjectStatus, ReviewNode, RiskPreset, TableLocation, Traverser,
    aggregation, detectors, scoring, sparse_index, tender,
};
use serde::{Deserialize, Serialize};

// ============================================================================
// Request / Response Types (matching packages/shared/src/ipc.ts)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskProgress {
    pub project_id: String,
    pub status: ProjectStatus,
    pub phase: Option<AnalysisPhase>,
    pub stage_label: String,
    pub current: Option<u64>,
    pub total: Option<u64>,
    pub elapsed_ms: u64,
    pub warnings: Vec<String>,
}

// ============================================================================
// AST-based analysis input (from TypeScript after parsing)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmissionAstInput {
    pub submission_id: String,
    pub file_hash: String,
    pub ast: DocumentAst,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenderBaselineInput {
    pub submission_id: String,
    pub normalized_paragraphs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskAnalysisInput {
    pub project_id: String,
    pub submissions: Vec<SubmissionAstInput>,
    pub baseline: Option<TenderBaselineInput>,
    pub preset: RiskPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectorRunResult {
    pub detector_type: DetectorType,
    pub status: DetectorRunStatus,
    pub candidate_count: u32,
    pub hit_count: u32,
    pub elapsed_ms: u64,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DetectorRunStatus {
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskAnalysisResult {
    pub findings: Vec<review_core::RiskFinding>,
    pub file_pair_assessments: Vec<review_core::FilePairAssessment>,
    pub project_risk: review_core::ProjectRiskAssessment,
    pub detector_runs: Vec<DetectorRunResult>,
    pub review_nodes: Vec<ReviewNode>,
    pub tender_filter_results: Option<Vec<review_core::tender::TenderFilterResult>>,
}

// ============================================================================
// Structured Error (matching StructuredRiskError in ipc.ts)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredRiskError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub retryable: bool,
}

impl std::fmt::Display for StructuredRiskError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for StructuredRiskError {}

// ============================================================================
// RiskEngine
// ============================================================================

/// The risk engine coordinates the analysis pipeline.
pub struct RiskEngine;

impl RiskEngine {
    pub fn new() -> Self {
        RiskEngine
    }

    /// Run the analysis pipeline with pre-parsed ASTs from TypeScript.
    /// This is the real pipeline that calls all review-core modules.
    pub async fn run_analysis_with_ast<F>(
        &self,
        input: RiskAnalysisInput,
        mut on_progress: F,
    ) -> Result<RiskAnalysisResult, StructuredRiskError>
    where
        F: FnMut(RiskProgress),
    {
        let project_id = input.project_id.clone();
        let started_at = std::time::Instant::now();
        let preset_config = scoring::PresetConfig::for_preset(input.preset);
        let rule_version = "0.3.0";

        // Helper to emit progress
        let mut emit =
            |phase: AnalysisPhase, label: &str, current: Option<u64>, total: Option<u64>| {
                on_progress(RiskProgress {
                    project_id: project_id.clone(),
                    status: ProjectStatus::Running,
                    phase: Some(phase),
                    stage_label: label.to_string(),
                    current,
                    total,
                    elapsed_ms: started_at.elapsed().as_millis() as u64,
                    warnings: Vec::new(),
                });
            };

        // ── Phase 0: Validating ──
        emit(AnalysisPhase::Validating, "正在验证输入...", None, None);
        if input.submissions.len() < 2 {
            return Err(StructuredRiskError {
                code: "INVALID_INPUT".to_string(),
                message: "至少需要2个投标文件".to_string(),
                details: None,
                retryable: false,
            });
        }

        // ── Phase 1: Parsing (already done by TS, verify ASTs) ──
        emit(AnalysisPhase::Parsing, "已接收解析结果...", None, None);
        for sub in &input.submissions {
            if sub.ast.blocks.is_empty() {
                return Err(StructuredRiskError {
                    code: "EMPTY_AST".to_string(),
                    message: format!("文档AST为空: {}", sub.ast.filename),
                    details: Some(serde_json::json!({ "submissionId": sub.submission_id })),
                    retryable: false,
                });
            }
        }

        // ── Phase 2: Extracting Nodes ──
        emit(
            AnalysisPhase::ExtractingNodes,
            "正在提取审查节点...",
            None,
            None,
        );
        let mut all_nodes: Vec<ReviewNode> = Vec::new();
        let mut submission_ids: Vec<String> = Vec::new();

        for sub in &input.submissions {
            submission_ids.push(sub.submission_id.clone());
            let file_hash = hex::decode(&sub.file_hash).unwrap_or_default();
            let nodes = build_review_nodes(&sub.ast, &sub.submission_id, &file_hash);
            all_nodes.extend(nodes);
        }

        // ── Phase 3: Extracting Entities (already done during node building) ──
        emit(
            AnalysisPhase::ExtractingEntities,
            "实体提取完成...",
            None,
            None,
        );

        // ── Phase 4: Filtering Tender Content ──
        let tender_filter_results = if let Some(ref baseline_input) = input.baseline {
            emit(
                AnalysisPhase::FilteringTenderContent,
                "正在过滤招标公共内容...",
                None,
                None,
            );
            let baseline = tender::build_baseline(
                &format!("baseline-{}", project_id),
                &project_id,
                &baseline_input.submission_id,
                "",
                &baseline_input.normalized_paragraphs,
            );
            let results = tender::filter_tender_content(&all_nodes, &baseline);

            // Mark filtered nodes
            for result in &results {
                if result.filtered {
                    if let Some(node) = all_nodes.iter_mut().find(|n| n.id == result.node_id) {
                        node.is_key_node = false; // downweight filtered nodes
                    }
                }
            }
            Some(results)
        } else {
            emit(
                AnalysisPhase::FilteringTenderContent,
                "无招标基线，跳过过滤...",
                None,
                None,
            );
            None
        };

        // ── Phase 5: Recalling Candidates ──
        emit(
            AnalysisPhase::RecallingCandidates,
            "正在构建稀疏索引...",
            None,
            None,
        );
        let mut recall_index = sparse_index::RecallIndex::new();
        for sub in &input.submissions {
            let sub_nodes: Vec<ReviewNode> = all_nodes
                .iter()
                .filter(|n| n.submission_id == sub.submission_id)
                .cloned()
                .collect();
            recall_index.index_document(&sub.submission_id, &sub_nodes);
        }

        let candidates = recall_index.find_candidates(&submission_ids);
        let total_candidates = candidates.len() as u64;
        emit(
            AnalysisPhase::RecallingCandidates,
            &format!("召回 {total_candidates} 个候选对"),
            Some(total_candidates),
            Some(total_candidates),
        );

        // ── Phase 6: Detecting ──
        let mut detector_runs: Vec<DetectorRunResult> = Vec::new();
        let total_detectors = 4u64;

        // Text detector
        emit(
            AnalysisPhase::Detecting,
            "文本检测...",
            Some(1),
            Some(total_detectors),
        );
        let text_start = std::time::Instant::now();
        let text_evidence = run_detector_safe(
            || detectors::TextDetector::detect(&candidates, &all_nodes, &preset_config),
            &mut detector_runs,
            DetectorType::Text,
            candidates.len(),
            text_start,
        );

        // Table detector
        emit(
            AnalysisPhase::Detecting,
            "表格检测...",
            Some(2),
            Some(total_detectors),
        );
        let table_start = std::time::Instant::now();
        let table_evidence = run_detector_safe(
            || detectors::TableDetector::detect(&candidates, &all_nodes, &preset_config),
            &mut detector_runs,
            DetectorType::Table,
            candidates.len(),
            table_start,
        );

        // Entity detector
        emit(
            AnalysisPhase::Detecting,
            "实体检测...",
            Some(3),
            Some(total_detectors),
        );
        let entity_start = std::time::Instant::now();
        let entity_evidence = run_detector_safe(
            || detectors::EntityDetector::detect(&candidates, &all_nodes, &preset_config),
            &mut detector_runs,
            DetectorType::Entity,
            candidates.len(),
            entity_start,
        );

        // Fact detector
        emit(
            AnalysisPhase::Detecting,
            "事实检测...",
            Some(4),
            Some(total_detectors),
        );
        let fact_start = std::time::Instant::now();
        let fact_evidence = run_detector_safe(
            || detectors::FactDetector::detect(&candidates, &all_nodes, &preset_config),
            &mut detector_runs,
            DetectorType::KeyFact,
            candidates.len(),
            fact_start,
        );

        // ── Phase 7: Aggregating ──
        emit(
            AnalysisPhase::Aggregating,
            "正在聚合检测结果...",
            None,
            None,
        );
        let mut findings = aggregation::aggregate_findings(
            &text_evidence,
            &table_evidence,
            &entity_evidence,
            &fact_evidence,
            rule_version,
        );

        // Apply tender discount to findings
        if let Some(ref filter_results) = tender_filter_results {
            apply_tender_discount(&mut findings, filter_results);
        }

        // Compute directional coverage
        let _coverages = aggregation::compute_directional_coverage(&findings, &submission_ids);

        // Assess file pairs
        let file_pair_assessments =
            aggregation::assess_file_pairs(&findings, &submission_ids, &preset_config);

        // Compute project risk
        let failed_detectors: Vec<DetectorType> = detector_runs
            .iter()
            .filter(|r| matches!(r.status, DetectorRunStatus::Failed))
            .map(|r| r.detector_type)
            .collect();

        let project_risk = aggregation::compute_project_risk(
            &file_pair_assessments,
            &findings,
            &preset_config,
            &failed_detectors,
            &project_id,
        );

        // ── Phase 8: Persisting (done by TS side) ──
        emit(
            AnalysisPhase::Persisting,
            "分析完成，返回结果...",
            None,
            None,
        );

        // ── Phase 9: Completed ──
        emit(AnalysisPhase::Completed, "分析完成", None, None);

        Ok(RiskAnalysisResult {
            findings,
            file_pair_assessments,
            project_risk,
            detector_runs,
            review_nodes: all_nodes,
            tender_filter_results,
        })
    }

}

// ============================================================================
// Pipeline Helpers
// ============================================================================

/// Extract plain text from a table by recursively visiting all cell content.
fn extract_table_text(table: &document_ast::TableNode) -> String {
    table
        .rows
        .iter()
        .flat_map(|r| r.cells.iter())
        .flat_map(|c| c.content.iter())
        .map(|block| match block {
            document_ast::BlockNode::Paragraph(p) => p.plain_text(),
            document_ast::BlockNode::Table(t) => extract_table_text(t),
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Extract plain text from a single cell's content blocks.
fn extract_cell_text(blocks: &[document_ast::BlockNode]) -> String {
    blocks
        .iter()
        .map(|block| match block {
            document_ast::BlockNode::Paragraph(p) => p.plain_text(),
            document_ast::BlockNode::Table(t) => extract_table_text(t),
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Build ReviewNodes from a DocumentAst using the Traverser and extraction functions.
fn build_review_nodes(ast: &DocumentAst, submission_id: &str, file_hash: &[u8]) -> Vec<ReviewNode> {
    let mut nodes = Vec::new();
    let mut table_counter: usize = 0;

    for item in Traverser::new(&ast.blocks) {
        match item.block {
            document_ast::BlockNode::Paragraph(p) => {
                let node_id = review_core::generate_node_id(file_hash, &[item.node_index]);
                let original_text = p.plain_text();
                let normalized_text = review_core::normalize_text(&original_text);
                let content_hash = review_core::content_hash(&normalized_text);
                let entities_strong =
                    review_core::extract_strong_entities(&original_text, submission_id, &node_id);
                let entities_weak =
                    review_core::extract_weak_entities(&original_text, submission_id, &node_id);
                let mut entities = entities_strong;
                entities.extend(entities_weak);
                let key_facts =
                    review_core::extract_key_facts(&original_text, submission_id, &node_id);

                nodes.push(ReviewNode {
                    id: node_id,
                    source_ast_node_id: p.id.clone(),
                    submission_id: submission_id.to_string(),
                    node_type: review_core::ReviewNodeType::Paragraph,
                    section_path: item.section_path,
                    order_index: item.node_index,
                    page_range: item.page_range,
                    original_text,
                    normalized_text,
                    content_hash,
                    labels: Vec::new(),
                    entities,
                    key_facts,
                    is_key_node: true,
                    table_location: None,
                });
            }
            document_ast::BlockNode::Table(t) => {
                for (r, row) in t.rows.iter().enumerate() {
                    for (c, cell) in row.cells.iter().enumerate() {
                        let node_id = review_core::generate_node_id(
                            file_hash,
                            &[item.node_index, r, c],
                        );
                        let original_text = extract_cell_text(&cell.content);
                        let normalized_text = review_core::normalize_text(&original_text);
                        let content_hash = review_core::content_hash(&normalized_text);
                        let entities_strong = review_core::extract_strong_entities(
                            &original_text,
                            submission_id,
                            &node_id,
                        );
                        let entities_weak = review_core::extract_weak_entities(
                            &original_text,
                            submission_id,
                            &node_id,
                        );
                        let mut entities = entities_strong;
                        entities.extend(entities_weak);
                        let key_facts = review_core::extract_key_facts(
                            &original_text,
                            submission_id,
                            &node_id,
                        );

                        nodes.push(ReviewNode {
                            id: node_id,
                            source_ast_node_id: t.id.clone(),
                            submission_id: submission_id.to_string(),
                            node_type: review_core::ReviewNodeType::TableCell,
                            section_path: item.section_path.clone(),
                            order_index: item.node_index,
                            page_range: item.page_range,
                            original_text,
                            normalized_text,
                            content_hash,
                            labels: Vec::new(),
                            entities,
                            key_facts,
                            is_key_node: true,
                            table_location: Some(TableLocation {
                                table_index: table_counter,
                                row_index: r,
                                cell_index: Some(c),
                                header_context: Vec::new(),
                            }),
                        });
                    }
                }
                table_counter += 1;
            }
        }
    }

    nodes
}

/// Run a detector with panic catching and timing.
fn run_detector_safe<F, E>(
    detector_fn: F,
    runs: &mut Vec<DetectorRunResult>,
    detector_type: DetectorType,
    candidate_count: usize,
    start: std::time::Instant,
) -> Vec<E>
where
    F: FnOnce() -> Vec<E> + std::panic::UnwindSafe,
{
    match std::panic::catch_unwind(detector_fn) {
        Ok(evidence) => {
            let hit_count = evidence.len();
            runs.push(DetectorRunResult {
                detector_type,
                status: DetectorRunStatus::Completed,
                candidate_count: candidate_count as u32,
                hit_count: hit_count as u32,
                elapsed_ms: start.elapsed().as_millis() as u64,
                error_message: None,
            });
            evidence
        }
        Err(_) => {
            runs.push(DetectorRunResult {
                detector_type,
                status: DetectorRunStatus::Failed,
                candidate_count: candidate_count as u32,
                hit_count: 0,
                elapsed_ms: start.elapsed().as_millis() as u64,
                error_message: Some("检测器执行异常".to_string()),
            });
            Vec::new()
        }
    }
}

/// Apply tender discount to findings that have filtered evidence.
fn apply_tender_discount(
    findings: &mut [review_core::RiskFinding],
    filter_results: &[review_core::tender::TenderFilterResult],
) {
    let filtered_nodes: std::collections::HashSet<&str> = filter_results
        .iter()
        .filter(|r| r.filtered)
        .map(|r| r.node_id.as_str())
        .collect();

    for finding in findings.iter_mut() {
        let total_evidence = finding.evidence.len() as f64;
        if total_evidence == 0.0 {
            continue;
        }
        let filtered_count = finding
            .evidence
            .iter()
            .filter(|e| {
                filtered_nodes.contains(e.source_node_id.as_str())
                    || filtered_nodes.contains(e.target_node_id.as_str())
            })
            .count() as f64;

        if filtered_count > 0.0 {
            let discount = (filtered_count / total_evidence).min(1.0);
            finding.score_breakdown.tender_discount = discount;
            // Recalculate final score
            let raw = finding
                .score_breakdown
                .exact_match_score
                .max(finding.score_breakdown.lexical_score)
                .max(finding.score_breakdown.structural_score)
                * 0.5
                + finding.score_breakdown.entity_score * 0.25
                + finding.score_breakdown.fact_score * 0.25;
            finding.score_breakdown.final_score =
                (raw * (1.0 - discount) - finding.score_breakdown.fact_conflict_penalty).max(0.0);
        }
    }
}

// ============================================================================
// hex helper (for file_hash decoding)
// ============================================================================

mod hex {
    pub fn decode(s: &str) -> Option<Vec<u8>> {
        if s.len() % 2 != 0 {
            return None;
        }
        let mut bytes = Vec::with_capacity(s.len() / 2);
        let chars: Vec<char> = s.chars().collect();
        for chunk in chars.chunks(2) {
            let hi = hex_val(chunk[0])?;
            let lo = hex_val(chunk[1])?;
            bytes.push((hi << 4) | lo);
        }
        Some(bytes)
    }

    fn hex_val(c: char) -> Option<u8> {
        match c {
            '0'..='9' => Some(c as u8 - b'0'),
            'a'..='f' => Some(c as u8 - b'a' + 10),
            'A'..='F' => Some(c as u8 - b'A' + 10),
            _ => None,
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn risk_progress_serde_camel_case() {
        let progress = RiskProgress {
            project_id: "p-1".to_string(),
            status: ProjectStatus::Running,
            phase: Some(AnalysisPhase::Parsing),
            stage_label: "解析中".to_string(),
            current: Some(2),
            total: Some(10),
            elapsed_ms: 1500,
            warnings: vec![],
        };
        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("\"projectId\""));
        assert!(json.contains("\"stageLabel\""));
        assert!(json.contains("\"elapsedMs\""));
        assert!(json.contains("\"phase\""));
    }

    #[test]
    fn structured_error_serde() {
        let err = StructuredRiskError {
            code: "INVALID_INPUT".to_string(),
            message: "至少需要2个投标文件".to_string(),
            details: Some(serde_json::json!({"min": 2})),
            retryable: false,
        };
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"code\""));
        assert!(json.contains("\"retryable\""));
        let back: StructuredRiskError = serde_json::from_str(&json).unwrap();
        assert_eq!(back.code, "INVALID_INPUT");
    }

    #[test]
    fn hex_decode_valid() {
        assert_eq!(hex::decode("0a1b2c"), Some(vec![0x0a, 0x1b, 0x2c]));
        assert_eq!(hex::decode("FF"), Some(vec![0xFF]));
        assert_eq!(hex::decode(""), Some(vec![]));
    }

    #[test]
    fn hex_decode_invalid() {
        assert_eq!(hex::decode("xyz"), None);
        assert_eq!(hex::decode("0"), None);
    }

    #[test]
    fn analysis_input_serde() {
        let input = RiskAnalysisInput {
            project_id: "proj-1".to_string(),
            submissions: vec![SubmissionAstInput {
                submission_id: "sub-1".to_string(),
                file_hash: "abcdef1234567890".to_string(),
                ast: DocumentAst {
                    id: "ast-1".to_string(),
                    filename: "test.docx".to_string(),
                    sha256: "abc".to_string(),
                    page_count: Some(10),
                    word_count: 1000,
                    parser_version: "0.2.2".to_string(),
                    blocks: vec![],
                    comments: vec![],
                    revisions: vec![],
                },
            }],
            baseline: None,
            preset: RiskPreset::Standard,
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("\"projectId\""));
        assert!(json.contains("\"submissionId\""));
        assert!(json.contains("\"fileHash\""));
        let back: RiskAnalysisInput = serde_json::from_str(&json).unwrap();
        assert_eq!(back.project_id, "proj-1");
    }
}
