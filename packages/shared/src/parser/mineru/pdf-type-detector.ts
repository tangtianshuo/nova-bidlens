/**
 * PDF 类型检测器
 * Per D-03: 预检测分流 — 扫描版直接走 MinerU，数字版走 pdf-parse
 */

export type PdfType = 'digital' | 'scanned' | 'unknown';

const SCANNED_THRESHOLD = 50; // 平均字符数/页，低于此值判定为扫描版
const PAGES_TO_CHECK = 3;

/**
 * 检测 PDF 类型（数字版 vs 扫描版）
 * 读取前几页文本层，判断文本密度
 *
 * @param filePath PDF 文件路径
 * @returns PdfType
 */
export async function detectPdfType(filePath: string): Promise<PdfType> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { PDFParse } = await import('pdf-parse');

    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText({ lineEnforce: false });
    await parser.destroy();

    const pages = result.pages.slice(0, PAGES_TO_CHECK);
    if (pages.length === 0) return 'unknown';

    let totalChars = 0;
    for (const page of pages) {
      totalChars += (page.text || '').trim().length;
    }

    const avgCharsPerPage = totalChars / pages.length;
    return avgCharsPerPage < SCANNED_THRESHOLD ? 'scanned' : 'digital';
  } catch {
    return 'unknown';
  }
}
