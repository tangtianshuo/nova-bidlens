/**
 * Unit tests for file-validator service (P1-02)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fs/promises using importOriginal pattern for ESM compatibility
vi.mock('fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    access: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  };
});

// Mock the shared module
vi.mock('@bidlens/shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    globalRegistry: {
      findByExtension: vi.fn((ext: string) => {
        const normalized = ext.toLowerCase().replace(/^\./, '');
        if (normalized === 'docx') {
          return { id: 'docx4js', name: 'DOCX Parser' };
        }
        if (normalized === 'pdf') {
          return { id: 'pdf-parser', name: 'PDF Parser' };
        }
        return null;
      }),
    },
  };
});

describe('file-validator', async () => {
  const { validateFile } = await import('./file-validator.js');
  const fs = await import('fs/promises');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns FILE_NOT_FOUND when file does not exist', async () => {
    vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await validateFile('/nonexistent/file.docx');

    expect(result.exists).toBe(false);
    expect(result.readable).toBe(false);
    expect(result.error?.code).toBe('FILE_NOT_FOUND');
  });

  it('returns FILE_UNREADABLE when stat fails', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('EACCES'));

    const result = await validateFile('/protected/file.docx');

    expect(result.exists).toBe(true);
    expect(result.readable).toBe(false);
    expect(result.error?.code).toBe('FILE_UNREADABLE');
  });

  it('returns FILE_TOO_LARGE when file exceeds 100MB', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 200 * 1024 * 1024 } as never);

    const result = await validateFile('/large/file.docx');

    expect(result.exists).toBe(true);
    expect(result.exceedsLimit).toBe(true);
    expect(result.error?.code).toBe('FILE_TOO_LARGE');
  });

  it('returns supported=true for .docx files', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 } as never);
    vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('PK\x03\x04word/document.xml'));

    const result = await validateFile('/test/file.docx');

    expect(result.exists).toBe(true);
    expect(result.readable).toBe(true);
    expect(result.supported).toBe(true);
    expect(result.parserId).toBe('docx4js');
    expect(result.error).toBeUndefined();
  });

  it('returns supported=false for unknown extensions', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 } as never);

    const result = await validateFile('/test/file.xyz');

    expect(result.supported).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('detects encrypted DOCX files', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 } as never);
    vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('EncryptedPackage data'));

    const result = await validateFile('/test/encrypted.docx');

    expect(result.encrypted).toBe(true);
    expect(result.error?.code).toBe('FILE_ENCRYPTED');
  });

  it('returns mineru-parser parserId for PDF when mineruAvailable is true', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 } as never);

    const result = await validateFile('/test/file.pdf', { mineruAvailable: true });

    expect(result.parserId).toBe('mineru-parser');
    expect(result.supported).toBe(true);
    // MinerU supports table extraction
    const tableCap = result.capabilities.find(c => c.dimension === 'table');
    expect(tableCap?.state).toBe('supported');
  });

  it('returns pdf-parser parserId for PDF when mineruAvailable is false', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined as never);
    vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 } as never);

    const result = await validateFile('/test/file.pdf', { mineruAvailable: false });

    expect(result.parserId).toBe('pdf-parser');
    const tableCap = result.capabilities.find(c => c.dimension === 'table');
    expect(tableCap?.state).toBe('degraded');
  });
});
