/**
 * Parser service (P1-03, P1-04, P1-05)
 * Wire DOCX/PDF parsers into main process with cancellation and timeout
 */

import path from 'node:path';
import type { ParseInput, ParseOptions, ParseResult } from '@bidlens/shared';
import { globalRegistry, detectPdfType, MinerUParser } from '@bidlens/shared';
import { log } from '../logger';
import type { MineruConfigService } from './mineru-config';

// Lazy-init MinerU parser instance (needs API token)
let mineruParserInstance: MinerUParser | null = null;
let mineruConfig: MineruConfigService | null = null;

export function setMineruConfigService(config: MineruConfigService): void {
  mineruConfig = config;
}

export function resetMinerUParser(): void {
  mineruParserInstance = null;
}

function getMinerUParser(): MinerUParser | null {
  if (!mineruParserInstance) {
    const token = mineruConfig?.getToken() ?? process.env.MINERU_API_TOKEN;
    if (token) {
      mineruParserInstance = new MinerUParser(token);
    }
  }
  return mineruParserInstance;
}

const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds

export interface ParserServiceOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Timeout in ms (0 = no timeout) */
  timeoutMs?: number;
}

/**
 * Parse a document file using the appropriate parser from the registry.
 * Supports cancellation via AbortSignal and timeout.
 */
export async function parseDocumentFile(
  filePath: string,
  opts?: ParserServiceOptions
): Promise<ParseResult> {
  const fileName = path.basename(filePath);
  const { stat } = await import('fs/promises');
  const fileStat = await stat(filePath);

  log.info('[Parser] Parsing file:', fileName, 'size:', fileStat.size, 'bytes');

  const input: ParseInput = {
    filePath,
    fileName,
    fileSize: fileStat.size,
  };

  const parser = await globalRegistry.findForInput(input);
  if (!parser) {
    log.warn('[Parser] No parser found for file:', fileName);
    return {
      success: false,
      warnings: [],
      duration: 0,
      parserId: 'none',
      error: {
        code: 'UNSUPPORTED_FORMAT',
        message: `No parser found for file: ${fileName}`,
      },
    };
  }

  const options: ParseOptions = {
    fidelityLevel: 3,
    extractComments: true,
    extractRevisions: true,
    extractImages: false,
    maxPages: 0,
    timeout: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };

  // PDF fallback strategy (per D-03): detect type → route accordingly
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') {
    const pdfType = await detectPdfType(filePath);
    log.info('[Parser] PDF type detected:', pdfType, 'for', fileName);

    if (pdfType === 'scanned') {
      // Scanned PDF → try MinerU directly (pdf-parse can't OCR)
      const mineru = getMinerUParser();
      if (mineru) {
        return mineru.parse(input, options);
      }
      log.warn('[Parser] Scanned PDF but no MinerU parser available, falling back to pdf-parse');
    }

    // Digital PDF or no MinerU → use pdf-parse (priority=1)
    const result = await parser.parse(input, options);

    // Per D-03: pdf-parse fails → fallback to MinerU (but not for scanned, already tried)
    if (!result.success && pdfType !== 'scanned') {
      const mineru = getMinerUParser();
      if (mineru) {
        log.info('[Parser] pdf-parse failed, falling back to MinerU for:', fileName);
        return mineru.parse(input, options);
      }
    }

    return result;
  }

  // If signal is already aborted, return immediately
  if (opts?.signal?.aborted) {
    return {
      success: false,
      warnings: [],
      duration: 0,
      parserId: parser.id,
      error: {
        code: 'TASK_CANCELLED',
        message: 'Parse cancelled before start',
      },
    };
  }

  // Create a promise that resolves with the parse result
  const parsePromise = parser.parse(input, options);

  // If no timeout and no signal, just return the parse result
  if (!opts?.timeoutMs && !opts?.signal) {
    return parsePromise;
  }

  // Build the race promises
  const races: Promise<ParseResult>[] = [parsePromise];

  // Timeout race
  if (opts?.timeoutMs && opts.timeoutMs > 0) {
    const timeoutPromise = new Promise<ParseResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          success: false,
          warnings: [],
          duration: opts.timeoutMs!,
          parserId: parser.id,
          error: {
            code: 'PARSE_ERROR',
            message: `解析超时 (${opts.timeoutMs}ms)`,
          },
        });
      }, opts.timeoutMs);
      // Allow timer to not keep process alive
      timer.unref();
    });
    races.push(timeoutPromise);
  }

  // Cancellation race
  if (opts?.signal) {
    const cancelPromise = new Promise<ParseResult>((resolve) => {
      const onAbort = () => {
        resolve({
          success: false,
          warnings: [],
          duration: 0,
          parserId: parser.id,
          error: {
            code: 'TASK_CANCELLED',
            message: 'Parse cancelled',
          },
        });
      };
      opts.signal!.addEventListener('abort', onAbort, { once: true });
    });
    races.push(cancelPromise);
  }

  return Promise.race(races);
}
