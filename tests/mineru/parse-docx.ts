#!/usr/bin/env npx tsx
/**
 * DOCX Parser - Extract text for MinerU comparison
 */

import { Docx4jsParser } from '../../packages/shared/src/parser/docx/index.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OUTPUT_DIR = join(import.meta.dirname ?? __dirname, 'output');

async function main() {
  const parser = new Docx4jsParser();
  const input = {
    filePath: join(import.meta.dirname ?? __dirname, 'fixtures', 'mineru_test_file_docx.docx'),
    fileName: 'mineru_test_file_docx.docx',
  };

  console.log('Parsing DOCX file...');
  const result = await parser.parse(input, {});

  // Extract text blocks
  const textBlocks: string[] = [];
  const tableBlocks: string[] = [];
  let sectionCount = 0;
  let paragraphCount = 0;
  let tableCount = 0;

  for (const block of result.ast.blocks) {
    if (block.type === 'section') {
      sectionCount++;
      textBlocks.push(`## ${block.title}`);
      // Process children
      for (const child of block.children) {
        if (child.type === 'paragraph') {
          paragraphCount++;
          textBlocks.push(child.text);
        } else if (child.type === 'table') {
          tableCount++;
          tableBlocks.push(`[Table ${tableCount}]`);
        }
      }
    } else if (block.type === 'paragraph') {
      paragraphCount++;
      textBlocks.push(block.text);
    } else if (block.type === 'table') {
      tableCount++;
      tableBlocks.push(`[Table ${tableCount}]`);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Write text content
  const textContent = textBlocks.join('\n\n');
  await writeFile(join(OUTPUT_DIR, 'docx-content.txt'), textContent);

  // Write summary
  const summary = {
    totalBlocks: result.ast.blocks.length,
    sections: sectionCount,
    paragraphs: paragraphCount,
    tables: tableCount,
    wordCount: result.metadata?.wordCount ?? 0,
    firstPages: textBlocks.slice(0, 50).join('\n'),
  };
  await writeFile(join(OUTPUT_DIR, 'docx-summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== DOCX Parse Summary ===');
  console.log(`Sections: ${sectionCount}`);
  console.log(`Paragraphs: ${paragraphCount}`);
  console.log(`Tables: ${tableCount}`);
  console.log(`Total blocks: ${result.ast.blocks.length}`);
  console.log(`\nFirst 500 chars:`);
  console.log(textContent.slice(0, 500));
}

main().catch(err => { console.error(err); process.exit(1); });
