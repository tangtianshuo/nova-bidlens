import { describe, expect, it } from 'vitest';
import {
  generateMarkdownReport,
  generateHtmlReport,
  createFullFidelityReport
} from './report-export.js';
import type {
  FullFidelityReport,
  ReportSummary,
  ContentDiffSection,
  TableDiffSection,
  FormatDiffSection,
  CommentDiffSection,
  RevisionDiffSection
} from './report-export.js';
import type { DiffItem, MatchType } from './diff-ast.js';
import type { CommentDiffResult, RevisionDiffResult } from './comment-diff.js';
import type { FormatDiffResult } from './format-diff.js';

describe('generateMarkdownReport', () => {
  it('should generate report with summary statistics', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 10,
        contentChanges: 5,
        tableChanges: 2,
        formatChanges: 1,
        commentChanges: 1,
        revisionChanges: 1
      },
      contentDiffs: {
        items: [],
        summary: {
          identical: 0,
          modified: 3,
          added: 1,
          deleted: 1,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: { items: [], count: 0 },
      formatDiffs: {
        textFormatChanges: [],
        paragraphFormatChanges: [],
        count: 0
      },
      commentDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      },
      revisionDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      }
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('# 文档比对报告');
    expect(markdown).toContain('## 总体统计');
    expect(markdown).toContain('- 总变更数: 10');
    expect(markdown).toContain('- 内容变更: 5');
    expect(markdown).toContain('- 表格变更: 2');
    expect(markdown).toContain('- 格式变更: 1');
    expect(markdown).toContain('- 批注变更: 1');
    expect(markdown).toContain('- 修订变更: 1');
  });

  it('should generate content diff section', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 1,
        contentChanges: 1,
        tableChanges: 0,
        formatChanges: 0,
        commentChanges: 0,
        revisionChanges: 0
      },
      contentDiffs: {
        items: [
          {
            matchId: '1',
            matchType: 'modified',
            confidence: 0.9,
            similarity: 0.85,
            sourceA: '原始文本',
            sourceB: '修改后文本',
            nodeIdsA: ['node1'],
            nodeIdsB: ['node1'],
            diffDetail: [
              { kind: 'removed', text: '原始' },
              { kind: 'added', text: '修改后' },
              { kind: 'same', text: '文本' }
            ],
            summary: '文本已修改'
          }
        ],
        summary: {
          identical: 0,
          modified: 1,
          added: 0,
          deleted: 0,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: { items: [], count: 0 },
      formatDiffs: {
        textFormatChanges: [],
        paragraphFormatChanges: [],
        count: 0
      },
      commentDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      },
      revisionDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      }
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('## 内容差异');
    expect(markdown).toContain('### 变更统计');
    expect(markdown).toContain('- 修改: 1');
    expect(markdown).toContain('### 详细差异');
    expect(markdown).toContain('**已修改** (相似度: 85%)');
    expect(markdown).toContain('文本已修改');
  });

  it('should generate table diff section', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 1,
        contentChanges: 0,
        tableChanges: 1,
        formatChanges: 0,
        commentChanges: 0,
        revisionChanges: 0
      },
      contentDiffs: {
        items: [],
        summary: {
          identical: 0,
          modified: 0,
          added: 0,
          deleted: 0,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: {
        items: [
          {
            matchId: 'table1',
            matchType: 'modified',
            confidence: 0.8,
            similarity: 0.75,
            sourceA: null,
            sourceB: null,
            nodeIdsA: [],
            nodeIdsB: [],
            diffDetail: [],
            summary: '表格已修改',
            blockType: 'table',
            tableDiff: {
              tableMatchType: 'content_changed',
              structuralChanges: [],
              cellDiffs: [
                {
                  position: [0, 0],
                  changeType: 'modified',
                  oldContent: '旧内容',
                  newContent: '新内容',
                  similarity: 0.9
                }
              ],
              confidence: 0.8
            }
          }
        ],
        count: 1
      },
      formatDiffs: {
        textFormatChanges: [],
        paragraphFormatChanges: [],
        count: 0
      },
      commentDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      },
      revisionDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      }
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('## 表格差异');
    expect(markdown).toContain('共 1 个表格变更');
    expect(markdown).toContain('### 表格 table1');
    expect(markdown).toContain('- 匹配类型: content_changed');
    expect(markdown).toContain('- 置信度: 80%');
    expect(markdown).toContain('- [0, 0]: 已修改');
  });

  it('should generate format diff section', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 1,
        contentChanges: 0,
        tableChanges: 0,
        formatChanges: 1,
        commentChanges: 0,
        revisionChanges: 0
      },
      contentDiffs: {
        items: [],
        summary: {
          identical: 0,
          modified: 0,
          added: 0,
          deleted: 0,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: { items: [], count: 0 },
      formatDiffs: {
        textFormatChanges: [
          {
            property: 'fontSize',
            oldValue: 12,
            newValue: 14,
            changeType: 'modified'
          }
        ],
        paragraphFormatChanges: [],
        count: 1
      },
      commentDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      },
      revisionDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      }
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('## 格式差异');
    expect(markdown).toContain('共 1 处格式变更');
    expect(markdown).toContain('### 文本格式');
    expect(markdown).toContain('- **fontSize**: 已修改');
    expect(markdown).toContain('- 旧值: 12');
    expect(markdown).toContain('- 新值: 14');
  });

  it('should generate comment diff section', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 1,
        contentChanges: 0,
        tableChanges: 0,
        formatChanges: 0,
        commentChanges: 1,
        revisionChanges: 0
      },
      contentDiffs: {
        items: [],
        summary: {
          identical: 0,
          modified: 0,
          added: 0,
          deleted: 0,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: { items: [], count: 0 },
      formatDiffs: {
        textFormatChanges: [],
        paragraphFormatChanges: [],
        count: 0
      },
      commentDiffs: {
        added: [
          {
            id: 'comment1',
            content: '这是一个新批注',
            author: '张三',
            date: '2024-01-01'
          }
        ],
        removed: [],
        modified: [],
        unchanged: [],
        count: 1
      },
      revisionDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      }
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('## 批注差异');
    expect(markdown).toContain('- 新增批注: 1');
    expect(markdown).toContain('### 新增批注');
    expect(markdown).toContain('**张三** (2024-01-01)');
    expect(markdown).toContain('"这是一个新批注"');
  });

  it('should generate revision diff section', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 1,
        contentChanges: 0,
        tableChanges: 0,
        formatChanges: 0,
        commentChanges: 0,
        revisionChanges: 1
      },
      contentDiffs: {
        items: [],
        summary: {
          identical: 0,
          modified: 0,
          added: 0,
          deleted: 0,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: { items: [], count: 0 },
      formatDiffs: {
        textFormatChanges: [],
        paragraphFormatChanges: [],
        count: 0
      },
      commentDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      },
      revisionDiffs: {
        added: [
          {
            id: 'rev1',
            revisionType: 'insert',
            author: '李四',
            date: '2024-01-02',
            contentText: '新增内容'
          }
        ],
        removed: [],
        modified: [],
        unchanged: [],
        count: 1
      }
    };

    const markdown = generateMarkdownReport(report);

    expect(markdown).toContain('## 修订差异');
    expect(markdown).toContain('- 新增修订: 1');
    expect(markdown).toContain('### 新增修订');
    expect(markdown).toContain('**李四** (2024-01-02)');
    expect(markdown).toContain('- 类型: insert');
    expect(markdown).toContain('- 内容: "新增内容"');
  });
});

describe('generateHtmlReport', () => {
  it('should generate valid HTML structure', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 0,
        contentChanges: 0,
        tableChanges: 0,
        formatChanges: 0,
        commentChanges: 0,
        revisionChanges: 0
      },
      contentDiffs: {
        items: [],
        summary: {
          identical: 0,
          modified: 0,
          added: 0,
          deleted: 0,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: { items: [], count: 0 },
      formatDiffs: {
        textFormatChanges: [],
        paragraphFormatChanges: [],
        count: 0
      },
      commentDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      },
      revisionDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      }
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('<head>');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<title>文档比对报告</title>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('should generate HTML with content diff section', () => {
    const report: FullFidelityReport = {
      summary: {
        totalChanges: 1,
        contentChanges: 1,
        tableChanges: 0,
        formatChanges: 0,
        commentChanges: 0,
        revisionChanges: 0
      },
      contentDiffs: {
        items: [
          {
            matchId: '1',
            matchType: 'modified',
            confidence: 0.9,
            similarity: 0.85,
            sourceA: '原始文本',
            sourceB: '修改后文本',
            nodeIdsA: ['node1'],
            nodeIdsB: ['node1'],
            diffDetail: [],
            summary: '文本已修改'
          }
        ],
        summary: {
          identical: 0,
          modified: 1,
          added: 0,
          deleted: 0,
          moved: 0,
          split: 0,
          merged: 0,
          uncertain: 0
        }
      },
      tableDiffs: { items: [], count: 0 },
      formatDiffs: {
        textFormatChanges: [],
        paragraphFormatChanges: [],
        count: 0
      },
      commentDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      },
      revisionDiffs: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        count: 0
      }
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<h2>内容差异</h2>');
    expect(html).toContain('<h3>变更统计</h3>');
    expect(html).toContain('<li>修改: 1</li>');
    expect(html).toContain('<h3>详细差异</h3>');
    expect(html).toContain('class="change change-modified"');
    expect(html).toContain('<strong>已修改</strong> (相似度: 85%)');
  });
});

describe('createFullFidelityReport', () => {
  it('should create report from DiffAst', () => {
    const diffAst = {
      taskId: 'task1',
      docAId: 'docA',
      docBId: 'docB',
      generatedAt: '2024-01-01',
      items: [
        {
          matchId: '1',
          matchType: 'modified' as MatchType,
          confidence: 0.9,
          similarity: 0.85,
          sourceA: '原始文本',
          sourceB: '修改后文本',
          nodeIdsA: ['node1'],
          nodeIdsB: ['node1'],
          diffDetail: [],
          summary: '文本已修改'
        }
      ],
      summary: {
        identical: 0,
        modified: 1,
        added: 0,
        deleted: 0,
        moved: 0,
        split: 0,
        merged: 0,
        uncertain: 0
      }
    };

    const report = createFullFidelityReport(diffAst);

    expect(report.summary.totalChanges).toBe(1);
    expect(report.summary.contentChanges).toBe(1);
    expect(report.summary.tableChanges).toBe(0);
    expect(report.contentDiffs.items).toHaveLength(1);
    expect(report.contentDiffs.summary.modified).toBe(1);
  });

  it('should separate table and content diffs', () => {
    const diffAst = {
      taskId: 'task1',
      docAId: 'docA',
      docBId: 'docB',
      generatedAt: '2024-01-01',
      items: [
        {
          matchId: '1',
          matchType: 'modified' as MatchType,
          confidence: 0.9,
          similarity: 0.85,
          sourceA: '原始文本',
          sourceB: '修改后文本',
          nodeIdsA: ['node1'],
          nodeIdsB: ['node1'],
          diffDetail: [],
          summary: '文本已修改'
        },
        {
          matchId: 'table1',
          matchType: 'modified' as MatchType,
          confidence: 0.8,
          similarity: 0.75,
          sourceA: null,
          sourceB: null,
          nodeIdsA: [],
          nodeIdsB: [],
          diffDetail: [],
          summary: '表格已修改',
          blockType: 'table' as const,
          tableDiff: {
            tableMatchType: 'content_changed' as const,
            structuralChanges: [],
            cellDiffs: [],
            confidence: 0.8
          }
        }
      ],
      summary: {
        identical: 0,
        modified: 2,
        added: 0,
        deleted: 0,
        moved: 0,
        split: 0,
        merged: 0,
        uncertain: 0
      }
    };

    const report = createFullFidelityReport(diffAst);

    expect(report.summary.totalChanges).toBe(2);
    expect(report.summary.contentChanges).toBe(1);
    expect(report.summary.tableChanges).toBe(1);
    expect(report.contentDiffs.items).toHaveLength(1);
    expect(report.tableDiffs.items).toHaveLength(1);
  });

  it('should include comment and revision diffs', () => {
    const diffAst = {
      taskId: 'task1',
      docAId: 'docA',
      docBId: 'docB',
      generatedAt: '2024-01-01',
      items: [],
      summary: {
        identical: 0,
        modified: 0,
        added: 0,
        deleted: 0,
        moved: 0,
        split: 0,
        merged: 0,
        uncertain: 0
      }
    };

    const commentDiff: CommentDiffResult = {
      added: [
        {
          id: 'comment1',
          content: '新批注',
          author: '张三',
          date: '2024-01-01',
          range: {
            startNodeId: 'node1',
            startOffset: 0,
            endNodeId: 'node1',
            endOffset: 10
          },
          replies: [],
          resolved: false
        }
      ],
      removed: [],
      modified: [],
      unchanged: []
    };

    const revisionDiff: RevisionDiffResult = {
      added: [
        {
          id: 'rev1',
          revisionType: 'insert',
          author: '李四',
          date: '2024-01-02',
          content: {
            text: '新增内容',
            format: undefined,
            position: { nodeId: 'node1', offset: 0 }
          },
          accepted: undefined
        }
      ],
      removed: [],
      modified: [],
      unchanged: []
    };

    const report = createFullFidelityReport(diffAst, commentDiff, revisionDiff);

    expect(report.summary.commentChanges).toBe(1);
    expect(report.summary.revisionChanges).toBe(1);
    expect(report.commentDiffs.added).toHaveLength(1);
    expect(report.revisionDiffs.added).toHaveLength(1);
  });
});

