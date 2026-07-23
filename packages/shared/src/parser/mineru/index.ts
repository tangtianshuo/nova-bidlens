/**
 * MinerU 云端 API 解析器
 * 调用 mineru.net 精准解析 API (v4) 解析 PDF 文档
 * Per D-02: priority=2, canParse 检测扫描版 PDF
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import type { DocumentParser, ParseInput, ParseOptions, ParseResult, ParseWarning } from '../types.js';
import type { DocumentAst, BlockNode } from '../../document-ast.js';
import { mapContentListToAst, type ContentListItem } from './mapper.js';

const MINERU_BATCH_URL = 'https://mineru.net/api/v4/file-urls/batch';
const MINERU_POLL_INTERVAL_MS = 3000;
const MINERU_HARD_TIMEOUT_MS = 300_000; // 5 minutes max
const SCANNED_PDF_CHAR_THRESHOLD = 50;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Retry wrapper with exponential backoff for transient network failures.
 * Only retries on: ECONNRESET, ETIMEDOUT, fetch failed, 429, 503.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err instanceof Error && (
        err.message.includes('ECONNRESET') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('fetch failed') ||
        err.message.includes('429') ||
        err.message.includes('503')
      );
      if (!isRetryable || attempt === MAX_RETRIES) {
        if (err instanceof Error && err.message.includes('fetch failed')) {
          throw Object.assign(err, { code: 'MINERU_OFFLINE' });
        }
        throw err;
      }
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(`[MinerU] ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

/**
 * 检测 PDF 是否为扫描版（文本层极少或为空）
 * 读取前几页文本，平均少于 50 字符/页 → 扫描版
 */
async function isScannedPdf(filePath: string): Promise<boolean> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText({ lineEnforce: false });
    await parser.destroy();

    const pages = result.pages || [];
    const pagesToCheck = pages.slice(0, 3);
    let totalChars = 0;
    for (const page of pagesToCheck) {
      totalChars += (page.text || '').trim().length;
    }

    const avgCharsPerPage = totalChars / Math.max(pagesToCheck.length, 1);
    return avgCharsPerPage < SCANNED_PDF_CHAR_THRESHOLD;
  } catch {
    // pdf-parse failed → cannot determine, assume not scanned
    return false;
  }
}

export class MinerUParser implements DocumentParser {
  readonly id = 'mineru-parser';
  readonly name = 'MinerU 云端解析器';
  readonly supportedExtensions = ['.pdf'];
  readonly mimeTypes = ['application/pdf'];
  readonly priority = 2; // Per D-02: lower than pdf-parse (priority=1)

  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async canParse(input: ParseInput): Promise<boolean> {
    if (!input.fileName.toLowerCase().endsWith('.pdf')) return false;
    // Per D-02: detect scanned PDF — MinerU is the fallback for scanned docs
    return isScannedPdf(input.filePath);
  }

  async parse(input: ParseInput, options: ParseOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: ParseWarning[] = [];
    const { signal } = options;

    try {
      signal?.throwIfAborted();

      // 1. Read file and compute SHA256
      const fileBuffer = await readFile(input.filePath);
      const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

      signal?.throwIfAborted();

      // 2. Upload via batch API and get batch_id
      const batchId = await this.uploadFile(fileBuffer, input.fileName, signal);
      warnings.push({ code: 'MINERU_BATCH', message: `MinerU batch created: ${batchId}`, severity: 'info' });

      signal?.throwIfAborted();

      // 3. Poll until done
      const result = await this.pollBatch(batchId, options.timeout, signal);
      const { fullZipUrl } = result as { fullZipUrl: string };

      signal?.throwIfAborted();

      // 4. Download and extract ZIP
      const contentList = await this.downloadAndParseZip(fullZipUrl, signal);

      // 5. Map to BlockNode[]
      const blocks = mapContentListToAst(contentList);

      // 6. Count words
      const wordCount = this.countWords(blocks);

      // 7. Build DocumentAst
      const ast: DocumentAst = {
        id: sha256,
        filename: input.fileName,
        sha256,
        pageCount: null,
        wordCount,
        parserVersion: 'mineru-api-v4',
        blocks,
      };

      return {
        success: true,
        ast,
        warnings,
        duration: Date.now() - startTime,
        parserId: this.id,
      };
    } catch (error) {
      const errorCode = (error as { code?: string })?.code ?? 'MINERU_ERROR';
      const friendlyMessages: Record<string, string> = {
        AUTH_EXPIRED: 'MinerU API 认证失败，请检查 Token 是否过期',
        MINERU_TIMEOUT: 'MinerU 解析超时（5分钟），请稍后重试',
        MINERU_OFFLINE: '此文件需要云端解析，请检查网络连接',
        RATE_LIMITED: 'MinerU API 请求过于频繁，请稍后重试',
      };
      return {
        success: false,
        warnings,
        duration: Date.now() - startTime,
        parserId: this.id,
        error: {
          code: errorCode,
          message: friendlyMessages[errorCode] ?? (error instanceof Error ? error.message : '未知 MinerU 错误'),
        },
      };
    }
  }

  /**
   * Upload file via batch API → get signed URL → PUT file
   */
  private async uploadFile(fileBuffer: Buffer, fileName: string, signal?: AbortSignal): Promise<string> {
    // Step 1: Get signed upload URL
    const urlRes = await withRetry(() => fetch(MINERU_BATCH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [{ name: fileName, data_id: fileName }],
        model_version: 'pipeline',
      }),
      signal,
    }), 'batch upload');

    if (urlRes.status === 401) {
      throw Object.assign(new Error('MinerU API 认证失败，请检查 Token 是否过期'), { code: 'AUTH_EXPIRED' });
    }
    if (!urlRes.ok) {
      throw new Error(`MinerU batch URL error ${urlRes.status}: ${await urlRes.text()}`);
    }

    const urlData = await urlRes.json() as {
      code: number;
      msg: string;
      data: { batch_id: string; file_urls: string[] };
    };

    if (urlData.code !== 0) {
      throw new Error(`MinerU batch URL failed: ${urlData.msg}`);
    }

    // Step 2: PUT file to signed URL (no Content-Type header per research)
    const putRes = await withRetry(() => fetch(urlData.data.file_urls[0], {
      method: 'PUT',
      body: new Uint8Array(fileBuffer),
      signal,
    }), 'file upload');

    if (!putRes.ok) {
      throw new Error(`MinerU file upload failed: ${putRes.status}`);
    }

    return urlData.data.batch_id;
  }

  /**
   * Poll batch status until complete or failed
   */
  private async pollBatch(batchId: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
    const effectiveTimeout = timeoutMs > 0 ? Math.min(timeoutMs, MINERU_HARD_TIMEOUT_MS) : MINERU_HARD_TIMEOUT_MS;
    const deadline = Date.now() + effectiveTimeout;

    while (Date.now() < deadline) {
      signal?.throwIfAborted();

      const res = await fetch(`https://mineru.net/api/v4/extract-results/batch/${batchId}`, {
        headers: { 'Authorization': `Bearer ${this.apiToken}` },
        signal,
      });

      if (res.status === 401) {
        throw Object.assign(new Error('MinerU API 认证失败，请检查 Token 是否过期'), { code: 'AUTH_EXPIRED' });
      }
      if (!res.ok) {
        throw new Error(`MinerU poll error ${res.status}`);
      }

      const data = await res.json() as {
        code: number;
        data: {
          extract_result: Array<{
            state: string;
            full_zip_url?: string;
            err_msg?: string;
          }>;
        };
      };

      const result = data.data.extract_result?.[0];
      if (!result) throw new Error('MinerU: no extract_result in response');

      if (result.state === 'done') {
        return { fullZipUrl: result.full_zip_url };
      }

      if (result.state === 'failed') {
        throw new Error(`MinerU task failed: ${result.err_msg ?? 'unknown'}`);
      }

      // pending/running → wait
      signal?.throwIfAborted();
      await new Promise(r => setTimeout(r, MINERU_POLL_INTERVAL_MS));
    }

    throw Object.assign(new Error('MinerU 解析超时（5分钟），请稍后重试'), { code: 'MINERU_TIMEOUT' });
  }

  /**
   * Download ZIP, extract *_content_list.json, parse it
   */
  private async downloadAndParseZip(zipUrl: string, signal?: AbortSignal): Promise<ContentListItem[]> {
    const res = await withRetry(() => fetch(zipUrl, { signal }), 'ZIP download');
    if (!res.ok) throw new Error(`MinerU ZIP download failed: ${res.status}`);

    const zipBuffer = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBuffer);

    // Find *_content_list.json (not v2)
    const entry = Object.keys(zip.files).find(
      n => n.includes('content_list.json') && !n.includes('v2')
    );

    if (!entry) {
      throw new Error('MinerU: content_list.json not found in ZIP');
    }

    const json = await zip.file(entry)!.async('string');
    return JSON.parse(json) as ContentListItem[];
  }

  private countWords(blocks: BlockNode[]): number {
    const countText = (text: string): number => {
      const cn = (text.match(/[一-鿿]/g) || []).length;
      const en = text.replace(/[一-鿿]/g, '').split(/\s+/).filter(w => w.length > 0).length;
      return cn + en;
    };

    let total = 0;
    for (const block of blocks) {
      switch (block.type) {
        case 'paragraph':
          total += countText(block.text);
          break;
        case 'table':
          total += block.rows.flat().reduce((s, c) => s + countText(c), 0);
          break;
        case 'section':
          total += countText(block.title);
          total += this.countWords(block.children);
          break;
        case 'list':
          total += block.items.reduce((s, p) => s + countText(p.text), 0);
          break;
      }
    }
    return total;
  }
}
