import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { encrypt, decrypt } from './crypto.js';
import type {
  ProjectStatus,
  AnalysisPhase,
  SubmissionState,
  RiskLevel,
  DetectorType,
  FindingReviewStatus,
  AuditEventType,
  ReportFormat,
  ReportScope,
} from '@bidlens/shared';

// ── helpers ──

function now(): string {
  return new Date().toISOString();
}

function enc(text: string, key: Buffer): Buffer {
  return encrypt(text, key);
}

function dec(buf: Buffer, key: Buffer): string {
  return decrypt(buf, key);
}

// ── row types (mirrors schema columns) ──

export interface ProjectRow {
  id: string;
  name: string;
  status: string;
  phase: string | null;
  preset: string;
  elapsed_ms: number;
  model_version: string;
  rule_version: string;
  parser_version: string;
  matcher_version: string;
  warnings_json: string;
  degradation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionRow {
  id: string;
  project_id: string;
  file_name: string;
  file_format: string;
  file_size_bytes: number;
  page_count: number | null;
  sha256: string;
  file_path_encrypted: Buffer | null;
  status: string;
  warnings_json: string;
  created_at: string;
  updated_at: string;
}

interface DocumentVersionRow {
  id: string;
  sha256: string;
  file_name: string;
  file_format: string;
  file_size_bytes: number;
  page_count: number | null;
  parser_version: string;
  ast_encrypted: Buffer;
  review_nodes_encrypted: Buffer | null;
  ref_count: number;
  created_at: string;
}

export interface FindingRow {
  id: string;
  project_id: string;
  detector_type: string;
  risk_level: string;
  involved_submission_ids_json: string;
  symmetric_similarity: number;
  directional_coverage_json: string;
  confidence_score: number;
  score_breakdown_json: string;
  rule_version: string;
  review_status: string;
  important: number;
  review_note_encrypted: Buffer | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EvidenceRow {
  id: string;
  finding_id: string;
  detector_type: string;
  match_basis: string;
  similarity_score: number;
  source_submission_id: string;
  source_node_id: string;
  source_original_text_encrypted: Buffer;
  source_normalized_text_encrypted: Buffer;
  source_section_path_json: string;
  source_page_range_json: string | null;
  source_table_location_json: string | null;
  target_submission_id: string;
  target_node_id: string;
  target_original_text_encrypted: Buffer;
  target_normalized_text_encrypted: Buffer;
  target_section_path_json: string;
  target_page_range_json: string | null;
  target_table_location_json: string | null;
  context_before_encrypted: Buffer | null;
  context_after_encrypted: Buffer | null;
  tender_filtered: number;
  tender_filter_reason: string | null;
  rule_version: string;
  created_at: string;
}

interface ReviewDecisionRow {
  id: string;
  project_id: string;
  finding_id: string;
  status: string;
  important: number;
  note_encrypted: Buffer | null;
  created_at: string;
  updated_at: string;
}

interface CheckpointRow {
  id: string;
  project_id: string;
  phase: string;
  input_hash: string;
  processing_version: string;
  completed_detectors_json: string;
  intermediate_result_ref: string | null;
  warnings_json: string;
  errors_json: string;
  created_at: string;
}

interface AuditEventRow {
  id: string;
  project_id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
}

interface ExportedReportRow {
  id: string;
  project_id: string;
  format: string;
  scope: string;
  result_hash: string;
  file_path_encrypted: Buffer | null;
  created_at: string;
}

// ── 1. ProjectRepository ──

export function createProjectRepository(db: Database.Database) {
  return {
    create(params: {
      name: string;
      preset?: string;
      modelVersion?: string;
      ruleVersion?: string;
      parserVersion?: string;
      matcherVersion?: string;
    }): string {
      const id = randomUUID();
      const ts = now();
      db.prepare(`INSERT INTO risk_projects (id, name, status, preset, model_version, rule_version, parser_version, matcher_version, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, params.name, params.preset ?? 'standard', params.modelVersion ?? '', params.ruleVersion ?? '', params.parserVersion ?? '', params.matcherVersion ?? '', ts, ts);
      return id;
    },

    getById(id: string): ProjectRow | undefined {
      return db.prepare(`SELECT * FROM risk_projects WHERE id = ?`).get(id) as ProjectRow | undefined;
    },

    list(filters?: { status?: ProjectStatus; limit?: number; offset?: number }): ProjectRow[] {
      let sql = `SELECT * FROM risk_projects`;
      const conditions: string[] = [];
      const args: unknown[] = [];
      if (filters?.status) {
        conditions.push(`status = ?`);
        args.push(filters.status);
      }
      if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(` AND `);
      }
      sql += ` ORDER BY created_at DESC`;
      if (filters?.limit != null) {
        sql += ` LIMIT ?`;
        args.push(filters.limit);
        if (filters?.offset != null) {
          sql += ` OFFSET ?`;
          args.push(filters.offset);
        }
      }
      return db.prepare(sql).all(...args) as ProjectRow[];
    },

    updateStatus(id: string, status: ProjectStatus, phase?: AnalysisPhase): void {
      const ts = now();
      if (phase !== undefined) {
        db.prepare(`UPDATE risk_projects SET status = ?, phase = ?, updated_at = ? WHERE id = ?`)
          .run(status, phase, ts, id);
      } else {
        db.prepare(`UPDATE risk_projects SET status = ?, updated_at = ? WHERE id = ?`)
          .run(status, ts, id);
      }
    },

    updateElapsed(id: string, elapsedMs: number): void {
      db.prepare(`UPDATE risk_projects SET elapsed_ms = ?, updated_at = ? WHERE id = ?`)
        .run(elapsedMs, now(), id);
    },

    delete(id: string): void {
      db.prepare(`DELETE FROM risk_projects WHERE id = ?`).run(id);
    },
  };
}

// ── 2. SubmissionRepository ──

export function createSubmissionRepository(db: Database.Database) {
  return {
    create(params: {
      projectId: string;
      fileName: string;
      fileFormat: string;
      fileSizeBytes: number;
      pageCount?: number;
      sha256: string;
      filePath?: string;
      encryptionKey: Buffer;
    }): string {
      const id = randomUUID();
      const ts = now();
      db.prepare(`INSERT INTO risk_submissions (id, project_id, file_name, file_format, file_size_bytes, page_count, sha256, file_path_encrypted, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .run(id, params.projectId, params.fileName, params.fileFormat, params.fileSizeBytes, params.pageCount ?? null, params.sha256, params.filePath ? enc(params.filePath, params.encryptionKey) : null, ts, ts);
      return id;
    },

    getByProject(projectId: string): SubmissionRow[] {
      return db.prepare(`SELECT * FROM risk_submissions WHERE project_id = ? ORDER BY created_at`).all(projectId) as SubmissionRow[];
    },

    updateStatus(id: string, status: SubmissionState): void {
      db.prepare(`UPDATE risk_submissions SET status = ?, updated_at = ? WHERE id = ?`)
        .run(status, now(), id);
    },
  };
}

// ── 3. DocumentVersionRepository ──

export function createDocumentVersionRepository(db: Database.Database) {
  return {
    create(params: {
      sha256: string;
      fileName: string;
      fileFormat: string;
      fileSizeBytes: number;
      pageCount?: number;
      parserVersion: string;
      astEncrypted: Buffer;
      reviewNodesEncrypted?: Buffer;
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO document_versions (id, sha256, file_name, file_format, file_size_bytes, page_count, parser_version, ast_encrypted, review_nodes_encrypted, ref_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
        .run(id, params.sha256, params.fileName, params.fileFormat, params.fileSizeBytes, params.pageCount ?? null, params.parserVersion, params.astEncrypted, params.reviewNodesEncrypted ?? null, now());
      return id;
    },

    getByHash(sha256: string): DocumentVersionRow | undefined {
      return db.prepare(`SELECT * FROM document_versions WHERE sha256 = ?`).get(sha256) as DocumentVersionRow | undefined;
    },

    incrementRef(id: string): void {
      db.prepare(`UPDATE document_versions SET ref_count = ref_count + 1 WHERE id = ?`).run(id);
    },

    decrementRef(id: string): void {
      db.prepare(`UPDATE document_versions SET ref_count = MAX(0, ref_count - 1) WHERE id = ?`).run(id);
    },
  };
}

// ── 4. FindingRepository ──

export function createFindingRepository(db: Database.Database) {
  return {
    create(params: {
      projectId: string;
      detectorType: DetectorType;
      riskLevel: RiskLevel;
      involvedSubmissionIds: string[];
      symmetricSimilarity: number;
      directionalCoverage: { fromId: string; toId: string; coverage: number }[];
      confidenceScore: number;
      scoreBreakdown: Record<string, unknown>;
      ruleVersion: string;
      reviewNote?: string;
      encryptionKey: Buffer;
    }): string {
      const id = randomUUID();
      const ts = now();
      db.prepare(`INSERT INTO risk_findings (id, project_id, detector_type, risk_level, involved_submission_ids_json, symmetric_similarity, directional_coverage_json, confidence_score, score_breakdown_json, rule_version, review_note_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, params.projectId, params.detectorType, params.riskLevel,
          JSON.stringify(params.involvedSubmissionIds),
          params.symmetricSimilarity,
          JSON.stringify(params.directionalCoverage),
          params.confidenceScore,
          JSON.stringify(params.scoreBreakdown),
          params.ruleVersion,
          params.reviewNote ? enc(params.reviewNote, params.encryptionKey) : null,
          ts, ts,
        );
      return id;
    },

    getByProject(projectId: string, filters?: { riskLevel?: RiskLevel; reviewStatus?: FindingReviewStatus }): FindingRow[] {
      let sql = `SELECT * FROM risk_findings WHERE project_id = ?`;
      const args: unknown[] = [projectId];
      if (filters?.riskLevel) {
        sql += ` AND risk_level = ?`;
        args.push(filters.riskLevel);
      }
      if (filters?.reviewStatus) {
        sql += ` AND review_status = ?`;
        args.push(filters.reviewStatus);
      }
      sql += ` ORDER BY created_at`;
      return db.prepare(sql).all(...args) as FindingRow[];
    },

    updateReview(id: string, status: FindingReviewStatus, important: boolean, note?: string, encryptionKey?: Buffer): void {
      const ts = now();
      const encNote = note && encryptionKey ? enc(note, encryptionKey) : null;
      db.prepare(`UPDATE risk_findings SET review_status = ?, important = ?, review_note_encrypted = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`)
        .run(status, important ? 1 : 0, encNote, ts, ts, id);
    },
  };
}

// ── 5. EvidenceRepository ──

export function createEvidenceRepository(db: Database.Database) {
  return {
    create(params: {
      findingId: string;
      detectorType: DetectorType;
      matchBasis: string;
      similarityScore: number;
      sourceSubmissionId: string;
      sourceNodeId: string;
      sourceOriginalText: string;
      sourceNormalizedText: string;
      sourceSectionPath: string[];
      sourcePageRange?: [number, number];
      sourceTableLocation?: Record<string, unknown>;
      targetSubmissionId: string;
      targetNodeId: string;
      targetOriginalText: string;
      targetNormalizedText: string;
      targetSectionPath: string[];
      targetPageRange?: [number, number];
      targetTableLocation?: Record<string, unknown>;
      contextBefore?: string;
      contextAfter?: string;
      tenderFiltered: boolean;
      tenderFilterReason?: string;
      ruleVersion: string;
      encryptionKey: Buffer;
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO risk_evidence (id, finding_id, detector_type, match_basis, similarity_score, source_submission_id, source_node_id, source_original_text_encrypted, source_normalized_text_encrypted, source_section_path_json, source_page_range_json, source_table_location_json, target_submission_id, target_node_id, target_original_text_encrypted, target_normalized_text_encrypted, target_section_path_json, target_page_range_json, target_table_location_json, context_before_encrypted, context_after_encrypted, tender_filtered, tender_filter_reason, rule_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, params.findingId, params.detectorType, params.matchBasis, params.similarityScore,
          params.sourceSubmissionId, params.sourceNodeId,
          enc(params.sourceOriginalText, params.encryptionKey),
          enc(params.sourceNormalizedText, params.encryptionKey),
          JSON.stringify(params.sourceSectionPath),
          params.sourcePageRange ? JSON.stringify(params.sourcePageRange) : null,
          params.sourceTableLocation ? JSON.stringify(params.sourceTableLocation) : null,
          params.targetSubmissionId, params.targetNodeId,
          enc(params.targetOriginalText, params.encryptionKey),
          enc(params.targetNormalizedText, params.encryptionKey),
          JSON.stringify(params.targetSectionPath),
          params.targetPageRange ? JSON.stringify(params.targetPageRange) : null,
          params.targetTableLocation ? JSON.stringify(params.targetTableLocation) : null,
          params.contextBefore ? enc(params.contextBefore, params.encryptionKey) : null,
          params.contextAfter ? enc(params.contextAfter, params.encryptionKey) : null,
          params.tenderFiltered ? 1 : 0,
          params.tenderFilterReason ?? null,
          params.ruleVersion,
          now(),
        );
      return id;
    },

    getByFinding(findingId: string, encryptionKey: Buffer) {
      const rows = db.prepare(`SELECT * FROM risk_evidence WHERE finding_id = ? ORDER BY created_at`).all(findingId) as EvidenceRow[];
      return rows.map(r => ({
        id: r.id,
        findingId: r.finding_id,
        detectorType: r.detector_type,
        matchBasis: r.match_basis,
        similarityScore: r.similarity_score,
        sourceSubmissionId: r.source_submission_id,
        sourceNodeId: r.source_node_id,
        sourceOriginalText: dec(r.source_original_text_encrypted, encryptionKey),
        sourceNormalizedText: dec(r.source_normalized_text_encrypted, encryptionKey),
        sourceSectionPath: JSON.parse(r.source_section_path_json) as string[],
        sourcePageRange: r.source_page_range_json ? JSON.parse(r.source_page_range_json) : null,
        sourceTableLocation: r.source_table_location_json ? JSON.parse(r.source_table_location_json) : null,
        targetSubmissionId: r.target_submission_id,
        targetNodeId: r.target_node_id,
        targetOriginalText: dec(r.target_original_text_encrypted, encryptionKey),
        targetNormalizedText: dec(r.target_normalized_text_encrypted, encryptionKey),
        targetSectionPath: JSON.parse(r.target_section_path_json) as string[],
        targetPageRange: r.target_page_range_json ? JSON.parse(r.target_page_range_json) : null,
        targetTableLocation: r.target_table_location_json ? JSON.parse(r.target_table_location_json) : null,
        contextBefore: r.context_before_encrypted ? dec(r.context_before_encrypted, encryptionKey) : '',
        contextAfter: r.context_after_encrypted ? dec(r.context_after_encrypted, encryptionKey) : '',
        tenderFiltered: !!r.tender_filtered,
        tenderFilterReason: r.tender_filter_reason,
        ruleVersion: r.rule_version,
      }));
    },
  };
}

// ── 6. ReviewDecisionRepository ──

export function createReviewDecisionRepository(db: Database.Database) {
  return {
    upsert(params: {
      projectId: string;
      findingId: string;
      status: FindingReviewStatus;
      important: boolean;
      note?: string;
      encryptionKey: Buffer;
    }): string {
      const existing = db.prepare(`SELECT id FROM review_decisions WHERE project_id = ? AND finding_id = ?`)
        .get(params.projectId, params.findingId) as { id: string } | undefined;
      const ts = now();
      const encNote = params.note ? enc(params.note, params.encryptionKey) : null;

      if (existing) {
        db.prepare(`UPDATE review_decisions SET status = ?, important = ?, note_encrypted = ?, updated_at = ? WHERE id = ?`)
          .run(params.status, params.important ? 1 : 0, encNote, ts, existing.id);
        return existing.id;
      }

      const id = randomUUID();
      db.prepare(`INSERT INTO review_decisions (id, project_id, finding_id, status, important, note_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, params.projectId, params.findingId, params.status, params.important ? 1 : 0, encNote, ts, ts);
      return id;
    },

    getByProject(projectId: string, encryptionKey: Buffer) {
      const rows = db.prepare(`SELECT * FROM review_decisions WHERE project_id = ? ORDER BY updated_at DESC`).all(projectId) as ReviewDecisionRow[];
      return rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        findingId: r.finding_id,
        status: r.status as FindingReviewStatus,
        important: !!r.important,
        note: r.note_encrypted ? dec(r.note_encrypted, encryptionKey) : '',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    },

    getByFindingId(findingId: string, encryptionKey: Buffer) {
      const row = db.prepare(`SELECT * FROM review_decisions WHERE finding_id = ?`)
        .get(findingId) as ReviewDecisionRow | undefined;
      if (!row) return undefined;
      return {
        id: row.id,
        projectId: row.project_id,
        findingId: row.finding_id,
        status: row.status as FindingReviewStatus,
        important: !!row.important,
        note: row.note_encrypted ? dec(row.note_encrypted, encryptionKey) : '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    deleteByFindingId(findingId: string): void {
      db.prepare(`DELETE FROM review_decisions WHERE finding_id = ?`).run(findingId);
    },
  };
}

// ── 7. CheckpointRepository ──

export function createCheckpointRepository(db: Database.Database) {
  return {
    save(params: {
      projectId: string;
      phase: string;
      inputHash: string;
      processingVersion: string;
      completedDetectors: string[];
      intermediateResultRef?: string;
      warnings?: string[];
      errors?: string[];
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO analysis_checkpoints (id, project_id, phase, input_hash, processing_version, completed_detectors_json, intermediate_result_ref, warnings_json, errors_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, params.projectId, params.phase, params.inputHash, params.processingVersion,
          JSON.stringify(params.completedDetectors),
          params.intermediateResultRef ?? null,
          JSON.stringify(params.warnings ?? []),
          JSON.stringify(params.errors ?? []),
          now(),
        );
      return id;
    },

    getLatest(projectId: string): CheckpointRow | undefined {
      return db.prepare(`SELECT * FROM analysis_checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`)
        .get(projectId) as CheckpointRow | undefined;
    },
  };
}

// ── 8. AuditEventRepository ──

export function createAuditEventRepository(db: Database.Database) {
  return {
    append(params: {
      projectId: string;
      eventType: AuditEventType;
      payload?: Record<string, unknown>;
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO audit_events (id, project_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(id, params.projectId, params.eventType, JSON.stringify(params.payload ?? {}), now());
      return id;
    },

    getByProject(projectId: string, eventType?: AuditEventType): AuditEventRow[] {
      if (eventType) {
        return db.prepare(`SELECT * FROM audit_events WHERE project_id = ? AND event_type = ? ORDER BY created_at`)
          .all(projectId, eventType) as AuditEventRow[];
      }
      return db.prepare(`SELECT * FROM audit_events WHERE project_id = ? ORDER BY created_at`)
        .all(projectId) as AuditEventRow[];
    },
  };
}

// ── 9. ExportedReportRepository ──

export function createExportedReportRepository(db: Database.Database) {
  return {
    create(params: {
      projectId: string;
      format: ReportFormat;
      scope: ReportScope;
      resultHash: string;
      filePath?: string;
      encryptionKey: Buffer;
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO exported_reports (id, project_id, format, scope, result_hash, file_path_encrypted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, params.projectId, params.format, params.scope, params.resultHash, params.filePath ? enc(params.filePath, params.encryptionKey) : null, now());
      return id;
    },

    getByProject(projectId: string, encryptionKey: Buffer) {
      const rows = db.prepare(`SELECT * FROM exported_reports WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as ExportedReportRow[];
      return rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        format: r.format as ReportFormat,
        scope: r.scope as ReportScope,
        resultHash: r.result_hash,
        filePath: r.file_path_encrypted ? dec(r.file_path_encrypted, encryptionKey) : '',
        createdAt: r.created_at,
      }));
    },
  };
}

// ── 10. FilePairAssessmentRepository ──

export interface FilePairAssessmentRow {
  id: string;
  project_id: string;
  submission_a_id: string;
  submission_b_id: string;
  directional_coverage_ab: number;
  directional_coverage_ba: number;
  symmetric_similarity: number;
  risk_level: string;
  top_finding_ids_json: string;
  finding_count_json: string;
  rule_version: string;
  analysis_status: string;
  created_at: string;
}

export function createFilePairAssessmentRepository(db: Database.Database) {
  return {
    create(params: {
      projectId: string;
      submissionAId: string;
      submissionBId: string;
      directionalCoverageAB: number;
      directionalCoverageBA: number;
      symmetricSimilarity: number;
      riskLevel: RiskLevel;
      topFindingIds: string[];
      findingCount: { high: number; medium: number; low: number };
      ruleVersion: string;
      analysisStatus: string;
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO file_pair_assessments (id, project_id, submission_a_id, submission_b_id, directional_coverage_ab, directional_coverage_ba, symmetric_similarity, risk_level, top_finding_ids_json, finding_count_json, rule_version, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, params.projectId, params.submissionAId, params.submissionBId, params.directionalCoverageAB, params.directionalCoverageBA, params.symmetricSimilarity, params.riskLevel, JSON.stringify(params.topFindingIds), JSON.stringify(params.findingCount), params.ruleVersion, params.analysisStatus, now());
      return id;
    },

    getByProject(projectId: string): FilePairAssessmentRow[] {
      return db.prepare(`SELECT * FROM file_pair_assessments WHERE project_id = ? ORDER BY created_at`).all(projectId) as FilePairAssessmentRow[];
    },

    deleteByProject(projectId: string): void {
      db.prepare(`DELETE FROM file_pair_assessments WHERE project_id = ?`).run(projectId);
    },
  };
}

// ── 11. TenderBaselineRepository ──

export interface TenderBaselineRow {
  id: string;
  project_id: string;
  submission_id: string;
  status: string;
  parse_warnings_json: string;
  created_at: string;
}

export function createTenderBaselineRepository(db: Database.Database) {
  return {
    create(params: {
      projectId: string;
      submissionId: string;
      status: string;
      parseWarnings: string[];
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO tender_baselines (id, project_id, submission_id, status, parse_warnings_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, params.projectId, params.submissionId, params.status, JSON.stringify(params.parseWarnings), now());
      return id;
    },

    getByProject(projectId: string): TenderBaselineRow | undefined {
      return db.prepare(`SELECT * FROM tender_baselines WHERE project_id = ?`).get(projectId) as TenderBaselineRow | undefined;
    },
  };
}

// ── 12. DetectorRunRepository ──

export interface DetectorRunRow {
  id: string;
  project_id: string;
  detector_type: string;
  status: string;
  candidate_count: number;
  hit_count: number;
  elapsed_ms: number;
  error_message: string | null;
  rule_version: string;
  created_at: string;
}

export function createDetectorRunRepository(db: Database.Database) {
  return {
    create(params: {
      projectId: string;
      detectorType: string;
      status: string;
      candidateCount: number;
      hitCount: number;
      elapsedMs: number;
      errorMessage?: string;
      ruleVersion: string;
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO detector_runs (id, project_id, detector_type, status, candidate_count, hit_count, elapsed_ms, error_message, rule_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, params.projectId, params.detectorType, params.status, params.candidateCount, params.hitCount, params.elapsedMs, params.errorMessage ?? null, params.ruleVersion, now());
      return id;
    },

    getByProject(projectId: string): DetectorRunRow[] {
      return db.prepare(`SELECT * FROM detector_runs WHERE project_id = ? ORDER BY created_at`).all(projectId) as DetectorRunRow[];
    },
  };
}

// ── 13. ProjectRiskAssessmentRepository ──

export interface ProjectRiskAssessmentRow {
  id: string;
  project_id: string;
  level: string;
  raw_rule_score: number;
  top_contributing_finding_ids_json: string;
  preset: string;
  rule_version: string;
  analysis_status: string;
  high_value_finding_count: number;
  involved_submission_count: number;
  strong_entity_hit_count: number;
  tender_discount_applied: number;
  incomplete_reason: string | null;
  created_at: string;
}

export function createProjectRiskAssessmentRepository(db: Database.Database) {
  return {
    create(params: {
      projectId: string;
      level: string;
      rawRuleScore: number;
      topContributingFindingIds: string[];
      preset: string;
      ruleVersion: string;
      analysisStatus: string;
      highValueFindingCount: number;
      involvedSubmissionCount: number;
      strongEntityHitCount: number;
      tenderDiscountApplied: boolean;
      incompleteReason?: string;
    }): string {
      const id = randomUUID();
      db.prepare(`INSERT INTO project_risk_assessments (id, project_id, level, raw_rule_score, top_contributing_finding_ids_json, preset, rule_version, analysis_status, high_value_finding_count, involved_submission_count, strong_entity_hit_count, tender_discount_applied, incomplete_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, params.projectId, params.level, params.rawRuleScore,
          JSON.stringify(params.topContributingFindingIds),
          params.preset, params.ruleVersion, params.analysisStatus,
          params.highValueFindingCount, params.involvedSubmissionCount,
          params.strongEntityHitCount, params.tenderDiscountApplied ? 1 : 0,
          params.incompleteReason ?? null, now(),
        );
      return id;
    },

    getByProject(projectId: string): ProjectRiskAssessmentRow | undefined {
      return db.prepare(`SELECT * FROM project_risk_assessments WHERE project_id = ?`).get(projectId) as ProjectRiskAssessmentRow | undefined;
    },
  };
}
