/**
 * Annotation IPC handlers for BidLens.
 * Handles save and batch read of review annotations.
 */
import { ipcMain } from 'electron';
import type {
  SaveAnnotationRequest,
  ReviewAnnotation,
  BatchReadAnnotationsResponse,
} from '@bidlens/shared';
import type { AnnotationRepository } from '../repositories/annotation-repository.js';
import type { TaskRepository } from '../repositories/task-repository.js';

export function registerAnnotationHandlers(deps: {
  annotationRepo: AnnotationRepository;
  taskRepo: TaskRepository;
}): void {
  const { annotationRepo, taskRepo } = deps;

  // Save or update an annotation
  ipcMain.handle('review:saveAnnotation', async (_event, request: SaveAnnotationRequest): Promise<ReviewAnnotation> => {
    const existing = await annotationRepo.getByMatchId(request.taskId, request.matchId);
    const annotation = await annotationRepo.save({
      id: existing?.id ?? crypto.randomUUID(),
      taskId: request.taskId,
      matchId: request.matchId,
      status: (request.status as ReviewAnnotation['status'] | undefined) ?? existing?.status ?? 'unreviewed',
      important: request.important ?? existing?.important ?? false,
      note: request.note ?? existing?.note ?? '',
    });

    // Update task's review progress
    const progress = annotationRepo.countByStatus(request.taskId);
    const total = taskRepo.getDiffItemCount(request.taskId) ?? progress.total;
    taskRepo.updateReviewProgress(request.taskId, { ...progress, total });

    return annotation;
  });

  // Batch read all annotations for a task
  ipcMain.handle('review:batchRead', async (_event, taskId: string): Promise<BatchReadAnnotationsResponse> => {
    const annotations = await annotationRepo.batchRead(taskId);
    return { annotations };
  });
}
