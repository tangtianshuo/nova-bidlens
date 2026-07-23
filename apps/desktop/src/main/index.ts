import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'node:path';
import { log } from './logger';
import {
  registerCompareHandlers,
  setPersistenceDeps,
  shutdownCompareServices,
} from './ipc/compare-handlers';
import { registerHistoryHandlers } from './ipc/history-handlers';
import { registerSettingsHandlers } from './ipc/settings-handlers';
import { registerAnnotationHandlers } from './ipc/annotation-handlers';
import { registerRiskReviewHandlers, shutdownRiskEngine } from './ipc/risk-review-handlers';
import { registerMineruConfigHandlers } from './ipc/mineru-config-handlers';
import { PersistenceManager } from './services/persistence';
import { MineruConfigService } from './services/mineru-config';
import { setMineruConfigService } from './services/parser-service';

const isDev = !app.isPackaged;

// Global persistence manager
let persistence: PersistenceManager | null = null;
let shutdownStarted = false;

function createWindow() {
  log.info('[Main] Creating window, isDev:', isDev);
  log.info('[Main] __dirname:', __dirname);

  const preloadPath = path.join(__dirname, '../preload/index.js');
  log.info('[Main] Preload path:', preloadPath);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Window control IPC handlers
  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.handle('window:close', () => win.close());
  ipcMain.handle('window:isMaximized', () => win.isMaximized());

  // Push maximize state changes to renderer
  win.on('maximize', () => win.webContents.send('window:maximize-changed', true));
  win.on('unmaximize', () => win.webContents.send('window:maximize-changed', false));

  // Initialize persistence layer (BIDLENS_DATA_DIR overrides userData for E2E isolation)
  const testDataDir = process.env.BIDLENS_DATA_DIR || undefined;
  persistence = new PersistenceManager(testDataDir);
  const dbResult = persistence.initialize();
  if (!dbResult.healthy) {
    log.error('[DB] Database health issue:', dbResult.corruptionError);
  }

  // Wire persistence dependencies to compare handlers
  const persistenceDeps = {
    taskRepo: persistence.taskRepo,
    snapshotRepo: persistence.snapshotRepo,
    annotationRepo: persistence.annotationRepo,
    retentionService: persistence.retentionService,
    db: persistence.db,
  };

  // Set persistence deps for compare handlers
  setPersistenceDeps(persistenceDeps);

  // Register all IPC handlers
  registerCompareHandlers(win);

  registerHistoryHandlers({
    ...persistenceDeps,
  });

  registerSettingsHandlers({
    db: persistence.db,
    retentionService: persistence.retentionService,
  });

  registerAnnotationHandlers({
    annotationRepo: persistence.annotationRepo,
    taskRepo: persistence.taskRepo,
  });
  registerRiskReviewHandlers(win, persistence.db.getDb(), persistence.keyManager.getKey());

  // MinerU token management
  const mineruDataDir = process.env.BIDLENS_DATA_DIR || app.getPath('userData');
  const mineruConfig = new MineruConfigService(mineruDataDir);
  registerMineruConfigHandlers({ config: mineruConfig });
  setMineruConfigService(mineruConfig);

  if (isDev) {
    log.info('[Main] Loading dev URL: http://localhost:5373');
    win.loadURL('http://localhost:5373');
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    log.info('[Main] Loading file:', indexPath);
    win.loadFile(indexPath);
  }
}

app.whenReady().then(createWindow);

// Prevent the native File/Edit/View menu from appearing above the product UI.
Menu.setApplicationMenu(null);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  event.preventDefault();

  void Promise.all([shutdownCompareServices(), shutdownRiskEngine()]).finally(async () => {
    if (persistence) {
      await persistence.shutdown();
      persistence = null;
    }
    app.quit();
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
