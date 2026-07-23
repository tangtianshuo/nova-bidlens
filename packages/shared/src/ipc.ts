import type {
  CompareOptions,
  CompareProgress,
  CompareResult,
  ReviewAnnotation,
  TaskSummary,
  FileValidationResult,
  AppSettings,
  StorageReport,
  ExportRequest,
  ExportResult,
  TaskStatus,
  SensitivityLevel,
} from './compare-task.js';
import type {
  AnalysisProjectDetail, AnalysisProjectSummary, RiskPreset,
  ProjectStatus, AnalysisPhase, RiskFinding,
  FindingReviewStatus, AuditEvent,
} from './risk-review.js';

// --- File operations (Spec §10) ---
export interface ValidateFilesRequest {
  fileAPath: string;
  fileBPath: string;
}

export interface ValidateFilesResponse {
  fileA: FileValidationResult;
  fileB: FileValidationResult;
  crossFormatDegradation: string[];
}

// --- Compare operations ---
export interface StartCompareRequest {
  fileAPath: string;
  fileBPath: string;
  options: CompareOptions;
}

export interface StartCompareResponse {
  taskId: string;
}

export interface CancelCompareResponse {
  taskId: string;
  cancelled: boolean;
}

export interface SelectFileResponse {
  path: string;
  name: string;
  size: number;
  format: string;
}

export interface RiskFileInput { path: string; name?: string; }
export interface CreateRiskProjectRequest {
  name: string; submissions: RiskFileInput[]; baseline?: RiskFileInput | null; preset: RiskPreset;
}
export interface CreateRiskProjectResponse { projectId: string; }
export interface RiskProgress {
  projectId: string; status: ProjectStatus; phase: AnalysisPhase | null;
  stageLabel: string; current?: number; total?: number; elapsedMs: number; warnings: string[];
}
export interface StructuredRiskError {
  code: string; message: string; details?: Record<string, unknown>; retryable: boolean;
}
export interface ExportRiskReportRequest {
  projectId: string; format: 'pdf' | 'html' | 'markdown'; scope: 'all' | 'confirmed' | 'important' | 'filtered';
}
export interface ExportRiskReportResponse { filePath: string; resultHash: string; }

// --- Review operations ---
export interface SaveAnnotationRequest {
  taskId: string;
  matchId: string;
  status?: string;
  important?: boolean;
  note?: string;
}

export interface BatchReadAnnotationsResponse {
  annotations: ReviewAnnotation[];
}

// --- History operations ---
export interface HistoryListRequest {
  search?: string;
  statusFilter?: TaskStatus | 'all';
}

export interface HistoryListResponse {
  tasks: TaskSummary[];
}

export interface OpenSnapshotRequest {
  taskId: string;
}

export interface OpenSnapshotResponse {
  result: CompareResult;
  annotations: ReviewAnnotation[];
}

export interface RecompareRequest {
  taskId: string;
  newFileAPath?: string;
  newFileBPath?: string;
  options?: CompareOptions;
}

// --- Export operations ---
export interface ChooseExportScopeRequest {
  taskId: string;
  scope: string;
}

// --- Settings operations ---
export interface UpdateSettingsRequest {
  theme?: string;
  historyCountLimit?: number;
  storageLimitBytes?: number;
}

export interface CleanupRequest {
  type: 'cleanable' | 'all';
  confirm: boolean;
}

// --- Engine handshake (D31) ---
export interface EngineHandshake {
  engineVersion: string;
  protocolVersion: string;
  capabilities: string[];
}

// --- Full IPC API surface (Spec §10) ---
export interface BidLensApi {
  // Similarity risk review
  listProjects(): Promise<AnalysisProjectSummary[]>;
  getProject(projectId: string): Promise<AnalysisProjectDetail>;
  createRiskProject(request: CreateRiskProjectRequest): Promise<CreateRiskProjectResponse>;
  cancelRiskProject(projectId: string): Promise<{ projectId: string; cancelled: boolean }>;
  resumeRiskProject(projectId: string): Promise<{ projectId: string }>;
  retryRiskSubmission(projectId: string, submissionId: string, newFile?: RiskFileInput): Promise<{ projectId: string }>;
  acceptPartial(projectId: string): Promise<{ projectId: string }>;
  deleteProject(projectId: string): Promise<{ deleted: boolean }>;
  onRiskProgress(handler: (progress: RiskProgress) => void): () => void;
  saveRiskFindingReview(request: { projectId: string; findingId: string; status?: FindingReviewStatus; important?: boolean; note?: string }): Promise<RiskFinding>;
  getAuditEvents(projectId: string): Promise<AuditEvent[]>;
  exportRiskReport(request: ExportRiskReportRequest): Promise<ExportRiskReportResponse>;
  // File
  selectFile(): Promise<SelectFileResponse | null>;
  validateFiles(request: ValidateFilesRequest): Promise<ValidateFilesResponse>;

  // Compare
  startCompare(request: StartCompareRequest): Promise<StartCompareResponse>;
  cancelCompare(taskId: string): Promise<CancelCompareResponse>;
  getCompareResult(taskId: string): Promise<CompareResult>;
  onCompareProgress(handler: (progress: CompareProgress) => void): () => void;

  // Review
  saveAnnotation(request: SaveAnnotationRequest): Promise<ReviewAnnotation>;
  batchReadAnnotations(taskId: string): Promise<BatchReadAnnotationsResponse>;

  // History
  listHistory(request?: HistoryListRequest): Promise<HistoryListResponse>;
  openSnapshot(request: OpenSnapshotRequest): Promise<OpenSnapshotResponse>;
  recompare(request: RecompareRequest): Promise<StartCompareResponse>;
  retainTask(taskId: string, retained: boolean): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  clearHistory(request: CleanupRequest): Promise<{ deletedCount: number }>;

  // Export
  exportReport(request: ExportRequest): Promise<ExportResult>;
  openExportedFile(filePath: string): Promise<void>;
  openExportFolder(folderPath: string): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings>;
  updateSettings(request: UpdateSettingsRequest): Promise<AppSettings>;
  getStorageReport(): Promise<StorageReport>;
  cleanup(request: CleanupRequest): Promise<{ deletedCount: number }>;

  // MinerU API config
  mineruGetToken(): Promise<{ token: string | null }>;
  mineruSaveToken(request: { token: string }): Promise<{ success: boolean }>;
  mineruDeleteToken(): Promise<{ success: boolean }>;
  mineruValidateToken(request?: { token?: string }): Promise<{ valid: boolean; error?: string }>;

  // Engine
  engineHandshake(): Promise<EngineHandshake>;

  // Log viewer
  getLogBuffer(): Promise<Array<{ ts: string; level: string; tag: string; text: string; source: string }>>;
  sendLog(entry: { level: string; tag: string; text: string }): void;
  onLogEntry(handler: (entry: { ts: string; level: string; tag: string; text: string; source: string }) => void): () => void;

  // Window controls
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;
  onMaximizeChanged(handler: (maximized: boolean) => void): () => void;
}
