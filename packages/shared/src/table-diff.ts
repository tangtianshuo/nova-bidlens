export type TableMatchType = 'identical' | 'structure_changed' | 'content_changed' | 'mixed_changes';

export type CellChangeType = 'identical' | 'modified' | 'added' | 'deleted' | 'span_changed';

export interface StructuralChange {
  type: 'rows_added' | 'rows_deleted' | 'columns_added' | 'columns_deleted';
  count: number;
  position: number;
}

export interface CellSpan {
  rowSpan: number;
  colSpan: number;
}

export interface CellDiff {
  position: [number, number]; // [row, col]
  changeType: CellChangeType;
  oldContent: string | null;
  newContent: string | null;
  similarity: number;
  oldSpan?: CellSpan;  // 旧合并信息
  newSpan?: CellSpan;  // 新合并信息
  spanChanged?: boolean;  // 标记合并信息是否变化
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
    case 'span_changed':
      return '#cce5ff'; // light blue for span changes
    default:
      return undefined;
  }
}

/**
 * Get tooltip text for cell diff
 */
export function getCellDiffTooltip(diff: CellDiff): string {
  switch (diff.changeType) {
    case 'modified':
      return `修改: "${diff.oldContent}" → "${diff.newContent}" (相似度: ${(diff.similarity * 100).toFixed(0)}%)`;
    case 'added':
      return `新增: "${diff.newContent}"`;
    case 'deleted':
      return `删除: "${diff.oldContent}"`;
    case 'span_changed':
      return `合并区域变化: ${formatSpanChange(diff.oldSpan, diff.newSpan)}`;
    default:
      return '';
  }
}

/**
 * Format span change description
 */
function formatSpanChange(oldSpan?: CellSpan, newSpan?: CellSpan): string {
  if (!oldSpan && newSpan) {
    return `新增合并 (${newSpan.rowSpan}行×${newSpan.colSpan}列)`;
  }
  if (oldSpan && !newSpan) {
    return `取消合并`;
  }
  if (oldSpan && newSpan) {
    return `${oldSpan.rowSpan}行×${oldSpan.colSpan}列 → ${newSpan.rowSpan}行×${newSpan.colSpan}列`;
  }
  return '';
}
