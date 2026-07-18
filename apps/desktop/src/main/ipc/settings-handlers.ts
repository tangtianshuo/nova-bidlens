/**
 * Settings IPC handlers for BidLens.
 * Handles get, update, storage report, cleanup.
 */
import { ipcMain } from 'electron';
import type {
  AppSettings,
  UpdateSettingsRequest,
  StorageReport,
  CleanupRequest,
} from '@bidlens/shared';
import type { DatabaseManager } from '../db/database.js';
import type { RetentionService } from '../services/retention.js';

const SETTINGS_KEY = 'app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  historyCountLimit: 20,
  storageLimitBytes: 1024 * 1024 * 1024, // 1GB
};

export function registerSettingsHandlers(deps: {
  db: DatabaseManager;
  retentionService: RetentionService;
}): void {
  const { db, retentionService } = deps;

  // Get current settings
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    const row = db.prepare(
      'SELECT value_json FROM settings WHERE key = ?'
    ).get(SETTINGS_KEY) as { value_json: string } | undefined;

    if (!row) return DEFAULT_SETTINGS;

    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value_json) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Update settings
  ipcMain.handle('settings:update', async (_event, request: UpdateSettingsRequest): Promise<AppSettings> => {
    // Get current settings
    const current = await (async () => {
      const row = db.prepare(
        'SELECT value_json FROM settings WHERE key = ?'
      ).get(SETTINGS_KEY) as { value_json: string } | undefined;
      return row ? JSON.parse(row.value_json) : DEFAULT_SETTINGS;
    })();

    // Merge with updates
    const updated: AppSettings = {
      ...current,
      ...(request.theme !== undefined && { theme: request.theme }),
      ...(request.historyCountLimit !== undefined && { historyCountLimit: request.historyCountLimit }),
      ...(request.storageLimitBytes !== undefined && { storageLimitBytes: request.storageLimitBytes }),
    };

    // Save to database
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value_json, updated_at)
      VALUES (?, ?, datetime('now'))
    `).run(SETTINGS_KEY, JSON.stringify(updated));

    return updated;
  });

  // Get storage report
  ipcMain.handle('settings:storageReport', async (): Promise<StorageReport> => {
    return retentionService.getStorageReport();
  });

  // Run cleanup
  ipcMain.handle('settings:cleanup', async (_event, request: CleanupRequest): Promise<{ deletedCount: number }> => {
    if (!request.confirm) {
      throw new Error('Cleanup requires confirmation');
    }

    if (request.type === 'cleanable') {
      const report = retentionService.getStorageReport();
      const count = retentionService.deleteLRU(report.cleanableCount);
      return { deletedCount: count };
    } else {
      const count = retentionService.clearNonRetained();
      return { deletedCount: count };
    }
  });
}
