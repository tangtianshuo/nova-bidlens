/**
 * Persistence manager for BidLens.
 * Initializes and manages all persistence services.
 */
import { app } from 'electron';
import path from 'node:path';
import { DatabaseManager } from '../db/database.js';
import { KeyManager } from './key-manager.js';
import { BackupService } from './backup.js';
import { RecoveryService } from './recovery.js';
import { RetentionService } from './retention.js';
import { TaskRepository } from '../repositories/task-repository.js';
import { SnapshotRepository } from '../repositories/snapshot-repository.js';
import { AnnotationRepository } from '../repositories/annotation-repository.js';
import { DatabaseWorkerClient } from '../db/database-worker-client.js';

export class PersistenceManager {
  readonly db: DatabaseManager;
  readonly keyManager: KeyManager;
  readonly backupService: BackupService;
  readonly recoveryService: RecoveryService;
  readonly retentionService: RetentionService;
  readonly taskRepo: TaskRepository;
  readonly snapshotRepo: SnapshotRepository;
  readonly annotationRepo: AnnotationRepository;

  private initialized = false;
  private databaseWorker: DatabaseWorkerClient | null = null;

  constructor(dataDir?: string) {
    const resolvedDataDir = dataDir ?? app.getPath('userData');

    this.db = new DatabaseManager({
      dataDir: resolvedDataDir,
      nativeModulesRoot: app.isPackaged
        ? path.join(process.resourcesPath, 'native')
        : undefined,
    });
    this.keyManager = new KeyManager(resolvedDataDir);
    this.backupService = new BackupService(resolvedDataDir);
    this.recoveryService = new RecoveryService(resolvedDataDir);

    // Repositories
    this.taskRepo = new TaskRepository(this.db);
    this.snapshotRepo = new SnapshotRepository(this.db, this.keyManager);
    this.annotationRepo = new AnnotationRepository(this.db, this.keyManager);

    // Retention service depends on repositories
    this.retentionService = new RetentionService(
      this.db,
      this.taskRepo,
      this.snapshotRepo,
      this.annotationRepo
    );
  }

  /**
   * Initialize all persistence services.
   * Must be called before using any repository.
   */
  initialize(): { healthy: boolean; corruptionError?: string } {
    if (this.initialized) {
      return { healthy: true };
    }

    // Initialize key manager (loads or generates encryption key)
    this.keyManager.initialize();

    // Open database (runs migrations and integrity check)
    const result = this.db.open();

    if (!result.healthy && result.corruptionError) {
      // Attempt recovery
      console.log('[Persistence] Attempting corruption recovery...');
      const dbPath = this.db.getPath();
      this.db.close();
      const recoveryResult = this.recoveryService.recoverCorruption(dbPath, result.corruptionError);

      if (recoveryResult.recovered) {
        console.log('[Persistence] Recovery successful:', recoveryResult.action);
        // Re-open the fresh database
        const reopened = this.db.open();
        this.initialized = reopened.healthy;
        if (reopened.healthy) this.startDatabaseWorker();
        return reopened;
      }
      return result;
    }

    // Run auto-cleanup on startup
    try {
      const settings = this.getSettings();
      this.retentionService.autoCleanup({
        maxTaskCount: settings.historyCountLimit,
        maxStorageBytes: settings.storageLimitBytes,
      });
    } catch (err) {
      console.error('[Persistence] Auto-cleanup failed:', err);
    }

    this.startDatabaseWorker();
    this.initialized = true;
    return result;
  }

  /**
   * Get current settings (convenience method).
   */
  private getSettings(): { historyCountLimit: number; storageLimitBytes: number } {
    const row = this.db.prepare(
      "SELECT value_json FROM settings WHERE key = 'app_settings'"
    ).get() as { value_json: string } | undefined;

    if (!row) {
      return { historyCountLimit: 20, storageLimitBytes: 1024 * 1024 * 1024 };
    }

    try {
      return JSON.parse(row.value_json);
    } catch {
      return { historyCountLimit: 20, storageLimitBytes: 1024 * 1024 * 1024 };
    }
  }

  /**
   * Shutdown persistence services.
   */
  async shutdown(): Promise<void> {
    if (this.databaseWorker) {
      await this.databaseWorker.close();
      this.databaseWorker = null;
    }
    // Create a backup before shutdown
    try {
      this.backupService.createBackup(this.db.getDb(), 'shutdown');
    } catch (err) {
      console.error('[Persistence] Shutdown backup failed:', err);
    }

    // Close database
    this.db.close();

    // Clear encryption key from memory
    this.keyManager.destroy();

    this.initialized = false;
  }

  private startDatabaseWorker(): void {
    if (this.databaseWorker) return;
    this.databaseWorker = new DatabaseWorkerClient(this.db.getPath());
    this.snapshotRepo.setWorker(this.databaseWorker);
  }
}
