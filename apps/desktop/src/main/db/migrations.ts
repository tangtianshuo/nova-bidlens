/**
 * Forward-only migration runner for BidLens SQLite database.
 * Uses PRAGMA user_version for version tracking.
 * Each migration runs in a transaction with checksum verification.
 */
import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import {
  CREATE_TABLES_SQL,
  CREATE_INDEXES_SQL,
  ENABLE_WAL_SQL,
  ENABLE_FOREIGN_KEYS_SQL,
  SCHEMA_VERSION,
} from './schema.js';

export interface Migration {
  version: number;
  name: string;
  up: string[];
}

function computeChecksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

/**
 * V0.3 risk-project tables. Additive only — does not touch v1 tables.
 * Encrypted columns use BLOB (AES-256-GCM ciphertext).
 * JSON fields stored as TEXT. Timestamps as ISO-8601 TEXT.
 */
const V2_TABLES_SQL = [
  // ── risk_projects ──
  `CREATE TABLE IF NOT EXISTS risk_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    phase TEXT,
    preset TEXT NOT NULL DEFAULT 'standard',
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    model_version TEXT NOT NULL DEFAULT '',
    rule_version TEXT NOT NULL DEFAULT '',
    parser_version TEXT NOT NULL DEFAULT '',
    matcher_version TEXT NOT NULL DEFAULT '',
    warnings_json TEXT NOT NULL DEFAULT '[]',
    degradation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── risk_submissions ──
  `CREATE TABLE IF NOT EXISTS risk_submissions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_format TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    page_count INTEGER,
    sha256 TEXT NOT NULL,
    file_path_encrypted BLOB,
    status TEXT NOT NULL DEFAULT 'pending',
    warnings_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE
  )`,

  // ── document_versions (shared across submissions with same hash) ──
  `CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_format TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    page_count INTEGER,
    parser_version TEXT NOT NULL,
    ast_encrypted BLOB NOT NULL,
    review_nodes_encrypted BLOB,
    ref_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── tender_baselines ──
  `CREATE TABLE IF NOT EXISTS tender_baselines (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    submission_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'parsed',
    parse_warnings_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES risk_submissions(id) ON DELETE CASCADE
  )`,

  // ── risk_findings ──
  `CREATE TABLE IF NOT EXISTS risk_findings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    detector_type TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    involved_submission_ids_json TEXT NOT NULL,
    symmetric_similarity REAL NOT NULL,
    directional_coverage_json TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    score_breakdown_json TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'pending',
    important INTEGER NOT NULL DEFAULT 0,
    review_note_encrypted BLOB,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE
  )`,

  // ── risk_evidence ──
  `CREATE TABLE IF NOT EXISTS risk_evidence (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    detector_type TEXT NOT NULL,
    match_basis TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    source_submission_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL,
    source_original_text_encrypted BLOB NOT NULL,
    source_normalized_text_encrypted BLOB NOT NULL,
    source_section_path_json TEXT NOT NULL,
    source_page_range_json TEXT,
    source_table_location_json TEXT,
    target_submission_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    target_original_text_encrypted BLOB NOT NULL,
    target_normalized_text_encrypted BLOB NOT NULL,
    target_section_path_json TEXT NOT NULL,
    target_page_range_json TEXT,
    target_table_location_json TEXT,
    context_before_encrypted BLOB,
    context_after_encrypted BLOB,
    tender_filtered INTEGER NOT NULL DEFAULT 0,
    tender_filter_reason TEXT,
    rule_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (finding_id) REFERENCES risk_findings(id) ON DELETE CASCADE
  )`,

  // ── file_pair_assessments ──
  `CREATE TABLE IF NOT EXISTS file_pair_assessments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    submission_a_id TEXT NOT NULL,
    submission_b_id TEXT NOT NULL,
    directional_coverage_ab REAL NOT NULL,
    directional_coverage_ba REAL NOT NULL,
    symmetric_similarity REAL NOT NULL,
    risk_level TEXT NOT NULL,
    top_finding_ids_json TEXT NOT NULL,
    finding_count_json TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    analysis_status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_a_id) REFERENCES risk_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_b_id) REFERENCES risk_submissions(id) ON DELETE CASCADE
  )`,

  // ── project_risk_assessments ──
  `CREATE TABLE IF NOT EXISTS project_risk_assessments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    level TEXT NOT NULL,
    raw_rule_score REAL NOT NULL,
    top_contributing_finding_ids_json TEXT NOT NULL,
    preset TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    analysis_status TEXT NOT NULL,
    high_value_finding_count INTEGER NOT NULL DEFAULT 0,
    involved_submission_count INTEGER NOT NULL DEFAULT 0,
    strong_entity_hit_count INTEGER NOT NULL DEFAULT 0,
    tender_discount_applied INTEGER NOT NULL DEFAULT 0,
    incomplete_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE
  )`,

  // ── review_decisions ──
  `CREATE TABLE IF NOT EXISTS review_decisions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    finding_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    important INTEGER NOT NULL DEFAULT 0,
    note_encrypted BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (finding_id) REFERENCES risk_findings(id) ON DELETE CASCADE,
    UNIQUE(project_id, finding_id)
  )`,

  // ── analysis_checkpoints ──
  `CREATE TABLE IF NOT EXISTS analysis_checkpoints (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    processing_version TEXT NOT NULL,
    completed_detectors_json TEXT NOT NULL DEFAULT '[]',
    intermediate_result_ref TEXT,
    warnings_json TEXT NOT NULL DEFAULT '[]',
    errors_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE
  )`,

  // ── detector_runs ──
  `CREATE TABLE IF NOT EXISTS detector_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    detector_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    candidate_count INTEGER NOT NULL DEFAULT 0,
    hit_count INTEGER NOT NULL DEFAULT 0,
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    rule_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE
  )`,

  // ── audit_events ──
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE
  )`,

  // ── exported_reports ──
  `CREATE TABLE IF NOT EXISTS exported_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    format TEXT NOT NULL,
    scope TEXT NOT NULL,
    result_hash TEXT NOT NULL,
    file_path_encrypted BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES risk_projects(id) ON DELETE CASCADE
  )`,
];

const V2_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_risk_projects_status ON risk_projects(status)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_projects_created ON risk_projects(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_submissions_project ON risk_submissions(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_submissions_sha256 ON risk_submissions(sha256)`,
  `CREATE INDEX IF NOT EXISTS idx_document_versions_sha256 ON document_versions(sha256)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_findings_project ON risk_findings(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_findings_review ON risk_findings(project_id, review_status)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_findings_level ON risk_findings(project_id, risk_level)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_evidence_finding ON risk_evidence(finding_id)`,
  `CREATE INDEX IF NOT EXISTS idx_file_pair_project ON file_pair_assessments(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_review_decisions_project ON review_decisions(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_review_decisions_finding ON review_decisions(finding_id)`,
  `CREATE INDEX IF NOT EXISTS idx_checkpoints_project ON analysis_checkpoints(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_detector_runs_project ON detector_runs(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_detector_runs_type ON detector_runs(project_id, detector_type)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_project ON audit_events(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(project_id, event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_exported_reports_project ON exported_reports(project_id)`,
];

/**
 * Built-in migrations. Each migration is a list of SQL statements.
 * Version 1: Initial schema.
 * Version 2: V0.3 risk-project persistence (additive).
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: [
      ENABLE_WAL_SQL,
      ENABLE_FOREIGN_KEYS_SQL,
      ...CREATE_TABLES_SQL,
      ...CREATE_INDEXES_SQL,
    ],
  },
  {
    version: 2,
    name: 'risk_project_persistence',
    up: [
      ...V2_TABLES_SQL,
      ...V2_INDEXES_SQL,
    ],
  },
];

/**
 * Run database quick_check to detect corruption.
 * Returns null if healthy, error message if corrupted.
 */
export function runQuickCheck(db: Database.Database): string | null {
  try {
    const result = db.pragma('quick_check') as Array<{ quick_check: string }>;
    const status = result[0]?.quick_check;
    if (status === 'ok') return null;
    return status ?? 'unknown error';
  } catch (err) {
    return `quick_check failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Get current schema version from PRAGMA user_version.
 */
function getUserVersion(db: Database.Database): number {
  const result = db.pragma('user_version') as Array<{ user_version: number }>;
  return result[0]?.user_version ?? 0;
}

/**
 * Set schema version via PRAGMA user_version.
 */
function setUserVersion(db: Database.Database, version: number): void {
  db.pragma(`user_version = ${version}`);
}

/**
 * Run all pending migrations in forward-only order.
 * Each migration executes in a transaction.
 * Records checksum in migration_history table.
 *
 * @returns The final schema version after migrations.
 */
export function runMigrations(db: Database.Database): number {
  // Enable WAL and foreign keys before any migration
  db.exec(ENABLE_WAL_SQL);
  db.exec(ENABLE_FOREIGN_KEYS_SQL);

  const currentVersion = getUserVersion(db);
  const targetVersion = SCHEMA_VERSION;

  if (currentVersion >= targetVersion) {
    return currentVersion;
  }

  // Run pending migrations
  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    const migrationTx = db.transaction(() => {
      for (const sql of migration.up) {
        db.exec(sql);
      }

      // Record migration in history table
      const checksum = computeChecksum(migration.up.join('\n'));
      db.prepare(
        `INSERT OR REPLACE INTO migration_history (version, name, checksum) VALUES (?, ?, ?)`
      ).run(migration.version, migration.name, checksum);

      // Update user_version
      setUserVersion(db, migration.version);
    });

    migrationTx();
  }

  return getUserVersion(db);
}

/**
 * Verify migration checksums match expected values.
 * Returns list of mismatched migrations.
 */
export function verifyMigrationChecksums(db: Database.Database): string[] {
  const errors: string[] = [];

  // Check if migration_history table exists
  const tableExists = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='migration_history'`
  ).get();

  if (!tableExists) return errors;

  const rows = db.prepare(
    `SELECT version, name, checksum FROM migration_history ORDER BY version`
  ).all() as Array<{ version: number; name: string; checksum: string }>;

  for (const row of rows) {
    const migration = MIGRATIONS.find(m => m.version === row.version);
    if (!migration) {
      errors.push(`Migration v${row.version} (${row.name}) not found in code`);
      continue;
    }
    const expectedChecksum = computeChecksum(migration.up.join('\n'));
    if (row.checksum !== expectedChecksum) {
      errors.push(
        `Migration v${row.version} (${row.name}) checksum mismatch: expected ${expectedChecksum}, got ${row.checksum}`
      );
    }
  }

  return errors;
}
