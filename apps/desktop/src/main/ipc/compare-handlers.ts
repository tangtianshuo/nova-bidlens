import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import type { CompareResult } from '@bidlens/shared';

const results = new Map<string, CompareResult>();

export function registerCompareHandlers(window: BrowserWindow): void {
  ipcMain.handle('compare:start', async () => {
    const taskId = crypto.randomUUID();
    const result = demoResult(taskId);
    results.set(taskId, result);
    window.webContents.send('compare:progress', { taskId, phase: 'complete', current: 1, total: 1, percent: 100, message: '比对完成' });
    return { taskId };
  });
  ipcMain.handle('compare:cancel', async (_event, taskId: string) => ({ taskId, cancelled: results.delete(taskId) }));
  ipcMain.handle('compare:getResult', async (_event, taskId: string) => {
    const result = results.get(taskId);
    if (!result) throw new Error(`Compare result not found: ${taskId}`);
    return result;
  });
  ipcMain.handle('compare:saveAnnotation', async (_event, annotation) => annotation);
  ipcMain.handle('compare:export', async () => ({ reportPath: '' }));
}

function demoResult(taskId: string): CompareResult {
  return {
    taskId,
    docA: { id: 'a', filename: '基准版.docx', sha256: 'a', pageCount: 1, wordCount: 10, parserVersion: 'demo', blocks: [] },
    docB: { id: 'b', filename: '比较版.docx', sha256: 'b', pageCount: 1, wordCount: 12, parserVersion: 'demo', blocks: [] },
    diffAst: {
      taskId,
      docAId: 'a',
      docBId: 'b',
      generatedAt: new Date().toISOString(),
      summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
      items: [{ matchId: 'm1', matchType: 'modified', confidence: 0.82, similarity: 0.82, sourceA: '投标人应提供营业执照', sourceB: '投标人须提供营业执照', nodeIdsA: ['a1'], nodeIdsB: ['b1'], diffDetail: [], summary: '措辞发生变化' }]
    },
    annotations: []
  };
}
