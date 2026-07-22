/**
 * E2E test helpers for driving the BidLens risk pipeline via IPC.
 */
import type { Page } from '@playwright/test';
import type { AnalysisProjectDetail, ProjectStatus } from '@bidlens/shared';

const DEFAULT_TIMEOUT = 120_000;

/** Create a risk project via IPC. Returns projectId. */
export async function createTestProject(
  page: Page,
  files: string[],
  baseline?: string,
): Promise<string> {
  const result = await page.evaluate(
    ({ files, baseline }) => {
      const api = (window as any).bidlens;
      return api.createRiskProject({
        name: `e2e-test-${Date.now()}`,
        submissions: files.map((p) => ({ path: p })),
        baseline: baseline ? { path: baseline } : null,
        preset: 'standard',
      });
    },
    { files, baseline },
  );
  return result.projectId;
}

/** Poll project status until it reaches the target or times out. */
export async function waitForStatus(
  page: Page,
  projectId: string,
  targetStatus: ProjectStatus,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const detail = await page.evaluate(
      (pid) => (window as any).bidlens.getProject(pid),
      projectId,
    );
    if (detail.status === targetStatus) return;
    if (detail.status === 'interrupted' || detail.status === 'partial') {
      throw new Error(`Project reached terminal status "${detail.status}" instead of "${targetStatus}"`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for status "${targetStatus}" after ${timeout}ms`);
}

/** Retrieve the full project detail via IPC. */
export async function getProjectDetail(
  page: Page,
  projectId: string,
): Promise<AnalysisProjectDetail> {
  return page.evaluate(
    (pid) => (window as any).bidlens.getProject(pid),
    projectId,
  );
}

/** Delete a project and clean up. */
export async function deleteTestProject(page: Page, projectId: string): Promise<void> {
  await page.evaluate(
    (pid) => (window as any).bidlens.deleteProject(pid),
    projectId,
  );
}

/** Wait for project to have at least one finding (polls getProject). */
export async function waitForFindings(
  page: Page,
  projectId: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<AnalysisProjectDetail> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const detail: AnalysisProjectDetail = await page.evaluate(
      (pid) => (window as any).bidlens.getProject(pid),
      projectId,
    );
    if (detail.findings.length > 0) return detail;
    if (detail.status === 'failed' || detail.status === 'interrupted') {
      throw new Error(`Project reached terminal status "${detail.status}" before findings appeared`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for findings after ${timeout}ms`);
}
