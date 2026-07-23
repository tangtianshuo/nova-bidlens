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

export function isMinerUAvailable(): boolean {
  return !!(mineruConfig?.getToken() || process.env.MINERU_API_TOKEN);
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

// Concurrency limiter for MinerU cloud API (max 2 concurrent)
let mineruInFlight = 0;
const MINERU_MAX_CONCURRENT = 2;
const mineruQueue: Array<() => void> = [];

function acquireMinerUSlot(): Promise<void> {
  if (mineruInFlight < MINERU_MAX_CONCURRENT) {
    mineruInFlight++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => { mineruQueue.push(resolve); });
}

function releaseMinerUSlot(): void {
  const next = mineruQueue.shift();
  if (next) {
    next();
  } else {
    mineruInFlight--;
  }
}

/** Quick DNS check for MinerU cloud availability */
async function isOnline(): Promise<boolean> {
  try {
    const { lookup } = await import('node:dns/promises');
    await lookup('mineru.net');
    return true;
  } catch {
    return false;
  }
}

export interface ParserServiceOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Timeout in ms (0 = no timeout) */
  timeoutMs?: number;
  /** Progress callback for long-running parses (e.g. MinerU cloud) */
  onProgress?: (stageLabel: string) => void;
}

/**
 * Parse a document file using the appropriate parser from the registry.
 * Supports cancellation via AbortSignal and timeout.
 */
/** Wrap MinerU parse with offline detection, concurrency limit, and 401 cache reset */
async function parseWithMinerU(mineru: MinerUParser, input: ParseInput, options: ParseOptions, opts?: ParserServiceOptions): Promise<ParseResult> {
  // UX-03: Check network before cloud parse
  if (!(await isOnline())) {
    return {
      success: false, warnings: [], duration: 0, parserId: 'mineru-parser',
      error: { code: 'MINERU_OFFLINE', message: '此文件需要云端解析，请检查网络连接' },
    };
  }

  // UX-01: Progress timer for long MinerU cloud parses
  const parseStart = Date.now();
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  if (opts?.onProgress) {
    progressTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - parseStart) / 1000);
      opts.onProgress!(`MinerU 解析中 (已等待 ${elapsed}s)`);
    }, 1000);
  }

  // UX-05: Acquire concurrency slot
  await acquireMinerUSlot();
  try {
    const result = await mineru.parse(input, options);
    // UX-02: Reset cached parser on 401 so next attempt gets fresh token
    if (!result.success && result.error?.code === 'AUTH_EXPIRED') {
      log.warn('[Parser] MinerU auth expired, clearing cached parser instance');
      resetMinerUParser();
    }
    return result;
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    releaseMinerUSlot();
  }
}

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
    signal: opts?.signal,
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
        return parseWithMinerU(mineru, input, options, opts);
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
        return parseWithMinerU(mineru, input, options, opts);
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
