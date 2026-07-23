/**
 * pdf-parse extraction worker — runs in a separate process to avoid
 * pdfjs-dist version conflicts with node-pdf-to-markdown.
 *
 * Usage: npx tsx tests/nodepdf/pdfparse-worker.ts
 * Output: JSON to stdout
 */
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const FIXTURE = resolve('tests/mineru/fixtures/mineru_test_file.pdf');

async function main() {
  const pdfBuffer = await readFile(FIXTURE);

  // Use dynamic import from shared package's node_modules to get correct pdfjs-dist
  const pdfParsePath = pathToFileURL(resolve('packages/shared/node_modules/pdf-parse/dist/pdf-parse/esm/index.js')).href;
  const { PDFParse } = await import(pdfParsePath);
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  const start = performance.now();
  const textResult = await parser.getText({ lineEnforce: true, lineThreshold: 4.6, cellSeparator: '\t' });
  const elapsed = performance.now() - start;

  const fullText = textResult.pages.map((p: any) => p.text).join('\n');
  const charCount = fullText.length;
  const chineseChars = (fullText.match(/[一-鿿]/g) || []).length;
  const pageCount = textResult.total;

  await parser.destroy();

  const result = { elapsed: Math.round(elapsed), pages: pageCount, charCount, chineseChars, sample: fullText.substring(0, 500) };
  // JSON marker for easy parsing
  console.log('PDFPARSE_JSON:' + JSON.stringify(result));
}

main().catch(e => { console.error(e); process.exit(1); });
