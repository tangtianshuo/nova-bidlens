/**
 * Snapshot repository for BidLens persistence.
 * Encrypted Document/Diff AST storage.
 */
import type { DocumentAst, DiffAst, CompareResult } from '@bidlens/shared';
import type { DatabaseManager } from '../db/database.js';
import type { KeyManager } from '../services/key-manager.js';
import {
  encryptToBuffer,
  decryptFromBuffer,
  encryptString,
  decryptString,
  serializeEnvelope,
  deserializeEnvelope,
  type AADContext,
} from '../services/encryption.js';
import type { DatabaseWorkerClient } from '../db/database-worker-client.js';

export class SnapshotRepository {
  private worker: DatabaseWorkerClient | null = null;

  constructor(
    private readonly db: DatabaseManager,
    private readonly keyManager: KeyManager
  ) {}

  setWorker(worker: DatabaseWorkerClient): void {
    this.worker = worker;
  }

  async persistCompareResult(result: CompareResult): Promise<boolean> {
    if (!this.worker) return false;
    await this.worker.persistResult(result, this.keyManager.getKey());
    return true;
  }

  /**
   * Save a DocumentAst snapshot (encrypted, async).
   */
  async saveDocumentAst(taskId: string, side: 'a' | 'b', doc: DocumentAst, parserVersion: string): Promise<void> {
    const encrypted = await this.prepareDocumentAst(taskId, side, doc);
    this.savePreparedDocumentAst(taskId, side, encrypted, parserVersion);
  }

  async prepareDocumentAst(taskId: string, side: 'a' | 'b', doc: DocumentAst): Promise<Buffer> {
    const key = this.keyManager.getKey();
    const context: AADContext = { recordType: 'document_ast', recordId: taskId, side };
    return encryptToBuffer(Buffer.from(JSON.stringify(doc), 'utf8'), key, context);
  }

  savePreparedDocumentAst(
    taskId: string,
    side: 'a' | 'b',
    encrypted: Buffer,
    parserVersion: string,
  ): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO document_snapshots (task_id, side, payload_encrypted, parser_version)
      VALUES (?, ?, ?, ?)
    `).run(taskId, side, encrypted, parserVersion);
  }

  /**
   * Load a DocumentAst snapshot (decrypted, async).
   */
  async loadDocumentAst(taskId: string, side: 'a' | 'b'): Promise<DocumentAst | null> {
    if (this.worker) {
      return this.worker.loadDocumentAst(taskId, side, this.keyManager.getKey());
    }
    const row = this.db.prepare(
      'SELECT payload_encrypted FROM document_snapshots WHERE task_id = ? AND side = ?'
    ).get(taskId, side) as { payload_encrypted: Buffer } | undefined;

    if (!row) return null;

    const key = this.keyManager.getKey();
    const context: AADContext = { recordType: 'document_ast', recordId: taskId, side };
    const plaintext = await decryptFromBuffer(row.payload_encrypted, key, context);
    return JSON.parse(plaintext.toString('utf8')) as DocumentAst;
  }

  /**
   * Save a DiffAst snapshot (encrypted, async).
   */
  async saveDiffAst(taskId: string, diff: DiffAst, engineVersion: string): Promise<void> {
    const encrypted = await this.prepareDiffAst(taskId, diff);
    this.savePreparedDiffAst(taskId, encrypted, engineVersion);
  }

  async prepareDiffAst(taskId: string, diff: DiffAst): Promise<Buffer> {
    const key = this.keyManager.getKey();
    const context: AADContext = { recordType: 'diff_ast', recordId: taskId };
    return encryptToBuffer(Buffer.from(JSON.stringify(diff), 'utf8'), key, context);
  }

  savePreparedDiffAst(taskId: string, encrypted: Buffer, engineVersion: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO diff_snapshots (task_id, payload_encrypted, engine_version)
      VALUES (?, ?, ?)
    `).run(taskId, encrypted, engineVersion);
  }

  /**
   * Load a DiffAst snapshot (decrypted, async).
   */
  async loadDiffAst(taskId: string): Promise<DiffAst | null> {
    if (this.worker) {
      return this.worker.loadDiffAst(taskId, this.keyManager.getKey());
    }
    const row = this.db.prepare(
      'SELECT payload_encrypted FROM diff_snapshots WHERE task_id = ?'
    ).get(taskId) as { payload_encrypted: Buffer } | undefined;

    if (!row) return null;

    const key = this.keyManager.getKey();
    const context: AADContext = { recordType: 'diff_ast', recordId: taskId };
    const plaintext = await decryptFromBuffer(row.payload_encrypted, key, context);
    return JSON.parse(plaintext.toString('utf8')) as DiffAst;
  }

  /**
   * Save encrypted file path (async).
   */
  async saveEncryptedPath(recordId: string, side: 'a' | 'b', filePath: string): Promise<Buffer> {
    const key = this.keyManager.getKey();
    const context: AADContext = { recordType: 'file_path', recordId, side };
    const envelope = await encryptString(filePath, key, context);
    return serializeEnvelope(envelope);
  }

  /**
   * Load and decrypt file path (async).
   */
  async loadDecryptedPath(encryptedPath: Buffer, recordId: string, side: 'a' | 'b'): Promise<string> {
    const key = this.keyManager.getKey();
    const context: AADContext = { recordType: 'file_path', recordId, side };
    const envelope = deserializeEnvelope(encryptedPath);
    return decryptString(envelope, key, context);
  }

  /**
   * Delete all snapshots for a task.
   */
  deleteByTaskId(taskId: string): void {
    this.db.prepare('DELETE FROM document_snapshots WHERE task_id = ?').run(taskId);
    this.db.prepare('DELETE FROM diff_snapshots WHERE task_id = ?').run(taskId);
  }

  /**
   * Check if snapshots exist for a task.
   */
  hasSnapshots(taskId: string): boolean {
    const docCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM document_snapshots WHERE task_id = ?'
    ).get(taskId) as { cnt: number }).cnt;
    const diffCount = (this.db.prepare(
      'SELECT COUNT(*) as cnt FROM diff_snapshots WHERE task_id = ?'
    ).get(taskId) as { cnt: number }).cnt;
    return docCount > 0 || diffCount > 0;
  }
}
