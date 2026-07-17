/**
 * Word 批注解析模块
 * 解析 OOXML 格式中的批注（comments.xml 和 document.xml）
 */

export interface ParsedComment {
  id: string;
  author: string;
  date: string;
  content: string;
  range: CommentRange;
  replies: ParsedComment[];
  resolved: boolean;
}

export interface CommentRange {
  startNodeId: string;
  startOffset: number;
  endNodeId: string;
  endOffset: number;
}

interface CommentDefinition {
  id: string;
  author: string;
  date: string;
  content: string;
  parentId?: string;
  resolved: boolean;
}

interface CommentAnchor {
  id: string;
  startNodeId: string;
  startOffset: number;
  endNodeId: string;
  endOffset: number;
}

/**
 * 从 Word 批注 XML 中提取批注内容
 * @param commentsXml word/comments.xml 的内容
 * @returns 批注定义列表
 */
export function parseCommentDefinitions(commentsXml: string): CommentDefinition[] {
  const comments: CommentDefinition[] = [];
  
  // 使用正则表达式解析 XML（简化版，生产环境应使用 XML 解析器）
  const commentRegex = /<w:comment\s+([^>]*)>([\s\S]*?)<\/w:comment>/g;
  let match;
  
  while ((match = commentRegex.exec(commentsXml)) !== null) {
    const attrs = match[1];
    const content = match[2];
    
    // 提取属性
    const id = extractAttribute(attrs, 'w:id') || '';
    const author = extractAttribute(attrs, 'w:author') || 'Unknown';
    const date = extractAttribute(attrs, 'w:date') || '';
    
    // 检查是否有父批注（回复）
    const parentId = extractAttribute(attrs, 'w:paraId') || undefined;
    
    // 提取批注文本内容
    const textContent = extractTextContent(content);
    
    comments.push({
      id,
      author,
      date,
      content: textContent,
      parentId,
      resolved: false
    });
  }
  
  return comments;
}

/**
 * 从 document.xml 中提取批注锚点位置
 * @param documentXml word/document.xml 的内容
 * @returns 批注锚点列表
 */
export function parseCommentAnchors(documentXml: string): CommentAnchor[] {
  const anchors: CommentAnchor[] = [];
  
  // 找到所有 commentRangeStart
  const startRegex = /<w:commentRangeStart\s+w:id="(\d+)"\s*\/>/g;
  const endRegex = /<w:commentRangeEnd\s+w:id="(\d+)"\s*\/>/g;
  
  // 提取所有节点并计算位置
  const nodes = extractNodesWithPositions(documentXml);
  
  // 匹配开始和结束锚点
  const starts: Map<string, { nodeId: string; offset: number }> = new Map();
  const ends: Map<string, { nodeId: string; offset: number }> = new Map();
  
  let match;
  while ((match = startRegex.exec(documentXml)) !== null) {
    const id = match[1];
    const pos = findPositionInNodes(nodes, match.index);
    if (pos) starts.set(id, pos);
  }
  
  while ((match = endRegex.exec(documentXml)) !== null) {
    const id = match[1];
    const pos = findPositionInNodes(nodes, match.index);
    if (pos) ends.set(id, pos);
  }
  
  // 组合开始和结束位置
  for (const [id, start] of starts) {
    const end = ends.get(id);
    if (end) {
      anchors.push({
        id,
        startNodeId: start.nodeId,
        startOffset: start.offset,
        endNodeId: end.nodeId,
        endOffset: end.offset
      });
    }
  }
  
  return anchors;
}

/**
 * 解析完整批注（合并定义和锚点）
 * @param commentsXml word/comments.xml 的内容
 * @param documentXml word/document.xml 的内容
 * @returns 解析后的批注列表
 */
export function parseComments(commentsXml: string, documentXml: string): ParsedComment[] {
  const definitions = parseCommentDefinitions(commentsXml);
  const anchors = parseCommentAnchors(documentXml);
  
  // 创建锚点映射
  const anchorMap = new Map<string, CommentAnchor>();
  for (const anchor of anchors) {
    anchorMap.set(anchor.id, anchor);
  }
  
  // 构建批注树
  const commentMap = new Map<string, ParsedComment>();
  const rootComments: ParsedComment[] = [];
  
  // 第一遍：创建所有批注对象
  for (const def of definitions) {
    const anchor = anchorMap.get(def.id);
    const comment: ParsedComment = {
      id: def.id,
      author: def.author,
      date: def.date,
      content: def.content,
      range: anchor ? {
        startNodeId: anchor.startNodeId,
        startOffset: anchor.startOffset,
        endNodeId: anchor.endNodeId,
        endOffset: anchor.endOffset
      } : { startNodeId: '', startOffset: 0, endNodeId: '', endOffset: 0 },
      replies: [],
      resolved: def.resolved
    };
    commentMap.set(def.id, comment);
  }
  
  // 第二遍：构建回复链
  for (const def of definitions) {
    const comment = commentMap.get(def.id);
    if (!comment) continue;
    
    if (def.parentId) {
      const parent = commentMap.get(def.parentId);
      if (parent) {
        parent.replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  }
  
  return rootComments;
}

// ============ 辅助函数 ============

function extractAttribute(attrs: string, name: string): string | undefined {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = attrs.match(regex);
  return match ? match[1] : undefined;
}

function extractTextContent(xml: string): string {
  const texts: string[] = [];
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  
  while ((match = textRegex.exec(xml)) !== null) {
    texts.push(match[1]);
  }
  
  return texts.join('');
}

interface XmlNode {
  id: string;
  type: string;
  startOffset: number;
  endOffset: number;
}

function extractNodesWithPositions(xml: string): XmlNode[] {
  const nodes: XmlNode[] = [];
  let nodeId = 0;
  
  // 匹配 w:p 段落节点
  const paragraphRegex = /<w:p\b[^>]*>/g;
  let match;
  
  while ((match = paragraphRegex.exec(xml)) !== null) {
    nodes.push({
      id: `p_${nodeId++}`,
      type: 'paragraph',
      startOffset: match.index,
      endOffset: match.index + match[0].length
    });
  }
  
  // 匹配 w:r 文本 run 节点
  const runRegex = /<w:r\b[^>]*>/g;
  while ((match = runRegex.exec(xml)) !== null) {
    nodes.push({
      id: `r_${nodeId++}`,
      type: 'run',
      startOffset: match.index,
      endOffset: match.index + match[0].length
    });
  }
  
  // 按位置排序
  nodes.sort((a, b) => a.startOffset - b.startOffset);
  
  return nodes;
}

function findPositionInNodes(nodes: XmlNode[], offset: number): { nodeId: string; offset: number } | null {
  // 找到包含该偏移量的最近节点
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].startOffset <= offset) {
      return {
        nodeId: nodes[i].id,
        offset: offset - nodes[i].startOffset
      };
    }
  }
  
  // 如果没有找到，返回第一个节点
  if (nodes.length > 0) {
    return {
      nodeId: nodes[0].id,
      offset: 0
    };
  }
  
  return null;
}
