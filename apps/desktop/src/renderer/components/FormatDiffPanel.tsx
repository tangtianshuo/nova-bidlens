import type { FormatDiffResult, TextFormatChange, ParagraphFormatChange } from '@bidlens/shared/types-only';
import { useState } from 'react';

export interface FormatDiffPanelProps {
  formatDiff: FormatDiffResult;
  onJumpToPosition?: (position: string) => void;
}

interface FormatGroupProps {
  title: string;
  icon: string;
  changes: Array<TextFormatChange | ParagraphFormatChange>;
  onJumpToPosition?: (position: string) => void;
}

function FormatGroup({ title, icon, changes, onJumpToPosition }: FormatGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (changes.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '16px', border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          color: '#495057',
        }}
      >
        <span style={{ marginRight: '8px', fontSize: '16px' }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        <span style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '12px',
          marginRight: '8px',
        }}>
          {changes.length}
        </span>
        <span style={{ fontSize: '12px', color: '#6c757d' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {isExpanded && (
        <div style={{ padding: '12px 16px' }}>
          {changes.map((change, index) => (
            <FormatChangeItem key={index} change={change} onJumpToPosition={onJumpToPosition} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormatChangeItem({ change, onJumpToPosition }: { change: TextFormatChange | ParagraphFormatChange; onJumpToPosition?: (position: string) => void }) {
  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'added': return '#28a745';
      case 'removed': return '#dc3545';
      case 'modified': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getChangeTypeLabel = (changeType: string) => {
    switch (changeType) {
      case 'added': return '新增';
      case 'removed': return '移除';
      case 'modified': return '修改';
      default: return '';
    }
  };

  const formatValue = (value: any) => {
    if (value === undefined || value === null) return '无';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'number') return value + 'pt';
    return String(value);
  };

  const handleClick = () => {
    if (onJumpToPosition) {
      onJumpToPosition(change.property);
    }
  };

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0',
        cursor: onJumpToPosition ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      <span style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: '600',
        color: 'white',
        backgroundColor: getChangeTypeColor(change.changeType),
        marginRight: '8px',
        minWidth: '40px',
        textAlign: 'center',
      }}>
        {getChangeTypeLabel(change.changeType)}
      </span>
      
      <span style={{ fontWeight: '500', marginRight: '12px', minWidth: '100px' }}>
        {change.property}
      </span>
      
      {change.changeType === 'modified' && (
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <span style={{
            padding: '4px 8px',
            backgroundColor: '#f8d7da',
            borderRadius: '3px',
            fontSize: '13px',
            marginRight: '8px',
            textDecoration: 'line-through',
          }}>
            {formatValue(change.oldValue)}
          </span>
          <span style={{ margin: '0 4px' }}>→</span>
          <span style={{
            padding: '4px 8px',
            backgroundColor: '#d4edda',
            borderRadius: '3px',
            fontSize: '13px',
          }}>
            {formatValue(change.newValue)}
          </span>
        </div>
      )}
      
      {change.changeType === 'added' && (
        <span style={{
          padding: '4px 8px',
          backgroundColor: '#d4edda',
          borderRadius: '3px',
          fontSize: '13px',
        }}>
          {formatValue(change.newValue)}
        </span>
      )}
      
      {change.changeType === 'removed' && (
        <span style={{
          padding: '4px 8px',
          backgroundColor: '#f8d7da',
          borderRadius: '3px',
          fontSize: '13px',
          textDecoration: 'line-through',
        }}>
          {formatValue(change.oldValue)}
        </span>
      )}
    </div>
  );
}

export function FormatDiffPanel({ formatDiff, onJumpToPosition }: FormatDiffPanelProps) {
  // 将文本格式变化按类型分组
  const fontFamilyChanges = formatDiff.textFormatChanges.filter(c => 
    c.property === 'fontFamily' || c.property === 'fontSize'
  );
  
  const colorChanges = formatDiff.textFormatChanges.filter(c => 
    c.property === 'color' || c.property === 'backgroundColor'
  );
  
  const styleChanges = formatDiff.textFormatChanges.filter(c => 
    ['bold', 'italic', 'underline', 'strikethrough', 'verticalAlign', 'letterSpacing'].includes(c.property)
  );

  if (!formatDiff.hasChanges) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h3 style={{ marginBottom: '8px', color: '#495057' }}>格式完全一致</h3>
        <p>两个文档的格式没有差异</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ 
        fontSize: '18px', 
        marginBottom: '16px', 
        color: '#495057',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>🎨</span>
        格式差异
        <span style={{ 
          fontSize: '12px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          padding: '2px 8px', 
          borderRadius: '10px' 
        }}>
          {formatDiff.textFormatChanges.length + formatDiff.paragraphFormatChanges.length}
        </span>
      </h2>
      
      <FormatGroup
        title="字体变化"
        icon="🔤"
        changes={fontFamilyChanges}
        onJumpToPosition={onJumpToPosition}
      />
      
      <FormatGroup
        title="颜色变化"
        icon="🎨"
        changes={colorChanges}
        onJumpToPosition={onJumpToPosition}
      />
      
      <FormatGroup
        title="文本样式变化"
        icon="✨"
        changes={styleChanges}
        onJumpToPosition={onJumpToPosition}
      />
      
      <FormatGroup
        title="段落格式变化"
        icon="📝"
        changes={formatDiff.paragraphFormatChanges}
        onJumpToPosition={onJumpToPosition}
      />
    </div>
  );
}

