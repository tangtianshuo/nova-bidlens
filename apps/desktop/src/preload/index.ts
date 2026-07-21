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
import { contextBridge, ipcRenderer } from 'electron';

const api: BidLensApi = {
  listProjects: () => ipcRenderer.invoke('risk:listProjects'),
  getProject: (projectId: string) => ipcRenderer.invoke('risk:getProject', projectId),
  createRiskProject: (request: CreateRiskProjectRequest) => ipcRenderer.invoke('risk:createProject', request),
  cancelRiskProject: (projectId: string) => ipcRenderer.invoke('risk:cancelProject', projectId),
  onRiskProgress: (handler: (progress: RiskProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => handler(progress as RiskProgress);
    ipcRenderer.on('risk:progress', listener);
    return () => { ipcRenderer.removeListener('risk:progress', listener); };
  },
  saveRiskFindingReview: (request) => ipcRenderer.invoke('risk:saveFindingReview', request),
  // File
  selectFile: () => ipcRenderer.invoke('file:select'),
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

  // Engine
  engineHandshake: () => ipcRenderer.invoke('engine:handshake'),

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
