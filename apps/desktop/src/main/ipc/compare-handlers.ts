/**
 * Production IPC handlers (P1-14)
 * Replaces demo/mock implementations with real file parsing,
 * Rust engine integration, progress tracking, and cancellation.
 * Now integrates with persistence layer (P2-13).
 */

import type { BrowserWindow } from 'electron';
import { dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import type {
  CompareResult,
  ReviewAnnotation,
  EngineHandshake,
  ValidateFilesResponse,
  StartCompareResponse,
  CancelCompareResponse,
  SelectFileResponse,
  DiffItem,
} from '@bidlens/shared';
import { TaskOrchestrator } from '../services/task-orchestrator.js';
import { validateFile } from '../services/file-validator.js';
import type { TaskRepository } from '../repositories/task-repository.js';
import type { SnapshotRepository } from '../repositories/snapshot-repository.js';
import type { AnnotationRepository } from '../repositories/annotation-repository.js';
import type { RetentionService } from '../services/retention.js';
import type { DatabaseManager } from '../db/database.js';

let orchestrator: TaskOrchestrator | null = null;
let persistenceDeps: {
  taskRepo: TaskRepository;
  snapshotRepo: SnapshotRepository;
  annotationRepo: AnnotationRepository;
  retentionService: RetentionService;
  db: DatabaseManager;
} | null = null;

async function persistCompletedResult(result: CompareResult): Promise<void> {
  if (!persistenceDeps) return;

  if (await persistenceDeps.snapshotRepo.persistCompareResult(result)) return;

  const [docAEncrypted, docBEncrypted, diffEncrypted] = await Promise.all([
    persistenceDeps.snapshotRepo.prepareDocumentAst(result.taskId, 'a', result.docA),
    persistenceDeps.snapshotRepo.prepareDocumentAst(result.taskId, 'b', result.docB),
    persistenceDeps.snapshotRepo.prepareDiffAst(result.taskId, result.diffAst),
  ]);

  persistenceDeps.db.transaction(() => {
    persistenceDeps!.taskRepo.save({
      id: result.taskId,
      displayName: `${result.docA.filename} vs ${result.docB.filename}`,
      status: 'ready',
      docAFilename: result.docA.filename,
      docBFilename: result.docB.filename,
      docAHash: result.docA.sha256,
      docBHash: result.docB.sha256,
      options: { ...result.options },
      diffSummary: result.diffAst.summary as unknown as Record<string, number>,
      reviewProgress: { total: result.diffAst.items.length, reviewed: 0, important: 0 },
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      lastAccessedAt: new Date().toISOString(),
    });
    persistenceDeps!.snapshotRepo.savePreparedDocumentAst(
      result.taskId, 'a', docAEncrypted, result.docA.parserVersion,
    );
    persistenceDeps!.snapshotRepo.savePreparedDocumentAst(
      result.taskId, 'b', docBEncrypted, result.docB.parserVersion,
    );
    persistenceDeps!.snapshotRepo.savePreparedDiffAst(result.taskId, diffEncrypted, 'compare');
  });
}

function getOrchestrator(window: BrowserWindow): TaskOrchestrator {
  if (!orchestrator) {
    orchestrator = new TaskOrchestrator(window, persistCompletedResult);
  }
  return orchestrator;
}

/**
 * Set persistence dependencies for history/settings/annotation handlers.
 */
export function setPersistenceDeps(deps: {
  taskRepo: TaskRepository;
  snapshotRepo: SnapshotRepository;
  annotationRepo: AnnotationRepository;
  retentionService: RetentionService;
  db: DatabaseManager;
}): void {
  persistenceDeps = deps;
}

export async function shutdownCompareServices(): Promise<void> {
  if (orchestrator) {
    await orchestrator.stop();
    orchestrator = null;
  }
}

export function registerCompareHandlers(window: BrowserWindow): void {
  // --- File ---
  ipcMain.handle('file:select', async (): Promise<SelectFileResponse | null> => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [
        { name: 'Word 文档', extensions: ['docx'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const name = path.basename(filePath);
    const { size } = await import('node:fs/promises').then((fs) => fs.stat(filePath));
    return { path: filePath, name, size, format: ext };
  });

  ipcMain.handle('file:validate', async (_event, request: { fileAPath: string; fileBPath: string }) => {
    const [fileA, fileB] = await Promise.all([
      validateFile(request.fileAPath),
      validateFile(request.fileBPath),
    ]);

    // Compute cross-format degradation warnings
    const crossFormatDegradation: string[] = [];
    if (fileA.extension !== fileB.extension) {
      crossFormatDegradation.push(`文件格式不同 (.${fileA.extension} vs .${fileB.extension}), 部分功能可能降级`);
    }

    return {
      fileA,
      fileB,
      crossFormatDegradation,
    } satisfies ValidateFilesResponse;
  });

  // --- Compare ---
  ipcMain.handle('compare:start', async (_event, request: { fileAPath: string; fileBPath: string; options: { sensitivity: string } }) => {
    const orch = getOrchestrator(window);

    // The orchestrator is created lazily. Await engine startup before accepting
    // a task so the renderer cannot enter a progress screen with no engine.
    await orch.start();

    // Check if engine is busy
    if (orch.isTaskActive()) {
      throw {
        code: 'ENGINE_BUSY',
        message: '已有比对任务正在运行，请等待完成后再试',
        retryable: true,
      };
    }

    const taskId = crypto.randomUUID();
    await orch.startCompare(
      taskId,
      request.fileAPath,
      request.fileBPath,
      { sensitivity: (request.options?.sensitivity as 'strict' | 'standard' | 'loose') ?? 'standard' }
    );

    return { taskId } satisfies StartCompareResponse;
  });

  ipcMain.handle('compare:cancel', async (_event, taskId: string) => {
    const orch = getOrchestrator(window);
    const result = orch.cancelCompare(taskId);
    return result satisfies CancelCompareResponse;
  });

  ipcMain.handle('compare:getResult', async (_event, taskId: string) => {
    const orch = getOrchestrator(window);
    const result = orch.getResult(taskId);
    if (!result) {
      // Try loading from persistence
      if (persistenceDeps) {
        try {
          const task = persistenceDeps.taskRepo.getById(taskId);
          if (task) {
            const docA = await persistenceDeps.snapshotRepo.loadDocumentAst(taskId, 'a');
            const docB = await persistenceDeps.snapshotRepo.loadDocumentAst(taskId, 'b');
            const diffAst = await persistenceDeps.snapshotRepo.loadDiffAst(taskId);

            if (docA && docB && diffAst) {
              const annotations = await persistenceDeps.annotationRepo.batchRead(taskId);
              return {
                taskId,
                docA,
                docB,
                diffAst,
                annotations,
                capabilities: [],
                options: JSON.parse(task.options_json),
                warnings: [],
                startedAt: task.started_at,
                completedAt: task.completed_at ?? task.started_at,
                durationMs: task.duration_ms ?? 0,
              } satisfies CompareResult;
            }
          }
        } catch (err) {
          console.error('[Compare] Failed to load from persistence:', err);
        }
      }

      throw {
        code: 'TASK_NOT_FOUND',
        message: `比对结果不存在: ${taskId}`,
        retryable: false,
      };
    }

    return result satisfies CompareResult;
  });

  // --- Export ---
  ipcMain.handle('export:report', async (_event, request: { taskId: string; format: 'html' | 'markdown'; scope: string; includeIdentical: boolean }) => {
    const { taskId, format, scope, includeIdentical } = request;
    if (!persistenceDeps) throw new Error('Persistence not initialized');

    const task = persistenceDeps.taskRepo.getById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const diffAst = await persistenceDeps.snapshotRepo.loadDiffAst(taskId);
    if (!diffAst) throw new Error(`DiffAst not found: ${taskId}`);

    const annotations = await persistenceDeps.annotationRepo.batchRead(taskId);

    // Filter items by scope
    let items = diffAst.items;
    if (!includeIdentical) items = items.filter((i: DiffItem) => i.matchType !== 'identical');
    if (scope === 'important') {
      const importantIds = new Set(annotations.filter((a: ReviewAnnotation) => a.important).map((a: ReviewAnnotation) => a.matchId));
      items = items.filter((i: DiffItem) => importantIds.has(i.matchId));
    } else if (scope === 'needs-confirmation') {
      const ncIds = new Set(annotations.filter((a: ReviewAnnotation) => a.status === 'needs-confirmation').map((a: ReviewAnnotation) => a.matchId));
      items = items.filter((i: DiffItem) => ncIds.has(i.matchId));
    }

    const { createFullFidelityReport, generateMarkdownReport, generateHtmlReport } = await import('@bidlens/shared');

    const report = createFullFidelityReport({ ...diffAst, items });

    const ext = format === 'html' ? 'html' : 'md';
    const defaultName = `比对报告_${task.doc_a_filename ?? taskId}.${ext}`;

    const result = await dialog.showSaveDialog(window, {
      defaultPath: defaultName,
      filters: [
        { name: format === 'html' ? 'HTML 文件' : 'Markdown 文件', extensions: [ext] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      throw new Error('Export cancelled');
    }

    const fs = await import('node:fs/promises');
    const content = format === 'html'
      ? generateHtmlReport(report)
      : generateMarkdownReport(report);

    await fs.writeFile(result.filePath, content, 'utf-8');

    return {
      filePath: result.filePath,
      format,
      itemCount: items.length,
    };
  });

  ipcMain.handle('export:openFile', async (_event, filePath: string) => {
    shell.openPath(filePath);
  });

  ipcMain.handle('export:openFolder', async (_event, folderPath: string) => {
    shell.openPath(folderPath);
  });

  // --- Engine ---
  ipcMain.handle('engine:handshake', async (): Promise<EngineHandshake> => {
    const orch = getOrchestrator(window);
    try {
      await orch.start();
      return await orch.handshake();
    } catch (err) {
      // Return a degraded handshake if engine is unavailable
      console.error('[IPC] Engine handshake failed:', err);
      return {
        engineVersion: 'unavailable',
        protocolVersion: '1.0',
        capabilities: [],
      };
    }
  });
}
