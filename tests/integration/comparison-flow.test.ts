import { describe, expect, it } from 'vitest';
import { parseDocumentXmlToAst } from '../../apps/desktop/src/main/parser/docx-parser';
import { renderMarkdownReport } from '../../apps/desktop/src/main/services/report-exporter';
import type { CompareResult, ExportModel } from '../../packages/shared/src';

describe('Integration: Document Comparison Flow', () => {
  it('should parse XML and generate report', () => {
    // 1. 解析文档
    const xmlA = '<w:document><w:body><w:p><w:r><w:t>投标人应提供营业执照</w:t></w:r></w:p></w:body></w:document>';
    const xmlB = '<w:document><w:body><w:p><w:r><w:t>投标人须提供营业执照</w:t></w:r></w:p></w:body></w:document>';
    
    const docA = parseDocumentXmlToAst(xmlA, { filename: 'a.docx', sha256: 'hash-a' });
    const docB = parseDocumentXmlToAst(xmlB, { filename: 'b.docx', sha256: 'hash-b' });
    
    expect(docA.blocks).toHaveLength(1);
    expect(docB.blocks).toHaveLength(1);
    expect(docA.blocks[0].text).toBe('投标人应提供营业执照');
    expect(docB.blocks[0].text).toBe('投标人须提供营业执照');
    
    // 2. 创建模拟比对结果
    const compareResult: CompareResult = {
      taskId: 'integration-test',
      docA: docA,
      docB: docB,
      diffAst: {
        taskId: 'integration-test',
        docAId: docA.id,
        docBId: docB.id,
        generatedAt: new Date().toISOString(),
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [{
          matchId: 'm1',
          matchType: 'modified',
          confidence: 0.82,
          similarity: 0.82,
          sourceA: docA.blocks[0].text,
          sourceB: docB.blocks[0].text,
          nodeIdsA: [docA.blocks[0].id],
          nodeIdsB: [docB.blocks[0].id],
          diffDetail: [],
          summary: '措辞发生变化'
        }]
      },
      annotations: []
    };
    
    // 3. 生成报告
    const exportModel: ExportModel = {
      taskId: compareResult.taskId,
      generatedAt: compareResult.diffAst.generatedAt,
      docA: { filename: docA.filename, sha256: docA.sha256, pageCount: docA.pageCount, wordCount: docA.wordCount },
      docB: { filename: docB.filename, sha256: docB.sha256, pageCount: docB.pageCount, wordCount: docB.wordCount },
      options: { mode: 'standard', embeddingProvider: 'local', embeddingModel: 'test', topK: 5, similarityThreshold: 0.45 },
      diffAst: compareResult.diffAst,
      annotations: compareResult.annotations
    };
    
    const markdown = renderMarkdownReport(exportModel);
    
    expect(markdown).toContain('# BidLens 比对报告');
    expect(markdown).toContain('a.docx');
    expect(markdown).toContain('b.docx');
    expect(markdown).toContain('投标人应提供营业执照');
    expect(markdown).toContain('投标人须提供营业执照');
    expect(markdown).toContain('modified');
  });
  
  it('should handle empty documents', () => {
    const xml = '<w:document><w:body></w:body></w:document>';
    const doc = parseDocumentXmlToAst(xml, { filename: 'empty.docx', sha256: 'hash-empty' });
    
    expect(doc.blocks).toHaveLength(0);
    expect(doc.wordCount).toBe(0);
  });
  
  it('should handle multiple paragraphs', () => {
    const xml = `<w:document><w:body>
      <w:p><w:r><w:t>第一段</w:t></w:r></w:p>
      <w:p><w:r><w:t>第二段</w:t></w:r></w:p>
      <w:p><w:r><w:t>第三段</w:t></w:r></w:p>
    </w:body></w:document>`;
    
    const doc = parseDocumentXmlToAst(xml, { filename: 'multi.docx', sha256: 'hash-multi' });
    
    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks[0].text).toBe('第一段');
    expect(doc.blocks[1].text).toBe('第二段');
    expect(doc.blocks[2].text).toBe('第三段');
    // 每个段落3个字符，总共9个字符
    expect(doc.wordCount).toBe(9);
  });
});
