import { describe, expect, it, vi } from 'vitest';
import { Docx4jsParser, docx4jsParser } from './index.js';

describe('Docx4jsParser', () => {
  const parser = new Docx4jsParser();

  describe('canParse', () => {
    it('should return true for .docx files', async () => {
      const result = await parser.canParse({
        filePath: '/test/document.docx',
        fileName: 'document.docx',
        fileSize: 1024
      });
      expect(result).toBe(true);
    });

    it('should return false for non-docx files', async () => {
      const result = await parser.canParse({
        filePath: '/test/document.pdf',
        fileName: 'document.pdf',
        fileSize: 1024
      });
      expect(result).toBe(false);
    });

    it('should be case insensitive', async () => {
      const result = await parser.canParse({
        filePath: '/test/document.DOCX',
        fileName: 'document.DOCX',
        fileSize: 1024
      });
      expect(result).toBe(true);
    });
  });

  describe('parser properties', () => {
    it('should have correct id', () => {
      expect(parser.id).toBe('docx4js');
    });

    it('should have correct name', () => {
      expect(parser.name).toBe('docx4js Parser');
    });

    it('should support .docx extension', () => {
      expect(parser.supportedExtensions).toContain('.docx');
    });

    it('should have correct mime type', () => {
      expect(parser.mimeTypes).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('should have priority 1', () => {
      expect(parser.priority).toBe(1);
    });
  });

  describe('exported instance', () => {
    it('should export a singleton instance', () => {
      expect(docx4jsParser).toBeInstanceOf(Docx4jsParser);
      expect(docx4jsParser.id).toBe('docx4js');
    });
  });

  describe('docx4js render tree compatibility', () => {
    it('extracts nested text from rendered children', () => {
      const rendered = [{
        type: 'r',
        props: {},
        children: [{ type: 't', props: {}, children: ['合同金额', '658000元'] }],
      }];

      expect((parser as unknown as { extractText: (value: unknown) => string }).extractText(rendered))
        .toBe('合同金额658000元');
    });

    it('recognizes paragraphs nested inside tables', () => {
      const table = { name: 'w:tbl', parent: null };
      const cell = { name: 'w:tc', parent: table };
      const paragraph = { name: 'w:p', parent: cell };

      expect((parser as unknown as { isInsideTable: (value: unknown) => boolean })
        .isInsideTable(paragraph)).toBe(true);
    });
  });
});
