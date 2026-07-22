/**
 * Echo.xml parser for nZBTF files
 * Extracts pricing data, bidder info, and cost summaries
 */

import { XMLParser } from 'fast-xml-parser';
import type { BlockNode, SectionNode, ParagraphNode, TableNode } from '../../document-ast.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

function decodeHtmlEntities(val: unknown): string {
  if (typeof val !== 'string') return String(val ?? '');
  if (val.includes('&amp;')) {
    return val.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  return val;
}

function countWords(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const englishWords = text.replace(/[一-鿿]/g, '').split(/\s+/).filter(w => w.length > 0).length;
  return chineseChars + englishWords;
}

function makePara(nodeId: number, text: string): ParagraphNode {
  return { type: 'paragraph', id: `p-${nodeId}`, text, pageStart: null, pageEnd: null };
}

function makeSection(nodeId: number, title: string, children: BlockNode[]): SectionNode {
  return { type: 'section', id: `s-${nodeId}`, title, level: 1, children, pageStart: null, pageEnd: null };
}

function makeTable(nodeId: number, rows: string[][]): TableNode {
  return { type: 'table', id: `tbl-${nodeId}`, rows, pageStart: null, pageEnd: null };
}

/**
 * Parse Echo.xml content into BlockNode[]
 * Focuses on BidderInfo, Summary, and root pricing attributes.
 * Skips deep UnitWorks/DivisionalWorks nesting (too large, low value for risk detection).
 */
export function parseEchoXml(xml: string, startNodeId: number): { blocks: BlockNode[]; lastNodeId: number; wordCount: number } {
  const parsed = xmlParser.parse(xml);
  const blocks: BlockNode[] = [];
  let nodeId = startNodeId;
  let wordCount = 0;

  const root = parsed?.ConstructionProject ?? parsed;

  // 1. Section: 投标人信息 from BidderInfo
  const bidderInfo = root?.BidderInfo;
  if (bidderInfo) {
    const bidderFields: [string, string][] = [
      ['投标人', bidderInfo?.['@_BidName']],
      ['投标总价', bidderInfo?.['@_BidTotal']],
      ['编制人', bidderInfo?.['@_Compiler']],
      ['编制日期', bidderInfo?.['@_BidCompileDate']],
    ];
    const bidderParas: ParagraphNode[] = [];
    for (const [label, value] of bidderFields) {
      if (value) {
        bidderParas.push(makePara(++nodeId, `${label}: ${decodeHtmlEntities(value)}`));
        wordCount += countWords(label) + countWords(String(value));
      }
    }
    if (bidderParas.length > 0) {
      blocks.push(makeSection(++nodeId, '投标人信息', bidderParas));
    }
  }

  // 2. Section: 造价信息 from root attributes
  const pricingFields: [string, string][] = [
    ['总价', root?.['@_Total']],
    ['暂列金额', root?.['@_ProvisionalSums']],
    ['暂估材料', root?.['@_ProvisionalMaterial']],
    ['税金', root?.['@_Tax']],
    ['分部分项工程费', root?.['@_DivisionalAndElementalWorks']],
    ['措施项目费', root?.['@_Preliminaries']],
    ['安全生产费', root?.['@_SafeProduction']],
    ['优质工程费', root?.['@_HighQuality']],
  ];
  const pricingParas: ParagraphNode[] = [];
  for (const [label, value] of pricingFields) {
    if (value) {
      pricingParas.push(makePara(++nodeId, `${label}: ${decodeHtmlEntities(value)}`));
      wordCount += countWords(label) + countWords(String(value));
    }
  }
  if (pricingParas.length > 0) {
    blocks.push(makeSection(++nodeId, '造价信息', pricingParas));
  }

  // 3. Table: 费用汇总 from Summary.SummaryItem[]
  const summaryItems = root?.Summary?.SummaryItem;
  const items = Array.isArray(summaryItems) ? summaryItems : summaryItems ? [summaryItems] : [];
  if (items.length > 0) {
    const rows: string[][] = [['序号', '行号', '费用项目', '金额']];
    for (const item of items) {
      const order = String(item?.['@_Order'] ?? '');
      const rowNumber = String(item?.['@_RowNumber'] ?? '');
      const name = decodeHtmlEntities(item?.['@_Name'] ?? '');
      const total = String(item?.['@_Total'] ?? '');
      rows.push([order, rowNumber, name, total]);
      wordCount += countWords(name) + countWords(total);
    }
    blocks.push(makeTable(++nodeId, rows));
  }

  return { blocks, lastNodeId: nodeId, wordCount };
}
