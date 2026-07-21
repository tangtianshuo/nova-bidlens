import { ipcMain, type BrowserWindow } from 'electron';
import type { CreateRiskProjectRequest } from '@bidlens/shared';
import { RiskReviewService } from '../services/risk-review-service.js';

let service: RiskReviewService | null = null;

export function registerRiskReviewHandlers(window: BrowserWindow) {
  service = new RiskReviewService(window);
  ipcMain.handle('risk:listProjects', () => service!.listProjects());
  ipcMain.handle('risk:getProject', (_event, projectId: string) => service!.getProject(projectId));
  ipcMain.handle('risk:createProject', (_event, request: CreateRiskProjectRequest) => service!.createProject(request));
  ipcMain.handle('risk:cancelProject', (_event, projectId: string) => service!.cancel(projectId));
  ipcMain.handle('risk:saveFindingReview', (_event, request) => service!.saveFindingReview(request));
}
