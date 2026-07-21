/**
 * Risk report generator for BidLens V0.3.
 * Produces Markdown and HTML reports from project analysis data.
 * Pure functions — no Electron or filesystem dependencies.
 */
import { createHash } from 'node:crypto';
import type {
  AnalysisProjectDetail, RiskFinding, RiskLevel, ReportScope,
} from '@bidlens/shared';

// ── labels ──

const RISK_LEVEL_LABEL: Record<string, string> = {
  high: '高', medium: '中', low: '低', incomplete: '未完成',
};

const PRESET_LABEL: Record<string, string> = {
  strict: '严格', standard: '标准', loose: '宽松',
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: '待处理', confirmed: '已确认', ignored: '已忽略',
};

const DETECTOR_LABEL: Record<string, string> = {
  text: '文本', table: '表格', entity: '实体', 'key-fact': '关键事实',
};

const MATCH_BASIS_LABEL: Record<string, string> = {
  lexical: '词汇匹配', semantic: '语义匹配', structural: '结构匹配',
  entity: '实体匹配', fact: '事实匹配',
};

const DISCLAIMER = '本报告仅为雷同性风险参考，不构成法律结论';

// ── helpers ──

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return remain > 0 ? `${minutes}分${remain}秒` : `${minutes}分钟`;
}

function filterFindings(findings: RiskFinding[], scope: ReportScope): RiskFinding[] {
  switch (scope) {
    case 'confirmed': return findings.filter((f) => f.reviewStatus === 'confirmed');
    case 'important': return findings.filter((f) => f.important);
    case 'filtered': return findings.filter((f) => f.reviewStatus !== 'ignored');
    default: return findings;
  }
}

function countByLevel(findings: RiskFinding[]): Record<string, number> {
  const counts: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.riskLevel]++;
  return counts;
}

function countByReviewStatus(findings: RiskFinding[]): Record<string, number> {
  const counts: Record<string, number> = { confirmed: 0, ignored: 0, pending: 0 };
  for (const f of findings) counts[f.reviewStatus]++;
  return counts;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineFmt(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// ── public API ──

export function computeReportHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function generateMarkdownReport(project: AnalysisProjectDetail, scope: ReportScope): string {
  const findings = filterFindings(project.findings, scope);
  const counts = countByLevel(findings);
  const reviewCounts = countByReviewStatus(findings);
  const subMap = new Map(project.submissions.map((s) => [s.id, s.fileName]));

  const lines: string[] = [
    '# 雷同性风险审查报告',
    '',
    '## 项目信息',
    `- 项目名称：${project.name}`,
    `- 生成时间：${new Date().toLocaleString('zh-CN')}`,
    `- 分析预设：${PRESET_LABEL[project.preset] ?? project.preset}`,
    `- 分析耗时：${formatElapsed(project.elapsedMs)}`,
    `- 规则版本：${project.ruleVersion}`,
    '',
    '## 风险摘要',
    `- 项目风险等级：${RISK_LEVEL_LABEL[project.assessment?.level ?? 'incomplete'] ?? '未知'}`,
    `- 发现项总数：${findings.length}`,
    `  - 高风险：${counts.high}`,
    `  - 中风险：${counts.medium}`,
    `  - 低风险：${counts.low}`,
    `- 审查状态：已确认 ${reviewCounts.confirmed} / 已忽略 ${reviewCounts.ignored} / 待处理 ${reviewCounts.pending}`,
    '',
  ];

  // file pair matrix (only if data exists)
  if (project.filePairAssessments.length > 0) {
    lines.push('## 文件对风险矩阵', '');
    lines.push('| 文件A | 文件B | 风险等级 | 相似度 |');
    lines.push('|-------|-------|---------|--------|');
    for (const fp of project.filePairAssessments) {
      const nameA = subMap.get(fp.submissionAId) ?? fp.submissionAId;
      const nameB = subMap.get(fp.submissionBId) ?? fp.submissionBId;
      lines.push(`| ${nameA} | ${nameB} | ${RISK_LEVEL_LABEL[fp.riskLevel]} | ${(fp.symmetricSimilarity * 100).toFixed(1)}% |`);
    }
    lines.push('');
  }

  // findings
  lines.push('## 发现项详情', '');
  if (findings.length === 0) {
    lines.push('暂无发现项。', '');
  } else {
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      const involvedNames = f.involvedSubmissionIds.map((id) => subMap.get(id) ?? id).join(', ');
      lines.push(
        `### 发现项 #${i + 1} [${RISK_LEVEL_LABEL[f.riskLevel]}风险]`,
        `- 检测类型：${DETECTOR_LABEL[f.detectorType] ?? f.detectorType}`,
        `- 涉及文件：${involvedNames}`,
        `- 对称相似度：${(f.symmetricSimilarity * 100).toFixed(1)}%`,
        `- 置信度：${(f.confidenceScore * 100).toFixed(1)}%`,
        `- 审查状态：${REVIEW_STATUS_LABEL[f.reviewStatus]}`,
        `- 重要：${f.important ? '是' : '否'}`,
        '',
      );
      if (f.evidence.length > 0) {
        lines.push('**证据：**', '');
        for (let j = 0; j < f.evidence.length; j++) {
          const ev = f.evidence[j];
          lines.push(
            `${j + 1}. 匹配基础：${MATCH_BASIS_LABEL[ev.matchBasis] ?? ev.matchBasis}`,
            `   - 源文本：${truncate(ev.sourceOriginalText, 200)}`,
            `   - 目标文本：${truncate(ev.targetOriginalText, 200)}`,
            `   - 相似度：${(ev.similarityScore * 100).toFixed(1)}%`,
            '',
          );
        }
      }
    }
  }

  lines.push('---', '', `*${DISCLAIMER}*`, '');
  return lines.join('\n');
}

export function generateHtmlReport(project: AnalysisProjectDetail, scope: ReportScope): string {
  const findings = filterFindings(project.findings, scope);
  const counts = countByLevel(findings);
  const reviewCounts = countByReviewStatus(findings);
  const subMap = new Map(project.submissions.map((s) => [s.id, s.fileName]));

  const riskLevel = project.assessment?.level ?? 'incomplete';
  const riskClass = riskLevel === 'high' ? 'risk-high' : riskLevel === 'medium' ? 'risk-medium' : 'risk-low';

  const findingRows = findings.length === 0
    ? '<p>暂无发现项。</p>'
    : findings.map((f, i) => {
      const involvedNames = f.involvedSubmissionIds.map((id) => subMap.get(id) ?? id).join(', ');
      const levelClass = f.riskLevel === 'high' ? 'risk-high' : f.riskLevel === 'medium' ? 'risk-medium' : 'risk-low';
      const evidenceHtml = f.evidence.length > 0
        ? `<p><strong>证据：</strong></p><ol>${f.evidence.map((ev) => `<li><p>匹配基础：${MATCH_BASIS_LABEL[ev.matchBasis] ?? ev.matchBasis}</p><p style="margin-left:24px;color:#6b7280">源文本：${escapeHtml(truncate(ev.sourceOriginalText, 200))}</p><p style="margin-left:24px;color:#6b7280">目标文本：${escapeHtml(truncate(ev.targetOriginalText, 200))}</p><p style="margin-left:24px;color:#6b7280">相似度：${(ev.similarityScore * 100).toFixed(1)}%</p></li>`).join('')}</ol>`
        : '';
      return `
      <div class="finding">
        <h3>发现项 #${i + 1} <span class="${levelClass}">[${RISK_LEVEL_LABEL[f.riskLevel]}风险]</span></h3>
        <ul>
          <li>检测类型：${DETECTOR_LABEL[f.detectorType] ?? f.detectorType}</li>
          <li>涉及文件：${escapeHtml(involvedNames)}</li>
          <li>对称相似度：${(f.symmetricSimilarity * 100).toFixed(1)}%</li>
          <li>置信度：${(f.confidenceScore * 100).toFixed(1)}%</li>
          <li>审查状态：${REVIEW_STATUS_LABEL[f.reviewStatus]}</li>
          <li>重要：${f.important ? '是' : '否'}</li>
        </ul>
        ${evidenceHtml}
      </div>`;
    }).join('\n');

  const filePairSection = project.filePairAssessments.length > 0
    ? `<h2>文件对风险矩阵</h2>
      <table>
        <tr><th>文件A</th><th>文件B</th><th>风险等级</th><th>相似度</th></tr>
        ${project.filePairAssessments.map((fp) => {
      const nameA = subMap.get(fp.submissionAId) ?? fp.submissionAId;
      const nameB = subMap.get(fp.submissionBId) ?? fp.submissionBId;
      return `<tr><td>${escapeHtml(nameA)}</td><td>${escapeHtml(nameB)}</td><td>${RISK_LEVEL_LABEL[fp.riskLevel]}</td><td>${(fp.symmetricSimilarity * 100).toFixed(1)}%</td></tr>`;
    }).join('\n')}
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>雷同性风险审查报告 - ${escapeHtml(project.name)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
  h2 { color: #374151; margin-top: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
  h3 { color: #4b5563; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; }
  ul, ol { padding-left: 24px; }
  li { margin: 4px 0; }
  .finding { margin: 24px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .disclaimer { margin-top: 40px; padding: 16px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; color: #92400e; font-style: italic; }
  .risk-high { color: #dc2626; font-weight: bold; }
  .risk-medium { color: #d97706; font-weight: bold; }
  .risk-low { color: #059669; }
  code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
</style>
</head>
<body>
<h1>雷同性风险审查报告</h1>
<h2>项目信息</h2>
<ul>
  <li>项目名称：${escapeHtml(project.name)}</li>
  <li>生成时间：${new Date().toLocaleString('zh-CN')}</li>
  <li>分析预设：${PRESET_LABEL[project.preset] ?? project.preset}</li>
  <li>分析耗时：${formatElapsed(project.elapsedMs)}</li>
  <li>规则版本：${escapeHtml(project.ruleVersion)}</li>
</ul>
<h2>风险摘要</h2>
<ul>
  <li>项目风险等级：<span class="${riskClass}">${RISK_LEVEL_LABEL[riskLevel] ?? '未知'}</span></li>
  <li>发现项总数：${findings.length}</li>
  <li>高风险：${counts.high} / 中风险：${counts.medium} / 低风险：${counts.low}</li>
  <li>审查状态：已确认 ${reviewCounts.confirmed} / 已忽略 ${reviewCounts.ignored} / 待处理 ${reviewCounts.pending}</li>
</ul>
${filePairSection}
<h2>发现项详情</h2>
${findingRows}
<div class="disclaimer">${DISCLAIMER}</div>
</body>
</html>`;
}
