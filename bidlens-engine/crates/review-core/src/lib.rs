//! Review-core: types, stable IDs, AST traversal, normalization, and extraction
//! primitives for the risk review pipeline.

pub mod aggregation;
pub mod tender;
pub mod sparse_index;
pub mod scoring;
pub mod detectors;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ============================================================================
// Core Enums (matching packages/shared/src/risk-review.ts)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectStatus {
    Draft,
    Running,
    Ready,
    Partial,
    Interrupted,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnalysisPhase {
    Validating,
    Parsing,
    ExtractingNodes,
    ExtractingEntities,
    FilteringTenderContent,
    RecallingCandidates,
    Detecting,
    Aggregating,
    Persisting,
    Completed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SubmissionState {
    Pending,
    Validated,
    Parsing,
    Parsed,
    Extracting,
    Extracted,
    Failed,
    Removed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskLevel {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DetectorType {
    Text,
    Table,
    Entity,
    KeyFact,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskPreset {
    Strict,
    Standard,
    Loose,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskAnalysisStatus {
    Complete,
    Degraded,
    Partial,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskFileFormat {
    Docx,
    Pdf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FindingReviewStatus {
    Pending,
    Confirmed,
    Ignored,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReviewNodeType {
    Heading,
    Paragraph,
    ListItem,
    TableRow,
    TableCell,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BusinessLabel {
    BidderIdentity,
    Authorization,
    Qualification,
    Personnel,
    Performance,
    TechnicalSolution,
    Schedule,
    Quality,
    Equipment,
    Commercial,
    Commitment,
    Generic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EntityStrength {
    Strong,
    Weak,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StrongEntityType {
    IdCard,
    Phone,
    Email,
    CreditCode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WeakEntityType {
    PersonName,
    CompanyName,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KeyFactType {
    Amount,
    Ratio,
    Date,
    Period,
    Identifier,
    Qualification,
    Negation,
    Commitment,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MatchBasis {
    Lexical,
    Semantic,
    Structural,
    Entity,
    Fact,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuditEventType {
    ProjectCreated,
    FileAdded,
    FileRemoved,
    FileReplaced,
    NoBaselineConfirmed,
    AnalysisStarted,
    AnalysisCancelled,
    AnalysisRecovered,
    PartialAccepted,
    ReviewChanged,
    NoteChanged,
    ReportExported,
    ProjectDeleted,
    CacheCleaned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportFormat {
    Pdf,
    Html,
    Markdown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportScope {
    All,
    Confirmed,
    Important,
    Filtered,
}

// ============================================================================
// Core Data Types (matching packages/shared/src/risk-review.ts)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableLocation {
    pub table_index: usize,
    pub row_index: usize,
    pub cell_index: Option<usize>,
    pub header_context: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entity {
    pub id: String,
    pub submission_id: String,
    pub node_id: String,
    pub strength: EntityStrength,
    #[serde(rename = "entityType")]
    pub entity_type: EntityType,
    pub normalized_value: String,
    pub original_value: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EntityType {
    IdCard,
    Phone,
    Email,
    CreditCode,
    PersonName,
    CompanyName,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyFact {
    pub id: String,
    pub submission_id: String,
    pub node_id: String,
    #[serde(rename = "factType")]
    pub fact_type: KeyFactType,
    pub normalized_value: String,
    pub original_value: String,
    pub unit: Option<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewNode {
    pub id: String,
    pub source_ast_node_id: String,
    pub submission_id: String,
    #[serde(rename = "nodeType")]
    pub node_type: ReviewNodeType,
    pub section_path: Vec<String>,
    pub order_index: usize,
    pub page_range: Option<(u32, u32)>,
    pub original_text: String,
    pub normalized_text: String,
    pub content_hash: String,
    pub labels: Vec<BusinessLabel>,
    pub entities: Vec<Entity>,
    pub key_facts: Vec<KeyFact>,
    pub is_key_node: bool,
    pub table_location: Option<TableLocation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreBreakdown {
    pub exact_match_score: f64,
    pub lexical_score: f64,
    pub structural_score: f64,
    pub entity_score: f64,
    pub fact_score: f64,
    pub tender_discount: f64,
    pub template_discount: f64,
    pub fact_conflict_penalty: f64,
    pub final_score: f64,
    pub rule_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectorCandidate {
    pub id: String,
    #[serde(rename = "detectorType")]
    pub detector_type: DetectorType,
    pub source_submission_id: String,
    pub source_node_id: String,
    pub target_submission_id: String,
    pub target_node_id: String,
    pub score_breakdown: ScoreBreakdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub id: String,
    #[serde(rename = "detectorType")]
    pub detector_type: DetectorType,
    pub match_basis: MatchBasis,
    pub similarity_score: f64,
    pub source_submission_id: String,
    pub source_node_id: String,
    pub source_original_text: String,
    pub source_normalized_text: String,
    pub source_section_path: Vec<String>,
    pub source_page_range: Option<(u32, u32)>,
    pub source_table_location: Option<TableLocation>,
    pub target_submission_id: String,
    pub target_node_id: String,
    pub target_original_text: String,
    pub target_normalized_text: String,
    pub target_section_path: Vec<String>,
    pub target_page_range: Option<(u32, u32)>,
    pub target_table_location: Option<TableLocation>,
    pub context_before: String,
    pub context_after: String,
    pub tender_filtered: bool,
    pub tender_filter_reason: Option<String>,
    pub rule_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectionalCoverage {
    pub from_id: String,
    pub to_id: String,
    pub coverage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskFinding {
    pub id: String,
    #[serde(rename = "detectorType")]
    pub detector_type: DetectorType,
    pub risk_level: RiskLevel,
    pub involved_submission_ids: Vec<String>,
    pub evidence: Vec<Evidence>,
    pub symmetric_similarity: f64,
    pub directional_coverage: Vec<DirectionalCoverage>,
    pub confidence_score: f64,
    pub score_breakdown: ScoreBreakdown,
    pub rule_version: String,
    pub review_status: FindingReviewStatus,
    pub important: bool,
    pub review_note: String,
    pub reviewed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDecision {
    pub id: String,
    pub project_id: String,
    pub finding_id: String,
    pub status: FindingReviewStatus,
    pub important: bool,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePairAssessment {
    pub id: String,
    pub project_id: String,
    pub submission_a_id: String,
    pub submission_b_id: String,
    pub directional_coverage_ab: f64,
    pub directional_coverage_ba: f64,
    pub symmetric_similarity: f64,
    pub risk_level: RiskLevel,
    pub top_finding_ids: Vec<String>,
    pub finding_count: FindingCount,
    pub rule_version: String,
    pub analysis_status: RiskAnalysisStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindingCount {
    pub high: u32,
    pub medium: u32,
    pub low: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRiskAssessment {
    pub id: String,
    pub project_id: String,
    pub level: RiskLevelOrIncomplete,
    pub raw_rule_score: f64,
    pub top_contributing_finding_ids: Vec<String>,
    pub preset: RiskPreset,
    pub rule_version: String,
    pub analysis_status: RiskAnalysisStatus,
    pub high_value_finding_count: u32,
    pub involved_submission_count: u32,
    pub strong_entity_hit_count: u32,
    pub tender_discount_applied: bool,
    pub incomplete_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskLevelOrIncomplete {
    High,
    Medium,
    Low,
    Incomplete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisCheckpoint {
    pub id: String,
    pub project_id: String,
    pub phase: AnalysisPhase,
    pub input_hash: String,
    pub processing_version: String,
    pub completed_detectors: Vec<DetectorType>,
    pub intermediate_result_ref: Option<String>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectorRun {
    pub id: String,
    pub project_id: String,
    #[serde(rename = "detectorType")]
    pub detector_type: DetectorType,
    pub status: DetectorRunStatus,
    pub candidate_count: u64,
    pub hit_count: u64,
    pub elapsed_ms: u64,
    pub error_message: Option<String>,
    pub rule_version: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DetectorRunStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub id: String,
    pub project_id: String,
    pub event_type: AuditEventType,
    pub payload: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedReport {
    pub id: String,
    pub project_id: String,
    pub format: ReportFormat,
    pub scope: ReportScope,
    pub result_hash: String,
    pub file_path: String,
    pub created_at: String,
}

// ============================================================================
// Stable ID Generation (Task 1)
// ============================================================================

/// Generate a deterministic node ID from file content hash and AST position path.
/// Same inputs always produce the same ID.
pub fn generate_node_id(file_hash: &[u8], node_path: &[usize]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(file_hash);
    for &idx in node_path {
        hasher.update(idx.to_le_bytes());
    }
    let result = hasher.finalize();
    // Use first 16 bytes as hex (32 chars) — sufficient collision resistance for node IDs
    hex_encode(&result[..16])
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>()
}

// ============================================================================
// AST Traversal (Task 1)
// ============================================================================

/// Section path as a stack of heading texts.
pub type SectionPath = Vec<String>;

/// Page range (start, end) inclusive.
pub type PageRange = (u32, u32);

/// A traversal item yielded by the document walker.
#[derive(Debug, Clone)]
pub struct TraversalItem<'a> {
    pub node_index: usize,
    pub block: &'a document_ast::BlockNode,
    pub section_path: SectionPath,
    pub page_range: Option<PageRange>,
}

/// Iterator over document AST blocks with section path tracking.
pub struct Traverser<'a> {
    blocks: &'a [document_ast::BlockNode],
    index: usize,
    section_stack: Vec<String>,
}

impl<'a> Traverser<'a> {
    pub fn new(blocks: &'a [document_ast::BlockNode]) -> Self {
        Self {
            blocks,
            index: 0,
            section_stack: Vec::new(),
        }
    }
}

impl<'a> Iterator for Traverser<'a> {
    type Item = TraversalItem<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        while self.index < self.blocks.len() {
            let block = &self.blocks[self.index];
            let node_index = self.index;
            self.index += 1;

            // Detect headings from paragraph format — paragraphs with bold + larger font
            // or text matching common heading patterns (e.g., "第X章", "X.", numbering)
            if let document_ast::BlockNode::Paragraph(p) = block {
                let text = p.plain_text();
                if is_heading(&text, p.paragraph_format.as_ref()) {
                    // Pop section stack until we find a parent level or it's empty
                    let level = heading_level(&text);
                    while self.section_stack.len() >= level && !self.section_stack.is_empty() {
                        self.section_stack.pop();
                    }
                    self.section_stack.push(text.clone());
                }
            }

            let page_range = match block {
                document_ast::BlockNode::Paragraph(p) => {
                    match (p.page_start, p.page_end) {
                        (Some(s), Some(e)) => Some((s as u32, e as u32)),
                        _ => None,
                    }
                }
                document_ast::BlockNode::Table(t) => match (t.page_start, t.page_end) {
                    (Some(s), Some(e)) => Some((s as u32, e as u32)),
                    _ => None,
                },
            };

            return Some(TraversalItem {
                node_index,
                block,
                section_path: self.section_stack.clone(),
                page_range,
            });
        }
        None
    }
}

/// Traverse document AST blocks, yielding items with section path and page range.
pub fn traverse<'a>(blocks: &'a [document_ast::BlockNode]) -> Traverser<'a> {
    Traverser::new(blocks)
}

/// Find a block node by its AST node ID.
pub fn find_node<'a>(
    blocks: &'a [document_ast::BlockNode],
    id: &str,
) -> Option<&'a document_ast::BlockNode> {
    blocks.iter().find(|b| match b {
        document_ast::BlockNode::Paragraph(p) => p.id == id,
        document_ast::BlockNode::Table(t) => t.id == id,
    })
}

/// Heuristic: does this paragraph look like a section heading?
fn is_heading(text: &str, fmt: Option<&document_ast::ParagraphFormat>) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() || trimmed.len() > 200 {
        return false;
    }
    // Bold paragraphs that are short are likely headings
    if let Some(f) = fmt {
        // No reliable heading detection from format alone; rely on text patterns
        let _ = f;
    }
    // Chinese heading patterns: 第X章, 第X节, 第X条, X、, （X）
    if trimmed.starts_with("第") && (trimmed.contains("章") || trimmed.contains("节") || trimmed.contains("条"))
    {
        return true;
    }
    // Numbered patterns: "1.", "1.1", "1.1.1", "一、", "（一）"
    let bytes = trimmed.as_bytes();
    if bytes.first().map_or(false, |b| b.is_ascii_digit()) {
        // "N" or "N.N" or "N.N.N" followed by text
        let mut dots = 0;
        let mut i = 0;
        while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
            if bytes[i] == b'.' {
                dots += 1;
            }
            i += 1;
        }
        if i > 0 && i < bytes.len() && dots <= 3 {
            return true;
        }
    }
    false
}

/// Crude heading level estimation. Returns 1-based level.
fn heading_level(text: &str) -> usize {
    let trimmed = text.trim();
    if trimmed.starts_with("第") && trimmed.contains("章") {
        return 1;
    }
    if trimmed.starts_with("第") && trimmed.contains("节") {
        return 2;
    }
    if trimmed.starts_with("第") && trimmed.contains("条") {
        return 3;
    }
    // Count dots in leading number pattern
    let bytes = trimmed.as_bytes();
    let mut dots = 0;
    for &b in bytes {
        if b == b'.' {
            dots += 1;
        } else if !b.is_ascii_digit() {
            break;
        }
    }
    dots + 1
}

// ============================================================================
// Text Normalization (Task 1)
// ============================================================================

/// Normalize text for comparison: strip punctuation, collapse whitespace, lowercase.
/// Handles Chinese/English mixed text.
pub fn normalize_text(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut last_was_space = false;

    for ch in text.chars() {
        if ch.is_ascii_whitespace() || ch == '\u{3000}' {
            // fullwidth space
            if !last_was_space && !result.is_empty() {
                result.push(' ');
                last_was_space = true;
            }
        } else if is_cjk_punctuation(ch) || is_ascii_punctuation(ch) {
            // Skip punctuation
            last_was_space = false;
        } else {
            // Lowercase ASCII, keep CJK as-is
            for lc in ch.to_lowercase() {
                result.push(lc);
            }
            last_was_space = false;
        }
    }

    result.trim().to_string()
}

fn is_cjk_punctuation(ch: char) -> bool {
    matches!(
        ch,
        '\u{3001}' // 、
        | '\u{3002}' // 。
        | '\u{FF0C}' // ，
        | '\u{FF0E}' // ．
        | '\u{FF1A}' // ：
        | '\u{FF1B}' // ；
        | '\u{FF01}' // ！
        | '\u{FF1F}' // ？
        | '\u{2018}' // '
        | '\u{2019}' // '
        | '\u{201C}' // "
        | '\u{201D}' // "
        | '\u{300A}' // 《
        | '\u{300B}' // 》
        | '\u{3008}' // 〈
        | '\u{3009}' // 〉
        | '\u{3010}' // 【
        | '\u{3011}' // 】
        | '\u{FF08}' // （
        | '\u{FF09}' // ）
        | '\u{FF3B}' // ［
        | '\u{FF3D}' // ］
        | '\u{FF5B}' // ｛
        | '\u{FF5D}' // ｝
    )
}

fn is_ascii_punctuation(ch: char) -> bool {
    ch.is_ascii_punctuation()
}

/// Compute SHA-256 hex digest of text content (for content_hash fields).
pub fn content_hash(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let result = hasher.finalize();
    hex_encode(&result)
}

// ============================================================================
// Entity Extraction (Task 2)
// ============================================================================

/// Extract strong entities: company names, credit codes, project IDs.
pub fn extract_strong_entities(
    text: &str,
    submission_id: &str,
    node_id: &str,
) -> Vec<Entity> {
    let mut entities = Vec::new();

    // Credit code: 18-char alphanumeric (统一社会信用代码)
    for mat in CREDIT_CODE_RE.find_iter(text) {
        let val = mat.as_str();
        entities.push(Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            strength: EntityStrength::Strong,
            entity_type: EntityType::CreditCode,
            normalized_value: val.to_uppercase(),
            original_value: val.to_string(),
            confidence: 0.95,
        });
    }

    // Phone numbers (11-digit mobile)
    for mat in PHONE_RE.find_iter(text) {
        let val = mat.as_str();
        entities.push(Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            strength: EntityStrength::Strong,
            entity_type: EntityType::Phone,
            normalized_value: val.to_string(),
            original_value: val.to_string(),
            confidence: 0.9,
        });
    }

    // Email addresses
    for mat in EMAIL_RE.find_iter(text) {
        let val = mat.as_str();
        entities.push(Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            strength: EntityStrength::Strong,
            entity_type: EntityType::Email,
            normalized_value: val.to_lowercase(),
            original_value: val.to_string(),
            confidence: 0.9,
        });
    }

    // ID card (18 digits, last may be X)
    for mat in ID_CARD_RE.find_iter(text) {
        let val = mat.as_str();
        entities.push(Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            strength: EntityStrength::Strong,
            entity_type: EntityType::IdCard,
            normalized_value: val.to_uppercase(),
            original_value: val.to_string(),
            confidence: 0.95,
        });
    }

    entities
}

/// Extract weak entities: company names, person names.
pub fn extract_weak_entities(
    text: &str,
    submission_id: &str,
    node_id: &str,
) -> Vec<Entity> {
    let mut entities = Vec::new();

    // Company names: X公司, X集团, X有限公司, X股份有限公司
    for mat in COMPANY_NAME_RE.find_iter(text) {
        let val = mat.as_str();
        entities.push(Entity {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            strength: EntityStrength::Weak,
            entity_type: EntityType::CompanyName,
            normalized_value: COMPANY_NORMALIZE_RE.replace_all(val, "").replace(' ', ""),
            original_value: val.to_string(),
            confidence: 0.7,
        });
    }

    // Person names: 2-4 Chinese characters followed by common suffixes or context
    for mat in PERSON_NAME_RE.find_iter(text) {
        let val = mat.as_str();
        // Extract just the name part (before the suffix)
        let name: String = val.chars().take_while(|c| *c != '：' && *c != ':').collect();
        if name.len() >= 2 && name.len() <= 4 {
            entities.push(Entity {
                id: uuid::Uuid::new_v4().to_string(),
                submission_id: submission_id.to_string(),
                node_id: node_id.to_string(),
                strength: EntityStrength::Weak,
                entity_type: EntityType::PersonName,
                normalized_value: name.clone(),
                original_value: val.to_string(),
                confidence: 0.6,
            });
        }
    }

    entities
}

// Regex helpers — compiled once via LazyLock
use std::sync::LazyLock;

static CREDIT_CODE_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}").unwrap()
});
static PHONE_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"1[3-9]\d{9}").unwrap()
});
static EMAIL_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}").unwrap()
});
static ID_CARD_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]").unwrap()
});
static COMPANY_NAME_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"[一-鿿（）()]{2,30}(?:有限公司|股份有限公司|集团|有限责任公司|股份公司)").unwrap()
});
static PERSON_NAME_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"[一-鿿]{2,4}[:：](?:项目经理|负责人|总监|经理|技术|总工|联系人)").unwrap()
});
static COMPANY_NORMALIZE_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"[（(][^）)]*[）)]").unwrap()
});
static AMOUNT_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"[\d,]+\.?\d*(?:万元|元)").unwrap()
});
static PERCENT_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"\d+\.?\d*%").unwrap()
});
static DATE_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"\d{4}年\d{1,2}月\d{1,2}日|\d{4}[-/]\d{1,2}[-/]\d{1,2}").unwrap()
});
static PERIOD_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"\d+(?:天|个月|年|日历天|工作日)").unwrap()
});
static DATE_NORMALIZE_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"(\d{4})年(\d{1,2})月(\d{1,2})日").unwrap()
});

// ============================================================================
// Key Fact Extraction (Task 2)
// ============================================================================

/// Extract key facts from text: amounts, percentages, dates, periods, identifiers.
pub fn extract_key_facts(
    text: &str,
    submission_id: &str,
    node_id: &str,
) -> Vec<KeyFact> {
    let mut facts = Vec::new();

    // Amounts: 万元, 元
    for mat in AMOUNT_RE.find_iter(text) {
        let val = mat.as_str();
        let (num, unit) = parse_amount(val);
        facts.push(KeyFact {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            fact_type: KeyFactType::Amount,
            normalized_value: num,
            original_value: val.to_string(),
            unit: Some(unit),
            confidence: 0.9,
        });
    }

    // Percentages
    for mat in PERCENT_RE.find_iter(text) {
        let val = mat.as_str();
        facts.push(KeyFact {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            fact_type: KeyFactType::Ratio,
            normalized_value: val.trim_end_matches('%').to_string(),
            original_value: val.to_string(),
            unit: Some("%".to_string()),
            confidence: 0.9,
        });
    }

    // Dates: YYYY年MM月DD日, YYYY-MM-DD, YYYY/MM/DD
    for mat in DATE_RE.find_iter(text) {
        let val = mat.as_str();
        facts.push(KeyFact {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            fact_type: KeyFactType::Date,
            normalized_value: normalize_date(val),
            original_value: val.to_string(),
            unit: None,
            confidence: 0.85,
        });
    }

    // Periods: X天, X个月, X年
    for mat in PERIOD_RE.find_iter(text) {
        let val = mat.as_str();
        facts.push(KeyFact {
            id: uuid::Uuid::new_v4().to_string(),
            submission_id: submission_id.to_string(),
            node_id: node_id.to_string(),
            fact_type: KeyFactType::Period,
            normalized_value: val.to_string(),
            original_value: val.to_string(),
            unit: None,
            confidence: 0.85,
        });
    }

    facts
}

fn parse_amount(text: &str) -> (String, String) {
    let unit = if text.ends_with("万元") {
        "万元".to_string()
    } else {
        "元".to_string()
    };
    let num_part = text.trim_end_matches("万元").trim_end_matches("元");
    let normalized = num_part.replace(',', "");
    (normalized, unit)
}

fn normalize_date(text: &str) -> String {
    // Normalize to YYYY-MM-DD
    if text.contains('年') {
        if let Some(caps) = DATE_NORMALIZE_RE.captures(text) {
            return format!(
                "{}-{:02}-{:02}",
                &caps[1],
                caps[2].parse::<u32>().unwrap_or(0),
                caps[3].parse::<u32>().unwrap_or(0)
            );
        }
    }
    text.replace('/', "-")
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use document_ast::{BlockNode, simple_paragraph};

    #[test]
    fn stable_node_id_deterministic() {
        let hash = b"test-file-hash";
        let path = [0, 2, 1];
        let id1 = generate_node_id(hash, &path);
        let id2 = generate_node_id(hash, &path);
        assert_eq!(id1, id2);
        assert_eq!(id1.len(), 32); // 16 bytes hex
    }

    #[test]
    fn stable_node_id_different_inputs() {
        let hash = b"test-file-hash";
        let id_a = generate_node_id(hash, &[0, 1]);
        let id_b = generate_node_id(hash, &[0, 2]);
        let id_c = generate_node_id(b"other-hash", &[0, 1]);
        assert_ne!(id_a, id_b);
        assert_ne!(id_a, id_c);
    }

    #[test]
    fn traverse_yields_all_blocks() {
        let blocks = vec![
            BlockNode::Paragraph(simple_paragraph("p-1", "第一章 总则")),
            BlockNode::Paragraph(simple_paragraph("p-2", "本项目采用公开招标")),
            BlockNode::Paragraph(simple_paragraph("p-3", "第二章 评标办法")),
            BlockNode::Paragraph(simple_paragraph("p-4", "综合评分法")),
        ];
        let items: Vec<_> = traverse(&blocks).collect();
        assert_eq!(items.len(), 4);
        assert_eq!(items[0].node_index, 0);
        assert_eq!(items[3].node_index, 3);
    }

    #[test]
    fn traverse_tracks_section_path() {
        let blocks = vec![
            BlockNode::Paragraph(simple_paragraph("p-1", "第一章 总则")),
            BlockNode::Paragraph(simple_paragraph("p-2", "正文内容")),
            BlockNode::Paragraph(simple_paragraph("p-3", "第二章 评标办法")),
            BlockNode::Paragraph(simple_paragraph("p-4", "评标内容")),
        ];
        let items: Vec<_> = traverse(&blocks).collect();
        assert_eq!(items[1].section_path, vec!["第一章 总则"]);
        assert_eq!(items[3].section_path, vec!["第二章 评标办法"]);
    }

    #[test]
    fn find_node_by_id() {
        let blocks = vec![
            BlockNode::Paragraph(simple_paragraph("p-1", "first")),
            BlockNode::Paragraph(simple_paragraph("p-2", "second")),
        ];
        assert!(find_node(&blocks, "p-1").is_some());
        assert!(find_node(&blocks, "p-2").is_some());
        assert!(find_node(&blocks, "p-3").is_none());
    }

    #[test]
    fn normalize_text_basic() {
        assert_eq!(normalize_text("  Hello   World  "), "hello world");
        assert_eq!(normalize_text("你好，世界！"), "你好世界");
        assert_eq!(
            normalize_text("投标文件（正本）"),
            "投标文件正本"
        );
    }

    #[test]
    fn normalize_text_mixed() {
        assert_eq!(
            normalize_text("ABC公司提交100万元保证金"),
            "abc公司提交100万元保证金"
        );
    }

    #[test]
    fn content_hash_deterministic() {
        let h1 = content_hash("test text");
        let h2 = content_hash("test text");
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // SHA-256 hex
    }

    #[test]
    fn extract_strong_credit_code() {
        let text = "统一社会信用代码：91110000MA01KPG5X1";
        let entities = extract_strong_entities(text, "sub-1", "node-1");
        assert!(!entities.is_empty());
        assert_eq!(entities[0].entity_type, EntityType::CreditCode);
        assert_eq!(entities[0].strength, EntityStrength::Strong);
    }

    #[test]
    fn extract_strong_phone() {
        let text = "联系电话：13812345678";
        let entities = extract_strong_entities(text, "sub-1", "node-1");
        assert!(entities.iter().any(|e| e.entity_type == EntityType::Phone));
    }

    #[test]
    fn extract_strong_email() {
        let text = "联系邮箱：test@example.com";
        let entities = extract_strong_entities(text, "sub-1", "node-1");
        assert!(entities.iter().any(|e| e.entity_type == EntityType::Email));
    }

    #[test]
    fn extract_weak_company_name() {
        let text = "投标人：北京建设有限公司提供了相关证明";
        let entities = extract_weak_entities(text, "sub-1", "node-1");
        assert!(entities.iter().any(|e| e.entity_type == EntityType::CompanyName));
    }

    #[test]
    fn extract_key_facts_amount() {
        let text = "投标总价为1500.50万元";
        let facts = extract_key_facts(text, "sub-1", "node-1");
        assert!(facts.iter().any(|f| f.fact_type == KeyFactType::Amount));
        let amount = facts.iter().find(|f| f.fact_type == KeyFactType::Amount).unwrap();
        assert_eq!(amount.normalized_value, "1500.50");
        assert_eq!(amount.unit.as_deref(), Some("万元"));
    }

    #[test]
    fn extract_key_facts_percentage() {
        let text = "质量合格率达到100%";
        let facts = extract_key_facts(text, "sub-1", "node-1");
        assert!(facts.iter().any(|f| f.fact_type == KeyFactType::Ratio));
    }

    #[test]
    fn extract_key_facts_date() {
        let text = "开标日期：2026年8月15日";
        let facts = extract_key_facts(text, "sub-1", "node-1");
        assert!(facts.iter().any(|f| f.fact_type == KeyFactType::Date));
        let date = facts.iter().find(|f| f.fact_type == KeyFactType::Date).unwrap();
        assert_eq!(date.normalized_value, "2026-08-15");
    }

    #[test]
    fn extract_key_facts_period() {
        let text = "工期为180天";
        let facts = extract_key_facts(text, "sub-1", "node-1");
        assert!(facts.iter().any(|f| f.fact_type == KeyFactType::Period));
    }

    #[test]
    fn serde_camel_case_roundtrip() {
        let finding = RiskFinding {
            id: "f-1".to_string(),
            detector_type: DetectorType::Text,
            risk_level: RiskLevel::High,
            involved_submission_ids: vec!["s-1".to_string()],
            evidence: vec![],
            symmetric_similarity: 0.85,
            directional_coverage: vec![],
            confidence_score: 0.9,
            score_breakdown: ScoreBreakdown {
                exact_match_score: 0.0,
                lexical_score: 0.8,
                structural_score: 0.7,
                entity_score: 0.0,
                fact_score: 0.0,
                tender_discount: 0.0,
                template_discount: 0.0,
                fact_conflict_penalty: 0.0,
                final_score: 0.75,
                rule_version: "0.3.0".to_string(),
            },
            rule_version: "0.3.0".to_string(),
            review_status: FindingReviewStatus::Pending,
            important: false,
            review_note: String::new(),
            reviewed_at: None,
        };
        let json = serde_json::to_string(&finding).unwrap();
        assert!(json.contains("\"detectorType\""));
        assert!(json.contains("\"riskLevel\""));
        assert!(json.contains("\"involvedSubmissionIds\""));
        assert!(json.contains("\"scoreBreakdown\""));
        assert!(json.contains("\"reviewStatus\""));
        assert!(json.contains("\"reviewedAt\""));

        let back: RiskFinding = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, "f-1");
    }

    #[test]
    fn heading_detection_chinese() {
        assert!(is_heading("第一章 总则", None));
        assert!(is_heading("第二节 评标", None));
        assert!(is_heading("第三条 说明", None));
        assert!(is_heading("1. 概述", None));
        assert!(is_heading("1.1 范围", None));
        assert!(!is_heading("这是普通的正文内容。", None));
    }
}
