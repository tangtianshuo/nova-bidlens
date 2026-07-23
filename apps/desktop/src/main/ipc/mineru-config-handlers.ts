/**
 * MinerU configuration IPC handlers.
 * Token management (save/get masked/delete/validate).
 */
import { ipcMain } from 'electron';
import { log } from '../logger';
import type { MineruConfigService } from '../services/mineru-config';

export function registerMineruConfigHandlers(deps: {
  config: MineruConfigService;
}): void {
  const { config } = deps;

  ipcMain.handle('mineru:getToken', async () => {
    log.info('[IPC] mineru:getToken — get masked token');
    return { token: config.getMaskedToken() };
  });

  ipcMain.handle('mineru:saveToken', async (_event, request: { token: string }) => {
    log.info('[IPC] mineru:saveToken — saving token');
    config.setToken(request.token);
    return { success: true };
  });

  ipcMain.handle('mineru:deleteToken', async () => {
    log.info('[IPC] mineru:deleteToken — deleting token');
    config.deleteToken();
    return { success: true };
  });

  ipcMain.handle('mineru:validateToken', async (_event, request?: { token?: string }) => {
    log.info('[IPC] mineru:validateToken — validating');
    return config.validateToken(request?.token);
  });
}
