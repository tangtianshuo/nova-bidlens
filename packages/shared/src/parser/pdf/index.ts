/**
 * PDF 解析器适配器
 * 将现有的 pdf-parser 封装为 DocumentParser 接口
 */

import { readFile } from 'fs/promises';
import type { DocumentParser, ParseInput, ParseOptions, ParseResult, ParseWarning } from '../types.js';
import { parsePdf } from '../pdf-parser.js';

export class PdfParser implements DocumentParser {
  readonly id = 'pdf-parser';
  readonly name = 'PDF Parser';
  readonly supportedExtensions = ['.pdf'];
  readonly mimeTypes = ['application/pdf'];
  readonly priority = 1;

  async canParse(input: ParseInput): Promise<boolean> {
    return input.fileName.toLowerCase().endsWith('.pdf');
  }

  async parse(input: ParseInput, options: ParseOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: ParseWarning[] = [];

    try {
      const fileBuffer = await readFile(input.filePath);
      const ast = await parsePdf(fileBuffer, input.fileName);

      return {
        success: true,
        ast,
        warnings,
        duration: Date.now() - startTime,
        parserId: this.id
      };
    } catch (error) {
      return {
        success: false,
        warnings,
        duration: Date.now() - startTime,
        parserId: this.id,
        error: {
          code: 'PARSE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// 导出解析器实例
export const pdfParser = new PdfParser();
