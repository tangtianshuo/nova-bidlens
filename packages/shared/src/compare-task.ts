import type { DiffAst } from './diff-ast.js';
import type { DocumentAst } from './document-ast.js';

// --- Sensitivity (D05) ---
export type SensitivityLevel = 'strict' | 'standard' | 'loose';

// --- Task lifecycle state machine (Spec §9) ---
export type TaskStatus =
  | 'draft'
  | 'validating'
  | 'parsing_baseline'
  | 'parsing_review'
  | 'comparing'
  | 'finalizing'
  | 'ready'
  | 'cancelling'
  | 'cancelled'
  | 'failed'
  | 'interrupted';

// --- Capability states (D08, INP-008) ---
export type CapabilityState = 'supported' | 'unsupported' | 'degraded' | 'no_change' | 'changed';

export type ComparisonDimension = 'content' | 'table' | 'format' | 'comment' | 'revision';

export interface CapabilityResult {
  dimension: ComparisonDimension;
  state: CapabilityState;
  reason?: string;
}

// --- Compare options (D05) ---
export interface CompareOptions {
  sensitivity: SensitivityLevel;
}

// --- Progress (D06, D20) ---
export interface CompareProgress {
  taskId: string;
  phase: ComparePhase;
  stageLabel: string;
  current?: number;
  total?: number;
  elapsedMs: number;
  warnings: string[];
}

export type ComparePhase =
  | 'validating'
  | 'parsing_baseline'
  | 'parsing_review'
  | 'comparing'
  | 'finalizing';

// --- Review (D10) ---
export type ReviewStatus = 'unreviewed' | 'confirmed' | 'needs-confirmation' | 'ignored';

export interface ReviewAnnotation {
  id: string;
  taskId: string;
  matchId: string;
  status: ReviewStatus;
  important: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

// --- Compare result (Spec §5.3) ---
export interface CompareResult {
  taskId: string;
  docA: DocumentAst;
  docB: DocumentAst;
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
  capabilities: CapabilityResult[];
  options: CompareOptions;
  warnings: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

// --- Structured error (Spec §10) ---
export type ErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_UNREADABLE'
  | 'FILE_TOO_LARGE'
  | 'FILE_ENCRYPTED'
  | 'UNSUPPORTED_FORMAT'
  | 'SCANNED_PDF'
  | 'ENGINE_BUSY'
  | 'ENGINE_EXITED'
  | 'ENGINE_UNAVAILABLE'
  | 'PROTOCOL_MISMATCH'
  | 'TASK_CANCELLED'
  | 'TASK_FAILED'
  | 'PARSE_ERROR'
  | 'COMPARE_ERROR'
  | 'PERSISTENCE_ERROR'
  | 'EXPORT_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface StructuredError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  phase?: ComparePhase;
  diagnosticId?: string;
}

// --- File validation (D02, INP-003) ---
export interface FileValidationResult {
  exists: boolean;
  readable: boolean;
  extension: string;
  supported: boolean;
  sizeBytes: number;
  exceedsLimit: boolean;
  encrypted: boolean;
  capabilities: CapabilityResult[];
  parserId?: string;
  warnings: string[];
  error?: StructuredError;
}

// --- Task summary for history list (D11, D26) ---
export interface TaskSummary {
  taskId: string;
  displayName: string;
  status: TaskStatus;
  docAFilename: string;
  docBFilename: string;
  diffSummary: Record<string, number>;
  reviewProgress: { total: number; reviewed: number; important: number };
  lastAccessedAt: string;
  retained: boolean;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

// --- Settings (D27) ---
export type Theme = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: Theme;
  historyCountLimit: number;
  storageLimitBytes: number;
}

export interface StorageReport {
  databaseSizeBytes: number;
  cacheSizeBytes: number;
  totalTaskCount: number;
  retainedCount: number;
  cleanableCount: number;
}

// --- Export (D15) ---
export type ExportFormat = 'html' | 'markdown';
export type ExportScope = 'all' | 'current_filter' | 'important' | 'needs-confirmation';

export interface ExportRequest {
  taskId: string;
  format: ExportFormat;
  scope: ExportScope;
  includeIdentical: boolean;
}

export interface ExportResult {
  filePath: string;
  format: ExportFormat;
  itemCount: number;
}
