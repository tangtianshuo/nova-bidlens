import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectPdfType, type PdfType } from './pdf-type-detector.js';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: vi.fn().mockResolvedValue({
      pages: [{ num: 1, text: 'A'.repeat(100) }],
      total: 1,
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-data')),
}));

describe('detectPdfType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "digital" when avg chars/page >= 50', async () => {
    const { PDFParse } = await import('pdf-parse');
    vi.mocked(PDFParse).mockImplementation(() => ({
      getText: vi.fn().mockResolvedValue({
        pages: [
          { num: 1, text: 'A'.repeat(80) },
          { num: 2, text: 'B'.repeat(80) },
          { num: 3, text: 'C'.repeat(80) },
        ],
        total: 3,
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    }) as any);

    const result = await detectPdfType('/test/digital.pdf');
    expect(result).toBe('digital');
  });

  it('returns "scanned" when avg chars/page < 50', async () => {
    const { PDFParse } = await import('pdf-parse');
    vi.mocked(PDFParse).mockImplementation(() => ({
      getText: vi.fn().mockResolvedValue({
        pages: [
          { num: 1, text: 'AB' },
          { num: 2, text: 'CD' },
          { num: 3, text: '' },
        ],
        total: 3,
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    }) as any);

    const result = await detectPdfType('/test/scanned.pdf');
    expect(result).toBe('scanned');
  });

  it('returns "unknown" when pdf-parse throws', async () => {
    const { PDFParse } = await import('pdf-parse');
    vi.mocked(PDFParse).mockImplementation(() => ({
      getText: vi.fn().mockRejectedValue(new Error('corrupted PDF')),
      destroy: vi.fn().mockResolvedValue(undefined),
    }) as any);

    const result = await detectPdfType('/test/corrupted.pdf');
    expect(result).toBe('unknown');
  });

  it('returns "unknown" when no pages returned', async () => {
    const { PDFParse } = await import('pdf-parse');
    vi.mocked(PDFParse).mockImplementation(() => ({
      getText: vi.fn().mockResolvedValue({
        pages: [],
        total: 0,
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    }) as any);

    const result = await detectPdfType('/test/empty.pdf');
    expect(result).toBe('unknown');
  });
});
