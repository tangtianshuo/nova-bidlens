/**
 * docx4js 解析器
 * 使用 docx4js 库解析 Word 文档
 */

import docx4js from 'docx4js';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import type { DocumentParser, ParseInput, ParseOptions, ParseResult, ParseWarning } from '../types.js';
import type { DocumentAst, BlockNode, ParagraphNode, TableNode, SectionNode, Comment, Revision } from '../../document-ast.js';
import { parseComments } from '../docx-comments.js';
import { parseRevisions } from '../docx-revisions.js';

export class Docx4jsParser implements DocumentParser {
  readonly id = 'docx4js';
  readonly name = 'docx4js Parser';
  readonly supportedExtensions = ['.docx'];
  readonly mimeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  readonly priority = 1;

  async canParse(input: ParseInput): Promise<boolean> {
    return input.fileName.toLowerCase().endsWith('.docx');
  }

  async parse(input: ParseInput, options: ParseOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: ParseWarning[] = [];

    try {
      // 读取文件并计算hash
      const fileBuffer = await readFile(input.filePath);
      const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

      // 使用docx4js加载文档
      const docx = await docx4js.load(input.filePath);
      
      const blocks: BlockNode[] = [];
      let wordCount = 0;
      let nodeId = 0;
      let currentSection: SectionNode | null = null;
      let comments: Comment[] = [];
      let revisions: Revision[] = [];

      // 使用render方法遍历文档结构
      docx.render((type: string, props: any, children: any[]) => {
        switch (type) {
          case 'p': {
            // 段落
            if (this.isInsideTable(props?.node)) break;
            const text = this.extractText(children);
            if (text.trim()) {
              // 检查是否是标题
              const style = props?.['w:pStyle'] || '';
              const headingMatch = style.match(/heading(\d+)/i);
              
              if (headingMatch) {
                // 标题节点
                const level = parseInt(headingMatch[1]);
                const section: SectionNode = {
                  type: 'section',
                  id: `s-${++nodeId}`,
                  title: text.trim(),
                  level,
                  children: [],
                  pageStart: null,
                  pageEnd: null
                };
                
                if (level === 1) {
                  blocks.push(section);
                  currentSection = section;
                } else if (currentSection) {
                  currentSection.children.push(section);
                }
              } else {
                // 普通段落
                const paragraph: ParagraphNode = {
                  type: 'paragraph',
                  id: `p-${++nodeId}`,
                  text: text.trim(),
                  pageStart: null,
                  pageEnd: null
                };
                
                if (currentSection) {
                  currentSection.children.push(paragraph);
                } else {
                  blocks.push(paragraph);
                }
                wordCount += this.countWords(text);
              }
            }
            break;
          }
          
          case 'tbl': {
            // 表格
            const table = this.extractTable(children, nodeId);
            if (table) {
              if (currentSection) {
                currentSection.children.push(table.node);
              } else {
                blocks.push(table.node);
              }
              wordCount += table.wordCount;
              nodeId = table.lastNodeId;
            }
            break;
          }
          
          case 'comment': {
            // 批注
            if (options.extractComments) {
              const comment = this.extractComment(props, children);
              if (comment) {
                comments.push(comment);
              }
            }
            break;
          }
          
          case 'ins':
          case 'del': {
            // 修订（插入/删除）
            if (options.extractRevisions) {
              const revision = this.extractRevision(type, props, children, nodeId);
              if (revision) {
                revisions.push(revision);
              }
            }
            break;
          }
          
          case 'sectPr': {
            // 节属性，重置当前节
            currentSection = null;
            break;
          }
        }
        
        return { type, props, children };
      });

      // 统计页数（如果可能）
      const pageCount = this.estimatePageCount(blocks);

      const ast: DocumentAst = {
        id: sha256,
        filename: input.fileName,
        sha256,
        pageCount,
        wordCount,
        parserVersion: 'docx4js-1.0.0',
        blocks,
        comments,
        revisions
      };

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

  private extractText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map((child) => this.extractText(child)).join('');
    if (typeof value === 'object') {
      const renderedNode = value as {
        children?: unknown;
        props?: { children?: unknown };
      };
      if (renderedNode.children !== undefined) {
        return this.extractText(renderedNode.children);
      }
      if (renderedNode.props?.children !== undefined) {
        return this.extractText(renderedNode.props.children);
      }
    }
    return '';
  }

  private isInsideTable(node: unknown): boolean {
    let current = node as { name?: string; parent?: unknown } | null | undefined;
    while (current) {
      if (current.name === 'w:tbl' || current.name === 'w:tc') return true;
      current = current.parent as typeof current;
    }
    return false;
  }

  private extractComment(props: any, children: any[]): Comment | null {
    if (!props?.id || !props?.author) return null;
    
    return {
      id: String(props.id),
      author: String(props.author),
      date: String(props.date || ''),
      content: this.extractText(children),
      range: {
        startNodeId: '',
        startOffset: 0,
        endNodeId: '',
        endOffset: 0
      },
      replies: [],
      resolved: false
    };
  }

  private extractRevision(type: string, props: any, children: any[], nodeId: number): Revision | null {
    if (!props?.id || !props?.author) return null;
    
    return {
      id: String(props.id),
      author: String(props.author),
      date: String(props.date || ''),
      revisionType: type === 'ins' ? 'insert' : 'delete',
      content: {
        text: this.extractText(children),
        format: undefined,
        position: {
          nodeId: `p-${nodeId}`,
          offset: 0
        }
      },
      accepted: undefined
    };
  }

  private extractTable(children: any[], startNodeId: number): { node: TableNode; wordCount: number; lastNodeId: number } | null {
    if (!children || !Array.isArray(children)) return null;

    const rows: string[][] = [];
    let wordCount = 0;
    let nodeId = startNodeId;

    const processRows = (items: any[]) => {
      for (const item of items) {
        if (item?.type === 'tr' || item?.props?.type === 'tr') {
          const row: string[] = [];
          const cells = item.props?.children || item.children || [];
          
          for (const cell of cells) {
            if (cell?.type === 'tc' || cell?.props?.type === 'tc') {
              const cellContent = cell.props?.children || cell.children || [];
              const text = this.extractText(cellContent);
              row.push(text.trim());
              wordCount += this.countWords(text);
            }
          }
          
          if (row.length > 0) {
            rows.push(row);
          }
        } else if (item?.children) {
          processRows(item.children);
        }
      }
    };

    processRows(children);

    if (rows.length === 0) return null;

    return {
      node: {
        type: 'table',
        id: `tbl-${++nodeId}`,
        rows,
        pageStart: null,
        pageEnd: null
      },
      wordCount,
      lastNodeId: nodeId
    };
  }

  private estimatePageCount(blocks: BlockNode[]): number | null {
    // 简单估算：每页约500字
    let totalWords = 0;
    const countBlockWords = (block: BlockNode) => {
      if (block.type === 'paragraph') {
        totalWords += this.countWords(block.text);
      } else if (block.type === 'section') {
        block.children.forEach(countBlockWords);
      } else if (block.type === 'table') {
        block.rows.forEach(row => {
          row.forEach(cell => {
            totalWords += this.countWords(cell);
          });
        });
      }
    };
    blocks.forEach(countBlockWords);
    
    return totalWords > 0 ? Math.max(1, Math.ceil(totalWords / 500)) : null;
  }

  private countWords(text: string): number {
    if (!text) return 0;
    // 统计中文字符
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    // 统计英文单词
    const englishWords = text
      .replace(/[\u4e00-\u9fff]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0).length;
    return chineseChars + englishWords;
  }
}

// 导出解析器实例
export const docx4jsParser = new Docx4jsParser();
