/**
 * E2E test: full risk pipeline from project creation to finding verification.
 * Creates a project with 2 similar DOCX files, processes through the Rust engine,
 * and verifies findings/evidence/assessments are persisted with traceable references.
 */
import { test, expect } from '@playwright/test';
import { launchTestApp, type TestContext, cleanupDir } from './setup';
import {
  createTestProject,
  waitForStatus,
  getProjectDetail,
  deleteTestProject,
  waitForFindings,
} from './helpers';
import { createSimilarDocs } from './fixtures/create-docx';
import type { AnalysisProjectDetail } from '@bidlens/shared';

let ctx: TestContext;
let projectId: string;
let detail: AnalysisProjectDetail;

test.beforeAll(async () => {
  ctx = await launchTestApp();
  const fixturePaths = await createSimilarDocs(ctx.exportDir);
  projectId = await createTestProject(ctx.page, fixturePaths);
  // Wait for engine to finish — 'ready' or 'partial' both mean analysis completed
  try {
    await waitForStatus(ctx.page, projectId, 'ready', 120_000);
  } catch {
    try {
      await waitForStatus(ctx.page, projectId, 'partial', 5_000);
    } catch {
      const events = await ctx.page.evaluate(
        (pid) => (window as any).bidlens.getAuditEvents(pid),
        projectId,
      );
      const failEvent = events.find((e: any) => e.eventType === 'analysis-failed');
      if (failEvent) {
        console.error('[E2E] Failure reason:', failEvent.payload.error);
        if (failEvent.payload.stack) console.error('[E2E] Stack:', failEvent.payload.stack);
      } else {
        const d = await getProjectDetail(ctx.page, projectId);
        console.error('[E2E] Project stuck. Status:', d.status, 'Phase:', d.phase);
        console.error('[E2E] Audit events:', JSON.stringify(events.slice(0, 5)));
      }
      throw new Error(`Project did not complete. Status: ${(await getProjectDetail(ctx.page, projectId)).status}`);
    }
  }
  detail = await getProjectDetail(ctx.page, projectId);
});

test.afterAll(async () => {
  if (projectId) {
    await deleteTestProject(ctx.page, projectId).catch(() => {});
  }
  await ctx.electronApp.close();
  cleanupDir(ctx.userDataDir);
  cleanupDir(ctx.exportDir);
});

test('full risk pipeline produces findings and evidence', async () => {
  // Submissions: 2 files loaded
  expect(detail.submissions.length).toBe(2);
  expect(detail.submissions[0].status).not.toBe('failed');
  expect(detail.submissions[1].status).not.toBe('failed');

  // At least one finding from the text detector
  expect(detail.findings.length).toBeGreaterThan(0);

  // Each finding must have evidence
  for (const finding of detail.findings) {
    expect(finding.evidence.length).toBeGreaterThan(0);
    expect(finding.involvedSubmissionIds.length).toBe(2);

    // Evidence traces back to real submissions
    const ev = finding.evidence[0];
    expect(ev.sourceSubmissionId).toBeTruthy();
    expect(ev.targetSubmissionId).toBeTruthy();
    expect(ev.sourceOriginalText.length).toBeGreaterThan(0);
  }

  // File pair assessment exists
  expect(detail.filePairAssessments.length).toBeGreaterThan(0);

  // Project-level assessment exists
  expect(detail.assessment).not.toBeNull();
});

test('findings have traceable evidence with node references', async () => {
  for (const finding of detail.findings) {
    for (const ev of finding.evidence) {
      expect(ev.sourceNodeId).toBeTruthy();
      expect(ev.targetNodeId).toBeTruthy();
      expect(Array.isArray(ev.sourceSectionPath)).toBe(true);
      expect(ev.similarityScore).toBeGreaterThan(0);
    }
  }
});

test('project can be deleted after review', async () => {
  await deleteTestProject(ctx.page, projectId);
  const projects = await ctx.page.evaluate(
    () => (window as any).bidlens.listProjects(),
  );
  expect(projects.find((p: any) => p.id === projectId)).toBeUndefined();
  // Prevent afterAll from trying to delete again
  projectId = '';
});
