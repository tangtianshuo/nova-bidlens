/**
 * Backup service for BidLens persistence.
 * Uses file copy for synchronous backups.
 * Maintains 5 backup retention with pre-migration backups.
 */
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BACKUPS = 5;
const BACKUP_PREFIX = 'bidlens-backup-';

export class BackupService {
  private readonly backupDir: string;

  constructor(dataDir: string) {
    this.backupDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of the database using file copy.
   * Returns the backup file path.
   */
  createBackup(db: Database.Database, label?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = label ? `-${label}` : '';
    const backupPath = path.join(this.backupDir, `${BACKUP_PREFIX}${timestamp}${suffix}.db`);

    try {
      // Get the database file path from the database instance
      // Use VACUUM INTO for a consistent backup
      db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

      console.log(`[Backup] Created: ${path.basename(backupPath)}`);

      // Cleanup old backups
      this.cleanupOldBackups();

      return backupPath;
    } catch (err) {
      console.error('[Backup] Failed to create backup:', err);
      throw err;
    }
  }

  /**
   * Create a pre-migration backup.
   */
  createPreMigrationBackup(db: Database.Database, fromVersion: number, toVersion: number): string {
    return this.createBackup(db, `migration-v${fromVersion}-to-v${toVersion}`);
  }

  /**
   * List available backups sorted by date (newest first).
   */
  listBackups(): Array<{ path: string; date: string; sizeBytes: number }> {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith('.db'))
        .sort()
        .reverse();

      return files.map(f => {
        const filePath = path.join(this.backupDir, f);
        const stat = fs.statSync(filePath);
        return {
          path: filePath,
          date: f.replace(BACKUP_PREFIX, '').replace('.db', ''),
          sizeBytes: stat.size,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Restore database from a backup file.
   * Returns diagnostic information about the restore.
   */
  restoreFromBackup(backupPath: string, targetPath: string): {
    success: boolean;
    error?: string;
    restoredFrom: string;
  } {
    try {
      if (!fs.existsSync(backupPath)) {
        return { success: false, error: 'Backup file not found', restoredFrom: backupPath };
      }

      // Copy backup to target location
      fs.copyFileSync(backupPath, targetPath);

      // Also copy WAL and SHM files if they exist
      const walPath = `${backupPath}-wal`;
      const shmPath = `${backupPath}-shm`;
      if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, `${targetPath}-wal`);
      }
      if (fs.existsSync(shmPath)) {
        fs.copyFileSync(shmPath, `${targetPath}-shm`);
      }

      return { success: true, restoredFrom: backupPath };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        restoredFrom: backupPath,
      };
    }
  }

  /**
   * Delete old backups, keeping only MAX_BACKUPS most recent.
   */
  private cleanupOldBackups(): void {
    try {
      const backups = this.listBackups();
      if (backups.length > MAX_BACKUPS) {
        const toDelete = backups.slice(MAX_BACKUPS);
        for (const backup of toDelete) {
          try {
            fs.unlinkSync(backup.path);
            // Clean up WAL/SHM files too
            if (fs.existsSync(`${backup.path}-wal`)) {
              fs.unlinkSync(`${backup.path}-wal`);
            }
            if (fs.existsSync(`${backup.path}-shm`)) {
              fs.unlinkSync(`${backup.path}-shm`);
            }
          } catch (err) {
            console.error(`[Backup] Failed to delete old backup: ${backup.path}`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Backup] Failed to cleanup old backups:', err);
    }
  }
}
