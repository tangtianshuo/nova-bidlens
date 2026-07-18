/**
 * Task repository for BidLens persistence.
 * CRUD operations for task metadata.
 */
import type { TaskSummary, TaskStatus, CompareResult } from '@bidlens/shared';
import type { DatabaseManager } from '../db/database.js';

export interface TaskRow {
  id: string;
  display_name: string;
  status: string;
  doc_a_filename: string;
  doc_b_filename: string;
  doc_a_hash: string;
  doc_b_hash: string;
  doc_a_path_encrypted: Buffer | null;
  doc_b_path_encrypted: Buffer | null;
  options_json: string;
  diff_summary_json: string | null;
  review_progress_json: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  last_accessed_at: string;
  retained: number;
  failure_summary: string | null;
  created_at: string;
}

export class TaskRepository {
  constructor(private readonly db: DatabaseManager) {}

  /**
   * Insert or update a task record.
   */
  save(task: {
    id: string;
    displayName: string;
    status: TaskStatus;
    docAFilename: string;
    docBFilename: string;
    docAHash: string;
    docBHash: string;
    docAPathEncrypted?: Buffer;
    docBPathEncrypted?: Buffer;
    options: Record<string, unknown>;
    diffSummary?: Record<string, number>;
    reviewProgress?: { total: number; reviewed: number; important: number };
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    lastAccessedAt: string;
    retained?: boolean;
    failureSummary?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, display_name, status, doc_a_filename, doc_b_filename,
        doc_a_hash, doc_b_hash, doc_a_path_encrypted, doc_b_path_encrypted,
        options_json, diff_summary_json, review_progress_json,
        started_at, completed_at, duration_ms, last_accessed_at,
        retained, failure_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        status = excluded.status,
        doc_a_filename = excluded.doc_a_filename,
        doc_b_filename = excluded.doc_b_filename,
        doc_a_hash = excluded.doc_a_hash,
        doc_b_hash = excluded.doc_b_hash,
        doc_a_path_encrypted = COALESCE(excluded.doc_a_path_encrypted, tasks.doc_a_path_encrypted),
        doc_b_path_encrypted = COALESCE(excluded.doc_b_path_encrypted, tasks.doc_b_path_encrypted),
        options_json = excluded.options_json,
        diff_summary_json = excluded.diff_summary_json,
        review_progress_json = excluded.review_progress_json,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        duration_ms = excluded.duration_ms,
        last_accessed_at = excluded.last_accessed_at,
        failure_summary = excluded.failure_summary
    `);

    stmt.run(
      task.id,
      task.displayName,
      task.status,
      task.docAFilename,
      task.docBFilename,
      task.docAHash,
      task.docBHash,
      task.docAPathEncrypted ?? null,
      task.docBPathEncrypted ?? null,
      JSON.stringify(task.options),
      task.diffSummary ? JSON.stringify(task.diffSummary) : null,
      task.reviewProgress ? JSON.stringify(task.reviewProgress) : null,
      task.startedAt,
      task.completedAt ?? null,
      task.durationMs ?? null,
      task.lastAccessedAt,
      task.retained ? 1 : 0,
      task.failureSummary ?? null
    );
  }

  /**
   * Get a single task by ID.
   */
  getById(taskId: string): TaskRow | null {
    const row = this.db.prepare(
      'SELECT * FROM tasks WHERE id = ?'
    ).get(taskId) as TaskRow | undefined;
    return row ?? null;
  }

  /**
   * Get task summary for history list.
   */
  getSummary(taskId: string): TaskSummary | null {
    const row = this.getById(taskId);
    if (!row) return null;
    return this.rowToSummary(row);
  }

  /**
   * List all tasks with optional search and status filter.
   */
  list(options?: {
    search?: string;
    statusFilter?: TaskStatus | 'all';
    limit?: number;
    offset?: number;
  }): TaskSummary[] {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: unknown[] = [];

    if (options?.statusFilter && options.statusFilter !== 'all') {
      sql += ' AND status = ?';
      params.push(options.statusFilter);
    }

    if (options?.search) {
      sql += ' AND (display_name LIKE ? OR doc_a_filename LIKE ? OR doc_b_filename LIKE ?)';
      const searchPattern = `%${options.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY last_accessed_at DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as TaskRow[];
    return rows.map(row => this.rowToSummary(row));
  }

  /**
   * Update task status.
   */
  updateStatus(taskId: string, status: TaskStatus, failureSummary?: string): void {
    this.db.prepare(
      'UPDATE tasks SET status = ?, failure_summary = ? WHERE id = ?'
    ).run(status, failureSummary ?? null, taskId);
  }

  /**
   * Update task completion info.
   */
  markCompleted(taskId: string, completedAt: string, durationMs: number): void {
    this.db.prepare(
      'UPDATE tasks SET status = ?, completed_at = ?, duration_ms = ? WHERE id = ?'
    ).run('ready', completedAt, durationMs, taskId);
  }

  /**
   * Update last accessed timestamp.
   */
  touch(taskId: string): void {
    this.db.prepare(
      'UPDATE tasks SET last_accessed_at = ? WHERE id = ?'
    ).run(new Date().toISOString(), taskId);
  }

  /**
   * Set retained flag.
   */
  setRetained(taskId: string, retained: boolean): void {
    this.db.prepare(
      'UPDATE tasks SET retained = ? WHERE id = ?'
    ).run(retained ? 1 : 0, taskId);
  }

  /**
   * Update diff summary.
   */
  updateDiffSummary(taskId: string, diffSummary: Record<string, number>): void {
    this.db.prepare(
      'UPDATE tasks SET diff_summary_json = ? WHERE id = ?'
    ).run(JSON.stringify(diffSummary), taskId);
  }

  /**
   * Update review progress.
   */
  updateReviewProgress(taskId: string, progress: { total: number; reviewed: number; important: number }): void {
    this.db.prepare(
      'UPDATE tasks SET review_progress_json = ? WHERE id = ?'
    ).run(JSON.stringify(progress), taskId);
  }

  /**
   * Delete a task by ID.
   */
  delete(taskId: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    return result.changes > 0;
  }

  /**
   * Delete all non-retained tasks.
   */
  deleteNonRetained(): number {
    const result = this.db.prepare('DELETE FROM tasks WHERE retained = 0').run();
    return result.changes;
  }

  /**
   * Get tasks ordered by last_accessed_at for LRU cleanup.
   */
  getLRUOrder(limit: number): TaskRow[] {
    return this.db.prepare(
      `SELECT * FROM tasks
       WHERE retained = 0 AND status IN ('ready', 'failed', 'cancelled', 'interrupted')
       ORDER BY last_accessed_at ASC LIMIT ?`
    ).all(limit) as TaskRow[];
  }

  /**
   * Count tasks by status.
   */
  countByStatus(): { total: number; retained: number; cleanable: number } {
    const total = (this.db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number }).cnt;
    const retained = (this.db.prepare('SELECT COUNT(*) as cnt FROM tasks WHERE retained = 1').get() as { cnt: number }).cnt;
    const cleanable = (this.db.prepare(
      `SELECT COUNT(*) as cnt FROM tasks
       WHERE retained = 0 AND status IN ('ready', 'failed', 'cancelled', 'interrupted')`
    ).get() as { cnt: number }).cnt;
    return { total, retained, cleanable };
  }

  /**
   * Update encrypted file paths.
   */
  updateEncryptedPaths(taskId: string, docAPathEncrypted?: Buffer, docBPathEncrypted?: Buffer): void {
    this.db.prepare(
      'UPDATE tasks SET doc_a_path_encrypted = ?, doc_b_path_encrypted = ? WHERE id = ?'
    ).run(docAPathEncrypted ?? null, docBPathEncrypted ?? null, taskId);
  }

  /**
   * Convert a database row to a TaskSummary.
   */
  private rowToSummary(row: TaskRow): TaskSummary {
    return {
      taskId: row.id,
      displayName: row.display_name,
      status: row.status as TaskStatus,
      docAFilename: row.doc_a_filename,
      docBFilename: row.doc_b_filename,
      diffSummary: row.diff_summary_json ? JSON.parse(row.diff_summary_json) : {},
      reviewProgress: row.review_progress_json
        ? JSON.parse(row.review_progress_json)
        : { total: 0, reviewed: 0, important: 0 },
      lastAccessedAt: row.last_accessed_at,
      retained: row.retained === 1,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      durationMs: row.duration_ms ?? undefined,
    };
  }
}
