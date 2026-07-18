import type { DiffAst, DiffItem, MatchType } from './diff-ast.js';
import type { CommentDiffResult, RevisionDiffResult } from './comment-diff.js';
import type { FormatDiffResult } from './format-diff.js';
import type { TableDiffResult } from './table-diff.js';

// ============ 报告接口定义 ============

export interface FullFidelityReport {
  summary: ReportSummary;
  contentDiffs: ContentDiffSection;
  tableDiffs: TableDiffSection;
  formatDiffs: FormatDiffSection;
  commentDiffs: CommentDiffSection;
  revisionDiffs: RevisionDiffSection;
}

export interface ReportSummary {
  totalChanges: number;
  contentChanges: number;
  tableChanges: number;
  formatChanges: number;
  commentChanges: number;
  revisionChanges: number;
}

export interface ContentDiffSection {
  items: DiffItem[];
  summary: {
    identical: number;
    modified: number;
    added: number;
    deleted: number;
    moved: number;
    split: number;
    merged: number;
    uncertain: number;
  };
}

export interface TableDiffSection {
  items: DiffItem[];
  count: number;
}

export interface FormatDiffSection {
  textFormatChanges: FormatChange[];
  paragraphFormatChanges: FormatChange[];
  count: number;
}

export interface FormatChange {
  property: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

export interface CommentDiffSection {
  added: CommentInfo[];
  removed: CommentInfo[];
  modified: CommentDiffInfo[];
  unchanged: CommentInfo[];
  count: number;
}

export interface CommentInfo {
  id: string;
  content: string;
  author: string;
  date: string;
}

export interface CommentDiffInfo {
  left: CommentInfo;
  right: CommentInfo;
  changes: {
    field: string;
    leftValue: unknown;
    rightValue: unknown;
  }[];
}

export interface RevisionDiffSection {
  added: RevisionInfo[];
  removed: RevisionInfo[];
  modified: RevisionDiffInfo[];
  unchanged: RevisionInfo[];
  count: number;
}

export interface RevisionInfo {
  id: string;
  revisionType: string;
  author: string;
  date: string;
  contentText: string;
}

export interface RevisionDiffInfo {
  left: RevisionInfo;
  right: RevisionInfo;
  changes: {
    field: string;
    leftValue: unknown;
    rightValue: unknown;
  }[];
}

// ============ 报告生成函数 ============

export function generateMarkdownReport(report: FullFidelityReport): string {
  const lines: string[] = [];
  
  // 标题
  lines.push('# 文档比对报告');
  lines.push('');
  
  // 总体统计
  lines.push('## 总体统计');
  lines.push('');
  lines.push(`- 总变更数: ${report.summary.totalChanges}`);
  lines.push(`- 内容变更: ${report.summary.contentChanges}`);
  lines.push(`- 表格变更: ${report.summary.tableChanges}`);
  lines.push(`- 格式变更: ${report.summary.formatChanges}`);
  lines.push(`- 批注变更: ${report.summary.commentChanges}`);
  lines.push(`- 修订变更: ${report.summary.revisionChanges}`);
  lines.push('');
  
  // 内容差异章节
  if (report.contentDiffs.items.length > 0) {
    lines.push('## 内容差异');
    lines.push('');
    lines.push('### 变更统计');
    lines.push('');
    lines.push(`- 完全相同: ${report.contentDiffs.summary.identical}`);
    lines.push(`- 修改: ${report.contentDiffs.summary.modified}`);
    lines.push(`- 新增: ${report.contentDiffs.summary.added}`);
    lines.push(`- 删除: ${report.contentDiffs.summary.deleted}`);
    lines.push(`- 移动: ${report.contentDiffs.summary.moved}`);
    lines.push(`- 拆分: ${report.contentDiffs.summary.split}`);
    lines.push(`- 合并: ${report.contentDiffs.summary.merged}`);
    lines.push(`- 不确定: ${report.contentDiffs.summary.uncertain}`);
    lines.push('');
    
    lines.push('### 详细差异');
    lines.push('');
    for (const item of report.contentDiffs.items) {
      lines.push(`- **${getMatchTypeLabel(item.matchType)}** (相似度: ${(item.similarity * 100).toFixed(0)}%)`);
      lines.push(`  - ${item.summary}`);
      if (item.sourceA) {
        lines.push(`  - 文档A: "${truncateText(item.sourceA, 50)}"`);
      }
      if (item.sourceB) {
        lines.push(`  - 文档B: "${truncateText(item.sourceB, 50)}"`);
      }
      lines.push('');
    }
  }
  
  // 表格差异章节
  if (report.tableDiffs.items.length > 0) {
    lines.push('## 表格差异');
    lines.push('');
    lines.push(`共 ${report.tableDiffs.count} 个表格变更`);
    lines.push('');
    
    for (const item of report.tableDiffs.items) {
      if (item.tableDiff) {
        lines.push(`### 表格 ${item.matchId}`);
        lines.push('');
        lines.push(`- 匹配类型: ${item.tableDiff.tableMatchType}`);
        lines.push(`- 置信度: ${(item.tableDiff.confidence * 100).toFixed(0)}%`);
        lines.push(`- 单元格变更数: ${item.tableDiff.cellDiffs.length}`);
        lines.push('');
        
        // 列出单元格变更
        for (const cellDiff of item.tableDiff.cellDiffs) {
          lines.push(`  - [${cellDiff.position[0]}, ${cellDiff.position[1]}]: ${getChangeTypeLabel(cellDiff.changeType)}`);
          if (cellDiff.oldContent && cellDiff.newContent) {
            lines.push(`    - "${truncateText(cellDiff.oldContent, 30)}" → "${truncateText(cellDiff.newContent, 30)}"`);
          }
        }
        lines.push('');
      }
    }
  }
  
  // 格式差异章节
  if (report.formatDiffs.count > 0) {
    lines.push('## 格式差异');
    lines.push('');
    lines.push(`共 ${report.formatDiffs.count} 处格式变更`);
    lines.push('');
    
    if (report.formatDiffs.textFormatChanges.length > 0) {
      lines.push('### 文本格式');
      lines.push('');
      for (const change of report.formatDiffs.textFormatChanges) {
        lines.push(`- **${change.property}**: ${getChangeTypeLabel(change.changeType)}`);
        lines.push(`  - 旧值: ${formatValue(change.oldValue)}`);
        lines.push(`  - 新值: ${formatValue(change.newValue)}`);
      }
      lines.push('');
    }
    
    if (report.formatDiffs.paragraphFormatChanges.length > 0) {
      lines.push('### 段落格式');
      lines.push('');
      for (const change of report.formatDiffs.paragraphFormatChanges) {
        lines.push(`- **${change.property}**: ${getChangeTypeLabel(change.changeType)}`);
        lines.push(`  - 旧值: ${formatValue(change.oldValue)}`);
        lines.push(`  - 新值: ${formatValue(change.newValue)}`);
      }
      lines.push('');
    }
  }
  
  // 批注差异章节
  if (report.commentDiffs.count > 0) {
    lines.push('## 批注差异');
    lines.push('');
    lines.push(`- 新增批注: ${report.commentDiffs.added.length}`);
    lines.push(`- 删除批注: ${report.commentDiffs.removed.length}`);
    lines.push(`- 修改批注: ${report.commentDiffs.modified.length}`);
    lines.push(`- 未变批注: ${report.commentDiffs.unchanged.length}`);
    lines.push('');
    
    if (report.commentDiffs.added.length > 0) {
      lines.push('### 新增批注');
      lines.push('');
      for (const comment of report.commentDiffs.added) {
        lines.push(`- **${comment.author}** (${comment.date})`);
        lines.push(`  "${comment.content}"`);
      }
      lines.push('');
    }
    
    if (report.commentDiffs.removed.length > 0) {
      lines.push('### 删除批注');
      lines.push('');
      for (const comment of report.commentDiffs.removed) {
        lines.push(`- **${comment.author}** (${comment.date})`);
        lines.push(`  "${comment.content}"`);
      }
      lines.push('');
    }
    
    if (report.commentDiffs.modified.length > 0) {
      lines.push('### 修改批注');
      lines.push('');
      for (const diff of report.commentDiffs.modified) {
        lines.push(`- **${diff.left.author}** (${diff.left.date})`);
        for (const change of diff.changes) {
          lines.push(`  - ${change.field}: "${formatValue(change.leftValue)}" → "${formatValue(change.rightValue)}"`);
        }
      }
      lines.push('');
    }
  }
  
  // 修订差异章节
  if (report.revisionDiffs.count > 0) {
    lines.push('## 修订差异');
    lines.push('');
    lines.push(`- 新增修订: ${report.revisionDiffs.added.length}`);
    lines.push(`- 删除修订: ${report.revisionDiffs.removed.length}`);
    lines.push(`- 修改修订: ${report.revisionDiffs.modified.length}`);
    lines.push(`- 未变修订: ${report.revisionDiffs.unchanged.length}`);
    lines.push('');
    
    if (report.revisionDiffs.added.length > 0) {
      lines.push('### 新增修订');
      lines.push('');
      for (const revision of report.revisionDiffs.added) {
        lines.push(`- **${revision.author}** (${revision.date})`);
        lines.push(`  - 类型: ${revision.revisionType}`);
        lines.push(`  - 内容: "${truncateText(revision.contentText, 50)}"`);
      }
      lines.push('');
    }
    
    if (report.revisionDiffs.removed.length > 0) {
      lines.push('### 删除修订');
      lines.push('');
      for (const revision of report.revisionDiffs.removed) {
        lines.push(`- **${revision.author}** (${revision.date})`);
        lines.push(`  - 类型: ${revision.revisionType}`);
        lines.push(`  - 内容: "${truncateText(revision.contentText, 50)}"`);
      }
      lines.push('');
    }
    
    if (report.revisionDiffs.modified.length > 0) {
      lines.push('### 修改修订');
      lines.push('');
      for (const diff of report.revisionDiffs.modified) {
        lines.push(`- **${diff.left.author}** (${diff.left.date})`);
        lines.push(`  - 类型: ${diff.left.revisionType}`);
        for (const change of diff.changes) {
          lines.push(`  - ${change.field}: "${formatValue(change.leftValue)}" → "${formatValue(change.rightValue)}"`);
        }
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

export function generateHtmlReport(report: FullFidelityReport): string {
  const html: string[] = [];
  
  html.push('<!DOCTYPE html>');
  html.push('<html lang="zh-CN">');
  html.push('<head>');
  html.push('  <meta charset="UTF-8">');
  html.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  html.push('  <title>文档比对报告</title>');
  html.push('  <style>');
  html.push('    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }');
  html.push('    h1, h2, h3 { color: #333; }');
  html.push('    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }');
  html.push('    .change { margin: 10px 0; padding: 10px; background: #fff; border-left: 4px solid #ccc; }');
  html.push('    .change-added { border-left-color: #28a745; background: #d4edda; }');
  html.push('    .change-removed { border-left-color: #dc3545; background: #f8d7da; }');
  html.push('    .change-modified { border-left-color: #ffc107; background: #fff3cd; }');
  html.push('    .change-identical { border-left-color: #6c757d; background: #f8f9fa; }');
  html.push('    table { border-collapse: collapse; width: 100%; margin: 20px 0; }');
  html.push('    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
  html.push('    th { background-color: #f2f2f2; }');
  html.push('    .cell-changed { background-color: #fff3cd; }');
  html.push('    .cell-added { background-color: #d4edda; }');
  html.push('    .cell-deleted { background-color: #f8d7da; }');
  html.push('  </style>');
  html.push('</head>');
  html.push('<body>');
  
  // 标题
  html.push('<h1>文档比对报告</h1>');
  
  // 总体统计
  html.push('<div class="summary">');
  html.push('  <h2>总体统计</h2>');
  html.push('  <ul>');
  html.push(`    <li>总变更数: ${report.summary.totalChanges}</li>`);
  html.push(`    <li>内容变更: ${report.summary.contentChanges}</li>`);
  html.push(`    <li>表格变更: ${report.summary.tableChanges}</li>`);
  html.push(`    <li>格式变更: ${report.summary.formatChanges}</li>`);
  html.push(`    <li>批注变更: ${report.summary.commentChanges}</li>`);
  html.push(`    <li>修订变更: ${report.summary.revisionChanges}</li>`);
  html.push('  </ul>');
  html.push('</div>');
  
  // 内容差异章节
  if (report.contentDiffs.items.length > 0) {
    html.push('<h2>内容差异</h2>');
    html.push('<h3>变更统计</h3>');
    html.push('<ul>');
    html.push(`  <li>完全相同: ${report.contentDiffs.summary.identical}</li>`);
    html.push(`  <li>修改: ${report.contentDiffs.summary.modified}</li>`);
    html.push(`  <li>新增: ${report.contentDiffs.summary.added}</li>`);
    html.push(`  <li>删除: ${report.contentDiffs.summary.deleted}</li>`);
    html.push(`  <li>移动: ${report.contentDiffs.summary.moved}</li>`);
    html.push(`  <li>拆分: ${report.contentDiffs.summary.split}</li>`);
    html.push(`  <li>合并: ${report.contentDiffs.summary.merged}</li>`);
    html.push(`  <li>不确定: ${report.contentDiffs.summary.uncertain}</li>`);
    html.push('</ul>');
    
    html.push('<h3>详细差异</h3>');
    for (const item of report.contentDiffs.items) {
      const changeClass = getChangeClass(item.matchType);
      html.push(`<div class="change ${changeClass}">`);
      html.push(`  <strong>${getMatchTypeLabel(item.matchType)}</strong> (相似度: ${(item.similarity * 100).toFixed(0)}%)`);
      html.push(`  <p>${item.summary}</p>`);
      if (item.sourceA) {
        html.push(`  <p>文档A: "${escapeHtml(truncateText(item.sourceA, 50))}"</p>`);
      }
      if (item.sourceB) {
        html.push(`  <p>文档B: "${escapeHtml(truncateText(item.sourceB, 50))}"</p>`);
      }
      html.push('</div>');
    }
  }
  
  // 表格差异章节
  if (report.tableDiffs.items.length > 0) {
    html.push('<h2>表格差异</h2>');
    html.push(`<p>共 ${report.tableDiffs.count} 个表格变更</p>`);
    
    for (const item of report.tableDiffs.items) {
      if (item.tableDiff) {
        html.push(`<h3>表格 ${item.matchId}</h3>`);
        html.push(`<p>匹配类型: ${item.tableDiff.tableMatchType}, 置信度: ${(item.tableDiff.confidence * 100).toFixed(0)}%</p>`);
        
        // 创建表格展示变更
        if (item.tableDiff.cellDiffs.length > 0) {
          html.push('<table>');
          html.push('  <thead>');
          html.push('    <tr>');
          html.push('      <th>位置</th>');
          html.push('      <th>变更类型</th>');
          html.push('      <th>旧内容</th>');
          html.push('      <th>新内容</th>');
          html.push('    </tr>');
          html.push('  </thead>');
          html.push('  <tbody>');
          
          for (const cellDiff of item.tableDiff.cellDiffs) {
            const cellClass = getCellClass(cellDiff.changeType);
            html.push(`    <tr class="${cellClass}">`);
            html.push(`      <td>[${cellDiff.position[0]}, ${cellDiff.position[1]}]</td>`);
            html.push(`      <td>${getChangeTypeLabel(cellDiff.changeType)}</td>`);
            html.push(`      <td>${escapeHtml(truncateText(cellDiff.oldContent || '-', 30))}</td>`);
            html.push(`      <td>${escapeHtml(truncateText(cellDiff.newContent || '-', 30))}</td>`);
            html.push('    </tr>');
          }
          
          html.push('  </tbody>');
          html.push('</table>');
        }
      }
    }
  }
  
  // 格式差异章节
  if (report.formatDiffs.count > 0) {
    html.push('<h2>格式差异</h2>');
    html.push(`<p>共 ${report.formatDiffs.count} 处格式变更</p>`);
    
    if (report.formatDiffs.textFormatChanges.length > 0) {
      html.push('<h3>文本格式</h3>');
      for (const change of report.formatDiffs.textFormatChanges) {
        const changeClass = getChangeClass(change.changeType);
        html.push(`<div class="change ${changeClass}">`);
        html.push(`  <strong>${change.property}</strong>: ${getChangeTypeLabel(change.changeType)}`);
        html.push(`  <p>旧值: ${formatValue(change.oldValue)}</p>`);
        html.push(`  <p>新值: ${formatValue(change.newValue)}</p>`);
        html.push('</div>');
      }
    }
    
    if (report.formatDiffs.paragraphFormatChanges.length > 0) {
      html.push('<h3>段落格式</h3>');
      for (const change of report.formatDiffs.paragraphFormatChanges) {
        const changeClass = getChangeClass(change.changeType);
        html.push(`<div class="change ${changeClass}">`);
        html.push(`  <strong>${change.property}</strong>: ${getChangeTypeLabel(change.changeType)}`);
        html.push(`  <p>旧值: ${formatValue(change.oldValue)}</p>`);
        html.push(`  <p>新值: ${formatValue(change.newValue)}</p>`);
        html.push('</div>');
      }
    }
  }
  
  // 批注差异章节
  if (report.commentDiffs.count > 0) {
    html.push('<h2>批注差异</h2>');
    html.push('<ul>');
    html.push(`  <li>新增批注: ${report.commentDiffs.added.length}</li>`);
    html.push(`  <li>删除批注: ${report.commentDiffs.removed.length}</li>`);
    html.push(`  <li>修改批注: ${report.commentDiffs.modified.length}</li>`);
    html.push(`  <li>未变批注: ${report.commentDiffs.unchanged.length}</li>`);
    html.push('</ul>');
    
    if (report.commentDiffs.added.length > 0) {
      html.push('<h3>新增批注</h3>');
      for (const comment of report.commentDiffs.added) {
        html.push('<div class="change change-added">');
        html.push(`  <strong>${escapeHtml(comment.author)}</strong> (${comment.date})`);
        html.push(`  <p>"${escapeHtml(comment.content)}"</p>`);
        html.push('</div>');
      }
    }
    
    if (report.commentDiffs.removed.length > 0) {
      html.push('<h3>删除批注</h3>');
      for (const comment of report.commentDiffs.removed) {
        html.push('<div class="change change-removed">');
        html.push(`  <strong>${escapeHtml(comment.author)}</strong> (${comment.date})`);
        html.push(`  <p>"${escapeHtml(comment.content)}"</p>`);
        html.push('</div>');
      }
    }
    
    if (report.commentDiffs.modified.length > 0) {
      html.push('<h3>修改批注</h3>');
      for (const diff of report.commentDiffs.modified) {
        html.push('<div class="change change-modified">');
        html.push(`  <strong>${escapeHtml(diff.left.author)}</strong> (${diff.left.date})`);
        html.push('  <ul>');
        for (const change of diff.changes) {
          html.push(`    <li>${change.field}: "${formatValue(change.leftValue)}" → "${formatValue(change.rightValue)}"</li>`);
        }
        html.push('  </ul>');
        html.push('</div>');
      }
    }
  }
  
  // 修订差异章节
  if (report.revisionDiffs.count > 0) {
    html.push('<h2>修订差异</h2>');
    html.push('<ul>');
    html.push(`  <li>新增修订: ${report.revisionDiffs.added.length}</li>`);
    html.push(`  <li>删除修订: ${report.revisionDiffs.removed.length}</li>`);
    html.push(`  <li>修改修订: ${report.revisionDiffs.modified.length}</li>`);
    html.push(`  <li>未变修订: ${report.revisionDiffs.unchanged.length}</li>`);
    html.push('</ul>');
    
    if (report.revisionDiffs.added.length > 0) {
      html.push('<h3>新增修订</h3>');
      for (const revision of report.revisionDiffs.added) {
        html.push('<div class="change change-added">');
        html.push(`  <strong>${escapeHtml(revision.author)}</strong> (${revision.date})`);
        html.push(`  <p>类型: ${revision.revisionType}</p>`);
        html.push(`  <p>内容: "${escapeHtml(truncateText(revision.contentText, 50))}"</p>`);
        html.push('</div>');
      }
    }
    
    if (report.revisionDiffs.removed.length > 0) {
      html.push('<h3>删除修订</h3>');
      for (const revision of report.revisionDiffs.removed) {
        html.push('<div class="change change-removed">');
        html.push(`  <strong>${escapeHtml(revision.author)}</strong> (${revision.date})`);
        html.push(`  <p>类型: ${revision.revisionType}</p>`);
        html.push(`  <p>内容: "${escapeHtml(truncateText(revision.contentText, 50))}"</p>`);
        html.push('</div>');
      }
    }
    
    if (report.revisionDiffs.modified.length > 0) {
      html.push('<h3>修改修订</h3>');
      for (const diff of report.revisionDiffs.modified) {
        html.push('<div class="change change-modified">');
        html.push(`  <strong>${escapeHtml(diff.left.author)}</strong> (${diff.left.date})`);
        html.push(`  <p>类型: ${diff.left.revisionType}</p>`);
        html.push('  <ul>');
        for (const change of diff.changes) {
          html.push(`    <li>${change.field}: "${formatValue(change.leftValue)}" → "${formatValue(change.rightValue)}"</li>`);
        }
        html.push('  </ul>');
        html.push('</div>');
      }
    }
  }
  
  html.push('</body>');
  html.push('</html>');
  
  return html.join('\n');
}

// ============ 辅助函数 ============

function getMatchTypeLabel(matchType: MatchType): string {
  const labels: Record<MatchType, string> = {
    identical: '完全相同',
    modified: '已修改',
    added: '新增',
    deleted: '删除',
    moved: '移动',
    split: '拆分',
    merged: '合并',
    uncertain: '不确定'
  };
  return labels[matchType] || matchType;
}

function getChangeTypeLabel(changeType: string): string {
  const labels: Record<string, string> = {
    identical: '完全相同',
    modified: '已修改',
    added: '新增',
    deleted: '删除',
    structure_changed: '结构变化',
    content_changed: '内容变化',
    mixed_changes: '混合变化',
    span_changed: '合并区域变化'
  };
  return labels[changeType] || changeType;
}

function getChangeClass(matchType: string): string {
  switch (matchType) {
    case 'added':
      return 'change-added';
    case 'deleted':
      return 'change-removed';
    case 'modified':
      return 'change-modified';
    default:
      return 'change-identical';
  }
}

function getCellClass(changeType: string): string {
  switch (changeType) {
    case 'added':
      return 'cell-added';
    case 'deleted':
      return 'cell-deleted';
    case 'modified':
      return 'cell-changed';
    default:
      return '';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatValue(value: any): string {
  if (value === undefined || value === null) return '无';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============ 工具函数：从 DiffAst 创建报告 ============

export function createFullFidelityReport(
  diffAst: DiffAst,
  commentDiff?: CommentDiffResult,
  revisionDiff?: RevisionDiffResult,
  formatDiff?: FormatDiffResult
): FullFidelityReport {
  // 分离内容差异和表格差异
  const contentItems: DiffItem[] = [];
  const tableItems: DiffItem[] = [];
  
  for (const item of diffAst.items) {
    if (item.blockType === 'table' && item.tableDiff) {
      tableItems.push(item);
    } else {
      contentItems.push(item);
    }
  }
  
  // 计算内容差异摘要
  const contentSummary = {
    identical: 0,
    modified: 0,
    added: 0,
    deleted: 0,
    moved: 0,
    split: 0,
    merged: 0,
    uncertain: 0
  };
  
  for (const item of contentItems) {
    contentSummary[item.matchType] += 1;
  }
  
  // 构建格式差异部分
  const formatDiffs: FormatDiffSection = {
    textFormatChanges: formatDiff?.textFormatChanges || [],
    paragraphFormatChanges: formatDiff?.paragraphFormatChanges || [],
    count: (formatDiff?.textFormatChanges.length || 0) + (formatDiff?.paragraphFormatChanges.length || 0)
  };
  
  // 构建批注差异部分
  const commentDiffs: CommentDiffSection = {
    added: (commentDiff?.added || []).map(c => ({
      id: c.id,
      content: c.content,
      author: c.author,
      date: c.date
    })),
    removed: (commentDiff?.removed || []).map(c => ({
      id: c.id,
      content: c.content,
      author: c.author,
      date: c.date
    })),
    modified: (commentDiff?.modified || []).map(d => ({
      left: {
        id: d.left.id,
        content: d.left.content,
        author: d.left.author,
        date: d.left.date
      },
      right: {
        id: d.right.id,
        content: d.right.content,
        author: d.right.author,
        date: d.right.date
      },
      changes: d.changes
    })),
    unchanged: (commentDiff?.unchanged || []).map(c => ({
      id: c.id,
      content: c.content,
      author: c.author,
      date: c.date
    })),
    count: (commentDiff?.added.length || 0) + (commentDiff?.removed.length || 0) + (commentDiff?.modified.length || 0)
  };
  
  // 构建修订差异部分
  const revisionDiffs: RevisionDiffSection = {
    added: (revisionDiff?.added || []).map(r => ({
      id: r.id,
      revisionType: r.revisionType,
      author: r.author,
      date: r.date,
      contentText: r.content.text
    })),
    removed: (revisionDiff?.removed || []).map(r => ({
      id: r.id,
      revisionType: r.revisionType,
      author: r.author,
      date: r.date,
      contentText: r.content.text
    })),
    modified: (revisionDiff?.modified || []).map(d => ({
      left: {
        id: d.left.id,
        revisionType: d.left.revisionType,
        author: d.left.author,
        date: d.left.date,
        contentText: d.left.content.text
      },
      right: {
        id: d.right.id,
        revisionType: d.right.revisionType,
        author: d.right.author,
        date: d.right.date,
        contentText: d.right.content.text
      },
      changes: d.changes
    })),
    unchanged: (revisionDiff?.unchanged || []).map(r => ({
      id: r.id,
      revisionType: r.revisionType,
      author: r.author,
      date: r.date,
      contentText: r.content.text
    })),
    count: (revisionDiff?.added.length || 0) + (revisionDiff?.removed.length || 0) + (revisionDiff?.modified.length || 0)
  };
  
  // 计算总数
  const contentChanges = contentItems.length;
  const tableChanges = tableItems.length;
  const formatChanges = formatDiffs.count;
  const commentChanges = commentDiffs.count;
  const revisionChanges = revisionDiffs.count;
  const totalChanges = contentChanges + tableChanges + formatChanges + commentChanges + revisionChanges;
  
  return {
    summary: {
      totalChanges,
      contentChanges,
      tableChanges,
      formatChanges,
      commentChanges,
      revisionChanges
    },
    contentDiffs: {
      items: contentItems,
      summary: contentSummary
    },
    tableDiffs: {
      items: tableItems,
      count: tableChanges
    },
    formatDiffs,
    commentDiffs,
    revisionDiffs
  };
}
