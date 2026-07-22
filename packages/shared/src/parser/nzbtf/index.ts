/**
 * nZBTF file parser
 * Extracts ZIP archive, parses TB.xml / Echo.xml / hyChoose.xml, maps to DocumentAst
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import type { DocumentParser, ParseInput, ParseOptions, ParseResult, ParseWarning } from '../types.js';
import type { DocumentAst, BlockNode } from '../../document-ast.js';
import { parseTbXml } from './tb-parser.js';
import { parseEchoXml } from './echo-parser.js';
import { parseHyChooseXml } from './hy-parser.js';

export class NzbtfParser implements DocumentParser {
  readonly id = 'nzbtf-parser';
  readonly name = 'nZBTF Parser';
  readonly supportedExtensions = ['.nzbtf'];
  readonly mimeTypes = ['application/zip'];
  readonly priority = 1;

  async canParse(input: ParseInput): Promise<boolean> {
    return input.fileName.toLowerCase().endsWith('.nzbtf');
  }

  async parse(input: ParseInput, _options: ParseOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: ParseWarning[] = [];

    try {
      // 1. Read file and compute SHA256
      const fileBuffer = await readFile(input.filePath);
      const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

      // 2. Extract ZIP — handle \ vs / path separators
      const zf = await JSZip.loadAsync(fileBuffer);
      const findEntry = (pattern: string) =>
        Object.keys(zf.files).find(n => n.toLowerCase().includes(pattern.toLowerCase()));

      const tbEntry = findEntry('tb.xml');
      const echoEntry = findEntry('echo.xml');
      const hyEntry = findEntry('hychoose.xml');

      const blocks: BlockNode[] = [];
      let nodeId = 0;
      let wordCount = 0;

      // 3. Parse each XML and collect blocks
      if (tbEntry) {
        const xml = await zf.file(tbEntry)!.async('string');
        const result = parseTbXml(xml, nodeId);
        blocks.push(...result.blocks);
        nodeId = result.lastNodeId;
        wordCount += result.wordCount;
      } else {
        warnings.push({ code: 'MISSING_TB', message: 'TB.xml not found in nZBTF archive', severity: 'warning' });
      }

      if (echoEntry) {
        const xml = await zf.file(echoEntry)!.async('string');
        const result = parseEchoXml(xml, nodeId);
        blocks.push(...result.blocks);
        nodeId = result.lastNodeId;
        wordCount += result.wordCount;
      } else {
        warnings.push({ code: 'MISSING_ECHO', message: 'Echo.xml not found in nZBTF archive', severity: 'warning' });
      }

      if (hyEntry) {
        const xml = await zf.file(hyEntry)!.async('string');
        const result = parseHyChooseXml(xml, nodeId);
        blocks.push(...result.blocks);
        nodeId = result.lastNodeId;
        wordCount += result.wordCount;
      } else {
        warnings.push({ code: 'MISSING_HY', message: 'hyChoose.xml not found in nZBTF archive', severity: 'warning' });
      }

      if (blocks.length === 0) {
        return {
          success: false,
          warnings,
          duration: Date.now() - startTime,
          parserId: this.id,
          error: { code: 'NO_CONTENT', message: 'No parseable XML content found in nZBTF archive' },
        };
      }

      // 4. Build DocumentAst
      const ast: DocumentAst = {
        id: sha256,
        filename: input.fileName,
        sha256,
        pageCount: null,
        wordCount,
        parserVersion: 'nzbtf-1.0.0',
        blocks,
      };

      return {
        success: true,
        ast,
        warnings,
        duration: Date.now() - startTime,
        parserId: this.id,
      };
    } catch (error) {
      return {
        success: false,
        warnings,
        duration: Date.now() - startTime,
        parserId: this.id,
        error: {
          code: 'PARSE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown nZBTF parse error',
        },
      };
    }
  }
}

export const nzbtfParser = new NzbtfParser();
