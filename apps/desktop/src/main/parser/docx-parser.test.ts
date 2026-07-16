import { describe, expect, it } from 'vitest';
import { parseDocumentXmlToAst } from './docx-parser';

describe('parseDocumentXmlToAst', () => {
  it('extracts paragraphs with stable node ids', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>投标人应提供营业执照</w:t></w:r></w:p></w:body></w:document>';
    const ast = parseDocumentXmlToAst(xml, { filename: 'a.docx', sha256: 'hash-a' });

    expect(ast.blocks).toHaveLength(1);
    expect(ast.blocks[0]).toMatchObject({ type: 'paragraph', id: 'p-1', text: '投标人应提供营业执照' });
  });
});
