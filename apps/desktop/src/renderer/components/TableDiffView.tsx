import type { TableDiffResult, StructuralChange } from '@bidlens/shared';
import type { TableNode } from '@bidlens/shared';
import { TableCellView } from './TableCellView';

export interface TableDiffViewProps {
  tableA: TableNode;
  tableB: TableNode;
  diffResult: TableDiffResult;
  onCellClick?: (position: [number, number]) => void;
}

export function TableDiffView({ tableA, tableB, diffResult, onCellClick }: TableDiffViewProps) {
  // Get max rows and columns considering structural changes
  const maxRows = Math.max(tableA.rows.length, tableB.rows.length);
  const maxColsA = getMaxColumns(tableA);
  const maxColsB = getMaxColumns(tableB);

  // Process structural changes to find added/deleted rows/cols
  const addedRows = new Set<number>();
  const deletedRows = new Set<number>();
  const addedCols = new Set<number>();
  const deletedCols = new Set<number>();

  for (const change of diffResult.structuralChanges) {
    processStructuralChange(change, addedRows, deletedRows, addedCols, deletedCols);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Table A (old) */}
      <div>
        <h3 style={{ fontSize: '16px', marginBottom: '8px', color: '#666' }}>
          原始文档表格
          {deletedRows.size > 0 && <span style={{ color: '#dc3545', marginLeft: '8px' }}>(有删除行)</span>}
          {deletedCols.size > 0 && <span style={{ color: '#dc3545', marginLeft: '8px' }}>(有删除列)</span>}
        </h3>
        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
            <TableBody
              rows={tableA.rows}
              maxRows={maxRows}
              maxCols={maxColsA}
              diffResult={diffResult}
              addedRows={deletedRows}  // Invert: what's deleted in A was "added" to show
              deletedRows={addedRows}
              addedCols={deletedCols}
              deletedCols={addedCols}
              isTableA={true}
              onCellClick={onCellClick}
            />
          </table>
        </div>
      </div>

      {/* Table B (new) */}
      <div>
        <h3 style={{ fontSize: '16px', marginBottom: '8px', color: '#666' }}>
          新文档表格
          {addedRows.size > 0 && <span style={{ color: '#28a745', marginLeft: '8px' }}>(有新增行)</span>}
          {addedCols.size > 0 && <span style={{ color: '#28a745', marginLeft: '8px' }}>(有新增列)</span>}
        </h3>
        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
            <TableBody
              rows={tableB.rows}
              maxRows={maxRows}
              maxCols={maxColsB}
              diffResult={diffResult}
              addedRows={addedRows}
              deletedRows={deletedRows}
              addedCols={addedCols}
              deletedCols={deletedCols}
              isTableA={false}
              onCellClick={onCellClick}
            />
          </table>
        </div>
      </div>

      {/* Structural changes summary */}
      {diffResult.structuralChanges.length > 0 && (
        <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '14px' }}>
          <strong>结构变化：</strong>
          {diffResult.structuralChanges.map((change, idx) => (
            <span key={idx} style={{ marginLeft: '8px' }}>
              {formatStructuralChange(change)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface TableBodyProps {
  rows: string[][];
  maxRows: number;
  maxCols: number;
  diffResult: TableDiffResult;
  addedRows: Set<number>;
  deletedRows: Set<number>;
  addedCols: Set<number>;
  deletedCols: Set<number>;
  isTableA: boolean;
  onCellClick?: (position: [number, number]) => void;
}

function TableBody({
  rows,
  maxRows,
  maxCols,
  diffResult,
  addedRows,
  deletedRows,
  addedCols,
  deletedCols,
  isTableA,
  onCellClick,
}: TableBodyProps) {
  return (
    <tbody>
      {Array.from({ length: maxRows }, (_, rowIdx) => {
        const isRowAdded = addedRows.has(rowIdx);
        const isRowDeleted = deletedRows.has(rowIdx);
        const row = rows[rowIdx];
        const rowCells = row ?? [];

        return (
          <tr
            key={rowIdx}
            style={{
              backgroundColor: isRowAdded ? '#d4edda22' : isRowDeleted ? '#f8d7da22' : undefined,
            }}
          >
            {/* Row index */}
            <td
              style={{
                padding: '4px 8px',
                backgroundColor: '#f8f9fa',
                borderRight: '1px solid #dee2e6',
                fontSize: '12px',
                color: '#666',
                textAlign: 'center',
                minWidth: '40px',
              }}
            >
              {rowIdx + 1}
            </td>

            {/* Row cells */}
            {Array.from({ length: maxCols }, (_, colIdx) => {
              const isColAdded = addedCols.has(colIdx);
              const isColDeleted = deletedCols.has(colIdx);
              const content = rowCells[colIdx] ?? '';
              
              // Get diff for this cell
              const cellDiff = diffResult.cellDiffs.find(
                d => d.position[0] === rowIdx && d.position[1] === colIdx
              );

              // Show placeholder for added/deleted rows/cols
              const isPlaceholder = (isRowAdded && isTableA) || (isRowDeleted && !isTableA) ||
                                   (isColAdded && isTableA) || (isColDeleted && !isTableA);

              return (
                <TableCellView
                  key={colIdx}
                  content={isPlaceholder ? '-' : content}
                  diff={isPlaceholder ? undefined : cellDiff}
                  isHeader={rowIdx === 0}
                  onCellClick={onCellClick}
                />
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}

function getMaxColumns(table: TableNode): number {
  return table.rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function processStructuralChange(
  change: StructuralChange,
  addedRows: Set<number>,
  deletedRows: Set<number>,
  addedCols: Set<number>,
  deletedCols: Set<number>
) {
  switch (change.type) {
    case 'rows_added':
      for (let i = 0; i < change.count; i++) {
        addedRows.add(change.position + i);
      }
      break;
    case 'rows_deleted':
      for (let i = 0; i < change.count; i++) {
        deletedRows.add(change.position + i);
      }
      break;
    case 'columns_added':
      for (let i = 0; i < change.count; i++) {
        addedCols.add(change.position + i);
      }
      break;
    case 'columns_deleted':
      for (let i = 0; i < change.count; i++) {
        deletedCols.add(change.position + i);
      }
      break;
  }
}

function formatStructuralChange(change: StructuralChange): string {
  switch (change.type) {
    case 'rows_added':
      return '新增 ' + change.count + ' 行 (位置: ' + (change.position + 1) + ')';
    case 'rows_deleted':
      return '删除 ' + change.count + ' 行 (位置: ' + (change.position + 1) + ')';
    case 'columns_added':
      return '新增 ' + change.count + ' 列 (位置: ' + (change.position + 1) + ')';
    case 'columns_deleted':
      return '删除 ' + change.count + ' 列 (位置: ' + (change.position + 1) + ')';
    default:
      return '';
  }
}
