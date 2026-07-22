/**
 * Utility to generate minimal valid DOCX files for E2E testing.
 * Uses jszip (already in project dependencies) — no new deps.
 */
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function buildDocumentXml(paragraphs: string[]): string {
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Create a minimal valid DOCX file at `filePath` with the given paragraphs.
 */
export async function createTestDocx(
  filePath: string,
  paragraphs: string[],
): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/document.xml', buildDocumentXml(paragraphs));

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
}

/**
 * Create 2 DOCX files with intentionally similar content to trigger risk detection.
 * Returns the file paths.
 */
export async function createSimilarDocs(dir: string): Promise<string[]> {
  const fileA = path.join(dir, 'fixture-A-投标文件.docx');
  const fileB = path.join(dir, 'fixture-B-投标文件.docx');

  // File A: original bid content
  const paragraphsA = [
    '投标人应提供营业执照副本复印件',
    '技术方案需满足国标要求',
    '项目工期为180个日历天',
    '质量保证期为验收合格后12个月',
    '项目经理应具备一级建造师资格证书',
  ];

  // File B: nearly identical with minor word changes
  const paragraphsB = [
    '投标人须提供营业执照副本复印件',
    '技术方案需满足国标要求',
    '项目工期为180个日历天',
    '质量保证期为验收合格后12个月',
    '项目经理须具备一级建造师资格证书',
  ];

  await createTestDocx(fileA, paragraphsA);
  await createTestDocx(fileB, paragraphsB);

  return [fileA, fileB];
}
