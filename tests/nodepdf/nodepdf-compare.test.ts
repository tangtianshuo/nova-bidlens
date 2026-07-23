/**
 * Phase 10: node-pdf-to-markdown vs pdf-parse comparison test
 *
 * Compares text extraction quality, speed, and structure between:
 * - node-pdf-to-markdown (pdfjs-dist@3.11, markdown output)
 * - pdf-parse v2 (pdfjs-dist@5.4, raw text output)
 *
 * Test fixture: tests/mineru/fixtures/mineru_test_file.pdf (76-page digital PDF)
 *
 * NOTE: pdf-parse runs in a child process to avoid pdfjs-dist version conflicts.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
const FIXTURE_PATH = join(__dirname, '../mineru/fixtures/mineru_test_file.pdf');
const WORKER_PATH = join(__dirname, 'pdfparse-worker.ts');

describe('node-pdf-to-markdown vs pdf-parse', () => {

  it('should extract text with node-pdf-to-markdown', async () => {
    const pdfBuffer = await readFile(FIXTURE_PATH);
    const pdf2md = (await import('node-pdf-to-markdown')).default;

    const start = performance.now();
    const result = await pdf2md(pdfBuffer);
    const elapsed = performance.now() - start;

    const pages = Array.isArray(result) ? result : result.markdown;
    const fullText = pages.join('\n');
    const charCount = fullText.length;
    const chineseChars = (fullText.match(/[一-鿿]/g) || []).length;

    console.log('=== node-pdf-to-markdown ===');
    console.log(`  Time: ${elapsed.toFixed(0)}ms`);
    console.log(`  Pages: ${pages.length}`);
    console.log(`  Total chars: ${charCount}`);
    console.log(`  Chinese chars: ${chineseChars}`);
    console.log(`  Avg chars/page: ${(charCount / pages.length).toFixed(0)}`);
    console.log(`  Sample: ${fullText.substring(0, 300).replace(/\n/g, '\\n')}`);

    // Markdown structure detection
    const headings = (fullText.match(/^#{1,6}\s/gm) || []).length;
    const boldText = (fullText.match(/\*\*[^*]+\*\*/g) || []).length;
    console.log(`  Headings: ${headings}, Bold: ${boldText}`);

    expect(pages.length).toBeGreaterThan(0);
    expect(charCount).toBeGreaterThan(1000);

    (globalThis as any).__nodepdf = { elapsed: Math.round(elapsed), pages: pages.length, charCount, chineseChars, headings, boldText, fullText };
  });

  it('should extract text with pdf-parse (child process)', async () => {
    // Run pdf-parse in child process to avoid pdfjs-dist version conflict
    const stdout = execSync(`npx tsx "${WORKER_PATH}"`, {
      cwd: join(__dirname, '../..'),
      timeout: 30000,
      encoding: 'utf-8',
      shell: true,
    });

    const jsonLine = stdout.split('\n').find(l => l.startsWith('PDFPARSE_JSON:'));
    if (!jsonLine) throw new Error('No JSON output from pdf-parse worker');
    const data = JSON.parse(jsonLine.replace('PDFPARSE_JSON:', ''));

    console.log('=== pdf-parse ===');
    console.log(`  Time: ${data.elapsed}ms`);
    console.log(`  Pages: ${data.pages}`);
    console.log(`  Total chars: ${data.charCount}`);
    console.log(`  Chinese chars: ${data.chineseChars}`);
    console.log(`  Avg chars/page: ${(data.charCount / data.pages).toFixed(0)}`);
    console.log(`  Sample: ${data.sample.substring(0, 300).replace(/\n/g, '\\n')}`);

    expect(data.pages).toBeGreaterThan(0);
    expect(data.charCount).toBeGreaterThan(1000);

    (globalThis as any).__pdfparse = data;
  });

  it('should compare extraction quality', () => {
    const a = (globalThis as any).__nodepdf;
    const b = (globalThis as any).__pdfparse;
    if (!a || !b) return;

    console.log('\n=== Comparison Summary ===');
    console.log(`  Speed: node-pdf-to-markdown ${a.elapsed}ms vs pdf-parse ${b.elapsed}ms (${(b.elapsed / a.elapsed).toFixed(2)}x)`);
    console.log(`  Chars: node-pdf-to-markdown ${a.charCount} vs pdf-parse ${b.charCount}`);
    console.log(`  Chinese: node-pdf-to-markdown ${a.chineseChars} vs pdf-parse ${b.chineseChars}`);
    console.log(`  Pages: node-pdf-to-markdown ${a.pages} vs pdf-parse ${b.pages}`);
    console.log(`  Markdown headings: ${a.headings} (node-pdf-to-markdown only)`);
    console.log(`  Bold text: ${a.boldText} (node-pdf-to-markdown only)`);

    // Chinese character match (first 500 Chinese chars from each)
    const sampleA = a.fullText.substring(0, 2000);
    const sampleB = b.sample.substring(0, 2000);
    const chineseA = (sampleA.match(/[一-鿿]/g) || []).join('');
    const chineseB = (sampleB.match(/[一-鿿]/g) || []).join('');
    const minLen = Math.min(chineseA.length, chineseB.length, 500);
    let matches = 0;
    for (let i = 0; i < minLen; i++) {
      if (chineseA[i] === chineseB[i]) matches++;
    }
    const accuracy = minLen > 0 ? (matches / minLen * 100) : 0;
    console.log(`  Chinese char match (first 500): ${accuracy.toFixed(1)}% (${matches}/${minLen})`);

    (globalThis as any).__comparison = { a, b, accuracy };
  });
});
