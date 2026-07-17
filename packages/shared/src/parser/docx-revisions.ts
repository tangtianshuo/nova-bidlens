/**
 * Word 修订解析模块
 * 解析 OOXML 格式中的修订（track changes）
 * 
 * 支持的修订类型：
 * - insert (w:ins): 插入的文本
 * - delete (w:del): 删除的文本
 * - formatChange (w:rPrChange/w:pPrChange): 格式变更
 * - moveFrom (w:moveFrom): 移动来源
 * - moveTo (w:moveTo): 移动目标
 */

export interface TextFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  strikethrough?: boolean;
}

export interface ParsedRevision {
  id: string;
  author: string;
  date: string;
  revisionType: 'insert' | 'delete' | 'formatChange' | 'moveFrom' | 'moveTo';
  content: {
    text: string;
    format?: TextFormat;
    position: {
      nodeId: string;
      offset: number;
    };
  };
  accepted?: boolean;
}

interface RevisionDefinition {
  id: string;
  author: string;
  date: string;
  revisionType: 'insert' | 'delete' | 'formatChange' | 'moveFrom' | 'moveTo';
  content: string;
  format?: TextFormat;
  startIndex: number;
  endIndex: number;
}

/**
 * 从 Word document.xml 中提取修订
 * @param documentXml word/document.xml 的内容
 * @returns 解析后的修订列表
 */
export function parseRevisions(documentXml: string): ParsedRevision[] {
  const revisions: ParsedRevision[] = [];
  const nodes = extractNodesWithPositions(documentXml);
  
  // 解析插入修订 (w:ins)
  const insertRevisions = extractInsertRevisions(documentXml, nodes);
  revisions.push(...insertRevisions);
  
  // 解析删除修订 (w:del)
  const deleteRevisions = extractDeleteRevisions(documentXml, nodes);
  revisions.push(...deleteRevisions);
  
  // 解析格式变更修订 (w:rPrChange)
  const formatRevisions = extractFormatChangeRevisions(documentXml, nodes);
  revisions.push(...formatRevisions);
  
  // 解析移动修订 (w:moveFrom / w:moveTo)
  const moveRevisions = extractMoveRevisions(documentXml, nodes);
  revisions.push(...moveRevisions);
  
  // 按位置排序
  revisions.sort((a, b) => {
    const posA = a.content.position;
    const posB = b.content.position;
    if (posA.nodeId !== posB.nodeId) {
      return posA.nodeId.localeCompare(posB.nodeId);
    }
    return posA.offset - posB.offset;
  });
  
  return revisions;
}

// ============ 提取各类修订 ============

function extractInsertRevisions(xml: string, nodes: XmlNode[]): ParsedRevision[] {
  const revisions: ParsedRevision[] = [];
  // 支持有属性和无属性的情况
  const regex = /<w:ins(?:\s+([^>]*))?>([\s\S]*?)<\/w:ins>/g;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    const attrs = match[1] || '';
    const content = match[2];
    
    const id = extractAttribute(attrs, 'w:id') || `ins_${match.index}`;
    const author = extractAttribute(attrs, 'w:author') || 'Unknown';
    const date = extractAttribute(attrs, 'w:date') || '';
    const text = extractTextContent(content);
    const format = extractFormatFromContent(content);
    const position = findPositionInNodes(nodes, match.index);
    
    revisions.push({
      id,
      author,
      date,
      revisionType: 'insert',
      content: {
        text,
        format,
        position: position || { nodeId: '', offset: 0 }
      }
    });
  }
  
  return revisions;
}

function extractDeleteRevisions(xml: string, nodes: XmlNode[]): ParsedRevision[] {
  const revisions: ParsedRevision[] = [];
  // 支持有属性和无属性的情况
  const regex = /<w:del(?:\s+([^>]*))?>([\s\S]*?)<\/w:del>/g;
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    const attrs = match[1] || '';
    const content = match[2];
    
    const id = extractAttribute(attrs, 'w:id') || `del_${match.index}`;
    const author = extractAttribute(attrs, 'w:author') || 'Unknown';
    const date = extractAttribute(attrs, 'w:date') || '';
    const text = extractDeletedTextContent(content);
    const position = findPositionInNodes(nodes, match.index);
    
    revisions.push({
      id,
      author,
      date,
      revisionType: 'delete',
      content: {
        text,
        position: position || { nodeId: '', offset: 0 }
      }
    });
  }
  
  return revisions;
}

function extractFormatChangeRevisions(xml: string, nodes: XmlNode[]): ParsedRevision[] {
  const revisions: ParsedRevision[] = [];
  
  // 查找 w:rPrChange（run 格式变更）
  const rprRegex = /<w:rPrChange\s+([^>]*)>([\s\S]*?)<\/w:rPrChange>/g;
  let match;
  
  while ((match = rprRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const content = match[2];
    
    const id = extractAttribute(attrs, 'w:id') || `fmt_${match.index}`;
    const author = extractAttribute(attrs, 'w:author') || 'Unknown';
    const date = extractAttribute(attrs, 'w:date') || '';
    const oldFormat = parseFormatProperties(content);
    const position = findPositionInNodes(nodes, match.index);
    
    revisions.push({
      id,
      author,
      date,
      revisionType: 'formatChange',
      content: {
        text: '格式变更',
        format: oldFormat,
        position: position || { nodeId: '', offset: 0 }
      }
    });
  }
  
  // 查找 w:pPrChange（paragraph 格式变更）
  const pprRegex = /<w:pPrChange\s+([^>]*)>([\s\S]*?)<\/w:pPrChange>/g;
  
  while ((match = pprRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const id = extractAttribute(attrs, 'w:id') || `pfmt_${match.index}`;
    const author = extractAttribute(attrs, 'w:author') || 'Unknown';
    const date = extractAttribute(attrs, 'w:date') || '';
    const position = findPositionInNodes(nodes, match.index);
    
    revisions.push({
      id,
      author,
      date,
      revisionType: 'formatChange',
      content: {
        text: '段落格式变更',
        position: position || { nodeId: '', offset: 0 }
      }
    });
  }
  
  return revisions;
}

function extractMoveRevisions(xml: string, nodes: XmlNode[]): ParsedRevision[] {
  const revisions: ParsedRevision[] = [];
  
  // 查找 w:moveFrom
  const moveFromRegex = /<w:moveFrom(?:\s+([^>]*))?>([\s\S]*?)<\/w:moveFrom>/g;
  let match;
  
  while ((match = moveFromRegex.exec(xml)) !== null) {
    const attrs = match[1] || '';
    const content = match[2];
    
    const id = extractAttribute(attrs, 'w:id') || `mvf_${match.index}`;
    const author = extractAttribute(attrs, 'w:author') || 'Unknown';
    const date = extractAttribute(attrs, 'w:date') || '';
    const text = extractDeletedTextContent(content);
    const position = findPositionInNodes(nodes, match.index);
    
    revisions.push({
      id,
      author,
      date,
      revisionType: 'moveFrom',
      content: {
        text,
        position: position || { nodeId: '', offset: 0 }
      }
    });
  }
  
  // 查找 w:moveTo
  const moveToRegex = /<w:moveTo(?:\s+([^>]*))?>([\s\S]*?)<\/w:moveTo>/g;
  
  while ((match = moveToRegex.exec(xml)) !== null) {
    const attrs = match[1] || '';
    const content = match[2];
    
    const id = extractAttribute(attrs, 'w:id') || `mvt_${match.index}`;
    const author = extractAttribute(attrs, 'w:author') || 'Unknown';
    const date = extractAttribute(attrs, 'w:date') || '';
    const text = extractTextContent(content);
    const format = extractFormatFromContent(content);
    const position = findPositionInNodes(nodes, match.index);
    
    revisions.push({
      id,
      author,
      date,
      revisionType: 'moveTo',
      content: {
        text,
        format,
        position: position || { nodeId: '', offset: 0 }
      }
    });
  }
  
  return revisions;
}

// ============ 辅助函数 ============

interface XmlNode {
  id: string;
  type: string;
  startOffset: number;
  endOffset: number;
}

function extractAttribute(attrs: string, name: string): string | undefined {
  if (!attrs) return undefined;
  const escapedName = name.replace(':', '\\:');
  const regex = new RegExp(`${escapedName}="([^"]*)"`, 'i');
  const match = attrs.match(regex);
  return match ? match[1] : undefined;
}

function extractTextContent(xml: string): string {
  const texts: string[] = [];
  // 排除 w:delText，只提取 w:t
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  
  while ((match = textRegex.exec(xml)) !== null) {
    texts.push(match[1]);
  }
  
  return texts.join('');
}

function extractDeletedTextContent(xml: string): string {
  const texts: string[] = [];
  // w:delText 用于删除的文本
  const textRegex = /<w:delText[^>]*>([^<]*)<\/w:delText>/g;
  let match;
  
  while ((match = textRegex.exec(xml)) !== null) {
    texts.push(match[1]);
  }
  
  // 如果没有 w:delText，尝试 w:t
  if (texts.length === 0) {
    const fallbackRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    while ((match = fallbackRegex.exec(xml)) !== null) {
      texts.push(match[1]);
    }
  }
  
  return texts.join('');
}

function extractFormatFromContent(xml: string): TextFormat | undefined {
  const rprMatch = xml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (!rprMatch) return undefined;
  
  return parseFormatProperties(rprMatch[1]);
}

function parseFormatProperties(rprXml: string): TextFormat {
  const format: TextFormat = {};
  
  // 粗体 - 检查 w:b 元素是否存在
  if (/<w:b[\s>\/]/.test(rprXml) || /<w:b>/.test(rprXml)) {
    if (/<w:b\s+w:val="0"/.test(rprXml)) {
      format.bold = false;
    } else {
      format.bold = true;
    }
  }
  
  // 斜体 - 检查 w:i 元素是否存在
  if (/<w:i[\s>\/]/.test(rprXml) || /<w:i>/.test(rprXml)) {
    if (/<w:i\s+w:val="0"/.test(rprXml)) {
      format.italic = false;
    } else {
      format.italic = true;
    }
  }
  
  // 下划线
  if (/<w:u[\s>]/.test(rprXml)) {
    format.underline = true;
  }
  
  // 删除线
  if (/<w:strike[\s>\/]/.test(rprXml) || /<w:strike>/.test(rprXml)) {
    format.strikethrough = true;
  }
  
  // 字体大小
  const sizeMatch = rprXml.match(/<w:sz\s+w:val="(\d+)"/);
  if (sizeMatch) {
    format.fontSize = sizeMatch[1];
  }
  
  // 字体
  const fontMatch = rprXml.match(/<w:rFonts\s+[^>]*w:ascii="([^"]*)"/);
  if (fontMatch) {
    format.fontFamily = fontMatch[1];
  }
  
  // 颜色
  const colorMatch = rprXml.match(/<w:color\s+w:val="([^"]*)"/);
  if (colorMatch) {
    format.color = colorMatch[1];
  }
  
  return Object.keys(format).length > 0 ? format : undefined;
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