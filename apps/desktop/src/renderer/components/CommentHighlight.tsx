import { useState, useCallback, useRef, useEffect } from 'react';
import type { ParsedComment, CommentRange } from '@bidlens/shared/types-only';
import type { ParsedRevision } from '@bidlens/shared/types-only';

export interface CommentHighlightProps {
  comments: ParsedComment[];
  revisions: ParsedRevision[];
  children: React.ReactNode;
}

interface HighlightSegment {
  type: 'text' | 'comment' | 'insert' | 'delete';
  content: string;
  id?: string;
  data?: ParsedComment | ParsedRevision;
}

export function CommentHighlight({ comments, revisions, children }: CommentHighlightProps) {
  const [activeTooltip, setActiveTooltip] = useState<{
    id: string;
    type: 'comment' | 'revision';
    x: number;
    y: number;
    data: ParsedComment | ParsedRevision;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // 构建高亮段落
  const buildSegments = useCallback((): HighlightSegment[] => {
    const segments: HighlightSegment[] = [];
    
    // 这里简化处理：假设 children 是纯文本
    // 实际实现需要解析 React children 树
    const text = extractTextFromChildren(children);
    
    if (!text) {
      return [{ type: 'text', content: '' }];
    }

    // 收集所有需要标记的位置
    const markers: Array<{
      position: number;
      type: 'start' | 'end';
      highlightType: 'comment' | 'insert' | 'delete';
      id: string;
      data: ParsedComment | ParsedRevision;
    }> = [];

    // 添加批注标记
    comments.forEach(comment => {
      if (comment.range.startOffset > 0) {
        markers.push({
          position: comment.range.startOffset,
          type: 'start',
          highlightType: 'comment',
          id: comment.id,
          data: comment
        });
        markers.push({
          position: comment.range.endOffset,
          type: 'end',
          highlightType: 'comment',
          id: comment.id,
          data: comment
        });
      }
    });

    // 添加修订标记
    revisions.forEach(revision => {
      const position = revision.content.position.offset;
      const textLength = revision.content.text.length;
      
      if (revision.revisionType === 'insert') {
        markers.push({
          position,
          type: 'start',
          highlightType: 'insert',
          id: revision.id,
          data: revision
        });
        markers.push({
          position: position + textLength,
          type: 'end',
          highlightType: 'insert',
          id: revision.id,
          data: revision
        });
      } else if (revision.revisionType === 'delete') {
        markers.push({
          position,
          type: 'start',
          highlightType: 'delete',
          id: revision.id,
          data: revision
        });
        markers.push({
          position: position + textLength,
          type: 'end',
          highlightType: 'delete',
          id: revision.id,
          data: revision
        });
      }
    });

    // 按位置排序标记
    markers.sort((a, b) => a.position - b.position);

    // 构建段落
    let currentPos = 0;
    const activeHighlights: Map<string, { type: string; data: ParsedComment | ParsedRevision }> = new Map();

    markers.forEach(marker => {
      // 添加前面的普通文本
      if (marker.position > currentPos) {
        const textContent = text.substring(currentPos, marker.position);
        if (activeHighlights.size === 0) {
          segments.push({ type: 'text', content: textContent });
        } else {
          // 有活跃的高亮，需要分段
          const highlightType = Array.from(activeHighlights.values())[0].type as 'comment' | 'insert' | 'delete';
          const highlightData = Array.from(activeHighlights.values())[0].data;
          segments.push({
            type: highlightType,
            content: textContent,
            id: Array.from(activeHighlights.keys())[0],
            data: highlightData
          });
        }
      }

      // 更新活跃高亮
      if (marker.type === 'start') {
        activeHighlights.set(marker.id, { type: marker.highlightType, data: marker.data });
      } else {
        activeHighlights.delete(marker.id);
      }

      currentPos = marker.position;
    });

    // 添加剩余的文本
    if (currentPos < text.length) {
      const remainingText = text.substring(currentPos);
      if (activeHighlights.size > 0) {
        const highlightType = Array.from(activeHighlights.values())[0].type as 'comment' | 'insert' | 'delete';
        const highlightData = Array.from(activeHighlights.values())[0].data;
        segments.push({
          type: highlightType,
          content: remainingText,
          id: Array.from(activeHighlights.keys())[0],
          data: highlightData
        });
      } else {
        segments.push({ type: 'text', content: remainingText });
      }
    }

    return segments;
  }, [comments, revisions, children]);

  const handleMouseEnter = useCallback((
    event: React.MouseEvent,
    id: string,
    type: 'comment' | 'revision',
    data: ParsedComment | ParsedRevision
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      id,
      type,
      x: rect.left + rect.width / 2,
      y: rect.top,
      data
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const segments = buildSegments();

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ lineHeight: 1.8 }}>
        {segments.map((segment, index) => {
          if (segment.type === 'text') {
            return <span key={index}>{segment.content}</span>;
          }

          const style = getHighlightStyle(segment.type as 'comment' | 'insert' | 'delete');
          const tooltipData = segment.data;

          return (
            <span
              key={index}
              style={style}
              onMouseEnter={(e) => tooltipData && handleMouseEnter(e, segment.id!, segment.type as 'comment' | 'revision', tooltipData)}
              onMouseLeave={handleMouseLeave}
            >
              {segment.content}
            </span>
          );
        })}
      </div>

      {activeTooltip && (
        <Tooltip
          x={activeTooltip.x}
          y={activeTooltip.y}
          type={activeTooltip.type}
          data={activeTooltip.data}
        />
      )}
    </div>
  );
}

function getHighlightStyle(type: 'comment' | 'insert' | 'delete'): React.CSSProperties {
  switch (type) {
    case 'comment':
      return {
        borderBottom: '2px solid #ffc107',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      };
    case 'insert':
      return {
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      };
    case 'delete':
      return {
        textDecoration: 'line-through',
        textDecorationColor: '#dc3545',
        color: '#6c757d',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      };
    default:
      return {};
  }
}

interface TooltipProps {
  x: number;
  y: number;
  type: 'comment' | 'revision';
  data: ParsedComment | ParsedRevision;
}

function Tooltip({ x, y, type, data }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x - rect.width / 2;
      let newY = y - rect.height - 8;

      // 确保不超出视口
      if (newX < 8) newX = 8;
      if (newX + rect.width > viewportWidth - 8) newX = viewportWidth - rect.width - 8;
      if (newY < 8) newY = y + 24;

      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  const content = type === 'comment' 
    ? renderCommentTooltip(data as ParsedComment)
    : renderRevisionTooltip(data as ParsedRevision);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '12px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: '300px',
        zIndex: 1000,
        fontSize: '13px',
        lineHeight: 1.5
      }}
    >
      {content}
    </div>
  );
}

function renderCommentTooltip(comment: ParsedComment) {
  return (
    <div>
      <div style={{ fontWeight: '600', marginBottom: '4px', color: '#ffc107' }}>
        💬 批注
      </div>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ color: '#adb5bd' }}>作者：</span>
        {comment.author}
      </div>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ color: '#adb5bd' }}>日期：</span>
        {formatDate(comment.date)}
      </div>
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        padding: '8px', 
        borderRadius: '4px',
        marginTop: '8px'
      }}>
        {comment.content}
      </div>
      {comment.replies.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#adb5bd' }}>
          {comment.replies.length} 条回复
        </div>
      )}
    </div>
  );
}

function renderRevisionTooltip(revision: ParsedRevision) {
  const typeLabel = revision.revisionType === 'insert' ? '插入' : 
                   revision.revisionType === 'delete' ? '删除' : 
                   revision.revisionType === 'formatChange' ? '格式变更' :
                   revision.revisionType === 'moveFrom' ? '移动来源' : '移动目标';
  
  const typeColor = revision.revisionType === 'insert' ? '#28a745' : 
                   revision.revisionType === 'delete' ? '#dc3545' : '#ffc107';

  return (
    <div>
      <div style={{ fontWeight: '600', marginBottom: '4px', color: typeColor }}>
        ✏️ 修订 - {typeLabel}
      </div>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ color: '#adb5bd' }}>作者：</span>
        {revision.author}
      </div>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ color: '#adb5bd' }}>日期：</span>
        {formatDate(revision.date)}
      </div>
      <div style={{ 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        padding: '8px', 
        borderRadius: '4px',
        marginTop: '8px'
      }}>
        <div style={{ marginBottom: '4px', fontSize: '12px', color: '#adb5bd' }}>
          内容变化：
        </div>
        <div>{revision.content.text}</div>
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  if (!dateString) return '未知';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextFromChildren((children as any).props.children);
  }
  return '';
}

