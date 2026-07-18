/**
 * File validation and capability inspection service (P1-02)
 * Validates existence, readability, extension, size, encryption
 * Detects capabilities based on parser output
 */

import path from 'node:path';
import type {
  FileValidationResult,
  CapabilityResult,
  ComparisonDimension,
  StructuredError,
} from '@bidlens/shared';
import { createError } from '@bidlens/shared';
import { globalRegistry } from '@bidlens/shared';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Detect if a file is encrypted by checking for encryption markers in .docx/.pdf
 */
async function detectEncryption(filePath: string, ext: string): Promise<boolean> {
  try {
    const { readFile } = await import('fs/promises');
    const buffer = await readFile(filePath);

    if (ext === 'docx') {
      // DOCX encryption: check for standard encryption info stream
      // Encrypted DOCX files have a different structure - check for encryption descriptor
      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 4096));
      // Encrypted OOXML files contain EncryptedPackage instead of word/document.xml
      return content.includes('EncryptedPackage') || content.includes('E n c r y p t i o n');
    }

    if (ext === 'pdf') {
      // PDF encryption: look for /Encrypt dictionary
      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 8192));
      return content.includes('/Encrypt');
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Detect capabilities based on file extension and parser metadata
 */
function detectCapabilities(ext: string, parserId?: string): CapabilityResult[] {
  const dimensions: ComparisonDimension[] = ['content', 'table', 'format', 'comment', 'revision'];

  return dimensions.map((dimension) => {
    // Content is always supported if we have a parser
    if (dimension === 'content') {
      return { dimension, state: 'supported' as const };
    }

    // Table support depends on parser
    if (dimension === 'table') {
      if (parserId === 'docx4js') {
        return { dimension, state: 'supported' as const };
      }
      if (parserId === 'pdf-parser') {
        // PDF tables are harder to extract, degrade
        return { dimension, state: 'degraded' as const, reason: 'PDF表格提取精度有限' };
      }
      return { dimension, state: 'unsupported' as const, reason: '无可用解析器' };
    }

    // Format diff
    if (dimension === 'format') {
      if (parserId === 'docx4js') {
        return { dimension, state: 'supported' as const };
      }
      return { dimension, state: 'unsupported' as const, reason: '格式比对仅支持DOCX' };
    }

    // Comments
    if (dimension === 'comment') {
      if (parserId === 'docx4js') {
        return { dimension, state: 'supported' as const };
      }
      return { dimension, state: 'unsupported' as const, reason: '批注提取仅支持DOCX' };
    }

    // Revisions
    if (dimension === 'revision') {
      if (parserId === 'docx4js') {
        return { dimension, state: 'supported' as const };
      }
      return { dimension, state: 'unsupported' as const, reason: '修订记录仅支持DOCX' };
    }

    return { dimension, state: 'unsupported' as const };
  });
}

/**
 * Validate a single file and detect its capabilities
 */
export async function validateFile(filePath: string): Promise<FileValidationResult> {
  const { access, stat } = await import('fs/promises');
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const warnings: string[] = [];

  // Check existence
  try {
    await access(filePath);
  } catch {
    return {
      exists: false,
      readable: false,
      extension: ext,
      supported: false,
      sizeBytes: 0,
      exceedsLimit: false,
      encrypted: false,
      capabilities: [],
      warnings,
      error: createError('FILE_NOT_FOUND', `文件不存在: ${filePath}`, { retryable: false }),
    };
  }

  // Check readability and size
  let sizeBytes = 0;
  try {
    const fileStat = await stat(filePath);
    sizeBytes = fileStat.size;
  } catch {
    return {
      exists: true,
      readable: false,
      extension: ext,
      supported: false,
      sizeBytes: 0,
      exceedsLimit: false,
      encrypted: false,
      capabilities: [],
      warnings,
      error: createError('FILE_UNREADABLE', `文件无法读取: ${filePath}`, { retryable: false }),
    };
  }

  // Check size limit
  const exceedsLimit = sizeBytes > MAX_FILE_SIZE_BYTES;
  if (exceedsLimit) {
    return {
      exists: true,
      readable: true,
      extension: ext,
      supported: false,
      sizeBytes,
      exceedsLimit: true,
      encrypted: false,
      capabilities: [],
      warnings,
      error: createError('FILE_TOO_LARGE', `文件超过100MB限制: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB`, { retryable: false }),
    };
  }

  // Check if parser exists for this extension
  const parser = globalRegistry.findByExtension(ext);
  const supported = parser !== null;
  const parserId = parser?.id;

  if (!supported) {
    warnings.push(`不支持的文件格式: .${ext}`);
  }

  // Check encryption
  const encrypted = supported ? await detectEncryption(filePath, ext) : false;
  if (encrypted) {
    return {
      exists: true,
      readable: true,
      extension: ext,
      supported,
      sizeBytes,
      exceedsLimit: false,
      encrypted: true,
      capabilities: [],
      parserId,
      warnings,
      error: createError('FILE_ENCRYPTED', `文件已加密: ${filePath}`, { retryable: false }),
    };
  }

  // Detect capabilities
  const capabilities = detectCapabilities(ext, parserId);

  return {
    exists: true,
    readable: true,
    extension: ext,
    supported,
    sizeBytes,
    exceedsLimit: false,
    encrypted: false,
    capabilities,
    parserId,
    warnings,
  };
}
