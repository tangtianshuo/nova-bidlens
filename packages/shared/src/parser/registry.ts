/**
 * 解析器注册中心
 */

import type { DocumentParser, ParseInput } from './types.js';

export class ParserRegistry {
  private parsers: Map<string, DocumentParser> = new Map();
  private extensionIndex: Map<string, DocumentParser[]> = new Map();

  /**
   * 注册解析器
   */
  register(parser: DocumentParser): void {
    this.parsers.set(parser.id, parser);

    // 建立扩展名索引 (按优先级排序, normalize to .ext format)
    for (const ext of parser.supportedExtensions) {
      const normalized = `.${ext.toLowerCase().replace(/^\./, '')}`;
      const list = this.extensionIndex.get(normalized) ?? [];
      list.push(parser);
      list.sort((a, b) => a.priority - b.priority);
      this.extensionIndex.set(normalized, list);
    }
  }

  /**
   * 按文件扩展名查找解析器
   */
  findByExtension(ext: string): DocumentParser | null {
    // Normalize: strip leading dot and lowercase
    const normalized = ext.toLowerCase().replace(/^\./, '');
    const list = this.extensionIndex.get(`.${normalized}`);
    return list?.[0] ?? null;
  }

  /**
   * 按 ID 查找解析器
   */
  findById(id: string): DocumentParser | null {
    return this.parsers.get(id) ?? null;
  }

  /**
   * 获取所有已注册解析器
   */
  getAll(): DocumentParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * 根据输入查找合适的解析器
   */
  async findForInput(input: ParseInput): Promise<DocumentParser | null> {
    // 从文件名提取扩展名, normalize to .ext format
    const rawExt = input.fileName.split('.').pop()?.toLowerCase();
    if (!rawExt) return null;
    const ext = `.${rawExt.replace(/^\./, '')}`;

    // 按优先级遍历
    const parsers = this.extensionIndex.get(ext) ?? [];
    for (const parser of parsers) {
      if (await parser.canParse(input)) {
        return parser;
      }
    }

    return null;
  }
}

// 全局注册中心实例
export const globalRegistry = new ParserRegistry();
