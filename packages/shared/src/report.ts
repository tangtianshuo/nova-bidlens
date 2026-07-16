import type { CompareOptions, ReviewAnnotation } from './compare-task.js';
import type { DiffAst } from './diff-ast.js';
import type { DocumentAst } from './document-ast.js';

export interface ExportModel {
  taskId: string;
  generatedAt: string;
  docA: Pick<DocumentAst, 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  docB: Pick<DocumentAst, 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  options: CompareOptions;
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
}
