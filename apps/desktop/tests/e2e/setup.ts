/**
 * Playwright Electron test harness.
 * Launches the app with isolated userData, database, and export directories.
 */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export interface TestContext {
  electronApp: ElectronApplication;
  page: Page;
  userDataDir: string;
  dbPath: string;
  exportDir: string;
}

/** Create a unique temp directory for this test run. */
function makeTmpDir(prefix: string): string {
  const dir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Launch the Electron app with test-isolated paths.
 * The main process must respect BIDLENS_TEST_DATA_DIR env var
 * to override userData (see main/index.ts for the override hook).
 */
export async function launchTestApp(): Promise<TestContext> {
  const userDataDir = makeTmpDir('bidlens-e2e-userdata');
  const exportDir = makeTmpDir('bidlens-e2e-export');
  const dbPath = path.join(userDataDir, 'bidlens.db');

  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      BIDLENS_TEST_DATA_DIR: userDataDir,
      BIDLENS_TEST_EXPORT_DIR: exportDir,
      NODE_ENV: 'test',
    },
  });

  const page = await electronApp.firstWindow();

  return { electronApp, page, userDataDir, dbPath, exportDir };
}

/** Get the IPC handle (window.bidlens) from the renderer. */
export async function getBidlensApi(page: Page) {
  return page.evaluate(() => (window as any).bidlens);
}

/** Clean up temp directories created during a test. */
export function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}
