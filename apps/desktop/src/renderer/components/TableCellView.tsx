import type { CellChangeType, CellDiff } from '@bidlens/shared';
import { getCellChangeColor } from '@bidlens/shared';
import { useState } from 'react';

export interface TableCellViewProps {
  content: string;
  diff?: CellDiff;
  isHeader?: boolean;
  onCellClick?: (position: [number, number]) => void;
}

export function TableCellView({ content, diff, isHeader, onCellClick }: TableCellViewProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const backgroundColor = diff ? getCellChangeColor(diff.changeType) : undefined;
  const changeType = diff?.changeType ?? 'identical';

  const tooltipContent = diff && changeType !== 'identical' ? getTooltipText(diff) : undefined;

  const handleClick = () => {
    if (onCellClick && diff && changeType !== 'identical') {
      onCellClick(diff.position);
    }
  };

  return (
    <td
      style={{
        backgroundColor,
        padding: '8px 12px',
        border: '1px solid #dee2e6',
        position: 'relative',
        cursor: onCellClick && changeType !== 'identical' ? 'pointer' : 'default',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={handleClick}
    >
      {isHeader ? <strong>{content || '-'}</strong> : <span>{content || '-'}</span>}
      
      {showTooltip && tooltipContent && (
        <div
          style={{
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
          }}
        >
          {tooltipContent}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              marginLeft: '-5px',
              borderWidth: '5px',
              borderStyle: 'solid',
              borderColor: '#333 transparent transparent transparent',
            }}
          />
        </div>
      )}
    </td>
  );
}

function getTooltipText(diff: CellDiff): string {
  switch (diff.changeType) {
    case 'modified':
      return '修改: "' + diff.oldContent + '" → "' + diff.newContent + '" (相似度: ' + (diff.similarity * 100).toFixed(0) + '%)';
    case 'added':
      return '新增: "' + diff.newContent + '"';
    case 'deleted':
      return '删除: "' + diff.oldContent + '"';
    default:
      return '';
  }
}
