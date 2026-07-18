/**
 * PDF 文本解析器
 * 
 * 将 PDF 文档解析为标准 DocumentAst 格式。
 * 支持逐页提取文本、段落分割，并保留页面信息。
 */

import { PDFParse } from 'pdf-parse';
import { createHash } from 'crypto';
import type { DocumentAst, BlockNode, ParagraphNode } from '../document-ast.js';

/** PDF 解析器版本 */
const PARSER_VERSION = 'pdf-1.0.0';

/** 段落检测阈值：连续空行数达到此值时认为是新段落 */
const PARAGRAPH_SEPARATOR_THRESHOLD = 2;

/**
 * 生成唯一节点 ID
 */
function generateNodeId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * 计算 Buffer 的 SHA-256 哈希
 */
function computeSha256(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 将文本按段落分割
 * 
 * 使用连续空行作为段落分隔符。
 * 如果文本中没有明显的段落分割，则将整个文本作为一个段落。
 * 
 * @param text - 原始文本
 * @returns 段落数组
 */
export function splitIntoParagraphs(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 按换行符分割
  const lines = text.split(/\r?\n/);
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  let emptyLineCount = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.length === 0) {
      // 空行
      emptyLineCount++;
      
      // 如果连续空行达到阈值，且当前有累积的段落内容，则保存为段落
      if (emptyLineCount >= PARAGRAPH_SEPARATOR_THRESHOLD && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join('\n').trim());
        currentParagraph = [];
      }
    } else {
      // 非空行
      // 如果之前有单个空行（不是段落分隔），保留换行
      if (emptyLineCount === 1 && currentParagraph.length > 0) {
        currentParagraph.push('');
      }
      emptyLineCount = 0;
      currentParagraph.push(trimmedLine);
    }
  }

  // 处理最后一段
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join('\n').trim());
  }

  // 如果没有检测到段落分割，但有文本内容，返回整个文本作为一个段落
  if (paragraphs.length === 0 && text.trim().length > 0) {
    paragraphs.push(text.trim());
  }

  return paragraphs;
}

/**
 * 统计文本字数
 */
function countWords(text: string): number {
  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  // 统计英文单词（去除中文字符后按空格分割）
  const englishWords = text
    .replace(/[\u4e00-\u9fff]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  return chineseChars + englishWords;
}

/**
 * 解析 PDF 文件为 DocumentAst
 * 
 * @param data - PDF 文件数据（Buffer 或 Uint8Array）
 * @param filename - 文件名
 * @returns Promise<DocumentAst> 文档抽象语法树
 */
export async function parsePdf(
  data: Buffer | Uint8Array,
  filename: string
): Promise<DocumentAst> {
  // 确保数据是 Uint8Array 格式
  const uint8Data = data instanceof Buffer 
    ? new Uint8Array(data) 
    : data;

  // 创建解析器实例
  const parser = new PDFParse({ data: uint8Data });

  try {
    // 提取文本（逐页）
    const textResult = await parser.getText({
      lineEnforce: true,
      lineThreshold: 4.6,
      cellSeparator: '\t',
    });

    const blocks: BlockNode[] = [];
    let wordCount = 0;

    // 遍历每一页
    for (const page of textResult.pages) {
      const pageNumber = page.num;
      const pageText = page.text;

      if (!pageText || pageText.trim().length === 0) {
        // 空页面，跳过
        continue;
      }

      // 分割段落
      const paragraphs = splitIntoParagraphs(pageText);

      for (const paragraphText of paragraphs) {
        if (paragraphText.trim().length === 0) {
          continue;
        }

        // 统计字数
        wordCount += countWords(paragraphText);

        const paragraphNode: ParagraphNode = {
          type: 'paragraph',
          id: generateNodeId(),
          text: paragraphText,
          pageStart: pageNumber,
          pageEnd: pageNumber,
        };

        blocks.push(paragraphNode);
      }
    }

    return {
      id: generateNodeId(),
      filename,
      sha256: computeSha256(uint8Data),
      pageCount: textResult.total,
      wordCount,
      parserVersion: PARSER_VERSION,
      blocks,
    };
  } finally {
    // 释放资源
    await parser.destroy();
  }
}
