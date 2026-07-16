export type TableMatchType = 'identical' | 'structure_changed' | 'content_changed' | 'mixed_changes';

export type CellChangeType = 'identical' | 'modified' | 'added' | 'deleted';

export interface StructuralChange {
  type: 'rows_added' | 'rows_deleted' | 'columns_added' | 'columns_deleted';
  count: number;
  position: number;
}

export interface CellDiff {
  position: [number, number]; // [row, col]
  changeType: CellChangeType;
  oldContent: string | null;
  newContent: string | null;
  similarity: number;
}

export interface TableDiffResult {
  tableMatchType: TableMatchType;
  structuralChanges: StructuralChange[];
  cellDiffs: CellDiff[];
  confidence: number;
}

/**
 * Get cell diff for a specific position
 */
export function getCellDiff(tableDiff: TableDiffResult, row: number, col: number): CellDiff | undefined {
  return tableDiff.cellDiffs.find(d => d.position[0] === row && d.position[1] === col);
}

/**
 * Get background color for cell change type
 */
export function getCellChangeColor(changeType: CellChangeType): string | undefined {
  switch (changeType) {
    case 'identical':
      return undefined; // no background
    case 'modified':
      return '#fff3cd'; // light yellow
    case 'added':
      return '#d4edda'; // light green
    case 'deleted':
      return '#f8d7da'; // light red
    default:
      return undefined;
  }
}
