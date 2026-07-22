/**
 * 解析器模块入口
 * 导出所有解析器和注册中心
 */

// 导出类型
export type { DocumentParser, ParseInput, ParseOptions, ParseResult, ParseWarning } from './types.js';

// 导出批注和修订类型
export type { ParsedComment } from './docx-comments.js';
export type { ParsedRevision, TextFormat } from './docx-revisions.js';

// 导出注册中心
export { ParserRegistry, globalRegistry } from './registry.js';

// 导出解析器
export { Docx4jsParser, docx4jsParser } from './docx/index.js';
export { PdfParser, pdfParser } from './pdf/index.js';
export { NzbtfParser, nzbtfParser } from './nzbtf/index.js';

// 导出便捷解析函数
import { globalRegistry } from './registry.js';
import type { ParseInput, ParseOptions, ParseResult } from './types.js';

/**
 * 解析文档
 * 自动选择合适的解析器
 */
export async function parseDocument(
  input: ParseInput,
  options: ParseOptions = {
    fidelityLevel: 3,
    extractComments: true,
    extractRevisions: true,
    extractImages: false,
    maxPages: 0,
    timeout: 0
  }
): Promise<ParseResult> {
  const parser = await globalRegistry.findForInput(input);
  if (!parser) {
    return {
      success: false,
      warnings: [],
      duration: 0,
      parserId: 'none',
      error: {
        code: 'NO_PARSER',
        message: `No parser found for file: ${input.fileName}`
      }
    };
  }
  return parser.parse(input, options);
}

// 注册默认解析器
import { docx4jsParser } from './docx/index.js';
import { pdfParser } from './pdf/index.js';
import { nzbtfParser } from './nzbtf/index.js';
globalRegistry.register(docx4jsParser);
globalRegistry.register(pdfParser);
globalRegistry.register(nzbtfParser);
