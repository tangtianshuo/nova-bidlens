import type { DiffAst } from './diff-ast.js';
import type { DocumentAst } from './document-ast.js';

export type CompareMode = 'fast' | 'standard' | 'precise';
export type ComparePhase = 'queued' | 'parsing_a' | 'parsing_b' | 'chunking' | 'embedding' | 'matching' | 'diffing' | 'complete' | 'failed' | 'cancelled';
export type ReviewStatus = 'important' | 'ignored' | 'needs_review';

export interface CompareOptions {
  mode: CompareMode;
  embeddingProvider: 'local' | 'external';
  embeddingModel: string;
  topK: number;
  similarityThreshold: number;
}

export interface CompareProgress {
  taskId: string;
  phase: ComparePhase;
  current: number;
  total: number;
  percent: number;
  message: string;
}

export interface ReviewAnnotation {
  id: string;
  taskId: string;
  matchId: string;
  status: ReviewStatus;
  note: string;
  updatedAt: string;
}

export interface CompareResult {
  taskId: string;
  docA: DocumentAst;
  docB: DocumentAst;
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
}
