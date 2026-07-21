/**
 * Database schema definitions for BidLens persistence layer.
 * All SQL statements for table creation and indexes.
 */

export const SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = [
  // Tasks table — stores comparison task metadata
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL,
    doc_a_filename TEXT NOT NULL,
    doc_b_filename TEXT NOT NULL,
    doc_a_hash TEXT NOT NULL,
    doc_b_hash TEXT NOT NULL,
    doc_a_path_encrypted BLOB,
    doc_b_path_encrypted BLOB,
    options_json TEXT NOT NULL,
    diff_summary_json TEXT,
    review_progress_json TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    last_accessed_at TEXT NOT NULL,
    retained INTEGER NOT NULL DEFAULT 0,
    failure_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Document snapshots (encrypted AST payloads)
  `CREATE TABLE IF NOT EXISTS document_snapshots (
    task_id TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('a', 'b')),
    payload_encrypted BLOB NOT NULL,
    parser_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (task_id, side),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )`,

  // Diff snapshots (encrypted diff AST payloads)
  `CREATE TABLE IF NOT EXISTS diff_snapshots (
    task_id TEXT PRIMARY KEY,
    payload_encrypted BLOB NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )`,

  // Review annotations
  `CREATE TABLE IF NOT EXISTS review_annotations (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unreviewed',
    important INTEGER NOT NULL DEFAULT 0,
    note_encrypted BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, match_id)
  )`,

  // Settings (key-value store)
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Migration tracking
  `CREATE TABLE IF NOT EXISTS migration_history (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

export const CREATE_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_tasks_last_accessed ON tasks(last_accessed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_retained ON tasks(retained)`,
  `CREATE INDEX IF NOT EXISTS idx_review_annotations_task ON review_annotations(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_document_snapshots_task ON document_snapshots(task_id)`,
];

export const ENABLE_WAL_SQL = `PRAGMA journal_mode = WAL`;

export const ENABLE_FOREIGN_KEYS_SQL = `PRAGMA foreign_keys = ON`;
