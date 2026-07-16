export type MatchType = 'identical' | 'modified' | 'added' | 'deleted' | 'moved' | 'split' | 'merged' | 'uncertain';

export interface TextDiffToken {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

export interface DiffItem {
  matchId: string;
  matchType: MatchType;
  confidence: number;
  similarity: number;
  sourceA: string | null;
  sourceB: string | null;
  nodeIdsA: string[];
  nodeIdsB: string[];
  diffDetail: TextDiffToken[];
  summary: string;
  reviewAnnotationId?: string;
}

export type DiffSummary = Record<MatchType, number>;

export interface DiffAst {
  taskId: string;
  docAId: string;
  docBId: string;
  generatedAt: string;
  items: DiffItem[];
  summary: DiffSummary;
}

export function createDiffSummary(items: DiffItem[]): DiffSummary {
  const summary: DiffSummary = {
    identical: 0,
    modified: 0,
    added: 0,
    deleted: 0,
    moved: 0,
    split: 0,
    merged: 0,
    uncertain: 0
  };
  for (const item of items) summary[item.matchType] += 1;
  return summary;
}

export function isTraceableDiffItem(item: DiffItem): boolean {
  if (item.matchType === 'added') return item.nodeIdsB.length > 0;
  if (item.matchType === 'deleted') return item.nodeIdsA.length > 0;
  return item.nodeIdsA.length > 0 && item.nodeIdsB.length > 0;
}
