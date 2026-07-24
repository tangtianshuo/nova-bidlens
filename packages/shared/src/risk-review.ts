/** Shared domain types for multi-submission similarity risk review. */
/** Authority: PRD v0.3 §6-§15, field dictionary 2026-07-21. */

// ─── Enums and Literals (PRD §13.1, §13.2, §8.1-8.4, §9, §11, §15) ───

/** Project lifecycle status. Not to be confused with AnalysisPhase. (PRD §13.1) */
export type ProjectStatus = 'draft' | 'running' | 'ready' | 'partial' | 'interrupted' | 'failed' | 'cancelled';

/** Derived from checkpoint progress, not stored. (PRD §13.2) */
export type AnalysisPhase =
  | 'validating' | 'parsing' | 'extracting-nodes' | 'extracting-entities'
  | 'filtering-tender-content' | 'recalling-candidates'
  | 'detecting' | 'aggregating' | 'persisting' | 'completed';

/** Per-submission processing state. (PRD §13.4) */
export type SubmissionState = 'pending' | 'validated' | 'parsing' | 'parsed' | 'extracting' | 'extracted' | 'failed' | 'removed';

export type RiskLevel = 'high' | 'medium' | 'low';
export type DetectorType = 'text' | 'table' | 'entity' | 'key-fact';
export type RiskPreset = 'strict' | 'standard' | 'loose';
export type RiskAnalysisStatus = 'complete' | 'degraded' | 'partial';
export type RiskFileFormat = 'docx' | 'pdf' | 'nzbtf';

/** Review status — `important` is an independent boolean. (PRD §11) */
export type FindingReviewStatus = 'pending' | 'confirmed' | 'ignored';

export type ReviewNodeType = 'heading' | 'paragraph' | 'list-item' | 'table-row' | 'table-cell';

export type BusinessLabel =
  | 'bidder-identity' | 'authorization' | 'qualification' | 'personnel'
  | 'performance' | 'technical-solution' | 'schedule' | 'quality'
  | 'equipment' | 'commercial' | 'commitment' | 'generic';

export type EntityStrength = 'strong' | 'weak';
export type StrongEntityType = 'id-card' | 'phone' | 'email' | 'credit-code';
export type WeakEntityType = 'person-name' | 'company-name';
export type KeyFactType = 'amount' | 'ratio' | 'date' | 'period' | 'identifier' | 'qualification' | 'negation' | 'commitment';
export type MatchBasis = 'lexical' | 'semantic' | 'structural' | 'entity' | 'fact';

export type AuditEventType =
  | 'project-created' | 'file-added' | 'file-removed' | 'file-replaced'
  | 'no-baseline-confirmed' | 'analysis-started' | 'analysis-completed' | 'analysis-cancelled' | 'analysis-failed' | 'analysis-recovered' | 'analysis-reanalyzed'
  | 'partial-accepted' | 'review-changed' | 'note-changed'
  | 'report-exported' | 'project-deleted' | 'cache-cleaned';

export type ReportFormat = 'pdf' | 'html' | 'markdown';
export type ReportScope = 'all' | 'confirmed' | 'important' | 'filtered';

// ─── ReviewNode and related (PRD §7) ───

export interface TableLocation {
  tableIndex: number;
  rowIndex: number;
  cellIndex: number | null;
  headerContext: string[];
}

export interface Entity {
  id: string;
  submissionId: string;
  nodeId: string;
  strength: EntityStrength;
  entityType: StrongEntityType | WeakEntityType;
  normalizedValue: string;
  originalValue: string;
  confidence: number;
}

export interface KeyFact {
  id: string;
  submissionId: string;
  nodeId: string;
  factType: KeyFactType;
  normalizedValue: string;
  originalValue: string;
  unit: string | null;
  confidence: number;
}

export interface ReviewNode {
  id: string;
  sourceAstNodeId: string;
  submissionId: string;
  nodeType: ReviewNodeType;
  sectionPath: string[];
  orderIndex: number;
  pageRange: [number, number] | null;
  originalText: string;
  normalizedText: string;
  contentHash: string;
  labels: BusinessLabel[];
  entities: Entity[];
  keyFacts: KeyFact[];
  isKeyNode: boolean;
  tableLocation: TableLocation | null;
}

// ─── Submission and Baseline (PRD §6, §8.5) ───

export interface RiskSubmission {
  id: string;
  fileName: string;
  fileFormat: RiskFileFormat;
  fileSizeBytes: number;
  pageCount: number | null;
  sha256: string;
  status: SubmissionState;
  warnings: string[];
}

export type SubmissionSummary = RiskSubmission;

export interface TenderBaseline {
  id: string;
  projectId: string;
  submissionId: string;
  status: 'parsed' | 'failed' | 'absent';
  parseWarnings: string[];
}

// ─── Scoring and Candidates (PRD §9) ───

export interface ScoreBreakdown {
  exactMatchScore: number;
  lexicalScore: number;
  structuralScore: number;
  entityScore: number;
  factScore: number;
  tenderDiscount: number;
  templateDiscount: number;
  factConflictPenalty: number;
  finalScore: number;
  ruleVersion: string;
}

export interface DetectorCandidate {
  id: string;
  detectorType: DetectorType;
  sourceSubmissionId: string;
  sourceNodeId: string;
  targetSubmissionId: string;
  targetNodeId: string;
  scoreBreakdown: ScoreBreakdown;
}

// ─── Evidence (PRD §4.1, §10.1) ───

export interface BboxRegion {
  page: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Evidence {
  id: string;
  detectorType: DetectorType;
  matchBasis: MatchBasis;
  similarityScore: number;
  sourceSubmissionId: string;
  sourceNodeId: string;
  sourceOriginalText: string;
  sourceNormalizedText: string;
  sourceSectionPath: string[];
  sourcePageRange: [number, number] | null;
  sourceTableLocation: TableLocation | null;
  targetSubmissionId: string;
  targetNodeId: string;
  targetOriginalText: string;
  targetNormalizedText: string;
  targetSectionPath: string[];
  targetPageRange: [number, number] | null;
  targetTableLocation: TableLocation | null;
  sourceBbox?: BboxRegion;
  targetBbox?: BboxRegion;
  contextBefore: string;
  contextAfter: string;
  tenderFiltered: boolean;
  tenderFilterReason: string | null;
  ruleVersion: string;
}

// ─── RiskFinding (PRD §10.1) ───

export interface RiskFinding {
  id: string;
  detectorType: DetectorType;
  riskLevel: RiskLevel;
  involvedSubmissionIds: string[];
  evidence: Evidence[];
  symmetricSimilarity: number;
  directionalCoverage: { fromId: string; toId: string; coverage: number }[];
  confidenceScore: number;
  scoreBreakdown: ScoreBreakdown;
  ruleVersion: string;
  reviewStatus: FindingReviewStatus;
  important: boolean;
  reviewNote: string;
  reviewedAt: string | null;
}

// ─── Review Decision (PRD §11) ───

export interface ReviewDecision {
  id: string;
  projectId: string;
  findingId: string;
  status: FindingReviewStatus;
  important: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Risk Assessments (PRD §10.2, §10.3) ───

export interface FilePairAssessment {
  id: string;
  projectId: string;
  submissionAId: string;
  submissionBId: string;
  directionalCoverageAB: number;
  directionalCoverageBA: number;
  symmetricSimilarity: number;
  riskLevel: RiskLevel;
  topFindingIds: string[];
  findingCount: { high: number; medium: number; low: number };
  ruleVersion: string;
  analysisStatus: RiskAnalysisStatus;
}

export interface ProjectRiskAssessment {
  id: string;
  projectId: string;
  level: RiskLevel | 'incomplete';
  rawRuleScore: number;
  topContributingFindingIds: string[];
  preset: RiskPreset;
  ruleVersion: string;
  analysisStatus: RiskAnalysisStatus;
  highValueFindingCount: number;
  involvedSubmissionCount: number;
  strongEntityHitCount: number;
  tenderDiscountApplied: boolean;
  incompleteReason: string | null;
}

// ─── Checkpoint and Detector Run (PRD §13.3) ───

export interface AnalysisCheckpoint {
  id: string;
  projectId: string;
  phase: AnalysisPhase;
  inputHash: string;
  processingVersion: string;
  completedDetectors: DetectorType[];
  intermediateResultRef: string | null;
  warnings: string[];
  errors: string[];
  createdAt: string;
}

export interface DetectorRun {
  id: string;
  projectId: string;
  detectorType: DetectorType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  candidateCount: number;
  hitCount: number;
  elapsedMs: number;
  errorMessage: string | null;
  ruleVersion: string;
}

// ─── Audit and Report (PRD §15) ───

export interface AuditEvent {
  id: string;
  projectId: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ExportedReport {
  id: string;
  projectId: string;
  format: ReportFormat;
  scope: ReportScope;
  resultHash: string;
  filePath: string;
  createdAt: string;
}

// ─── Project Summary and Detail ───

export interface AnalysisProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  status: ProjectStatus;
  submissionCount: number;
  riskLevel: RiskLevel | 'incomplete' | null;
  preset: RiskPreset;
  hasBaseline: boolean;
  elapsedMs: number;
}

export interface AnalysisProjectDetail {
  id: string;
  name: string;
  createdAt: string;
  status: ProjectStatus;
  phase: AnalysisPhase | null;
  preset: RiskPreset;
  elapsedMs: number;
  submissions: RiskSubmission[];
  baseline: TenderBaseline | null;
  findings: RiskFinding[];
  filePairAssessments: FilePairAssessment[];
  assessment: ProjectRiskAssessment | null;
  detectorRuns: DetectorRun[];
  checkpoints: AnalysisCheckpoint[];
  modelVersion: string;
  ruleVersion: string;
  parserVersion: string;
  matcherVersion: string;
  warnings: string[];
  degradationReason: string | null;
}

// ─── Backward compatibility ───
/** @deprecated Use ProjectStatus instead. Will be removed after renderer migration. */
export type AnalysisProjectStatus = ProjectStatus;
/** @deprecated Use Evidence instead. Will be removed after renderer migration. */
export type RiskEvidence = Evidence;
/** @deprecated Use ProjectRiskAssessment instead. Will be removed after renderer migration. */
export type RiskAssessment = ProjectRiskAssessment;
