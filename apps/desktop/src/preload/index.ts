import type {
  BidLensApi,
  ValidateFilesRequest,
  StartCompareRequest,
  SaveAnnotationRequest,
  HistoryListRequest,
  OpenSnapshotRequest,
  RecompareRequest,
  CleanupRequest,
  ExportRequest,
  UpdateSettingsRequest,
  CompareProgress,
  CreateRiskProjectRequest,
  RiskProgress,
} from '@bidlens/shared';
import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Log streaming: renderer → main
ipcRenderer.on('log:entry', (_event, entry) => {
  // Expose to renderer via custom event
  window.dispatchEvent(new CustomEvent('bidlens:log', { detail: entry }));
});

const api: BidLensApi = {
  listProjects: () => ipcRenderer.invoke('risk:listProjects'),
  getProject: (projectId: string) => ipcRenderer.invoke('risk:getProject', projectId),
  createRiskProject: (request: CreateRiskProjectRequest) => ipcRenderer.invoke('risk:createProject', request),
  cancelRiskProject: (projectId: string) => ipcRenderer.invoke('risk:cancelProject', projectId),
  resumeRiskProject: (projectId: string) => ipcRenderer.invoke('risk:resumeProject', projectId),
  reanalyzeProject: (projectId: string) => ipcRenderer.invoke('risk:reanalyzeProject', projectId),
  retryRiskSubmission: (projectId: string, submissionId: string, newFile?: unknown) => ipcRenderer.invoke('risk:retrySubmission', projectId, submissionId, newFile),
  acceptPartial: (projectId: string) => ipcRenderer.invoke('risk:acceptPartial', projectId),
  deleteProject: (projectId: string) => ipcRenderer.invoke('risk:deleteProject', projectId),
  onRiskProgress: (handler: (progress: RiskProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => handler(progress as RiskProgress);
    ipcRenderer.on('risk:progress', listener);
    return () => { ipcRenderer.removeListener('risk:progress', listener); };
  },
  saveRiskFindingReview: (request) => ipcRenderer.invoke('risk:saveFindingReview', request),
  getAuditEvents: (projectId: string) => ipcRenderer.invoke('risk:getAuditEvents', projectId),
  exportRiskReport: (request: unknown) => ipcRenderer.invoke('risk:exportReport', request),
  getPdfFile: (projectId: string, submissionId: string) => ipcRenderer.invoke('risk:getPdfFile', projectId, submissionId),
  // File
  selectFile: () => ipcRenderer.invoke('file:select'),
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  validateFiles: (request: ValidateFilesRequest) => ipcRenderer.invoke('file:validate', request),

  // Compare
  startCompare: (request: StartCompareRequest) => ipcRenderer.invoke('compare:start', request),
  cancelCompare: (taskId: string) => ipcRenderer.invoke('compare:cancel', taskId),
  getCompareResult: (taskId: string) => ipcRenderer.invoke('compare:getResult', taskId),
  onCompareProgress: (handler: (progress: CompareProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => handler(progress as CompareProgress);
    ipcRenderer.on('compare:progress', listener);
    return () => { ipcRenderer.removeListener('compare:progress', listener); };
  },

  // Review
  saveAnnotation: (request: SaveAnnotationRequest) => ipcRenderer.invoke('review:saveAnnotation', request),
  batchReadAnnotations: (taskId: string) => ipcRenderer.invoke('review:batchRead', taskId),

  // History
  listHistory: (request?: HistoryListRequest) => ipcRenderer.invoke('history:list', request),
  openSnapshot: (request: OpenSnapshotRequest) => ipcRenderer.invoke('history:openSnapshot', request),
  recompare: (request: RecompareRequest) => ipcRenderer.invoke('history:recompare', request),
  retainTask: (taskId: string, retained: boolean) => ipcRenderer.invoke('history:retain', taskId, retained),
  deleteTask: (taskId: string) => ipcRenderer.invoke('history:delete', taskId),
  clearHistory: (request: CleanupRequest) => ipcRenderer.invoke('history:clear', request),

  // Export
  exportReport: (request: ExportRequest) => ipcRenderer.invoke('export:report', request),
  openExportedFile: (filePath: string) => ipcRenderer.invoke('export:openFile', filePath),
  openExportFolder: (folderPath: string) => ipcRenderer.invoke('export:openFolder', folderPath),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (request: UpdateSettingsRequest) => ipcRenderer.invoke('settings:update', request),
  getStorageReport: () => ipcRenderer.invoke('settings:storageReport'),
  cleanup: (request: CleanupRequest) => ipcRenderer.invoke('settings:cleanup', request),

  // MinerU API config
  mineruGetToken: () => ipcRenderer.invoke('mineru:getToken'),
  mineruSaveToken: (request: { token: string }) => ipcRenderer.invoke('mineru:saveToken', request),
  mineruDeleteToken: () => ipcRenderer.invoke('mineru:deleteToken'),
  mineruValidateToken: (request?: { token?: string }) => ipcRenderer.invoke('mineru:validateToken', request),

  // Engine
  engineHandshake: () => ipcRenderer.invoke('engine:handshake'),

  // Log viewer
  getLogBuffer: () => ipcRenderer.invoke('log:getBuffer'),
  sendLog: (entry: { level: string; tag: string; text: string }) => ipcRenderer.send('log:fromRenderer', entry),
  onLogEntry: (handler: (entry: any) => void) => {
    const listener = (_event: any, entry: any) => handler(entry);
    ipcRenderer.on('log:entry', listener);
    return () => { ipcRenderer.removeListener('log:entry', listener); };
  },

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChanged: (handler: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => handler(maximized);
    ipcRenderer.on('window:maximize-changed', listener);
    return () => { ipcRenderer.removeListener('window:maximize-changed', listener); };
  },
};

contextBridge.exposeInMainWorld('bidlens', api);
