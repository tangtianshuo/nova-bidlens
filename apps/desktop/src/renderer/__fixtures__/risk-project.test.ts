import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildReadyScenario,
  buildNoBaselineScenario,
  buildDegradedScenario,
  buildPartialScenario,
  buildInterruptedScenario,
  buildEmptyProjectList,
  buildProjectSummaries,
  resetFixtureIds,
} from './risk-project';

describe('risk-project fixtures', () => {
  beforeEach(() => {
    resetFixtureIds();
  });

  describe('buildReadyScenario', () => {
    it('produces a complete project with 3 submissions and findings', () => {
      const project = buildReadyScenario();
      expect(project.status).toBe('ready');
      expect(project.submissions).toHaveLength(3);
      expect(project.findings.length).toBeGreaterThan(0);
      expect(project.assessment).not.toBeNull();
      expect(project.assessment!.level).toBe('high');
      expect(project.baseline).not.toBeNull();
      expect(project.warnings).toHaveLength(0);
      expect(project.degradationReason).toBeNull();
    });

    it('uses deterministic IDs', () => {
      const a = buildReadyScenario();
      resetFixtureIds();
      const b = buildReadyScenario();
      expect(a.id).toBe(b.id);
      expect(a.submissions[0].id).toBe(b.submissions[0].id);
      expect(a.findings[0].id).toBe(b.findings[0].id);
    });

    it('has no any types', () => {
      const project = buildReadyScenario();
      // Verify key fields are typed (compile-time check + runtime spot check)
      expect(typeof project.name).toBe('string');
      expect(typeof project.assessment!.rawRuleScore).toBe('number');
      expect(project.submissions[0].fileFormat).toMatch(/^(docx|pdf)$/);
    });
  });

  describe('buildNoBaselineScenario', () => {
    it('has null baseline and warning', () => {
      const project = buildNoBaselineScenario();
      expect(project.baseline).toBeNull();
      expect(project.warnings.length).toBeGreaterThan(0);
      expect(project.warnings[0]).toContain('基线');
    });
  });

  describe('buildDegradedScenario', () => {
    it('has degraded analysis status', () => {
      const project = buildDegradedScenario();
      expect(project.assessment!.analysisStatus).toBe('degraded');
      expect(project.degradationReason).toBe('model_unavailable');
      expect(project.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('buildPartialScenario', () => {
    it('has incomplete assessment', () => {
      const project = buildPartialScenario();
      expect(project.status).toBe('partial');
      expect(project.assessment!.level).toBe('incomplete');
      expect(project.assessment!.analysisStatus).toBe('partial');
    });
  });

  describe('buildInterruptedScenario', () => {
    it('has interrupted status and no findings', () => {
      const project = buildInterruptedScenario();
      expect(project.status).toBe('interrupted');
      expect(project.findings).toHaveLength(0);
      expect(project.assessment).toBeNull();
    });
  });

  describe('buildEmptyProjectList', () => {
    it('returns empty array', () => {
      expect(buildEmptyProjectList()).toEqual([]);
    });
  });

  describe('buildProjectSummaries', () => {
    it('returns 6 summaries covering all states', () => {
      const summaries = buildProjectSummaries();
      expect(summaries).toHaveLength(6);
      const statuses = summaries.map((s) => s.status);
      expect(statuses).toContain('ready');
      expect(statuses).toContain('partial');
      expect(statuses).toContain('interrupted');
    });

    it('each summary has required fields', () => {
      for (const s of buildProjectSummaries()) {
        expect(s.id).toBeTruthy();
        expect(s.name).toBeTruthy();
        expect(s.createdAt).toBeTruthy();
        expect(typeof s.submissionCount).toBe('number');
        expect(typeof s.elapsedMs).toBe('number');
      }
    });
  });
});
