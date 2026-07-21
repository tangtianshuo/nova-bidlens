/** Shared domain types for multi-submission similarity risk review. */
export type AnalysisProjectStatus = 'validating' | 'parsing' | 'filtering' | 'embedding' | 'retrieving' | 'detecting' | 'aggregating' | 'ready' | 'partial' | 'interrupted' | 'failed';
export type RiskLevel = 'high' | 'medium' | 'low';
export type DetectorType = 'text' | 'table' | 'entity';
export type FindingReviewStatus = 'pending' | 'confirmed' | 'ignored' | 'important';
export type RiskPreset = 'strict' | 'standard' | 'loose';
export type RiskAnalysisStatus = 'complete' | 'degraded' | 'partial';
export type RiskFileFormat = 'docx' | 'pdf';

export interface RiskSubmission {
  id: string; fileName: string; fileFormat: RiskFileFormat; fileSizeBytes: number;
  pageCount: number | null; sha256: string; status: AnalysisProjectStatus; warnings: string[];
}
export type SubmissionSummary = RiskSubmission;
export interface RiskEvidence {
  id: string; submissionId: string; blockIndex: number; originalText: string; normalizedText: string;
  matchBasis: 'lexical' | 'semantic' | 'structural' | 'entity'; similarityScore: number;
  contextBefore: string; contextAfter: string; tenderFiltered: boolean; tenderFilterReason: string | null;
}
export type Evidence = RiskEvidence;
export interface RiskFinding {
  id: string; detectorType: DetectorType; riskLevel: RiskLevel; involvedSubmissionIds: string[];
  evidence: RiskEvidence[]; symmetricSimilarity: number;
  directionalCoverage: { fromId: string; toId: string; coverage: number }[];
  confidenceScore: number; reviewStatus: FindingReviewStatus; reviewNote: string; ruleVersion: string;
}
export interface RiskAssessment {
  level: RiskLevel | 'incomplete'; rawRuleScore: number; topContributingFindingIds: string[];
  preset: RiskPreset; ruleVersion: string; analysisStatus: RiskAnalysisStatus;
}
export interface AnalysisProjectSummary {
  id: string; name: string; createdAt: string; status: AnalysisProjectStatus; submissionCount: number;
  riskLevel: RiskLevel | 'incomplete' | null; preset: RiskPreset; hasBaseline: boolean; elapsedMs: number;
}
export interface AnalysisProjectDetail {
  id: string; name: string; createdAt: string; status: AnalysisProjectStatus; preset: RiskPreset; elapsedMs: number;
  submissions: RiskSubmission[]; baseline: RiskSubmission | null; findings: RiskFinding[];
  assessment: RiskAssessment | null; modelVersion: string; ruleVersion: string; parserVersion: string;
  matcherVersion: string; warnings: string[]; degradationReason: string | null;
}
