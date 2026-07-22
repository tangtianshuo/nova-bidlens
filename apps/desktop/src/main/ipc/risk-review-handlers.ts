import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import type { CreateRiskProjectRequest, ExportRiskReportRequest } from '@bidlens/shared';
import { RiskReviewService } from '../services/risk-review-service.js';
import { EngineManager } from '../services/engine-manager.js';

let service: RiskReviewService | null = null;
let engineManager: EngineManager | null = null;

export function registerRiskReviewHandlers(window: BrowserWindow, db: Database.Database, encryptionKey: Buffer) {
  engineManager = new EngineManager();
  service = new RiskReviewService(window, db, encryptionKey, engineManager);
  ipcMain.handle('risk:listProjects', () => service!.listProjects());
  ipcMain.handle('risk:getProject', (_event, projectId: string) => service!.getProject(projectId));
  ipcMain.handle('risk:createProject', (_event, request: CreateRiskProjectRequest) => service!.createProject(request));
  ipcMain.handle('risk:cancelProject', (_event, projectId: string) => service!.cancel(projectId));
  ipcMain.handle('risk:resumeProject', (_event, projectId: string) => service!.resumeRiskProject(projectId));
  ipcMain.handle('risk:retrySubmission', (_event, projectId: string, submissionId: string) => service!.retryRiskSubmission(projectId, submissionId));
  ipcMain.handle('risk:acceptPartial', (_event, projectId: string) => service!.acceptPartial(projectId));
  ipcMain.handle('risk:deleteProject', (_event, projectId: string) => service!.deleteProject(projectId));
  ipcMain.handle('risk:saveFindingReview', (_event, request) => service!.saveRiskFindingReview(request));
  ipcMain.handle('risk:getAuditEvents', (_event, projectId: string) => service!.getAuditEvents(projectId));
  ipcMain.handle('risk:exportReport', async (_event, request: ExportRiskReportRequest) => {
    const ext = request.format === 'pdf' ? 'pdf' : request.format === 'html' ? 'html' : 'md';
    const filterName = request.format === 'pdf' ? 'PDF 文件' : request.format === 'html' ? 'HTML 文件' : 'Markdown 文件';
    const detail = service!.getProject(request.projectId);
    const defaultName = `雷同性风险审查报告_${detail.name}.${ext}`;

    const result = await dialog.showSaveDialog(window, {
      defaultPath: defaultName,
      filters: [
        { name: filterName, extensions: [ext] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      throw new Error('导出已取消');
    }

    return service!.exportRiskReport(request, result.filePath);
  });

  ipcMain.handle('risk:openFile', async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle('risk:openFolder', async (_event, folderPath: string) => {
    shell.showItemInFolder(folderPath);
  });
}

export async function shutdownRiskEngine(): Promise<void> {
  if (engineManager) {
    await engineManager.stop();
    engineManager = null;
  }
  service = null;
}
