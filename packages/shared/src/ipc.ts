import type { CompareOptions, CompareProgress, CompareResult, ReviewAnnotation } from './compare-task';

export interface StartCompareRequest {
  fileAPath: string;
  fileBPath: string;
  options: CompareOptions;
}

export interface BidLensApi {
  startCompare(request: StartCompareRequest): Promise<{ taskId: string }>;
  cancelCompare(taskId: string): Promise<{ taskId: string; cancelled: boolean }>;
  getCompareResult(taskId: string): Promise<CompareResult>;
  saveAnnotation(annotation: ReviewAnnotation): Promise<ReviewAnnotation>;
  exportReport(request: { taskId: string; format: 'markdown' | 'html' }): Promise<{ reportPath: string }>;
  onCompareProgress(handler: (progress: CompareProgress) => void): () => void;
}
