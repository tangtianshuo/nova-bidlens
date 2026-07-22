/**
 * TB.xml parser for nZBTF files
 * Extracts bidder info, project details, and personnel data
 */

import { XMLParser } from 'fast-xml-parser';
import type { BlockNode, SectionNode, ParagraphNode, TableNode } from '../../document-ast.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

/** Decode double-encoded HTML entities (&amp;quot; -> ") */
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

/**
 * Parse TB.xml content into BlockNode[]
 */
export function parseTbXml(xml: string, startNodeId: number): { blocks: BlockNode[]; lastNodeId: number; wordCount: number } {
  const parsed = xmlParser.parse(xml);
  const blocks: BlockNode[] = [];
  let nodeId = startNodeId;
  let wordCount = 0;

  // 1. Section: 项目信息 from root XiangMuInfo attributes
  const root = parsed?.XiangMuInfo ?? parsed?.TB ?? parsed;
  const projectFields: [string, string][] = [
    ['项目名称', root?.['@_XiangMuMC']],
    ['标段编码', root?.['@_BiaoDuanBM']],
    ['标段名称', root?.['@_BiaoDuanMC']],
    ['投标单位', root?.['@_TBDW']],
    ['招标代理', root?.['@_ZhaoBiaoDL']],
    ['建设单位', root?.['@_JianSheDW']],
  ];

  const projectParas: ParagraphNode[] = [];
  for (const [label, value] of projectFields) {
    if (value) {
      projectParas.push(makePara(++nodeId, `${label}: ${decodeHtmlEntities(value)}`));
      wordCount += countWords(label) + countWords(String(value));
    }
  }
  if (projectParas.length > 0) {
    blocks.push(makeSection(++nodeId, '项目信息', projectParas));
  }

  // 2. Section: 投标要点 from TBInfo array
  const tbInfoRaw = root?.TBInfo;
  const tbInfos = Array.isArray(tbInfoRaw) ? tbInfoRaw : tbInfoRaw ? [tbInfoRaw] : [];
  if (tbInfos.length > 0) {
    const infoParas: ParagraphNode[] = [];
    for (const item of tbInfos) {
      const key = decodeHtmlEntities(item?.['@_Key'] ?? '');
      const value = decodeHtmlEntities(item?.['@_Value'] ?? '');
      const keyExt = decodeHtmlEntities(item?.['@_KeyExt'] ?? '');
      if (key) {
        const text = keyExt ? `${key}: ${value} ${keyExt}` : `${key}: ${value}`;
        infoParas.push(makePara(++nodeId, text));
        wordCount += countWords(text);
      }
    }
    if (infoParas.length > 0) {
      blocks.push(makeSection(++nodeId, '投标要点', infoParas));
    }
  }

  // 3. Section: 资质人员 from BiaoShu.TBNetFileInfo.TBDWInfo
  const tbNetFileInfo = root?.BiaoShu?.TBNetFileInfo;
  const dwInfos = tbNetFileInfo?.TBDWInfo;
  const dwArray = Array.isArray(dwInfos) ? dwInfos : dwInfos ? [dwInfos] : [];
  if (dwArray.length > 0) {
    const personnelParas: ParagraphNode[] = [];
    for (const dw of dwArray) {
      const dwName = decodeHtmlEntities(dw?.['@_DWName'] ?? '');
      if (dwName) {
        personnelParas.push(makePara(++nodeId, `单位: ${dwName}`));
        wordCount += countWords(dwName) + 2;
      }
      const btItems = dw?.TBNetFileBT;
      const btArray = Array.isArray(btItems) ? btItems : btItems ? [btItems] : [];
      for (const bt of btArray) {
        const name = decodeHtmlEntities(bt?.['@_Name'] ?? '');
        const zlmc = decodeHtmlEntities(bt?.['@_ZLMC'] ?? '');
        if (name || zlmc) {
          const text = `${zlmc}: ${name}`.trim();
          personnelParas.push(makePara(++nodeId, text));
          wordCount += countWords(text);
        }
      }
    }
    if (personnelParas.length > 0) {
      blocks.push(makeSection(++nodeId, '资质人员', personnelParas));
    }
  }

  return { blocks, lastNodeId: nodeId, wordCount };
}
