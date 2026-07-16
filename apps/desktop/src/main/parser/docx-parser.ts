import type { DocumentAst, ParagraphNode } from '@bidlens/shared';
import { XMLParser } from 'fast-xml-parser';

export function parseDocumentXmlToAst(xml: string, metadata: { filename: string; sha256: string }): DocumentAst {
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml);
  const paragraphs = normalizeArray(parsed.document?.body?.p);
  const blocks: ParagraphNode[] = paragraphs.map((paragraph, index) => ({
    type: 'paragraph' as const,
    id: `p-${index + 1}`,
    text: extractText(paragraph),
    pageStart: null,
    pageEnd: null
  })).filter((paragraph) => paragraph.text.length > 0);

  return {
    id: metadata.sha256,
    filename: metadata.filename,
    sha256: metadata.sha256,
    pageCount: null,
    wordCount: blocks.reduce((sum, block) => sum + block.text.length, 0),
    parserVersion: 'docx-parser-v0.1.0',
    blocks
  };
}

function extractText(paragraph: unknown): string {
  return normalizeArray((paragraph as { r?: unknown })?.r)
    .map((run) => (run as { t?: string })?.t ?? '')
    .join('')
    .trim();
}

function normalizeArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
