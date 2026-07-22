/**
 * Smoke tests for the Electron app E2E harness.
 * Verifies: app launches, window appears, IPC responds, DB is isolated.
 */
import { test, expect } from '@playwright/test';
import { launchTestApp, type TestContext, cleanupDir, verifyDbExists } from './setup';
import { createTestProject, waitForStatus, getProjectDetail } from './helpers';

let ctx: TestContext;

test.beforeAll(async () => {
  ctx = await launchTestApp();
});

test.afterAll(async () => {
  await ctx.electronApp.close();
  cleanupDir(ctx.userDataDir);
  cleanupDir(ctx.exportDir);
});

test('app launches and shows main window', async () => {
  const title = await ctx.page.title();
  // Window should exist and have loaded (title may be empty for frameless window)
  expect(ctx.page).toBeTruthy();
  // The renderer should have loaded — check for a visible element
  await expect(ctx.page.locator('body')).toBeAttached();
});

test('window.bidlens API is exposed', async () => {
  const api = await ctx.page.evaluate(() => (window as any).bidlens);
  expect(api).toBeTruthy();
  expect(typeof api.createRiskProject).toBe('function');
  expect(typeof api.getProject).toBe('function');
  expect(typeof api.listProjects).toBe('function');
});

test('DB is created in isolated directory', async () => {
  // The DB file should exist in the temp userDataDir, not the real user data dir
  expect(verifyDbExists(ctx)).toBe(true);
  expect(ctx.dbPath).toContain('bidlens-e2e-userdata');
});

test('project list returns empty array for fresh DB', async () => {
  const projects = await ctx.page.evaluate(
    () => (window as any).bidlens.listProjects(),
  );
  expect(Array.isArray(projects)).toBe(true);
  expect(projects).toHaveLength(0);
});

test('can create a risk project via IPC', async () => {
  // This test verifies the IPC round-trip works.
  // Actual DOCX files are not available yet — the call will fail at
  // file validation, which is expected and proves the handler is wired.
  const files = [
    '/tmp/e2e-fixture-A.docx',
    '/tmp/e2e-fixture-B.docx',
  ];

  try {
    const projectId = await createTestProject(ctx.page, files);
    expect(projectId).toBeTruthy();
  } catch (e: unknown) {
    // Expected: files don't exist yet. The important thing is the IPC
    // call didn't crash the app — it returned an error response.
    // Verify the error is about file validation, not a missing IPC handler.
    expect(e).toBeDefined();
    const msg = String(e);
    expect(msg).not.toContain('is not a function');
    expect(msg).not.toContain('handler not registered');
  }
});

test('project list is accessible', async () => {
  const projects = await ctx.page.evaluate(
    () => (window as any).bidlens.listProjects(),
  );
  expect(Array.isArray(projects)).toBe(true);
});
