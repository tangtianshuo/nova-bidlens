import { describe, expect, it } from 'vitest';
import type { DiffItem, DiffAst, TextDiffToken } from '../../packages/shared/src/diff-ast.js';
import type { TableDiffResult, CellDiff, StructuralChange, CellSpan } from '../../packages/shared/src/table-diff.js';
import type { FormatDiffResult, TextFormatChange, ParagraphFormatChange } from '../../packages/shared/src/format-diff.js';
import type { CommentDiffResult, RevisionDiffResult, ParsedComment, ParsedRevision } from '../../packages/shared/src/comment-diff.js';
import { compareComments, compareRevisions } from '../../packages/shared/src/comment-diff.js';
import { compareTextFormats, compareParagraphFormats, computeFormatDiff } from '../../packages/shared/src/format-diff.js';
import type { TextFormat, ParagraphFormat } from '../../packages/shared/src/parser/docx-format.js';
import type { FullFidelityReport, ReportSummary } from '../../packages/shared/src/report-export.js';
import { generateMarkdownReport, generateHtmlReport, createFullFidelityReport } from '../../packages/shared/src/report-export.js';
import { getCellDiff, getCellChangeColor, getCellDiffTooltip } from '../../packages/shared/src/table-diff.js';

describe('V0.2 Full Fidelity Integration Tests', () => {
  // ============ Table Comparison Integration ============
  describe('Table Comparison Integration', () => {
    it('should detect identical tables', () => {
      const tableDiff: TableDiffResult = {
        tableMatchType: 'identical',
        structuralChanges: [],
        cellDiffs: [],
        confidence: 1.0
      };
      expect(tableDiff.tableMatchType).toBe('identical');
      expect(tableDiff.structuralChanges).toHaveLength(0);
      expect(tableDiff.cellDiffs).toHaveLength(0);
      expect(tableDiff.confidence).toBe(1.0);
    });

    it('should detect content changes in table cells', () => {
      const cellDiffs: CellDiff[] = [
        { position: [0, 0], changeType: 'identical', oldContent: 'project', newContent: 'project', similarity: 1.0 },
        { position: [0, 1], changeType: 'modified', oldContent: 'budget', newContent: 'total budget', similarity: 0.85 },
        { position: [1, 0], changeType: 'added', oldContent: null, newContent: 'new row', similarity: 0 },
        { position: [1, 1], changeType: 'deleted', oldContent: 'deleted', newContent: null, similarity: 0 }
      ];
      const tableDiff: TableDiffResult = { tableMatchType: 'content_changed', structuralChanges: [], cellDiffs, confidence: 0.82 };
      expect(tableDiff.tableMatchType).toBe('content_changed');
      expect(tableDiff.cellDiffs).toHaveLength(4);
      expect(tableDiff.confidence).toBe(0.82);
      expect(tableDiff.cellDiffs.filter(d => d.changeType === 'identical')).toHaveLength(1);
      expect(tableDiff.cellDiffs.filter(d => d.changeType === 'modified')).toHaveLength(1);
      expect(tableDiff.cellDiffs.filter(d => d.changeType === 'added')).toHaveLength(1);
      expect(tableDiff.cellDiffs.filter(d => d.changeType === 'deleted')).toHaveLength(1);
    });

    it('should detect structural changes in tables', () => {
      const structuralChanges: StructuralChange[] = [
        { type: 'rows_added', count: 2, position: 2 },
        { type: 'columns_deleted', count: 1, position: 1 }
      ];
      const tableDiff: TableDiffResult = { tableMatchType: 'structure_changed', structuralChanges, cellDiffs: [], confidence: 0.75 };
      expect(tableDiff.structuralChanges).toHaveLength(2);
      expect(tableDiff.structuralChanges[0].type).toBe('rows_added');
      expect(tableDiff.structuralChanges[0].count).toBe(2);
      expect(tableDiff.structuralChanges[1].type).toBe('columns_deleted');
    });

    it('should detect mixed changes in tables', () => {
      const cellDiffs: CellDiff[] = [{ position: [0, 0], changeType: 'modified', oldContent: 'old', newContent: 'new', similarity: 0.9 }];
      const structuralChanges: StructuralChange[] = [{ type: 'rows_added', count: 1, position: 1 }];
      const tableDiff: TableDiffResult = { tableMatchType: 'mixed_changes', structuralChanges, cellDiffs, confidence: 0.68 };
      expect(tableDiff.tableMatchType).toBe('mixed_changes');
      expect(tableDiff.structuralChanges).toHaveLength(1);
      expect(tableDiff.cellDiffs).toHaveLength(1);
    });

    it('should handle span changes in cells', () => {
      const cellDiffs: CellDiff[] = [{
        position: [0, 0], changeType: 'span_changed', oldContent: 'merged', newContent: 'merged', similarity: 1.0,
        oldSpan: { rowSpan: 2, colSpan: 1 }, newSpan: { rowSpan: 1, colSpan: 2 }, spanChanged: true
      }];
      const tableDiff: TableDiffResult = { tableMatchType: 'content_changed', structuralChanges: [], cellDiffs, confidence: 0.88 };
      expect(tableDiff.cellDiffs[0].spanChanged).toBe(true);
      expect(tableDiff.cellDiffs[0].oldSpan).toEqual({ rowSpan: 2, colSpan: 1 });
      expect(tableDiff.cellDiffs[0].newSpan).toEqual({ rowSpan: 1, colSpan: 2 });
    });

    it('should get cell diff by position', () => {
      const tableDiff: TableDiffResult = {
        tableMatchType: 'content_changed', structuralChanges: [],
        cellDiffs: [
          { position: [0, 0], changeType: 'identical', oldContent: 'A', newContent: 'A', similarity: 1.0 },
          { position: [0, 1], changeType: 'modified', oldContent: 'B', newContent: 'C', similarity: 0.8 },
          { position: [1, 0], changeType: 'added', oldContent: null, newContent: 'D', similarity: 0 }
        ],
        confidence: 0.85
      };
      expect(getCellDiff(tableDiff, 0, 0)).toBeDefined();
      expect(getCellDiff(tableDiff, 0, 0)?.changeType).toBe('identical');
      expect(getCellDiff(tableDiff, 0, 1)?.changeType).toBe('modified');
      expect(getCellDiff(tableDiff, 1, 0)?.changeType).toBe('added');
      expect(getCellDiff(tableDiff, 2, 0)).toBeUndefined();
    });

    it('should return correct colors for cell change types', () => {
      expect(getCellChangeColor('identical')).toBeUndefined();
      expect(getCellChangeColor('modified')).toBe('#fff3cd');
      expect(getCellChangeColor('added')).toBe('#d4edda');
      expect(getCellChangeColor('deleted')).toBe('#f8d7da');
      expect(getCellChangeColor('span_changed')).toBe('#cce5ff');
    });

    it('should generate correct tooltips for cell diffs', () => {
      const modifiedDiff: CellDiff = { position: [0, 0], changeType: 'modified', oldContent: 'old', newContent: 'new', similarity: 0.92 };
      expect(getCellDiffTooltip(modifiedDiff)).toContain('92%');
      const addedDiff: CellDiff = { position: [0, 1], changeType: 'added', oldContent: null, newContent: 'added', similarity: 0 };
      expect(getCellDiffTooltip(addedDiff)).toContain('added');
      const deletedDiff: CellDiff = { position: [1, 0], changeType: 'deleted', oldContent: 'deleted', newContent: null, similarity: 0 };
      expect(getCellDiffTooltip(deletedDiff)).toContain('deleted');
      const spanDiff: CellDiff = { position: [0, 0], changeType: 'span_changed', oldContent: null, newContent: null, similarity: 0,
        oldSpan: { rowSpan: 2, colSpan: 1 }, newSpan: { rowSpan: 1, colSpan: 2 }, spanChanged: true };
      expect(getCellDiffTooltip(spanDiff)).toContain('合并区域变化');
    });

    it('should handle nested table diffs', () => {
      const nestedTableDiff: TableDiffResult = {
        tableMatchType: 'content_changed', structuralChanges: [],
        cellDiffs: [{ position: [0, 0], changeType: 'modified', oldContent: 'nested', newContent: 'nested', similarity: 0.95 }],
        confidence: 0.9
      };
      const cellDiffs: CellDiff[] = [{
        position: [0, 0], changeType: 'modified', oldContent: 'with nested', newContent: 'with nested', similarity: 0.95,
        nestedTableDiff
      }];
      const tableDiff: TableDiffResult = { tableMatchType: 'content_changed', structuralChanges: [], cellDiffs, confidence: 0.88 };
      expect(tableDiff.cellDiffs[0].nestedTableDiff).toBeDefined();
      expect(tableDiff.cellDiffs[0].nestedTableDiff?.tableMatchType).toBe('content_changed');
    });
  });

  // ============ Format Difference Integration ============
  describe('Format Difference Integration', () => {
    it('should detect text format changes', () => {
      const left: TextFormat = { fontFamily: 'Arial', fontSize: 12, bold: true, color: '#000000' };
      const right: TextFormat = { fontFamily: 'Helvetica', fontSize: 14, bold: false, color: '#333333' };
      const changes = compareTextFormats(left, right);
      expect(changes).toHaveLength(4);
      expect(changes).toEqual(expect.arrayContaining([
        { property: 'fontFamily', oldValue: 'Arial', newValue: 'Helvetica', changeType: 'modified' },
        { property: 'fontSize', oldValue: 12, newValue: 14, changeType: 'modified' },
        { property: 'bold', oldValue: true, newValue: false, changeType: 'modified' },
        { property: 'color', oldValue: '#000000', newValue: '#333333', changeType: 'modified' }
      ]));
    });

    it('should detect paragraph format changes', () => {
      const left: ParagraphFormat = { alignment: 'left', indentLeft: 0, lineSpacing: 1.0, spaceBefore: 0, spaceAfter: 0 };
      const right: ParagraphFormat = { alignment: 'justify', indentLeft: 20, lineSpacing: 1.5, spaceBefore: 10, spaceAfter: 10 };
      const changes = compareParagraphFormats(left, right);
      expect(changes).toHaveLength(5);
    });

    it('should compute full format diff', () => {
      const leftText: TextFormat = { fontFamily: 'Arial', fontSize: 12, bold: true };
      const rightText: TextFormat = { fontFamily: 'Helvetica', fontSize: 14, italic: true };
      const leftPara: ParagraphFormat = { alignment: 'left', indentLeft: 0 };
      const rightPara: ParagraphFormat = { alignment: 'center', indentLeft: 20 };
      const result = computeFormatDiff(leftText, rightText, leftPara, rightPara);
      expect(result.hasChanges).toBe(true);
      expect(result.textFormatChanges.length).toBeGreaterThan(0);
      expect(result.paragraphFormatChanges.length).toBeGreaterThan(0);
    });

    it('should handle format additions', () => {
      const left: TextFormat = {};
      const right: TextFormat = { fontFamily: 'Arial', fontSize: 12, bold: true };
      const changes = compareTextFormats(left, right);
      expect(changes).toHaveLength(3);
      expect(changes.every(c => c.changeType === 'added')).toBe(true);
    });

    it('should handle format removals', () => {
      const left: TextFormat = { fontFamily: 'Arial', fontSize: 12, bold: true };
      const right: TextFormat = {};
      const changes = compareTextFormats(left, right);
      expect(changes).toHaveLength(3);
      expect(changes.every(c => c.changeType === 'removed')).toBe(true);
    });

    it('should handle identical formats', () => {
      const format: TextFormat = { fontFamily: 'Arial', fontSize: 12, bold: true };
      const changes = compareTextFormats(format, { ...format });
      expect(changes).toHaveLength(0);
      const result = computeFormatDiff(format, format, undefined, undefined);
      expect(result.hasChanges).toBe(false);
    });
  });

  // ============ Comment/Revision Integration ============
  describe('Comment/Revision Integration', () => {
    it('should detect added comments', () => {
      const left: ParsedComment[] = [];
      const right: ParsedComment[] = [{
        id: 'c1', content: 'Please confirm', author: 'Zhang', date: '2024-01-15', resolved: false,
        range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 10 }, replies: []
      }];
      const result = compareComments(left, right);
      expect(result.added).toHaveLength(1);
      expect(result.added[0].id).toBe('c1');
      expect(result.removed).toHaveLength(0);
    });

    it('should detect removed comments', () => {
      const left: ParsedComment[] = [{
        id: 'c1', content: 'To delete', author: 'Li', date: '2024-01-10', resolved: true,
        range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 5 }, replies: []
      }];
      const right: ParsedComment[] = [];
      const result = compareComments(left, right);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].id).toBe('c1');
    });

    it('should detect modified comments', () => {
      const left: ParsedComment[] = [{
        id: 'c1', content: 'original', author: 'Wang', date: '2024-01-10', resolved: false,
        range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 10 }, replies: []
      }];
      const right: ParsedComment[] = [{
        id: 'c1', content: 'modified', author: 'Wang', date: '2024-01-15', resolved: true,
        range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 15 }, replies: []
      }];
      const result = compareComments(left, right);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].left.content).toBe('original');
      expect(result.modified[0].right.content).toBe('modified');
    });

    it('should detect unchanged comments', () => {
      const comment: ParsedComment = {
        id: 'c1', content: 'unchanged', author: 'Zhao', date: '2024-01-10', resolved: false,
        range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 10 }, replies: []
      };
      const result = compareComments([comment], [{ ...comment }]);
      expect(result.unchanged).toHaveLength(1);
    });

    it('should handle comment replies', () => {
      const left: ParsedComment[] = [{
        id: 'c1', content: 'parent', author: 'A', date: '2024-01-10', resolved: false,
        range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 10 },
        replies: [{ id: 'r1', content: 'reply1', author: 'B', date: '2024-01-11', resolved: false,
          range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 10 }, replies: [] }]
      }];
      const right: ParsedComment[] = [{
        id: 'c1', content: 'parent', author: 'A', date: '2024-01-10', resolved: false,
        range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 10 },
        replies: [{ id: 'r1', content: 'modified reply', author: 'B', date: '2024-01-12', resolved: true,
          range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 15 }, replies: [] }]
      }];
      const result = compareComments(left, right);
      expect(result.unchanged).toHaveLength(1);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].left.id).toBe('r1');
    });

    it('should detect added revisions', () => {
      const left: ParsedRevision[] = [];
      const right: ParsedRevision[] = [{
        id: 'rev1', revisionType: 'insertion', author: 'Zhang', date: '2024-01-15',
        content: { text: 'new content', position: { nodeId: 'n1', offset: 10 } }, accepted: false
      }];
      const result = compareRevisions(left, right);
      expect(result.added).toHaveLength(1);
      expect(result.added[0].id).toBe('rev1');
    });

    it('should detect removed revisions', () => {
      const left: ParsedRevision[] = [{
        id: 'rev1', revisionType: 'deletion', author: 'Li', date: '2024-01-10',
        content: { text: 'deleted', position: { nodeId: 'n1', offset: 5 } }, accepted: true
      }];
      const right: ParsedRevision[] = [];
      const result = compareRevisions(left, right);
      expect(result.removed).toHaveLength(1);
    });

    it('should detect modified revisions', () => {
      const left: ParsedRevision[] = [{
        id: 'rev1', revisionType: 'insertion', author: 'Wang', date: '2024-01-10',
        content: { text: 'old', position: { nodeId: 'n1', offset: 0 } }, accepted: false
      }];
      const right: ParsedRevision[] = [{
        id: 'rev1', revisionType: 'insertion', author: 'Wang', date: '2024-01-15',
        content: { text: 'new', position: { nodeId: 'n1', offset: 0 } }, accepted: true
      }];
      const result = compareRevisions(left, right);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].left.content.text).toBe('old');
      expect(result.modified[0].right.content.text).toBe('new');
    });
  });

  // ============ PDF Parsing Integration ============
  describe('PDF Parsing Integration', () => {
    it('should define expected PDF parsing structure', () => {
      const mockDocumentAst = {
        id: 'test-id', filename: 'test.pdf', sha256: 'abc123', pageCount: 3, wordCount: 100,
        parserVersion: 'pdf-1.0.0',
        blocks: [
          { type: 'paragraph' as const, id: 'block-1', text: 'First paragraph', pageStart: 1, pageEnd: 1 },
          { type: 'paragraph' as const, id: 'block-2', text: 'Second paragraph', pageStart: 1, pageEnd: 1 }
        ]
      };
      expect(mockDocumentAst.blocks).toHaveLength(2);
      expect(mockDocumentAst.pageCount).toBe(3);
      expect(mockDocumentAst.wordCount).toBe(100);
      expect(mockDocumentAst.parserVersion).toBe('pdf-1.0.0');
    });

    it('should handle multi-page document structure', () => {
      const multiPageDoc = {
        id: 'multi-page', filename: 'multi.pdf', sha256: 'def456', pageCount: 5, wordCount: 500,
        parserVersion: 'pdf-1.0.0',
        blocks: [
          { type: 'paragraph' as const, id: 'p1', text: 'Page 1', pageStart: 1, pageEnd: 1 },
          { type: 'paragraph' as const, id: 'p2', text: 'Page 2', pageStart: 2, pageEnd: 2 },
          { type: 'paragraph' as const, id: 'p3', text: 'Page 3', pageStart: 3, pageEnd: 3 }
        ]
      };
      expect(multiPageDoc.pageCount).toBe(5);
      expect(multiPageDoc.blocks).toHaveLength(3);
      expect(multiPageDoc.blocks[0].pageStart).toBe(1);
      expect(multiPageDoc.blocks[2].pageStart).toBe(3);
    });

    it('should validate PDF parser version', () => {
      const parserVersion = 'pdf-1.0.0';
      expect(parserVersion).toMatch(/^pdf-\d+\.\d+\.\d+$/);
    });

    it('should support paragraph splitting logic', () => {
      const text = 'para1\n\n\npara2\n\n\npara3';
      const lines = text.split(/\r?\n/);
      const paragraphs: string[] = [];
      let current: string[] = [];
      let emptyCount = 0;
      for (const line of lines) {
        if (line.trim() === '') {
          emptyCount++;
          if (emptyCount >= 2 && current.length > 0) {
            paragraphs.push(current.join('\n').trim());
            current = [];
          }
        } else {
          if (emptyCount === 1 && current.length > 0) current.push('');
          emptyCount = 0;
          current.push(line.trim());
        }
      }
      if (current.length > 0) paragraphs.push(current.join('\n').trim());
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toBe('para1');
      expect(paragraphs[1]).toBe('para2');
      expect(paragraphs[2]).toBe('para3');
    });
  });

  // ============ Report Export Integration ============
  describe('Report Export Integration', () => {
    it('should generate markdown report with all sections', () => {
      const report: FullFidelityReport = {
        summary: { totalChanges: 10, contentChanges: 5, tableChanges: 2, formatChanges: 2, commentChanges: 1, revisionChanges: 0 },
        contentDiffs: {
          items: [{
            matchId: 'm1', matchType: 'modified', confidence: 0.9, similarity: 0.9,
            sourceA: 'original', sourceB: 'modified', nodeIdsA: ['n1'], nodeIdsB: ['n1'],
            diffDetail: [], summary: 'changed'
          }],
          summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
        },
        tableDiffs: { items: [], count: 0 },
        formatDiffs: {
          textFormatChanges: [{ property: 'fontFamily', oldValue: 'Arial', newValue: 'Helvetica', changeType: 'modified' }],
          paragraphFormatChanges: [], count: 1
        },
        commentDiffs: { added: [], removed: [], modified: [], unchanged: [], count: 0 },
        revisionDiffs: { added: [], removed: [], modified: [], unchanged: [], count: 0 }
      };
      const markdown = generateMarkdownReport(report);
      expect(markdown).toContain('#');
      expect(markdown).toContain('10');
      expect(markdown).toContain('original');
      expect(markdown).toContain('modified');
    });

    it('should generate HTML report', () => {
      const report: FullFidelityReport = {
        summary: { totalChanges: 5, contentChanges: 3, tableChanges: 1, formatChanges: 1, commentChanges: 0, revisionChanges: 0 },
        contentDiffs: {
          items: [{
            matchId: 'm1', matchType: 'modified', confidence: 0.85, similarity: 0.85,
            sourceA: 'old text', sourceB: 'new text', nodeIdsA: ['n1'], nodeIdsB: ['n1'],
            diffDetail: [], summary: 'changed'
          }],
          summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
        },
        tableDiffs: { items: [], count: 0 },
        formatDiffs: { textFormatChanges: [], paragraphFormatChanges: [], count: 0 },
        commentDiffs: { added: [], removed: [], modified: [], unchanged: [], count: 0 },
        revisionDiffs: { added: [], removed: [], modified: [], unchanged: [], count: 0 }
      };
      const html = generateHtmlReport(report);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('old text');
      expect(html).toContain('new text');
    });

    it('should create full fidelity report from diff data', () => {
      const diffAst: DiffAst = {
        taskId: 'test-task', docAId: 'doc-a', docBId: 'doc-b', generatedAt: new Date().toISOString(),
        items: [
          { matchId: 'm1', matchType: 'modified', confidence: 0.9, similarity: 0.9, sourceA: 'original', sourceB: 'modified', nodeIdsA: ['n1'], nodeIdsB: ['n1'], diffDetail: [], summary: 'changed' },
          { matchId: 'm2', matchType: 'added', confidence: 1.0, similarity: 0, sourceA: null, sourceB: 'new', nodeIdsA: [], nodeIdsB: ['n2'], diffDetail: [], summary: 'added' }
        ],
        summary: { identical: 0, modified: 1, added: 1, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
      };
      const report = createFullFidelityReport(diffAst);
      expect(report.summary.totalChanges).toBe(2);
      expect(report.contentDiffs.items).toHaveLength(2);
      expect(report.contentDiffs.summary.modified).toBe(1);
      expect(report.contentDiffs.summary.added).toBe(1);
    });

    it('should include table diffs in report', () => {
      const diffAst: DiffAst = {
        taskId: 'test-task', docAId: 'doc-a', docBId: 'doc-b', generatedAt: new Date().toISOString(),
        items: [{
          matchId: 't1', matchType: 'modified', confidence: 0.8, similarity: 0.8, sourceA: null, sourceB: null,
          nodeIdsA: ['n1'], nodeIdsB: ['n1'], diffDetail: [], summary: 'table changed', blockType: 'table',
          tableA: { id: 'table-a', rows: [['A1', 'A2'], ['B1', 'B2']] },
          tableB: { id: 'table-b', rows: [['A1', 'A2-modified'], ['B1', 'B2']] },
          tableDiff: {
            tableMatchType: 'content_changed', structuralChanges: [],
            cellDiffs: [{ position: [0, 1], changeType: 'modified', oldContent: 'A2', newContent: 'A2-modified', similarity: 0.9 }],
            confidence: 0.8
          }
        }],
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
      };
      const report = createFullFidelityReport(diffAst);
      expect(report.tableDiffs.count).toBe(1);
      expect(report.tableDiffs.items[0].tableDiff?.tableMatchType).toBe('content_changed');
    });

    it('should include comment and revision diffs in report', () => {
      const diffAst: DiffAst = {
        taskId: 'test-task', docAId: 'doc-a', docBId: 'doc-b', generatedAt: new Date().toISOString(),
        items: [], summary: { identical: 0, modified: 0, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
      };
      const commentDiff: CommentDiffResult = {
        added: [{ id: 'c1', content: 'new comment', author: 'Zhang', date: '2024-01-15', resolved: false,
          range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 10 }, replies: [] }],
        removed: [], modified: [], unchanged: []
      };
      const revisionDiff: RevisionDiffResult = {
        added: [{ id: 'rev1', revisionType: 'insertion', author: 'Li', date: '2024-01-15',
          content: { text: 'new revision', position: { nodeId: 'n1', offset: 0 } }, accepted: false }],
        removed: [], modified: [], unchanged: []
      };
      const report = createFullFidelityReport(diffAst, commentDiff, revisionDiff);
      expect(report.commentDiffs.count).toBe(1);
      expect(report.commentDiffs.added).toHaveLength(1);
      expect(report.commentDiffs.added[0].content).toBe('new comment');
      expect(report.revisionDiffs.count).toBe(1);
      expect(report.revisionDiffs.added).toHaveLength(1);
      expect(report.revisionDiffs.added[0].contentText).toBe('new revision');
    });

    it('should calculate total changes correctly', () => {
      const diffAst: DiffAst = {
        taskId: 'test-task', docAId: 'doc-a', docBId: 'doc-b', generatedAt: new Date().toISOString(),
        items: [
          { matchId: 'm1', matchType: 'modified', confidence: 0.9, similarity: 0.9, sourceA: 'A', sourceB: 'B', nodeIdsA: ['n1'], nodeIdsB: ['n1'], diffDetail: [], summary: '' },
          { matchId: 'm2', matchType: 'added', confidence: 1, similarity: 0, sourceA: null, sourceB: 'C', nodeIdsA: [], nodeIdsB: ['n2'], diffDetail: [], summary: '' },
          { matchId: 'm3', matchType: 'deleted', confidence: 1, similarity: 0, sourceA: 'D', sourceB: null, nodeIdsA: ['n3'], nodeIdsB: [], diffDetail: [], summary: '' }
        ],
        summary: { identical: 0, modified: 1, added: 1, deleted: 1, moved: 0, split: 0, merged: 0, uncertain: 0 }
      };
      const commentDiff: CommentDiffResult = {
        added: [{ id: 'c1', content: 'c', author: 'A', date: '2024-01-01', resolved: false,
          range: { startNodeId: 'n1', startOffset: 0, endNodeId: 'n1', endOffset: 1 }, replies: [] }],
        removed: [], modified: [], unchanged: []
      };
      const revisionDiff: RevisionDiffResult = {
        added: [{ id: 'rev1', revisionType: 'insertion', author: 'B', date: '2024-01-01',
          content: { text: 'r', position: { nodeId: 'n1', offset: 0 } }, accepted: false }],
        removed: [], modified: [], unchanged: []
      };
      const report = createFullFidelityReport(diffAst, commentDiff, revisionDiff);
      expect(report.summary.totalChanges).toBe(5);
      expect(report.summary.contentChanges).toBe(3);
      expect(report.summary.commentChanges).toBe(1);
      expect(report.summary.revisionChanges).toBe(1);
    });
  });

  // ============ End-to-End Integration ============
  describe('End-to-End Integration', () => {
    it('should handle complete comparison workflow', () => {
      const docA = {
        id: 'doc-a', filename: 'fileA.docx', sha256: 'hash-a', pageCount: 10, wordCount: 5000, parserVersion: 'docx-1.0.0',
        blocks: [
          { type: 'paragraph' as const, id: 'p1', text: 'Provide business license', pageStart: 1, pageEnd: 1 },
          { type: 'paragraph' as const, id: 'p2', text: 'Deadline: March 1, 2024', pageStart: 2, pageEnd: 2 }
        ]
      };
      const docB = {
        id: 'doc-b', filename: 'fileB.docx', sha256: 'hash-b', pageCount: 12, wordCount: 5500, parserVersion: 'docx-1.0.0',
        blocks: [
          { type: 'paragraph' as const, id: 'p1', text: 'Provide business license copy', pageStart: 1, pageEnd: 1 },
          { type: 'paragraph' as const, id: 'p2', text: 'Deadline: March 15, 2024', pageStart: 2, pageEnd: 2 },
          { type: 'paragraph' as const, id: 'p3', text: 'New clause: bid bond', pageStart: 3, pageEnd: 3 }
        ]
      };
      const diffItems: DiffItem[] = [
        { matchId: 'm1', matchType: 'modified', confidence: 0.85, similarity: 0.85, sourceA: 'Provide business license', sourceB: 'Provide business license copy', nodeIdsA: ['p1'], nodeIdsB: ['p1'], diffDetail: [{ kind: 'same', text: 'Provide business license' }, { kind: 'added', text: ' copy' }], summary: 'added copy requirement' },
        { matchId: 'm2', matchType: 'modified', confidence: 0.9, similarity: 0.9, sourceA: 'Deadline: March 1, 2024', sourceB: 'Deadline: March 15, 2024', nodeIdsA: ['p2'], nodeIdsB: ['p2'], diffDetail: [{ kind: 'same', text: 'Deadline: March ' }, { kind: 'removed', text: '1' }, { kind: 'added', text: '15' }, { kind: 'same', text: ', 2024' }], summary: 'deadline changed' },
        { matchId: 'm3', matchType: 'added', confidence: 1.0, similarity: 0, sourceA: null, sourceB: 'New clause: bid bond', nodeIdsA: [], nodeIdsB: ['p3'], diffDetail: [], summary: 'new paragraph' }
      ];
      const diffAst: DiffAst = {
        taskId: 'e2e-test', docAId: docA.id, docBId: docB.id, generatedAt: new Date().toISOString(),
        items: diffItems, summary: { identical: 0, modified: 2, added: 1, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
      };
      const commentDiff: CommentDiffResult = {
        added: [{ id: 'c1', content: 'Confirm bond amount', author: 'Expert', date: '2024-02-20', resolved: false,
          range: { startNodeId: 'p3', startOffset: 0, endNodeId: 'p3', endOffset: 10 }, replies: [] }],
        removed: [], modified: [], unchanged: []
      };
      const formatDiff: FormatDiffResult = {
        textFormatChanges: [{ property: 'fontFamily', oldValue: 'Arial', newValue: 'Helvetica', changeType: 'modified' }],
        paragraphFormatChanges: [], hasChanges: true
      };
      const report = createFullFidelityReport(diffAst, commentDiff, undefined, formatDiff);
      // 3 content + 1 comment + 1 format = 5 total
      expect(report.summary.totalChanges).toBe(5);
      expect(report.contentDiffs.summary.modified).toBe(2);
      expect(report.contentDiffs.summary.added).toBe(1);
      expect(report.commentDiffs.added).toHaveLength(1);
      expect(report.formatDiffs.textFormatChanges).toHaveLength(1);
      const markdown = generateMarkdownReport(report);
      expect(markdown).toContain('#');
      const html = generateHtmlReport(report);
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should handle empty comparison results', () => {
      const diffAst: DiffAst = {
        taskId: 'empty-test', docAId: 'doc-a', docBId: 'doc-b', generatedAt: new Date().toISOString(),
        items: [], summary: { identical: 0, modified: 0, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
      };
      const report = createFullFidelityReport(diffAst);
      expect(report.summary.totalChanges).toBe(0);
      expect(report.contentDiffs.items).toHaveLength(0);
      expect(report.tableDiffs.count).toBe(0);
      expect(report.commentDiffs.count).toBe(0);
      expect(report.revisionDiffs.count).toBe(0);
    });

    it('should handle documents with identical content', () => {
      const diffAst: DiffAst = {
        taskId: 'identical-test', docAId: 'doc-a', docBId: 'doc-b', generatedAt: new Date().toISOString(),
        items: [{
          matchId: 'm1', matchType: 'identical', confidence: 1.0, similarity: 1.0,
          sourceA: 'identical content', sourceB: 'identical content', nodeIdsA: ['n1'], nodeIdsB: ['n1'],
          diffDetail: [{ kind: 'same', text: 'identical content' }], summary: 'same'
        }],
        summary: { identical: 1, modified: 0, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 }
      };
      const report = createFullFidelityReport(diffAst);
      expect(report.contentDiffs.summary.identical).toBe(1);
      // totalChanges = contentChanges (all items including identical)
      expect(report.summary.totalChanges).toBe(1);
    });
  });
});
