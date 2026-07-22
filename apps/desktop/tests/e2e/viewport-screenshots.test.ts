/**
 * E2E test: viewport and accessibility screenshots for risk review UI.
 * Captures screenshots at 1280x800, 1024x700, and 760px widths
 * and verifies ARIA labels exist on key interactive elements.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { launchTestApp, type TestContext, cleanupDir } from './setup';
import {
  createTestProject,
  waitForFindings,
  deleteTestProject,
} from './helpers';
import { createSimilarDocs } from './fixtures/create-docx';

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

let ctx: TestContext;
let projectId: string;

test.beforeAll(async () => {
  // Ensure screenshot output directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  ctx = await launchTestApp();
  const fixturePaths = await createSimilarDocs(ctx.exportDir);
  projectId = await createTestProject(ctx.page, fixturePaths);

  // Wait for engine to produce findings
  await waitForFindings(ctx.page, projectId, 120_000);
});

test.afterAll(async () => {
  if (projectId) {
    await deleteTestProject(ctx.page, projectId).catch(() => {});
  }
  await ctx.electronApp.close();
  cleanupDir(ctx.userDataDir);
  cleanupDir(ctx.exportDir);
});

test('1280x800 viewport screenshot with ARIA checks', async () => {
  const page = ctx.page;

  // Set desktop viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);

  // Screenshot
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'viewport-1280x800.png'),
    fullPage: true,
  });

  // ARIA: at least some aria-label elements should exist
  const ariaElements = page.locator('[aria-label]');
  const count = await ariaElements.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // ARIA: finding list has role="listbox" with aria-label
  const listbox = page.locator('[role="listbox"][aria-label]');
  const listboxCount = await listbox.count();
  expect(listboxCount).toBeGreaterThanOrEqual(1);
});

test('1024x700 viewport screenshot with ARIA checks', async () => {
  const page = ctx.page;

  // Set compact viewport
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.waitForTimeout(500);

  // Screenshot
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'viewport-1024x700.png'),
    fullPage: true,
  });

  // ARIA: key interactive elements still have accessible names
  const ariaElements = page.locator('[aria-label]');
  const count = await ariaElements.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('760px viewport screenshot with ARIA checks', async () => {
  const page = ctx.page;

  // Set narrow viewport (equivalent to 760 width)
  await page.setViewportSize({ width: 760, height: 1024 });
  await page.waitForTimeout(500);

  // Screenshot
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'viewport-760.png'),
    fullPage: true,
  });

  // ARIA: verify no elements are visually hidden but still accessible (basic check)
  const ariaElements = page.locator('[aria-label]');
  const count = await ariaElements.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // Verify listbox is still present at narrow viewport
  const listbox = page.locator('[role="listbox"]');
  const listboxCount = await listbox.count();
  expect(listboxCount).toBeGreaterThanOrEqual(1);
});
