import type { CompareOptions, ReviewAnnotation } from './compare-task';
import type { DiffAst } from './diff-ast';
import type { DocumentAst } from './document-ast';

export interface ExportModel {
  taskId: string;
  generatedAt: string;
  docA: Pick<DocumentAst, 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  docB: Pick<DocumentAst, 'filename' | 'sha256' | 'pageCount' | 'wordCount'>;
  options: CompareOptions;
  diffAst: DiffAst;
  annotations: ReviewAnnotation[];
}
