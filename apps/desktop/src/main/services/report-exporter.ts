import type { ExportModel } from '@bidlens/shared';

export function renderMarkdownReport(model: ExportModel): string {
  const lines = [
    '# BidLens 比对报告',
    '',
    `生成时间: ${model.generatedAt}`,
    `任务 ID: ${model.taskId}`,
    '',
    `A: ${model.docA.filename}`,
    `B: ${model.docB.filename}`,
    '',
    '## 差异统计',
    ...Object.entries(model.diffAst.summary).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 差异列表'
  ];

  for (const item of model.diffAst.items) {
    const annotation = model.annotations.find((entry) => entry.matchId === item.matchId);
    lines.push('', `### ${item.matchType} ${item.matchId}`, `- confidence: ${item.confidence}`, `- annotation: ${annotation ? `${annotation.status} ${annotation.note}` : 'none'}`, '', '```text', `A: ${item.sourceA ?? ''}`, `B: ${item.sourceB ?? ''}`, '```');
  }

  return `${lines.join('\n')}\n`;
}

export function renderHtmlReport(model: ExportModel): string {
  return `<!doctype html><meta charset="utf-8"><pre>${escapeHtml(renderMarkdownReport(model))}</pre>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
