import type { CellChangeType, CellDiff, TableDiffResult } from '@bidlens/shared/types-only';
import { getCellChangeColor, getCellDiffTooltip } from '@bidlens/shared/types-only';
import { useState } from 'react';

export interface ParsedNestedTable {
  id: string;
  rows: Array<{
    id: string;
    cells: Array<{
      id: string;
      content: string;
      isPlaceholder?: boolean;
    }>;
    rowType: 'header' | 'body' | 'footer';
  }>;
  depthLimitExceeded?: boolean;
}

export interface TableCellViewProps {
  content: string;
  diff?: CellDiff;
  isHeader?: boolean;
  rowSpan?: number;
  colSpan?: number;
  isPlaceholder?: boolean;
  nestedTable?: ParsedNestedTable;
  nestedTableDiff?: TableDiffResult;
  onCellClick?: (position: [number, number]) => void;
}

export function TableCellView({ 
  content, 
  diff, 
  isHeader, 
  rowSpan = 1, 
  colSpan = 1,
  isPlaceholder = false,
  nestedTable,
  nestedTableDiff,
  onCellClick 
}: TableCellViewProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (isPlaceholder) {
    return null;
  }

  const effectiveNestedDiff = nestedTableDiff ?? diff?.nestedTableDiff;
  const backgroundColor = diff ? getCellChangeColor(diff.changeType) : undefined;
  const changeType = diff?.changeType ?? 'identical';
  const isSpanChanged = diff?.spanChanged ?? false;
  const tooltipContent = diff && changeType !== 'identical' ? getCellDiffTooltip(diff) : undefined;

  const handleClick = () => {
    if (onCellClick && diff && changeType !== 'identical') {
      onCellClick(diff.position);
    }
  };

  const isMerged = rowSpan > 1 || colSpan > 1;
  const mergedStyle = isMerged ? {
    border: '2px solid #6c757d',
    fontWeight: 'bold' as const,
  } : {};

  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      style={{
        backgroundColor,
        padding: '8px 12px',
        border: '1px solid #dee2e6',
        position: 'relative',
        cursor: onCellClick && changeType !== 'identical' ? 'pointer' : 'default',
        transition: 'background-color 0.2s',
        ...mergedStyle,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={handleClick}
    >
      {content && (
        isHeader ? <strong>{content}</strong> : <span>{content}</span>
      )}
      
      {nestedTable && (
        <NestedTableView table={nestedTable} diff={effectiveNestedDiff} />
      )}
      
      {!content && !nestedTable && <span>-</span>}
      
      {isMerged && (
        <span style={{
          position: 'absolute',
          top: '2px',
          right: '2px',
          fontSize: '10px',
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          padding: '1px 4px',
          borderRadius: '2px',
        }}>
          {rowSpan > 1 ? `${rowSpan}行` : ''}{colSpan > 1 ? `${colSpan}列` : ''}
        </span>
      )}
      
      {isSpanChanged && (
        <span style={{
          position: 'absolute',
          top: '2px',
          left: '2px',
          fontSize: '10px',
          color: '#0056b3',
          backgroundColor: '#cce5ff',
          padding: '1px 4px',
          borderRadius: '2px',
        }}>
          合并变化
        </span>
      )}
      
      {effectiveNestedDiff && effectiveNestedDiff.tableMatchType !== 'identical' && (
        <span style={{
          position: 'absolute',
          bottom: '2px',
          left: '2px',
          fontSize: '10px',
          color: '#856404',
          backgroundColor: '#fff3cd',
          padding: '1px 4px',
          borderRadius: '2px',
        }}>
          嵌套表格有变化
        </span>
      )}
      
      {showTooltip && tooltipContent && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#333',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {tooltipContent}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            marginLeft: '-5px',
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: '#333 transparent transparent transparent',
          }} />
        </div>
      )}
    </td>
  );
}

function NestedTableView({ table, diff }: { table: ParsedNestedTable; diff?: TableDiffResult }) {
  const cellDiffMap = new Map<string, CellDiff>();
  if (diff) {
    for (const d of diff.cellDiffs) {
      cellDiffMap.set(`${d.position[0]},${d.position[1]}`, d);
    }
  }

  return (
    <div style={{
      marginTop: '4px',
      border: '2px dashed #6c757d',
      borderRadius: '4px',
      padding: '4px',
      backgroundColor: '#f8f9fa',
      fontSize: '12px',
    }}>
      {table.depthLimitExceeded && (
        <div style={{
          padding: '4px 8px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          fontSize: '11px',
          borderRadius: '2px',
          marginBottom: '4px',
          textAlign: 'center',
        }}>
          ⚠️ 嵌套深度超限，已截断
        </div>
      )}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '11px',
      }}>
        <tbody>
          {table.rows.map((row, rowIdx) => {
            const isHeader = row.rowType === 'header';
            return (
              <tr key={row.id || rowIdx}>
                {row.cells.map((cell, colIdx) => {
                  if (cell.isPlaceholder) return null;
                  const cellDiff = cellDiffMap.get(`${rowIdx},${colIdx}`);
                  const cellBg = cellDiff ? getCellChangeColor(cellDiff.changeType) : undefined;
                  return (
                    <td key={cell.id || colIdx} style={{
                      padding: '2px 4px',
                      border: '1px solid #ced4da',
                      backgroundColor: cellBg,
                    }}>
                      {isHeader ? <strong>{cell.content || '-'}</strong> : (cell.content || '-')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getTooltipText(diff: CellDiff): string {
  return getCellDiffTooltip(diff);
}

