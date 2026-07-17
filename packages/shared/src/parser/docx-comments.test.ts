import { describe, expect, it } from 'vitest';
import { 
  parseComments, 
  parseCommentDefinitions, 
  parseCommentAnchors,
  ParsedComment,
  CommentRange 
} from './docx-comments.js';

// 模拟 Word comments.xml
const mockCommentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:comment w:id="1" w:author="张三" w:date="2024-01-15T10:30:00Z" w:initials="ZS">
    <w:p w:rsidR="00000000" w:rsidRDefault="00000000">
      <w:r>
        <w:t>这是一条批注</w:t>
      </w:r>
    </w:p>
  </w:comment>
  <w:comment w:id="2" w:author="李四" w:date="2024-01-15T11:00:00Z" w:initials="LS">
    <w:p w:rsidR="00000000" w:rsidRDefault="00000000">
      <w:r>
        <w:t>这是另一条批注，内容较长</w:t>
      </w:r>
    </w:p>
  </w:comment>
  <w:comment w:id="3" w:author="王五" w:date="2024-01-15T11:30:00Z" w:initials="WW">
    <w:p w:rsidR="00000000" w:rsidRDefault="00000000">
      <w:r>
        <w:t>这是回复批注</w:t>
      </w:r>
    </w:p>
  </w:comment>
</w:comments>`;

// 模拟带有批注锚点的 document.xml
const mockDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p w:rsidR="00000000" w:rsidRDefault="00000000">
      <w:r>
        <w:t>这是第一段文字，</w:t>
      </w:r>
      <w:commentRangeStart w:id="1"/>
      <w:r>
        <w:t>这里包含批注</w:t>
      </w:r>
      <w:commentRangeEnd w:id="1"/>
      <w:r>
        <w:rPr>
          <w:rStyle w:val="CommentReference"/>
        </w:rPr>
        <w:commentReference w:id="1"/>
      </w:r>
      <w:t>，继续第一段。</w:t>
    </w:p>
    <w:p w:rsidR="00000000" w:rsidRDefault="00000000">
      <w:r>
        <w:t>第二段开始，</w:t>
      </w:r>
      <w:commentRangeStart w:id="2"/>
      <w:r>
        <w:t>这里也有批注</w:t>
      </w:r>
      <w:commentRangeEnd w:id="2"/>
      <w:r>
        <w:rPr>
          <w:rStyle w:val="CommentReference"/>
        </w:rPr>
        <w:commentReference w:id="2"/>
      </w:r>
      <w:t>，第二段结束。</w:t>
    </w:p>
  </w:body>
</w:document>`;

describe('parseCommentDefinitions', () => {
  it('should parse comment definitions from comments.xml', () => {
    const comments = parseCommentDefinitions(mockCommentsXml);
    
    expect(comments).toHaveLength(3);
    expect(comments[0].id).toBe('1');
    expect(comments[0].author).toBe('张三');
    expect(comments[0].date).toBe('2024-01-15T10:30:00Z');
    expect(comments[0].content).toBe('这是一条批注');
  });

  it('should parse multiple comments with different authors', () => {
    const comments = parseCommentDefinitions(mockCommentsXml);
    
    expect(comments[1].author).toBe('李四');
    expect(comments[1].content).toBe('这是另一条批注，内容较长');
    expect(comments[2].author).toBe('王五');
    expect(comments[2].content).toBe('这是回复批注');
  });

  it('should handle empty comments.xml', () => {
    const emptyXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:comments>';
    const comments = parseCommentDefinitions(emptyXml);
    
    expect(comments).toHaveLength(0);
  });

  it('should handle comments with multiple text runs', () => {
    const multiRunXml = `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:comment w:id="10" w:author="测试" w:date="2024-01-01T00:00:00Z">
        <w:p>
          <w:r><w:t>第一部分</w:t></w:r>
          <w:r><w:t>第二部分</w:t></w:r>
        </w:p>
      </w:comment>
    </w:comments>`;
    
    const comments = parseCommentDefinitions(multiRunXml);
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe('第一部分第二部分');
  });
});

describe('parseCommentAnchors', () => {
  it('should parse comment anchors from document.xml', () => {
    const anchors = parseCommentAnchors(mockDocumentXml);
    
    expect(anchors).toHaveLength(2);
    expect(anchors[0].id).toBe('1');
    expect(anchors[1].id).toBe('2');
  });

  it('should return correct node positions', () => {
    const anchors = parseCommentAnchors(mockDocumentXml);
    
    // 验证锚点有有效的节点ID
    expect(anchors[0].startNodeId).toBeTruthy();
    expect(anchors[0].endNodeId).toBeTruthy();
  });

  it('should handle document without comments', () => {
    const simpleDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r><w:t>没有批注的文档</w:t></w:r>
          </w:p>
        </w:body>
      </w:document>`;
    
    const anchors = parseCommentAnchors(simpleDoc);
    expect(anchors).toHaveLength(0);
  });
});

describe('parseComments', () => {
  it('should merge definitions and anchors into complete comments', () => {
    const comments = parseComments(mockCommentsXml, mockDocumentXml);
    
    expect(comments).toHaveLength(3);
    expect(comments[0].id).toBe('1');
    expect(comments[0].author).toBe('张三');
    expect(comments[0].content).toBe('这是一条批注');
    expect(comments[0].range.startNodeId).toBeTruthy();
    expect(comments[0].range.endNodeId).toBeTruthy();
  });

  it('should preserve comment metadata', () => {
    const comments = parseComments(mockCommentsXml, mockDocumentXml);
    
    expect(comments[0].date).toBe('2024-01-15T10:30:00Z');
    expect(comments[0].resolved).toBe(false);
    expect(comments[0].replies).toEqual([]);
  });

  it('should handle comments without matching anchors', () => {
    // 批注定义中有的ID在文档中没有对应锚点
    const orphanCommentsXml = `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:comment w:id="99" w:author="测试" w:date="2024-01-01T00:00:00Z">
        <w:p><w:r><w:t>孤立批注</w:t></w:r></w:p>
      </w:comment>
    </w:comments>`;
    
    const simpleDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body><w:p><w:r><w:t>文档内容</w:t></w:r></w:p></w:body>
      </w:document>`;
    
    const comments = parseComments(orphanCommentsXml, simpleDoc);
    
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe('99');
    // 没有锚点时，range 应该是空的
    expect(comments[0].range.startNodeId).toBe('');
  });

  it('should handle reply chain structure', () => {
    // 测试回复链结构
    const replyCommentsXml = `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:comment w:id="1" w:author="用户A" w:date="2024-01-01T00:00:00Z">
        <w:p><w:r><w:t>原始批注</w:t></w:r></w:p>
      </w:comment>
      <w:comment w:id="2" w:author="用户B" w:date="2024-01-01T00:01:00Z" w:paraId="1">
        <w:p><w:r><w:t>回复1</w:t></w:r></w:p>
      </w:comment>
      <w:comment w:id="3" w:author="用户C" w:date="2024-01-01T00:02:00Z" w:paraId="1">
        <w:p><w:r><w:t>回复2</w:t></w:r></w:p>
      </w:comment>
    </w:comments>`;
    
    const simpleDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body><w:p><w:commentRangeStart w:id="1"/><w:r><w:t>文字</w:t></w:r><w:commentRangeEnd w:id="1"/></w:p></w:body>
      </w:document>`;
    
    const comments = parseComments(replyCommentsXml, simpleDoc);
    
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe('1');
    expect(comments[0].replies).toHaveLength(2);
    expect(comments[0].replies[0].id).toBe('2');
    expect(comments[0].replies[1].id).toBe('3');
  });

  it('should handle nested replies', () => {
    const nestedReplyXml = `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:comment w:id="1" w:author="用户A" w:date="2024-01-01T00:00:00Z">
        <w:p><w:r><w:t>第一层</w:t></w:r></w:p>
      </w:comment>
      <w:comment w:id="2" w:author="用户B" w:date="2024-01-01T00:01:00Z" w:paraId="1">
        <w:p><w:r><w:t>第二层</w:t></w:r></w:p>
      </w:comment>
    </w:comments>`;
    
    const simpleDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body><w:p><w:commentRangeStart w:id="1"/><w:r><w:t>文字</w:t></w:r><w:commentRangeEnd w:id="1"/></w:p></w:body>
      </w:document>`;
    
    const comments = parseComments(nestedReplyXml, simpleDoc);
    
    expect(comments).toHaveLength(1);
    expect(comments[0].replies).toHaveLength(1);
    expect(comments[0].replies[0].content).toBe('第二层');
  });
});
