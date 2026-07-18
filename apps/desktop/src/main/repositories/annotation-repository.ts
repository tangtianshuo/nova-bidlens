/**
 * Annotation repository for BidLens persistence.
 * Save, batch read, update annotations.
 * Atomic autosave, never mutates Diff AST.
 */
import type { ReviewAnnotation, ReviewStatus } from '@bidlens/shared';
import type { DatabaseManager } from '../db/database.js';
import type { KeyManager } from '../services/key-manager.js';
import { encryptToBuffer, decryptFromBuffer, type AADContext } from '../services/encryption.js';

interface AnnotationRow {
  id: string;
  task_id: string;
  match_id: string;
  status: string;
  important: number;
  note_encrypted: Buffer | null;
  created_at: string;
  updated_at: string;
}

export class AnnotationRepository {
  constructor(
    private readonly db: DatabaseManager,
    private readonly keyManager: KeyManager
  ) {}

  /**
   * Save or update an annotation. Atomic upsert. Async due to encryption.
   */
  async save(annotation: {
    id: string;
    taskId: string;
    matchId: string;
    status: ReviewStatus;
    important: boolean;
    note: string;
  }): Promise<ReviewAnnotation> {
    const key = this.keyManager.getKey();
    const now = new Date().toISOString();
    const existing = this.db.prepare(
      'SELECT * FROM review_annotations WHERE task_id = ? AND match_id = ?'
    ).get(annotation.taskId, annotation.matchId) as AnnotationRow | undefined;
    const annotationId = existing?.id ?? annotation.id;

    // Encrypt note if non-empty
    let noteEncrypted: Buffer | null = null;
    if (annotation.note) {
      const context: AADContext = {
        recordType: 'annotation_note',
        recordId: annotationId,
      };
      noteEncrypted = await encryptToBuffer(
        Buffer.from(annotation.note, 'utf8'),
        key,
        context
      );
    }

    // Upsert with conflict on (task_id, match_id)
    this.db.prepare(`
      INSERT INTO review_annotations (id, task_id, match_id, status, important, note_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, match_id) DO UPDATE SET
        status = excluded.status,
        important = excluded.important,
        note_encrypted = excluded.note_encrypted,
        updated_at = excluded.updated_at
    `).run(
      annotationId,
      annotation.taskId,
      annotation.matchId,
      annotation.status,
      annotation.important ? 1 : 0,
      noteEncrypted,
      now,
      now
    );

    return {
      id: annotationId,
      taskId: annotation.taskId,
      matchId: annotation.matchId,
      status: annotation.status,
      important: annotation.important,
      note: annotation.note,
      createdAt: existing?.created_at ?? now,
      updatedAt: now,
    };
  }

  /**
   * Batch read all annotations for a task. Async due to decryption.
   */
  async batchRead(taskId: string): Promise<ReviewAnnotation[]> {
    const rows = this.db.prepare(
      'SELECT * FROM review_annotations WHERE task_id = ? ORDER BY created_at'
    ).all(taskId) as AnnotationRow[];

    const key = this.keyManager.getKey();
    const annotations: ReviewAnnotation[] = [];
    for (const row of rows) {
      annotations.push(await this.rowToAnnotation(row, key));
    }
    return annotations;
  }

  /**
   * Get a single annotation by task and match ID. Async due to decryption.
   */
  async getByMatchId(taskId: string, matchId: string): Promise<ReviewAnnotation | null> {
    const row = this.db.prepare(
      'SELECT * FROM review_annotations WHERE task_id = ? AND match_id = ?'
    ).get(taskId, matchId) as AnnotationRow | undefined;

    if (!row) return null;

    const key = this.keyManager.getKey();
    return this.rowToAnnotation(row, key);
  }

  /**
   * Delete all annotations for a task.
   */
  deleteByTaskId(taskId: string): void {
    this.db.prepare('DELETE FROM review_annotations WHERE task_id = ?').run(taskId);
  }

  /**
   * Count annotations by status for a task.
   */
  countByStatus(taskId: string): { total: number; reviewed: number; important: number } {
    const total = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM review_annotations WHERE task_id = ?'
    ).get(taskId) as { cnt: number }).cnt;

    const reviewed = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM review_annotations WHERE task_id = ? AND status != 'unreviewed'"
    ).get(taskId) as { cnt: number }).cnt;

    const important = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM review_annotations WHERE task_id = ? AND important = 1'
    ).get(taskId) as { cnt: number }).cnt;

    return { total, reviewed, important };
  }

  /**
   * Convert a database row to a ReviewAnnotation, decrypting the note. Async due to decryption.
   */
  private async rowToAnnotation(row: AnnotationRow, key: Buffer): Promise<ReviewAnnotation> {
    let note = '';
    if (row.note_encrypted) {
      try {
        const context: AADContext = {
          recordType: 'annotation_note',
          recordId: row.id,
        };
        const decrypted = await decryptFromBuffer(row.note_encrypted, key, context);
        note = decrypted.toString('utf8');
      } catch (err) {
        console.error(`[AnnotationRepository] Failed to decrypt note for ${row.id}`);
        note = '[decryption failed]';
      }
    }

    return {
      id: row.id,
      taskId: row.task_id,
      matchId: row.match_id,
      status: row.status as ReviewStatus,
      important: row.important === 1,
      note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
