/**
 * Unit tests for parser-service (P1-03, P1-04, P1-05)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fs/promises using importOriginal pattern for ESM compatibility
vi.mock('fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
  };
});

// Mock the shared module
vi.mock('@bidlens/shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    globalRegistry: {
      findForInput: vi.fn().mockResolvedValue({
        id: 'docx4js',
        name: 'docx4js Parser',
        supportedExtensions: ['.docx'],
        mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        priority: 1,
        canParse: vi.fn().mockResolvedValue(true),
        parse: vi.fn().mockResolvedValue({
          success: true,
          ast: { id: 'test', blocks: [] },
          warnings: [],
          duration: 100,
          parserId: 'docx4js',
        }),
      }),
    },
  };
});

describe('parser-service', async () => {
  const { parseDocumentFile } = await import('./parser-service.js');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parse result for supported file', async () => {
    const result = await parseDocumentFile('/test/file.docx');

    expect(result.success).toBe(true);
    expect(result.parserId).toBe('docx4js');
  });

  it('returns UNSUPPORTED_FORMAT when no parser found', async () => {
    const { globalRegistry } = await import('@bidlens/shared');
    vi.mocked(globalRegistry.findForInput).mockResolvedValueOnce(null);

    const result = await parseDocumentFile('/test/file.xyz');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('returns TASK_CANCELLED when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await parseDocumentFile('/test/file.docx', {
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TASK_CANCELLED');
  });

  it('returns TASK_CANCELLED when signal is aborted during parse', async () => {
    const { globalRegistry } = await import('@bidlens/shared');
    const controller = new AbortController();

    // Make the parser hang until we abort
    vi.mocked(globalRegistry.findForInput).mockResolvedValueOnce({
      id: 'docx4js',
      name: 'docx4js Parser',
      supportedExtensions: ['.docx'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      priority: 1,
      canParse: vi.fn().mockResolvedValue(true),
      parse: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                ast: { id: 'test', blocks: [] },
                warnings: [],
                duration: 100,
                parserId: 'docx4js',
              });
            }, 5000);
          })
      ),
    });

    // Abort after a short delay
    setTimeout(() => controller.abort(), 50);

    const result = await parseDocumentFile('/test/file.docx', {
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TASK_CANCELLED');
  });
});
