import { describe, expect, it, vi, beforeEach } from 'vitest';
import { splitIntoParagraphs, parsePdf } from './pdf-parser.js';

// Mock pdf-parse module
vi.mock('pdf-parse', () => {
  return {
    PDFParse: vi.fn().mockImplementation(() => ({
      getText: vi.fn().mockResolvedValue({
        pages: [{ num: 1, text: 'test content' }],
        text: 'test content',
        total: 1,
        getPageText: vi.fn().mockReturnValue('test content'),
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('splitIntoParagraphs', () => {
  it('should return empty array for empty string', () => {
    expect(splitIntoParagraphs('')).toEqual([]);
  });

  it('should return empty array for whitespace only', () => {
    expect(splitIntoParagraphs('   \n  \n  ')).toEqual([]);
  });

  it('should return single paragraph for text without empty lines', () => {
    const text = 'Hello World\nSecond line\nThird line';
    const result = splitIntoParagraphs(text);
    expect(result).toEqual(['Hello World\nSecond line\nThird line']);
  });

  it('should split by double empty lines', () => {
    const text = 'Paragraph 1\n\n\nParagraph 2\n\n\nParagraph 3';
    const result = splitIntoParagraphs(text);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Paragraph 1');
    expect(result[1]).toBe('Paragraph 2');
    expect(result[2]).toBe('Paragraph 3');
  });

  it('should keep single empty lines within paragraph', () => {
    const text = 'Line 1\n\nLine 2\n\n\nNew Paragraph';
    const result = splitIntoParagraphs(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Line 1\n\nLine 2');
    expect(result[1]).toBe('New Paragraph');
  });

  it('should handle Windows line endings (CRLF)', () => {
    const text = 'Para 1\r\n\r\n\r\nPara 2';
    const result = splitIntoParagraphs(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Para 1');
    expect(result[1]).toBe('Para 2');
  });

  it('should trim whitespace from paragraphs', () => {
    const text = '  Paragraph 1  \n\n\n  Paragraph 2  ';
    const result = splitIntoParagraphs(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Paragraph 1');
    expect(result[1]).toBe('Paragraph 2');
  });

  it('should handle single line text', () => {
    const text = 'Single line text';
    const result = splitIntoParagraphs(text);
    expect(result).toEqual(['Single line text']);
  });
});

describe('parsePdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse PDF and return DocumentAst', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [
        { num: 1, text: 'Page 1 paragraph 1\n\n\nPage 1 paragraph 2' },
        { num: 2, text: 'Page 2 content' },
      ],
      text: 'Page 1 paragraph 1Page 1 paragraph 2Page 2 content',
      total: 2,
      getPageText: vi.fn().mockReturnValue(''),
    });
    const mockDestroy = vi.fn().mockResolvedValue(undefined);

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: mockDestroy,
    }));

    const data = Buffer.from('test pdf content');
    const result = await parsePdf(data, 'test.pdf');

    expect(result.filename).toBe('test.pdf');
    expect(result.pageCount).toBe(2);
    expect(result.parserVersion).toBe('pdf-1.0.0');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[0].type).toBe('paragraph');
    expect((result.blocks[0] as any).text).toBe('Page 1 paragraph 1');
    expect(result.blocks[0].pageStart).toBe(1);
    expect((result.blocks[1] as any).text).toBe('Page 1 paragraph 2');
    expect(result.blocks[1].pageStart).toBe(1);
    expect((result.blocks[2] as any).text).toBe('Page 2 content');
    expect(result.blocks[2].pageStart).toBe(2);
  });

  it('should handle empty text', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: '' }],
      text: '',
      total: 1,
      getPageText: vi.fn().mockReturnValue(''),
    });

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    const data = Buffer.from('empty pdf');
    const result = await parsePdf(data, 'empty.pdf');

    expect(result.filename).toBe('empty.pdf');
    expect(result.pageCount).toBe(1);
    expect(result.blocks).toHaveLength(0);
    expect(result.wordCount).toBe(0);
  });

  it('should count Chinese characters correctly', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: '你好世界 这是测试' }],
      text: '你好世界 这是测试',
      total: 1,
      getPageText: vi.fn().mockReturnValue(''),
    });

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    const data = Buffer.from('test');
    const result = await parsePdf(data, 'chinese.pdf');

    // 8个中文字符 (你好世界这是测试) + 0个英文单词
    expect(result.wordCount).toBe(8);
  });

  it('should count mixed content correctly', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: '这是的测试 Hello World' }],
      text: '这是的测试 Hello World',
      total: 1,
      getPageText: vi.fn().mockReturnValue(''),
    });

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    const data = Buffer.from('test');
    const result = await parsePdf(data, 'mixed.pdf');

    // 5个中文字符 (这是的测试) + 2个英文单词 (Hello, World)
    expect(result.wordCount).toBe(7);
  });

  it('should generate unique node IDs', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: 'Para 1\n\n\nPara 2\n\n\nPara 3' }],
      text: 'Para 1Para 2Para 3',
      total: 1,
      getPageText: vi.fn().mockReturnValue(''),
    });

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    const data = Buffer.from('test');
    const result = await parsePdf(data, 'test.pdf');

    const ids = result.blocks.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should generate consistent SHA-256 hash', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: 'test' }],
      text: 'test',
      total: 1,
      getPageText: vi.fn().mockReturnValue(''),
    });

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    const data = Buffer.from('consistent data');
    const result1 = await parsePdf(data, 'test.pdf');
    const result2 = await parsePdf(data, 'test.pdf');

    expect(result1.sha256).toBe(result2.sha256);
  });

  it('should handle Uint8Array input', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: 'test' }],
      text: 'test',
      total: 1,
      getPageText: vi.fn().mockReturnValue(''),
    });

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    const data = new Uint8Array([1, 2, 3, 4]);
    const result = await parsePdf(data, 'test.pdf');

    expect(result.filename).toBe('test.pdf');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should call PDFParse with correct parameters', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockGetText = vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: 'test content' }],
      text: 'test content',
      total: 1,
      getPageText: vi.fn().mockReturnValue(''),
    });
    const mockDestroy = vi.fn().mockResolvedValue(undefined);

    (PDFParse as any).mockImplementation(() => ({
      getText: mockGetText,
      destroy: mockDestroy,
    }));

    const data = Buffer.from('test pdf');
    await parsePdf(data, 'test.pdf');

    expect(PDFParse).toHaveBeenCalledWith({
      data: expect.any(Uint8Array),
    });
    expect(mockGetText).toHaveBeenCalledWith({
      lineEnforce: true,
      lineThreshold: 4.6,
      cellSeparator: '\t',
    });
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('should call destroy even if getText throws', async () => {
    const { PDFParse } = await import('pdf-parse');
    const mockDestroy = vi.fn().mockResolvedValue(undefined);

    (PDFParse as any).mockImplementation(() => ({
      getText: vi.fn().mockRejectedValue(new Error('Parse error')),
      destroy: mockDestroy,
    }));

    const data = Buffer.from('test');

    await expect(parsePdf(data, 'test.pdf')).rejects.toThrow('Parse error');
    expect(mockDestroy).toHaveBeenCalled();
  });
});

