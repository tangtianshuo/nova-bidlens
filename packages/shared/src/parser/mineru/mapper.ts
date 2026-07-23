/**
 * MinerU content_list.json → DocumentAst mapper
 * Per D-01: Strict hierarchy mapping
 */

import type { BlockNode, ParagraphNode, SectionNode, TableNode } from '../../document-ast.js';

export interface ContentListItem {
  type: 'text' | 'table' | 'page_number' | 'header' | 'image';
  text?: string;
  text_level?: number;
  bbox?: [number, number, number, number];
  page_idx?: number;
  table_body?: string;
  table_caption?: string[];
  table_footnote?: string[];
  img_path?: string;
  image_caption?: string[];
  sub_type?: string;
  list_items?: string[];
}

let nodeIdCounter = 0;

function nextNodeId(prefix: string): string {
  return `${prefix}-${++nodeIdCounter}`;
}

export function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}

/**
 * Parse MinerU table_body HTML into rows[][]
 * Handles <table>, <tr>, <td>/<th> tags
 */
export function parseTableBody(html: string): string[][] {
  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const row: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .trim();
      row.push(text);
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

/**
 * Map MinerU content_list.json items to BlockNode[]
 * Per D-01: text_level=0 → Paragraph, text_level>0 → Section (hierarchy), table → Table
 */
export function mapContentListToAst(items: ContentListItem[]): BlockNode[] {
  resetNodeIdCounter();
  const blocks: BlockNode[] = [];
  const sectionStack: SectionNode[] = [];

  for (const item of items) {
    const pageIdx = item.page_idx != null ? item.page_idx + 1 : null;

    switch (item.type) {
      case 'text': {
        const text = item.text?.trim();
        if (!text) break;

        if (item.text_level && item.text_level > 0) {
          const section: SectionNode = {
            type: 'section',
            id: nextNodeId('s'),
            title: text,
            level: item.text_level,
            children: [],
            pageStart: pageIdx,
            pageEnd: pageIdx,
          };

          while (
            sectionStack.length > 0 &&
            sectionStack[sectionStack.length - 1].level >= section.level
          ) {
            sectionStack.pop();
          }

          if (sectionStack.length > 0) {
            sectionStack[sectionStack.length - 1].children.push(section);
          } else {
            blocks.push(section);
          }
          sectionStack.push(section);
        } else {
          const paragraph: ParagraphNode = {
            type: 'paragraph',
            id: nextNodeId('p'),
            text,
            pageStart: pageIdx,
            pageEnd: pageIdx,
          };

          if (sectionStack.length > 0) {
            sectionStack[sectionStack.length - 1].children.push(paragraph);
          } else {
            blocks.push(paragraph);
          }
        }
        break;
      }

      case 'table': {
        if (!item.table_body) break;
        const rows = parseTableBody(item.table_body);
        if (rows.length === 0) break;

        const table: TableNode = {
          type: 'table',
          id: nextNodeId('tbl'),
          rows,
          pageStart: pageIdx,
          pageEnd: pageIdx,
        };

        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].children.push(table);
        } else {
          blocks.push(table);
        }
        break;
      }

      case 'page_number':
      case 'header':
      case 'image':
        break;
    }
  }

  return blocks;
}
