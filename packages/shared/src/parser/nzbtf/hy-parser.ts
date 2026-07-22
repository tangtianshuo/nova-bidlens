/**
 * hyChoose.xml parser for nZBTF files
 * Extracts evaluation/selection data: company info, PM, team members
 */

import { XMLParser } from 'fast-xml-parser';
import type { BlockNode, SectionNode, ParagraphNode } from '../../document-ast.js';

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

/** Extract text content from a child element (handles simple text nodes) */
function getChildText(parent: Record<string, unknown> | undefined, key: string): string {
  if (!parent) return '';
  const val = parent[key];
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && '#text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)['#text'] ?? '');
  }
  return String(val ?? '');
}

/**
 * Parse hyChoose.xml content into BlockNode[]
 */
export function parseHyChooseXml(xml: string, startNodeId: number): { blocks: BlockNode[]; lastNodeId: number; wordCount: number } {
  const parsed = xmlParser.parse(xml);
  const blocks: BlockNode[] = [];
  let nodeId = startNodeId;
  let wordCount = 0;

  const mainItems = parsed?.HyInfo?.ZhengType?.Main;
  const mains = Array.isArray(mainItems) ? mainItems : mainItems ? [mainItems] : [];

  // 1. Section: 资格审查 — Main[0] DanWeiItem (company details)
  const danWeiMain = mains.find((m: Record<string, unknown>) => m?.['@_Type'] === 'A0');
  const danWeiItem = danWeiMain?.DanWeiItem;
  if (danWeiItem) {
    const fields: [string, string][] = [
      ['单位名称', getChildText(danWeiItem, 'DanWeiName')],
      ['统一社会信用代码', getChildText(danWeiItem, 'UnitOrgNum')],
      ['法定代表人', getChildText(danWeiItem, 'FaRen')],
      ['注册资本', getChildText(danWeiItem, 'ZhuCeZiBen') ? `${getChildText(danWeiItem, 'ZhuCeZiBen')}${getChildText(danWeiItem, 'ZhuCeZiBenDW')}` : ''],
      ['营业执照号', getChildText(danWeiItem, 'LicenceNum')],
      ['安全生产许可证号', getChildText(danWeiItem, 'AnQuanXuKeZhenNum')],
      ['资质等级', getChildText(danWeiItem, 'MainZiZhiDengJi')],
      ['经营范围', getChildText(danWeiItem, 'JinYingFanWei')],
      ['联系人', getChildText(danWeiItem, 'LocalLianXiRen')],
      ['联系电话', getChildText(danWeiItem, 'LocalTel')],
    ];

    const paras: ParagraphNode[] = [];
    for (const [label, value] of fields) {
      const decoded = decodeHtmlEntities(value);
      if (decoded) {
        paras.push(makePara(++nodeId, `${label}: ${decoded}`));
        wordCount += countWords(label) + countWords(decoded);
      }
    }
    if (paras.length > 0) {
      blocks.push(makeSection(++nodeId, '资格审查', paras));
    }
  }

  // 2. Section: 项目负责人 — Main[1] PMItem
  const pmMain = mains.find((m: Record<string, unknown>) => m?.['@_Type'] === 'A1');
  const pmItems = pmMain?.PMItem;
  const pmArray = Array.isArray(pmItems) ? pmItems : pmItems ? [pmItems] : [];
  if (pmArray.length > 0) {
    const paras: ParagraphNode[] = [];
    for (const pm of pmArray) {
      const fields: [string, string][] = [
        ['姓名', getChildText(pm, 'PMName')],
        ['职称', getChildText(pm, 'ZhiCheng')],
        ['职务', getChildText(pm, 'ZhiWu')],
        ['学历', getChildText(pm, 'XueLi')],
        ['专业', getChildText(pm, 'StudyZy')],
        ['性别', getChildText(pm, 'PMSEX')],
      ];
      for (const [label, value] of fields) {
        const decoded = decodeHtmlEntities(value);
        if (decoded) {
          paras.push(makePara(++nodeId, `${label}: ${decoded}`));
          wordCount += countWords(label) + countWords(decoded);
        }
      }
    }
    if (paras.length > 0) {
      blocks.push(makeSection(++nodeId, '项目负责人', paras));
    }
  }

  // 3. Section: 项目管理人员 — Main[3] XMItem (team members)
  const xmMain = mains.find((m: Record<string, unknown>) => m?.['@_Type'] === 'A3');
  const xmItems = xmMain?.XMItem;
  const xmArray = Array.isArray(xmItems) ? xmItems : xmItems ? [xmItems] : [];
  if (xmArray.length > 0) {
    const paras: ParagraphNode[] = [];
    for (const xm of xmArray) {
      const fields: [string, string][] = [
        ['姓名', getChildText(xm, 'XMGLPMName')],
        ['职称', getChildText(xm, 'ZhiCheng')],
        ['职务', getChildText(xm, 'ZhiWu')],
      ];
      for (const [label, value] of fields) {
        const decoded = decodeHtmlEntities(value);
        if (decoded) {
          paras.push(makePara(++nodeId, `${label}: ${decoded}`));
          wordCount += countWords(label) + countWords(decoded);
        }
      }
    }
    if (paras.length > 0) {
      blocks.push(makeSection(++nodeId, '项目管理人员', paras));
    }
  }

  return { blocks, lastNodeId: nodeId, wordCount };
}
