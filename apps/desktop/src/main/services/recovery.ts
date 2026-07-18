/**
 * Corruption recovery service for BidLens persistence.
 * Detects corruption, isolates damaged files, creates fresh database.
 * Preserves diagnostic summary for troubleshooting.
 */
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { runQuickCheck } from '../db/migrations.js';

export interface RecoveryResult {
  recovered: boolean;
  action: 'none' | 'isolated_and_fresh' | 'restored_from_backup';
  details: string;
  isolatedFiles: string[];
}

export class RecoveryService {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * Check database health and attempt recovery if corrupted.
   */
  checkAndRecover(dbPath: string, db: Database.Database): RecoveryResult {
    const corruptionError = runQuickCheck(db);

    if (!corruptionError) {
      return { recovered: true, action: 'none', details: 'Database healthy', isolatedFiles: [] };
    }

    db.close();
    return this.recoverCorruption(dbPath, corruptionError);
  }

  recoverCorruption(dbPath: string, corruptionError: string): RecoveryResult {
    console.error('[Recovery] Corruption detected:', corruptionError);

    const expectedFiles = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]
      .filter((file) => fs.existsSync(file)).length;

    // Isolate corrupted files
    const isolated = this.isolateCorruptedFiles(dbPath);

    if (isolated.length !== expectedFiles) {
      return {
        recovered: false,
        action: 'none',
        details: `Corruption detected but only ${isolated.length}/${expectedFiles} files were isolated.`,
        isolatedFiles: isolated,
      };
    }

    // Create fresh database
    this.createFreshDatabase(dbPath);

    return {
      recovered: true,
      action: 'isolated_and_fresh',
      details: `Corruption detected: ${corruptionError}. Isolated ${isolated.length} files and created fresh database.`,
      isolatedFiles: isolated,
    };
  }

  /**
   * Isolate corrupted database, WAL, and SHM files.
   * Moves them to a 'corrupted' subdirectory with timestamp.
   */
  private isolateCorruptedFiles(dbPath: string): string[] {
    const isolated: string[] = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const corruptedDir = path.join(this.dataDir, 'corrupted', timestamp);

    if (!fs.existsSync(corruptedDir)) {
      fs.mkdirSync(corruptedDir, { recursive: true });
    }

    const filesToIsolate = [
      dbPath,
      `${dbPath}-wal`,
      `${dbPath}-shm`,
    ];

    for (const file of filesToIsolate) {
      if (fs.existsSync(file)) {
        const basename = path.basename(file);
        const dest = path.join(corruptedDir, basename);
        try {
          fs.renameSync(file, dest);
          isolated.push(dest);
          console.log(`[Recovery] Isolated: ${basename}`);
        } catch (err) {
          // If rename fails (e.g., cross-device), try copy + delete
          try {
            fs.copyFileSync(file, dest);
            fs.unlinkSync(file);
            isolated.push(dest);
          } catch (copyErr) {
            console.error(`[Recovery] Failed to isolate ${basename}:`, copyErr);
          }
        }
      }
    }

    return isolated;
  }

  /**
   * Create a fresh empty database file.
   */
  private createFreshDatabase(dbPath: string): void {
    // The database will be created fresh when DatabaseManager.open() is called
    // Just ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    console.log('[Recovery] Fresh database will be created on next open');
  }

  /**
   * Get diagnostic summary of any corrupted files found.
   */
  getDiagnosticSummary(): {
    corruptedDirExists: boolean;
    corruptedSessions: Array<{ timestamp: string; files: string[] }>;
  } {
    const corruptedBase = path.join(this.dataDir, 'corrupted');

    if (!fs.existsSync(corruptedBase)) {
      return { corruptedDirExists: false, corruptedSessions: [] };
    }

    try {
      const sessions = fs.readdirSync(corruptedBase)
        .filter(f => fs.statSync(path.join(corruptedBase, f)).isDirectory())
        .sort()
        .reverse();

      return {
        corruptedDirExists: true,
        corruptedSessions: sessions.map(timestamp => ({
          timestamp,
          files: fs.readdirSync(path.join(corruptedBase, timestamp)),
        })),
      };
    } catch {
      return { corruptedDirExists: true, corruptedSessions: [] };
    }
  }
}
