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
});
