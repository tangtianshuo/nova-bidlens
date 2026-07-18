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
 * Built-in migrations. Each migration is a list of SQL statements.
 * Version 1: Initial schema.
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
