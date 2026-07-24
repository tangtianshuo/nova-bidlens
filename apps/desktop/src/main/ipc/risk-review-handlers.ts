import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import type { CreateRiskProjectRequest, ExportRiskReportRequest } from '@bidlens/shared';
import { RiskReviewService } from '../services/risk-review-service.js';
import { EngineManager } from '../services/engine-manager.js';
import { log } from '../logger';

let service: RiskReviewService | null = null;
let engineManager: EngineManager | null = null;

function wrapHandler<T extends (...args: any[]) => any>(name: string, handler: T): T {
  return ((...args: any[]) => {
    try {
      const result = handler(...args);
      if (result instanceof Promise) {
        return result.catch((err: unknown) => {
          log.error(`[Risk] ${name} failed —`, err instanceof Error ? err.message : err);
          throw err;
        });
      }
      return result;
    } catch (err) {
      log.error(`[Risk] ${name} failed —`, err instanceof Error ? err.message : err);
      throw err;
    }
  }) as unknown as T;
}

export async function registerRiskReviewHandlers(window: BrowserWindow, db: Database.Database, encryptionKey: Buffer) {
  log.info('[Risk] Registering risk review IPC handlers');
  engineManager = new EngineManager();
  await engineManager.start();
  service = new RiskReviewService(window, db, encryptionKey, engineManager);
  ipcMain.handle('risk:listProjects', wrapHandler('listProjects', () => service!.listProjects()));
  ipcMain.handle('risk:getProject', wrapHandler('getProject', (_event: unknown, projectId: string) => service!.getProject(projectId)));
  ipcMain.handle('risk:createProject', wrapHandler('createProject', (_event: unknown, request: CreateRiskProjectRequest) => {
    log.info('[Risk] createProject — name:', request.name, 'files:', request.submissions.length);
    return service!.createProject(request);
  }));
  ipcMain.handle('risk:cancelProject', wrapHandler('cancelProject', (_event: unknown, projectId: string) => {
    log.info('[Risk] cancelProject —', projectId);
    return service!.cancel(projectId);
  }));
  ipcMain.handle('risk:resumeProject', wrapHandler('resumeProject', (_event: unknown, projectId: string) => service!.resumeRiskProject(projectId)));
  ipcMain.handle('risk:reanalyzeProject', wrapHandler('reanalyzeProject', (_event: unknown, projectId: string) => {
    log.info('[Risk] reanalyzeProject —', projectId);
    return service!.reanalyzeProject(projectId);
  }));
  ipcMain.handle('risk:retrySubmission', wrapHandler('retrySubmission', (_event: unknown, projectId: string, submissionId: string) => service!.retryRiskSubmission(projectId, submissionId)));
  ipcMain.handle('risk:acceptPartial', wrapHandler('acceptPartial', (_event: unknown, projectId: string) => service!.acceptPartial(projectId)));
  ipcMain.handle('risk:deleteProject', wrapHandler('deleteProject', (_event: unknown, projectId: string) => service!.deleteProject(projectId)));
  ipcMain.handle('risk:saveFindingReview', wrapHandler('saveFindingReview', (_event: unknown, request: unknown) => service!.saveRiskFindingReview(request as any)));
  ipcMain.handle('risk:getAuditEvents', wrapHandler('getAuditEvents', (_event: unknown, projectId: string) => service!.getAuditEvents(projectId)));
  ipcMain.handle('risk:exportReport', wrapHandler('exportReport', async (_event: unknown, request: ExportRiskReportRequest) => {
    log.info('[Risk] exportReport — projectId:', request.projectId, 'format:', request.format);
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
  }));

  ipcMain.handle('risk:getPdfFile', wrapHandler('getPdfFile', (_event: unknown, projectId: string, submissionId: string) => {
    return service!.getPdfFile(projectId, submissionId);
  }));

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
