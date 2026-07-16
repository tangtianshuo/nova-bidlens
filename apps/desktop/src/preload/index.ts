import type { BidLensApi } from '@bidlens/shared';
import { contextBridge, ipcRenderer } from 'electron';

const api: BidLensApi = {
  startCompare: (request) => ipcRenderer.invoke('compare:start', request),
  cancelCompare: (taskId) => ipcRenderer.invoke('compare:cancel', taskId),
  getCompareResult: (taskId) => ipcRenderer.invoke('compare:getResult', taskId),
  saveAnnotation: (annotation) => ipcRenderer.invoke('compare:saveAnnotation', annotation),
  exportReport: (request) => ipcRenderer.invoke('compare:export', request),
  onCompareProgress: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => handler(progress as never);
    ipcRenderer.on('compare:progress', listener);
    return () => ipcRenderer.removeListener('compare:progress', listener);
  }
};

contextBridge.exposeInMainWorld('bidlens', api);
