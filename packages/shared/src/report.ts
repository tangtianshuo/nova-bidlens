/**
 * P5-05: Export model and factory for report generation.
 * Report generation functions live in report-export.ts.
 */

import type { CompareOptions, ReviewAnnotation, CapabilityResult } from './compare-task.js';
import type { DiffAst } from './diff-ast.js';
import type { DocumentAst } from './document-ast.js';

export interface ExportModel {
  taskId: string;
  generatedAt: string;
  docA: Pick<DocumentAst, 'id' | 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  docB: Pick<DocumentAst, 'id' | 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  options: CompareOptions;
  capabilities: CapabilityResult[];
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
  warnings: string[];
}

export function createExportModel(params: {
  taskId: string;
  docA: ExportModel['docA'];
  docB: ExportModel['docB'];
  options: CompareOptions;
  capabilities: CapabilityResult[];
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
  warnings?: string[];
}): ExportModel {
  return {
    taskId: params.taskId,
    generatedAt: new Date().toISOString(),
    docA: params.docA,
    docB: params.docB,
    options: params.options,
    capabilities: params.capabilities,
    diffAst: params.diffAst,
    annotations: params.annotations,
    warnings: params.warnings ?? [],
  };
}
