/**
 * Types-only exports for renderer process.
 * Exports only TypeScript types and pure utility functions — no Node.js dependencies.
 * Safe to use in browser/renderer environment.
 */

export const BIDLENS_VERSION = '0.2.2';
export type { AnalysisProjectStatus, RiskLevel, DetectorType, FindingReviewStatus, RiskPreset, RiskAnalysisStatus, RiskFileFormat, RiskSubmission, SubmissionSummary, RiskEvidence, Evidence, RiskFinding, RiskAssessment, AnalysisProjectSummary, AnalysisProjectDetail } from './risk-review.js';

// Core document types
export type { DocumentAst, BlockNode, ParagraphNode, SectionNode, ListNode, TableNode, Comment, CommentRange, Revision } from './document-ast.js';

// Diff types
export type { DiffAst, DiffItem, DiffSummary, MatchType, TextDiffToken, TableNodeForDiff } from './diff-ast.js';
export { isTableDiffItem } from './diff-ast.js';

// Task, progress, review, capability, error types
export type {
  SensitivityLevel,
  TaskStatus,
  CapabilityState,
  ComparisonDimension,
  CapabilityResult,
  CompareOptions,
  CompareProgress,
  ComparePhase,
  ReviewStatus,
  ReviewAnnotation,
  CompareResult,
  ErrorCode,
  StructuredError,
  FileValidationResult,
  TaskSummary,
  Theme,
  AppSettings,
  StorageReport,
  ExportFormat,
  ExportScope,
  ExportRequest,
  ExportResult,
} from './compare-task.js';

// IPC contract types
export type {
  ValidateFilesRequest,
  ValidateFilesResponse,
  StartCompareRequest,
  StartCompareResponse,
  CancelCompareResponse,
  SaveAnnotationRequest,
  BatchReadAnnotationsResponse,
  HistoryListRequest,
  HistoryListResponse,
  OpenSnapshotRequest,
  OpenSnapshotResponse,
  RecompareRequest,
  ChooseExportScopeRequest,
  UpdateSettingsRequest,
  CleanupRequest,
  EngineHandshake,
  BidLensApi,
  RiskFileInput,
  CreateRiskProjectRequest,
  CreateRiskProjectResponse,
  RiskProgress,
} from './ipc.js';

// State machine utilities (pure functions, no Node deps)
export {
  isLegalTransition,
  assertTransition,
  isTerminalState,
  isRunningState,
  isValidReviewStatus,
  computeReviewProgress,
} from './state-machine.js';

// Error utilities (pure functions)
export { createError, isRetryableError, formatErrorCode } from './errors.js';

// Field mapping utilities (pure functions)
export { camelToSnake, snakeToCamel, toSnakeCase, toCamelCase } from './field-mapping.js';

// Table diff types and utilities
export type { TableDiffResult, TableMatchType, CellChangeType, StructuralChange, CellDiff, CellSpan } from './table-diff.js';
export { getCellChangeColor, getCellDiffTooltip } from './table-diff.js';

// Format diff types
export type { FormatDiffResult, TextFormatChange, ParagraphFormatChange } from './format-diff.js';

// Parser types (browser-safe)
export type { ParsedComment } from './parser/docx-comments.js';
export type { ParsedRevision, TextFormat } from './parser/docx-revisions.js';
