import { describe, expect, it } from 'vitest';
import { parseDocumentXmlToAst } from '../../apps/desktop/src/main/parser/docx-parser';
import { renderMarkdownReport, renderHtmlReport } from '../../apps/desktop/src/main/services/report-exporter';
import type { CompareResult, ExportModel, DocumentAst } from '../../packages/shared/src';

describe('E2E: Complete Document Comparison Workflow', () => {
  // 模拟真实的文档比对场景
  it('should handle a realistic document comparison scenario', () => {
    // 1. 模拟两个投标文档
    const xmlA = `<w:document><w:body>
      <w:p><w:r><w:t>第一章 投标须知</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.1 投标人应提供营业执照副本复印件</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.2 投标人须提供近三年财务报表</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.3 投标保证金为合同金额的5%</w:t></w:r></w:p>
    </w:body></w:document>`;
    
    const xmlB = `<w:document><w:body>
      <w:p><w:r><w:t>第一章 投标须知</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.1 投标人须提供营业执照副本复印件</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.2 投标人应提供近三年财务报表</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.3 投标保证金为合同金额的10%</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.4 新增条款：投标人需提供信用报告</w:t></w:r></w:p>
    </w:body></w:document>`;
    
    // 2. 解析文档
    const docA = parseDocumentXmlToAst(xmlA, { filename: '基准版投标文件.docx', sha256: 'sha256-a' });
    const docB = parseDocumentXmlToAst(xmlB, { filename: '比较版投标文件.docx', sha256: 'sha256-b' });
    
    // 验证解析结果
    expect(docA.blocks).toHaveLength(4);
    expect(docB.blocks).toHaveLength(5);
    expect(docA.blocks[0].text).toBe('第一章 投标须知');
    expect(docB.blocks[4].text).toBe('1.4 新增条款：投标人需提供信用报告');
    
    // 3. 模拟比对结果（实际应用中由Rust引擎生成）
    const compareResult: CompareResult = {
      taskId: 'e2e-test-001',
      docA: docA,
      docB: docB,
      diffAst: {
        taskId: 'e2e-test-001',
        docAId: docA.id,
        docBId: docB.id,
        generatedAt: '2026-07-16T10:47:00.000Z',
        summary: { 
          identical: 1, 
          modified: 3, 
          added: 1, 
          deleted: 0, 
          moved: 0, 
          split: 0, 
          merged: 0, 
          uncertain: 0 
        },
        items: [
          {
            matchId: 'm1',
            matchType: 'identical',
            confidence: 1.0,
            similarity: 1.0,
            sourceA: '第一章 投标须知',
            sourceB: '第一章 投标须知',
            nodeIdsA: [docA.blocks[0].id],
            nodeIdsB: [docB.blocks[0].id],
            diffDetail: [],
            summary: '完全相同'
          },
          {
            matchId: 'm2',
            matchType: 'modified',
            confidence: 0.95,
            similarity: 0.95,
            sourceA: '1.1 投标人应提供营业执照副本复印件',
            sourceB: '1.1 投标人须提供营业执照副本复印件',
            nodeIdsA: [docA.blocks[1].id],
            nodeIdsB: [docB.blocks[1].id],
            diffDetail: [],
            summary: '措辞变化：应→须'
          },
          {
            matchId: 'm3',
            matchType: 'modified',
            confidence: 0.92,
            similarity: 0.92,
            sourceA: '1.2 投标人须提供近三年财务报表',
            sourceB: '1.2 投标人应提供近三年财务报表',
            nodeIdsA: [docA.blocks[2].id],
            nodeIdsB: [docB.blocks[2].id],
            diffDetail: [],
            summary: '措辞变化：须→应'
          },
          {
            matchId: 'm4',
            matchType: 'modified',
            confidence: 0.85,
            similarity: 0.85,
            sourceA: '1.3 投标保证金为合同金额的5%',
            sourceB: '1.3 投标保证金为合同金额的10%',
            nodeIdsA: [docA.blocks[3].id],
            nodeIdsB: [docB.blocks[3].id],
            diffDetail: [],
            summary: '数值变化：5%→10%'
          },
          {
            matchId: 'm5',
            matchType: 'added',
            confidence: 1.0,
            similarity: 1.0,
            sourceA: null,
            sourceB: '1.4 新增条款：投标人需提供信用报告',
            nodeIdsA: [],
            nodeIdsB: [docB.blocks[4].id],
            diffDetail: [],
            summary: '新增条款'
          }
        ]
      },
      annotations: [
        {
          id: 'ann1',
          taskId: 'e2e-test-001',
          matchId: 'm4',
          status: 'important',
          note: '关键条款变更：保证金比例翻倍',
          updatedAt: '2026-07-16T10:48:00.000Z'
        },
        {
          id: 'ann2',
          taskId: 'e2e-test-001',
          matchId: 'm5',
          status: 'needs_review',
          note: '新增条款需要评估',
          updatedAt: '2026-07-16T10:48:30.000Z'
        }
      ]
    };
    
    // 4. 生成报告
    const exportModel: ExportModel = {
      taskId: compareResult.taskId,
      generatedAt: compareResult.diffAst.generatedAt,
      docA: { 
        filename: docA.filename, 
        sha256: docA.sha256, 
        pageCount: docA.pageCount, 
        wordCount: docA.wordCount 
      },
      docB: { 
        filename: docB.filename, 
        sha256: docB.sha256, 
        pageCount: docB.pageCount, 
        wordCount: docB.wordCount 
      },
      options: { 
        mode: 'standard', 
        embeddingProvider: 'local', 
        embeddingModel: 'test', 
        topK: 5, 
        similarityThreshold: 0.45 
      },
      diffAst: compareResult.diffAst,
      annotations: compareResult.annotations
    };
    
    // 5. 测试Markdown报告
    const markdown = renderMarkdownReport(exportModel);
    
    expect(markdown).toContain('# BidLens 比对报告');
    expect(markdown).toContain('基准版投标文件.docx');
    expect(markdown).toContain('比较版投标文件.docx');
    expect(markdown).toContain('第一章 投标须知');
    expect(markdown).toContain('1.4 新增条款：投标人需提供信用报告');
    expect(markdown).toContain('important');
    expect(markdown).toContain('关键条款变更：保证金比例翻倍');
    
    // 6. 测试HTML报告
    const html = renderHtmlReport(exportModel);
    
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('BidLens 比对报告');
    expect(html).toContain('基准版投标文件.docx');
    
    // 7. 验证统计信息
    expect(compareResult.diffAst.summary.identical).toBe(1);
    expect(compareResult.diffAst.summary.modified).toBe(3);
    expect(compareResult.diffAst.summary.added).toBe(1);
    
    // 8. 验证注释
    expect(compareResult.annotations).toHaveLength(2);
    expect(compareResult.annotations[0].status).toBe('important');
    expect(compareResult.annotations[1].status).toBe('needs_review');
  });
  
  // 测试错误处理
  it('should handle malformed XML gracefully', () => {
    const malformedXml = '<w:document><w:body><w:p><w:r><w:t>不完整的XML</w:r></w:p>';
    
    // 应该不会抛出异常
    const doc = parseDocumentXmlToAst(malformedXml, { filename: 'malformed.docx', sha256: 'hash-malformed' });
    
    expect(doc).toBeDefined();
    expect(doc.blocks).toBeDefined();
    expect(Array.isArray(doc.blocks)).toBe(true);
  });
  
  // 测试性能
  it('should handle large documents within reasonable time', () => {
    // 生成一个大文档
    const paragraphs = Array.from({ length: 100 }, (_, i) => 
      `<w:p><w:r><w:t>段落 ${i + 1}: 这是测试内容，用于验证大文档处理能力。</w:t></w:r></w:p>`
    ).join('');
    
    const largeXml = `<w:document><w:body>${paragraphs}</w:body></w:document>`;
    
    const startTime = Date.now();
    const doc = parseDocumentXmlToAst(largeXml, { filename: 'large.docx', sha256: 'hash-large' });
    const endTime = Date.now();
    
    expect(doc.blocks).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
  });
});
