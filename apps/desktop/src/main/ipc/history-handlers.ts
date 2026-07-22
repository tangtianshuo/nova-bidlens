/**
 * History IPC handlers for BidLens.
 * Handles task history list, open, recompare, retain, delete, clear.
 */
import { ipcMain } from 'electron';
import { log } from '../logger';
import type {
  HistoryListRequest,
  HistoryListResponse,
  OpenSnapshotRequest,
  OpenSnapshotResponse,
  RecompareRequest,
  CleanupRequest,
  TaskSummary,
  ReviewAnnotation,
} from '@bidlens/shared';
import type { TaskRepository } from '../repositories/task-repository.js';
import type { SnapshotRepository } from '../repositories/snapshot-repository.js';
import type { AnnotationRepository } from '../repositories/annotation-repository.js';
import type { RetentionService } from '../services/retention.js';

export function registerHistoryHandlers(deps: {
  taskRepo: TaskRepository;
  snapshotRepo: SnapshotRepository;
  annotationRepo: AnnotationRepository;
  retentionService: RetentionService;
}): void {
  const { taskRepo, snapshotRepo, annotationRepo, retentionService } = deps;

  // List history with optional search and status filter
  ipcMain.handle('history:list', async (_event, request?: HistoryListRequest): Promise<HistoryListResponse> => {
    log.info('[IPC] history:list — search:', request?.search ?? 'none', 'filter:', request?.statusFilter ?? 'all');
    const tasks = taskRepo.list({
      search: request?.search,
      statusFilter: request?.statusFilter,
    });
    return { tasks };
  });

  // Open a snapshot — loads full CompareResult and annotations
  ipcMain.handle('history:openSnapshot', async (_event, request: OpenSnapshotRequest): Promise<OpenSnapshotResponse> => {
    const { taskId } = request;
    log.info('[IPC] history:openSnapshot — taskId:', taskId);

    // Touch the task to update last accessed
    taskRepo.touch(taskId);

    // Load snapshots
    const docA = await snapshotRepo.loadDocumentAst(taskId, 'a');
    const docB = await snapshotRepo.loadDocumentAst(taskId, 'b');
    const diffAst = await snapshotRepo.loadDiffAst(taskId);

    if (!docA || !docB || !diffAst) {
      throw new Error(`Snapshot not found for task ${taskId}`);
    }

    // Load task metadata
    const task = taskRepo.getById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Load annotations
    const annotations = await annotationRepo.batchRead(taskId);

    // Reconstruct CompareResult
    const result = {
      taskId,
      docA,
      docB,
      diffAst,
      annotations,
      capabilities: [], // Would need to store these too
      options: JSON.parse(task.options_json),
      warnings: [],
      startedAt: task.started_at,
      completedAt: task.completed_at ?? task.started_at,
      durationMs: task.duration_ms ?? 0,
    };

    return { result, annotations };
  });

  // Recompare — creates a new task based on an existing one
  ipcMain.handle('history:recompare', async (_event, request: RecompareRequest): Promise<{ taskId: string }> => {
    const { taskId, newFileAPath, newFileBPath, options } = request;
    log.info('[IPC] history:recompare — from taskId:', taskId);

    // Load original task
    const originalTask = taskRepo.getById(taskId);
    if (!originalTask) {
      throw new Error(`Original task not found: ${taskId}`);
    }

    // Create new task ID
    const newTaskId = crypto.randomUUID();

    // Save initial task record
    taskRepo.save({
      id: newTaskId,
      displayName: originalTask.display_name,
      status: 'draft',
      docAFilename: originalTask.doc_a_filename,
      docBFilename: originalTask.doc_b_filename,
      docAHash: originalTask.doc_a_hash,
      docBHash: originalTask.doc_b_hash,
      options: options ?? JSON.parse(originalTask.options_json),
      startedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    });

    // TODO: Trigger actual comparison via engine
    // For now, return the new task ID
    return { taskId: newTaskId };
  });

  // Retain/unretain a task
  ipcMain.handle('history:retain', async (_event, taskId: string, retained: boolean): Promise<void> => {
    taskRepo.setRetained(taskId, retained);
  });

  // Delete a single task
  ipcMain.handle('history:delete', async (_event, taskId: string): Promise<void> => {
    retentionService.deleteTask(taskId, true);
  });

  // Clear history
  ipcMain.handle('history:clear', async (_event, request: CleanupRequest): Promise<{ deletedCount: number }> => {
    if (!request.confirm) {
      throw new Error('Cleanup requires confirmation');
    }

    if (request.type === 'all') {
      // Delete all non-retained tasks
      const count = retentionService.clearNonRetained();
      return { deletedCount: count };
    } else {
      // Delete only cleanable tasks (LRU based)
      const report = retentionService.getStorageReport();
      const count = retentionService.deleteLRU(report.cleanableCount);
      return { deletedCount: count };
    }
  });
}
