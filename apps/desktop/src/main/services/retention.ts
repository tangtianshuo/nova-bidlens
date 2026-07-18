/**
 * Retention and cleanup service for BidLens persistence.
 * Manages task lifecycle, LRU cleanup, and storage budgets.
 */
import type { DatabaseManager } from '../db/database.js';
import type { TaskRepository } from '../repositories/task-repository.js';
import type { SnapshotRepository } from '../repositories/snapshot-repository.js';
import type { AnnotationRepository } from '../repositories/annotation-repository.js';

export interface CleanupResult {
  deletedCount: number;
  freedBytes: number;
}

export class RetentionService {
  constructor(
    private readonly db: DatabaseManager,
    private readonly taskRepo: TaskRepository,
    private readonly snapshotRepo: SnapshotRepository,
    private readonly annotationRepo: AnnotationRepository
  ) {}

  /**
   * Run automatic cleanup based on retention policy.
   * - Removes oldest non-retained tasks when count exceeds limit
   * - Removes tasks when storage exceeds budget
   * - Never removes retained or active tasks
   */
  autoCleanup(options: {
    maxTaskCount?: number;
    maxStorageBytes?: number;
  }): CleanupResult {
    let deletedCount = 0;

    // Count-based cleanup
    if (options.maxTaskCount) {
      const { total } = this.taskRepo.countByStatus();
      const excess = total - options.maxTaskCount;
      if (excess > 0) {
        deletedCount += this.deleteLRU(excess);
      }
    }

    // Size-based cleanup
    if (options.maxStorageBytes) {
      const currentSize = this.db.getLogicalDataSizeBytes();
      if (currentSize > options.maxStorageBytes) {
        // Delete tasks until we're under budget
        let remaining = currentSize - options.maxStorageBytes;
        while (remaining > 0) {
          const tasks = this.taskRepo.getLRUOrder(1);
          if (tasks.length === 0) break;

          this.deleteTask(tasks[0].id);
          deletedCount++;

          // Recheck size
          const newSize = this.db.getLogicalDataSizeBytes();
          remaining = newSize - options.maxStorageBytes;
        }
      }
    }

    return {
      deletedCount,
      freedBytes: 0, // Could track this if needed
    };
  }

  /**
   * Delete the N least-recently-used non-retained tasks.
   */
  deleteLRU(count: number): number {
    const tasks = this.taskRepo.getLRUOrder(count);
    for (const task of tasks) {
      this.deleteTask(task.id);
    }
    return tasks.length;
  }

  /**
   * Delete a specific task and all its associated data.
   */
  deleteTask(taskId: string, force = false): boolean {
    const task = this.taskRepo.getById(taskId);
    if (!task) return false;
    if (task.retained === 1 && !force) return false;

    // Don't delete retained tasks unless explicitly requested
    // (this method is used by both explicit delete and auto-cleanup)
    this.db.transaction(() => {
      this.annotationRepo.deleteByTaskId(taskId);
      this.snapshotRepo.deleteByTaskId(taskId);
      this.taskRepo.delete(taskId);
    });

    return true;
  }

  /**
   * Delete all non-retained tasks.
   */
  clearNonRetained(): number {
    const tasks = this.taskRepo.getLRUOrder(Number.MAX_SAFE_INTEGER);
    let deleted = 0;

    this.db.transaction(() => {
      for (const task of tasks) {
        this.annotationRepo.deleteByTaskId(task.id);
        this.snapshotRepo.deleteByTaskId(task.id);
        this.taskRepo.delete(task.id);
        deleted++;
      }
    });

    return deleted;
  }

  /**
   * Get storage report.
   */
  getStorageReport(): {
    databaseSizeBytes: number;
    cacheSizeBytes: number;
    totalTaskCount: number;
    retainedCount: number;
    cleanableCount: number;
  } {
    const { total, retained, cleanable } = this.taskRepo.countByStatus();
    return {
      databaseSizeBytes: this.db.getLogicalDataSizeBytes(),
      cacheSizeBytes: 0, // No separate cache yet
      totalTaskCount: total,
      retainedCount: retained,
      cleanableCount: cleanable,
    };
  }
}
