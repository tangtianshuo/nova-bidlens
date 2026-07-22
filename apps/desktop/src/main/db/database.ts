/**
 * Database manager for BidLens persistence layer.
 * Wraps better-sqlite3 with serialized write operations,
 * proper lifecycle management, and failure mapping.
 */
import type Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { runMigrations, runQuickCheck, verifyMigrationChecksums } from './migrations.js';
import { loadNativeDatabase } from './native-database.js';
import { ENABLE_FOREIGN_KEYS_SQL } from './schema.js';
import { log } from '../logger';

export interface DatabaseConfig {
  /** Directory for database files. Defaults to app userData. */
  dataDir?: string;
  /** Database filename. Defaults to 'bidlens.db' */
  filename?: string;
  /** Explicit packaged location for native runtime dependencies. */
  nativeModulesRoot?: string;
}

export class DatabaseManager {
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private readonly walPath: string;
  private readonly shmPath: string;
  private readonly nativeModulesRoot?: string;

  constructor(config?: DatabaseConfig) {
    const dataDir = config?.dataDir ?? app.getPath('userData');
    const filename = config?.filename ?? 'bidlens.db';
    this.dbPath = path.join(dataDir, filename);
    this.walPath = path.join(dataDir, `${filename}-wal`);
    this.shmPath = path.join(dataDir, `${filename}-shm`);
    this.nativeModulesRoot = config?.nativeModulesRoot;
  }

  /**
   * Open database, run migrations, and verify integrity.
   * Returns corruption status if detected.
   */
  open(): { healthy: boolean; corruptionError?: string } {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const NativeDatabase = loadNativeDatabase(this.nativeModulesRoot);
    this.db = new NativeDatabase(this.dbPath);

    // Enable WAL mode and foreign keys
    this.db.exec(ENABLE_FOREIGN_KEYS_SQL);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    // Run integrity check
    const corruptionError = runQuickCheck(this.db);
    if (corruptionError) {
      log.error('[DB] Corruption detected:', corruptionError);
      return { healthy: false, corruptionError };
    }

    // Run pending migrations
    const finalVersion = runMigrations(this.db);
    log.info(`[DB] Schema version: ${finalVersion}`);

    // Verify migration checksums
    const checksumErrors = verifyMigrationChecksums(this.db);
    if (checksumErrors.length > 0) {
      log.error('[DB] Migration checksum errors:', checksumErrors);
    }

    return { healthy: true };
  }

  /**
   * Get the underlying better-sqlite3 instance.
   * Throws if database is not open.
   */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not open. Call open() first.');
    }
    return this.db;
  }

  /**
   * Execute a function within a transaction.
   * Write operations should use this to ensure atomicity.
   */
  transaction<T>(fn: () => T): T {
    const db = this.getDb();
    const tx = db.transaction(fn);
    return tx();
  }

  /**
   * Prepare a statement. Convenience wrapper.
   */
  prepare(sql: string): Database.Statement {
    return this.getDb().prepare(sql);
  }

  /**
   * Execute raw SQL. Use sparingly.
   */
  exec(sql: string): void {
    this.getDb().exec(sql);
  }

  /**
   * Get database file size in bytes.
   */
  getSizeBytes(): number {
    try {
      const stat = fs.statSync(this.dbPath);
      let size = stat.size;
      // Include WAL file if present
      if (fs.existsSync(this.walPath)) {
        size += fs.statSync(this.walPath).size;
      }
      return size;
    } catch {
      return 0;
    }
  }

  /** Logical encrypted payload size used for retention decisions. */
  getLogicalDataSizeBytes(): number {
    const row = this.getDb().prepare(`
      SELECT
        COALESCE((SELECT SUM(LENGTH(payload_encrypted)) FROM document_snapshots), 0) +
        COALESCE((SELECT SUM(LENGTH(payload_encrypted)) FROM diff_snapshots), 0) +
        COALESCE((SELECT SUM(LENGTH(note_encrypted)) FROM review_annotations), 0)
        AS bytes
    `).get() as { bytes: number };
    return row.bytes;
  }

  /**
   * Get database file path.
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Check if database is open.
   */
  isOpen(): boolean {
    return this.db !== null;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        log.error('[DB] Error closing database:', err);
      }
      this.db = null;
    }
  }
}
