import { describe, expect, it } from 'vitest';
import { parseRevisions, ParsedRevision, TextFormat } from './docx-revisions.js';

// 模拟带有插入修订的 document.xml
const mockInsertXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>这是</w:t></w:r>
      <w:ins w:id="1" w:author="张三" w:date="2024-01-15T10:30:00Z">
        <w:r>
          <w:rPr><w:b/></w:rPr>
          <w:t>新插入的</w:t>
        </w:r>
      </w:ins>
      <w:r><w:t>文字</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

// 模拟带有删除修订的 document.xml
const mockDeleteXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>这是</w:t></w:r>
      <w:del w:id="2" w:author="李四" w:date="2024-01-15T11:00:00Z">
        <w:r>
          <w:delText>被删除的</w:delText>
        </w:r>
      </w:del>
      <w:r><w:t>文字</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

// 模拟带有格式变更的 document.xml
const mockFormatChangeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:rPr>
          <w:rPrChange w:id="3" w:author="王五" w:date="2024-01-15T12:00:00Z">
            <w:rPr><w:b w:val="0"/></w:rPr>
          </w:rPrChange>
          <w:b/>
        </w:rPr>
        <w:t>格式变更文字</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

// 模拟带有移动修订的 document.xml
const mockMoveXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>文字</w:t></w:r>
      <w:moveFrom w:id="4" w:author="赵六" w:date="2024-01-15T13:00:00Z">
        <w:r>
          <w:delText>移动来源</w:delText>
        </w:r>
      </w:moveFrom>
      <w:moveTo w:id="5" w:author="赵六" w:date="2024-01-15T13:00:00Z">
        <w:r>
          <w:t>移动目标</w:t>
        </w:r>
      </w:moveTo>
    </w:p>
  </w:body>
</w:document>`;

// 综合测试文档
const mockFullXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>第一段开始</w:t></w:r>
      <w:ins w:id="10" w:author="用户A" w:date="2024-01-01T00:00:00Z">
        <w:r><w:t>插入内容</w:t></w:r>
      </w:ins>
      <w:r><w:t>，</w:t></w:r>
      <w:del w:id="11" w:author="用户B" w:date="2024-01-01T00:01:00Z">
        <w:r><w:delText>删除内容</w:delText></w:r>
      </w:del>
      <w:r><w:t>第一段结束。</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>第二段开始</w:t></w:r>
      <w:ins w:id="12" w:author="用户C" w:date="2024-01-01T00:02:00Z">
        <w:r><w:t>第二处插入</w:t></w:r>
      </w:ins>
      <w:r><w:t>第二段结束。</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

describe('parseRevisions - 插入修订', () => {
  it('应该解析插入修订', () => {
    const revisions = parseRevisions(mockInsertXml);
    
    expect(revisions).toHaveLength(1);
    expect(revisions[0].id).toBe('1');
    expect(revisions[0].author).toBe('张三');
    expect(revisions[0].date).toBe('2024-01-15T10:30:00Z');
    expect(revisions[0].revisionType).toBe('insert');
    expect(revisions[0].content.text).toBe('新插入的');
  });

  it('应该解析插入修订的格式信息', () => {
    const revisions = parseRevisions(mockInsertXml);
    
    expect(revisions[0].content.format).toBeDefined();
    expect(revisions[0].content.format?.bold).toBe(true);
  });

  it('应该包含修订位置信息', () => {
    const revisions = parseRevisions(mockInsertXml);
    
    expect(revisions[0].content.position).toBeDefined();
    expect(revisions[0].content.position.nodeId).toBeTruthy();
    expect(typeof revisions[0].content.position.offset).toBe('number');
  });
});

describe('parseRevisions - 删除修订', () => {
  it('应该解析删除修订', () => {
    const revisions = parseRevisions(mockDeleteXml);
    
    expect(revisions).toHaveLength(1);
    expect(revisions[0].id).toBe('2');
    expect(revisions[0].author).toBe('李四');
    expect(revisions[0].date).toBe('2024-01-15T11:00:00Z');
    expect(revisions[0].revisionType).toBe('delete');
    expect(revisions[0].content.text).toBe('被删除的');
  });

  it('应该正确提取 w:delText 内容', () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:del w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:delText>第一部分</w:delText></w:r>
            <w:r><w:delText>第二部分</w:delText></w:r>
          </w:del>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(xml);
    expect(revisions[0].content.text).toBe('第一部分第二部分');
  });
});

describe('parseRevisions - 格式变更', () => {
  it('应该解析格式变更修订', () => {
    const revisions = parseRevisions(mockFormatChangeXml);
    
    expect(revisions).toHaveLength(1);
    expect(revisions[0].revisionType).toBe('formatChange');
    expect(revisions[0].author).toBe('王五');
  });

  it('应该解析旧格式信息', () => {
    const revisions = parseRevisions(mockFormatChangeXml);
    
    // 旧格式中 b=0，表示之前没有粗体
    expect(revisions[0].content.format).toBeDefined();
    expect(revisions[0].content.format?.bold).toBe(false);
  });
});

describe('parseRevisions - 移动修订', () => {
  it('应该解析移动来源', () => {
    const revisions = parseRevisions(mockMoveXml);
    
    const moveFrom = revisions.find(r => r.revisionType === 'moveFrom');
    expect(moveFrom).toBeDefined();
    expect(moveFrom?.id).toBe('4');
    expect(moveFrom?.author).toBe('赵六');
    expect(moveFrom?.content.text).toBe('移动来源');
  });

  it('应该解析移动目标', () => {
    const revisions = parseRevisions(mockMoveXml);
    
    const moveTo = revisions.find(r => r.revisionType === 'moveTo');
    expect(moveTo).toBeDefined();
    expect(moveTo?.id).toBe('5');
    expect(moveTo?.content.text).toBe('移动目标');
  });

  it('应该同时包含 moveFrom 和 moveTo', () => {
    const revisions = parseRevisions(mockMoveXml);
    
    expect(revisions).toHaveLength(2);
    expect(revisions.some(r => r.revisionType === 'moveFrom')).toBe(true);
    expect(revisions.some(r => r.revisionType === 'moveTo')).toBe(true);
  });
});

describe('parseRevisions - 综合测试', () => {
  it('应该解析多种修订类型', () => {
    const revisions = parseRevisions(mockFullXml);
    
    expect(revisions).toHaveLength(3);
    expect(revisions.filter(r => r.revisionType === 'insert')).toHaveLength(2);
    expect(revisions.filter(r => r.revisionType === 'delete')).toHaveLength(1);
  });

  it('应该保持修订的原始顺序', () => {
    const revisions = parseRevisions(mockFullXml);
    
    // 第一段的插入应该在第一段的删除之前
    const ids = revisions.map(r => r.id);
    expect(ids).toEqual(['10', '11', '12']);
  });

  it('应该保留所有修订元数据', () => {
    const revisions = parseRevisions(mockFullXml);
    
    expect(revisions[0].author).toBe('用户A');
    expect(revisions[1].author).toBe('用户B');
    expect(revisions[2].author).toBe('用户C');
    
    expect(revisions[0].date).toBe('2024-01-01T00:00:00Z');
    expect(revisions[1].date).toBe('2024-01-01T00:01:00Z');
    expect(revisions[2].date).toBe('2024-01-01T00:02:00Z');
  });
});

describe('parseRevisions - 边界情况', () => {
  it('应该处理空文档', () => {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>无修订的文档</w:t></w:r></w:p>
        </w:body>
      </w:document>`;
    
    const revisions = parseRevisions(emptyXml);
    expect(revisions).toHaveLength(0);
  });

  it('应该处理缺少属性的修订', () => {
    const minimalXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins>
            <w:r><w:t>最小属性修订</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(minimalXml);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].author).toBe('Unknown');
    expect(revisions[0].revisionType).toBe('insert');
  });

  it('应该处理多 run 的修订', () => {
    const multiRunXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:t>第一段</w:t></w:r>
            <w:r><w:t>第二段</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(multiRunXml);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].content.text).toBe('第一段第二段');
  });

  it('应该处理嵌套在复杂结构中的修订', () => {
    const complexXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:t>开始</w:t></w:r>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:i/>
            </w:rPr>
            <w:t>格式化</w:t>
          </w:r>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r>
              <w:rPr><w:u w:val="single"/></w:rPr>
              <w:t>带下划线的插入</w:t>
            </w:r>
          </w:ins>
          <w:r><w:t>结束</w:t></w:r>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(complexXml);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].content.text).toBe('带下划线的插入');
    expect(revisions[0].content.format?.underline).toBe(true);
  });
});

describe('parseRevisions - 格式解析', () => {
  it('应该解析粗体格式', () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:rPr><w:b/></w:rPr><w:t>粗体</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(xml);
    expect(revisions[0].content.format?.bold).toBe(true);
    expect(revisions[0].content.format?.italic).toBeUndefined();
  });

  it('应该解析斜体格式', () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:rPr><w:i/></w:rPr><w:t>斜体</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(xml);
    expect(revisions[0].content.format?.italic).toBe(true);
  });

  it('应该解析字体大小', () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>大字体</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(xml);
    expect(revisions[0].content.format?.fontSize).toBe('24');
  });

  it('应该解析颜色', () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>红色</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(xml);
    expect(revisions[0].content.format?.color).toBe('FF0000');
  });

  it('应该解析删除线', () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:rPr><w:strike/></w:rPr><w:t>删除线</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(xml);
    expect(revisions[0].content.format?.strikethrough).toBe(true);
  });

  it('应该处理没有格式的修订', () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:ins w:id="1" w:author="测试" w:date="2024-01-01T00:00:00Z">
            <w:r><w:t>无格式</w:t></w:r>
          </w:ins>
        </w:p>
      </w:body>
    </w:document>`;
    
    const revisions = parseRevisions(xml);
    expect(revisions[0].content.format).toBeUndefined();
  });
});