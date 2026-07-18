/**
 * Persistence integration tests for BidLens.
 * Tests restart recovery, tamper detection, migration, backup, cleanup.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseManager } from '../database.js';
import { runMigrations, runQuickCheck, verifyMigrationChecksums } from '../migrations.js';
import { KeyManager, type KeyStorage } from '../../services/key-manager.js';
import { encryptToBuffer, decryptFromBuffer, encryptString, decryptString, serializeEnvelope, deserializeEnvelope } from '../../services/encryption.js';
import { TaskRepository } from '../../repositories/task-repository.js';
import { SnapshotRepository } from '../../repositories/snapshot-repository.js';
import { AnnotationRepository } from '../../repositories/annotation-repository.js';
import { RetentionService } from '../../services/retention.js';
import { BackupService } from '../../services/backup.js';
import { RecoveryService } from '../../services/recovery.js';

// Mock electron app.getPath
const mockGetPath = () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bidlens-test-'));
  return tmpDir;
};

const testKeyStorage: KeyStorage = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(value, 'utf8'),
  decrypt: (value) => value.toString('utf8'),
};

describe('Persistence Layer', () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;

  beforeEach(() => {
    tmpDir = mockGetPath();
    dbManager = new DatabaseManager({ dataDir: tmpDir });
  });

  afterEach(() => {
    dbManager.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('DatabaseManager', () => {
    it('should open database and run migrations', () => {
      const result = dbManager.open();
      expect(result.healthy).toBe(true);
      expect(dbManager.isOpen()).toBe(true);
    });

    it('should create database file', () => {
      dbManager.open();
      expect(fs.existsSync(path.join(tmpDir, 'bidlens.db'))).toBe(true);
    });

    it('should enable WAL mode', () => {
      dbManager.open();
      const walMode = dbManager.getDb().pragma('journal_mode') as Array<{ journal_mode: string }>;
      expect(walMode[0].journal_mode).toBe('wal');
    });
  });

  describe('Migrations', () => {
    it('should create all tables', () => {
      dbManager.open();
      const db = dbManager.getDb();

      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as Array<{ name: string }>;

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('document_snapshots');
      expect(tableNames).toContain('diff_snapshots');
      expect(tableNames).toContain('review_annotations');
      expect(tableNames).toContain('settings');
      expect(tableNames).toContain('migration_history');
    });

    it('should set user_version to 1', () => {
      dbManager.open();
      const version = dbManager.getDb().pragma('user_version') as Array<{ user_version: number }>;
      expect(version[0].user_version).toBe(1);
    });

    it('should record migration in history', () => {
      dbManager.open();
      const db = dbManager.getDb();

      const migrations = db.prepare(
        'SELECT * FROM migration_history ORDER BY version'
      ).all() as Array<{ version: number; name: string; checksum: string }>;

      expect(migrations).toHaveLength(1);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].name).toBe('initial_schema');
    });

    it('should verify migration checksums', () => {
      dbManager.open();
      const errors = verifyMigrationChecksums(dbManager.getDb());
      expect(errors).toHaveLength(0);
    });

    it('should detect checksum tampering', () => {
      dbManager.open();
      const db = dbManager.getDb();

      // Tamper with checksum
      db.prepare(
        "UPDATE migration_history SET checksum = 'tampered' WHERE version = 1"
      ).run();

      const errors = verifyMigrationChecksums(db);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('checksum mismatch');
    });
  });

  describe('Quick Check', () => {
    it('should return null for healthy database', () => {
      dbManager.open();
      const result = runQuickCheck(dbManager.getDb());
      expect(result).toBeNull();
    });
  });

  describe('Encryption', () => {
    it('should fail closed when secure key storage is unavailable', () => {
      const unavailableStorage: KeyStorage = {
        isAvailable: () => false,
        encrypt: () => { throw new Error('unavailable'); },
        decrypt: () => { throw new Error('unavailable'); },
      };
      const keyManager = new KeyManager(tmpDir, unavailableStorage);

      expect(() => keyManager.initialize()).toThrow(/Secure key storage is unavailable/);
      expect(fs.existsSync(path.join(tmpDir, '.bidlens-key.enc'))).toBe(false);
    });

    it('should encrypt and decrypt data', async () => {
      const key = Buffer.alloc(32, 'test-key');
      const plaintext = Buffer.from('Hello, BidLens!');
      const context = { recordType: 'test', recordId: '123' };

      const envelope = await encryptString('Hello, BidLens!', key, context);
      const decrypted = await decryptString(envelope, key, context);

      expect(decrypted).toBe('Hello, BidLens!');
    });

    it('should fail decryption with wrong key', async () => {
      const key1 = Buffer.alloc(32, 'key1');
      const key2 = Buffer.alloc(32, 'key2');
      const context = { recordType: 'test', recordId: '123' };

      const envelope = await encryptString('secret', key1, context);

      await expect(decryptString(envelope, key2, context)).rejects.toThrow();
    });

    it('should fail decryption with tampered ciphertext', async () => {
      const key = Buffer.alloc(32, 'test-key');
      const context = { recordType: 'test', recordId: '123' };

      const envelope = await encryptString('secret', key, context);
      // Tamper with ciphertext
      envelope.ciphertext[0] ^= 0xff;

      await expect(decryptString(envelope, key, context)).rejects.toThrow();
    });

    it('should serialize and deserialize envelope', async () => {
      const key = Buffer.alloc(32, 'test-key');
      const context = { recordType: 'test', recordId: '123' };

      const envelope = await encryptString('test data', key, context);
      const serialized = serializeEnvelope(envelope);
      const deserialized = deserializeEnvelope(serialized);
      const decrypted = await decryptString(deserialized, key, context);

      expect(decrypted).toBe('test data');
    });

    it('should use AAD for authentication', async () => {
      const key = Buffer.alloc(32, 'test-key');
      const context1 = { recordType: 'type1', recordId: '123' };
      const context2 = { recordType: 'type2', recordId: '123' };

      const envelope = await encryptString('secret', key, context1);

      // Decryption with different AAD should fail
      await expect(decryptString(envelope, key, context2)).rejects.toThrow();
    });
  });

  describe('TaskRepository', () => {
    let taskRepo: TaskRepository;

    beforeEach(() => {
      dbManager.open();
      taskRepo = new TaskRepository(dbManager);
    });

    it('should save and retrieve task', () => {
      taskRepo.save({
        id: 'task-1',
        displayName: 'Test Task',
        status: 'ready',
        docAFilename: 'a.docx',
        docBFilename: 'b.docx',
        docAHash: 'hash-a',
        docBHash: 'hash-b',
        options: { sensitivity: 'standard' },
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      });

      const task = taskRepo.getById('task-1');
      expect(task).not.toBeNull();
      expect(task!.display_name).toBe('Test Task');
    });

    it('should list tasks', () => {
      taskRepo.save({
        id: 'task-1',
        displayName: 'Task 1',
        status: 'ready',
        docAFilename: 'a.docx',
        docBFilename: 'b.docx',
        docAHash: 'hash-a',
        docBHash: 'hash-b',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      });

      taskRepo.save({
        id: 'task-2',
        displayName: 'Task 2',
        status: 'draft',
        docAFilename: 'c.docx',
        docBFilename: 'd.docx',
        docAHash: 'hash-c',
        docBHash: 'hash-d',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      });

      const tasks = taskRepo.list();
      expect(tasks).toHaveLength(2);
    });

    it('should delete task', () => {
      taskRepo.save({
        id: 'task-1',
        displayName: 'Task 1',
        status: 'ready',
        docAFilename: 'a.docx',
        docBFilename: 'b.docx',
        docAHash: 'hash-a',
        docBHash: 'hash-b',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      });

      expect(taskRepo.delete('task-1')).toBe(true);
      expect(taskRepo.getById('task-1')).toBeNull();
    });

    it('should preserve child rows when updating a task', () => {
      const now = new Date().toISOString();
      taskRepo.save({
        id: 'task-1', displayName: 'Task 1', status: 'ready',
        docAFilename: 'a.docx', docBFilename: 'b.docx',
        docAHash: 'hash-a', docBHash: 'hash-b', options: {},
        startedAt: now, lastAccessedAt: now,
      });
      dbManager.prepare(`
        INSERT INTO review_annotations
          (id, task_id, match_id, status, important, note_encrypted, created_at, updated_at)
        VALUES ('ann-1', 'task-1', 'match-1', 'confirmed', 0, NULL, ?, ?)
      `).run(now, now);

      taskRepo.save({
        id: 'task-1', displayName: 'Updated Task', status: 'ready',
        docAFilename: 'a.docx', docBFilename: 'b.docx',
        docAHash: 'hash-a', docBHash: 'hash-b', options: {},
        startedAt: now, lastAccessedAt: now,
      });

      const row = dbManager.prepare(
        'SELECT COUNT(*) AS count FROM review_annotations WHERE task_id = ?'
      ).get('task-1') as { count: number };
      expect(row.count).toBe(1);
    });
  });

  describe('SnapshotRepository', () => {
    let snapshotRepo: SnapshotRepository;
    let keyManager: KeyManager;
    let taskRepo: TaskRepository;

    beforeEach(() => {
      dbManager.open();
      keyManager = new KeyManager(tmpDir, testKeyStorage);
      keyManager.initialize();
      taskRepo = new TaskRepository(dbManager);
      snapshotRepo = new SnapshotRepository(dbManager, keyManager);

      // Create a parent task first (foreign key requirement)
      taskRepo.save({
        id: 'task-1',
        displayName: 'Test Task',
        status: 'ready',
        docAFilename: 'a.docx',
        docBFilename: 'b.docx',
        docAHash: 'hash-a',
        docBHash: 'hash-b',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      });
    });

    afterEach(() => {
      keyManager.destroy();
    });

    it('should save and load document AST', async () => {
      const doc = {
        id: 'a',
        filename: 'test.docx',
        sha256: 'abc123',
        pageCount: 1,
        wordCount: 100,
        parserVersion: '1.0',
        blocks: [],
      };

      await snapshotRepo.saveDocumentAst('task-1', 'a', doc, '1.0');
      const loaded = await snapshotRepo.loadDocumentAst('task-1', 'a');

      expect(loaded).not.toBeNull();
      expect(loaded!.filename).toBe('test.docx');
    });

    it('should save and load diff AST', async () => {
      const diff = {
        taskId: 'task-1',
        docAId: 'a',
        docBId: 'b',
        generatedAt: new Date().toISOString(),
        summary: { identical: 0, modified: 1, added: 0, deleted: 0, moved: 0, split: 0, merged: 0, uncertain: 0 },
        items: [],
      };

      await snapshotRepo.saveDiffAst('task-1', diff, '1.0');
      const loaded = await snapshotRepo.loadDiffAst('task-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.taskId).toBe('task-1');
    });
  });

  describe('AnnotationRepository', () => {
    let annotationRepo: AnnotationRepository;
    let keyManager: KeyManager;
    let taskRepo: TaskRepository;

    beforeEach(() => {
      dbManager.open();
      keyManager = new KeyManager(tmpDir, testKeyStorage);
      keyManager.initialize();
      taskRepo = new TaskRepository(dbManager);
      annotationRepo = new AnnotationRepository(dbManager, keyManager);

      // Create a parent task first (foreign key requirement)
      taskRepo.save({
        id: 'task-1',
        displayName: 'Test Task',
        status: 'ready',
        docAFilename: 'a.docx',
        docBFilename: 'b.docx',
        docAHash: 'hash-a',
        docBHash: 'hash-b',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      });
    });

    afterEach(() => {
      keyManager.destroy();
    });

    it('should save and retrieve annotation', async () => {
      const annotation = await annotationRepo.save({
        id: 'ann-1',
        taskId: 'task-1',
        matchId: 'match-1',
        status: 'confirmed',
        important: true,
        note: 'Test note',
      });

      expect(annotation.id).toBe('ann-1');
      expect(annotation.note).toBe('Test note');
    });

    it('should batch read annotations', async () => {
      await annotationRepo.save({
        id: 'ann-1',
        taskId: 'task-1',
        matchId: 'match-1',
        status: 'confirmed',
        important: false,
        note: '',
      });

      await annotationRepo.save({
        id: 'ann-2',
        taskId: 'task-1',
        matchId: 'match-2',
        status: 'unreviewed',
        important: true,
        note: 'Important',
      });

      const annotations = await annotationRepo.batchRead('task-1');
      expect(annotations).toHaveLength(2);
    });

    it('should encrypt notes', async () => {
      await annotationRepo.save({
        id: 'ann-1',
        taskId: 'task-1',
        matchId: 'match-1',
        status: 'unreviewed',
        important: false,
        note: 'Sensitive note',
      });

      // Check that note is encrypted in database
      const db = dbManager.getDb();
      const row = db.prepare(
        'SELECT note_encrypted FROM review_annotations WHERE id = ?'
      ).get('ann-1') as { note_encrypted: Buffer };

      // Encrypted data should not contain plaintext
      expect(row.note_encrypted.toString()).not.toContain('Sensitive note');
    });

    it('should preserve annotation identity when updating its note', async () => {
      await annotationRepo.save({
        id: 'ann-1', taskId: 'task-1', matchId: 'match-1',
        status: 'unreviewed', important: false, note: 'First note',
      });
      const updated = await annotationRepo.save({
        id: 'ann-2', taskId: 'task-1', matchId: 'match-1',
        status: 'confirmed', important: true, note: 'Updated note',
      });
      const loaded = await annotationRepo.getByMatchId('task-1', 'match-1');

      expect(updated.id).toBe('ann-1');
      expect(loaded).toMatchObject({
        id: 'ann-1', status: 'confirmed', important: true, note: 'Updated note',
      });
    });
  });

  describe('RetentionService', () => {
    let retentionService: RetentionService;
    let taskRepo: TaskRepository;
    let snapshotRepo: SnapshotRepository;
    let annotationRepo: AnnotationRepository;
    let keyManager: KeyManager;

    beforeEach(() => {
      dbManager.open();
      keyManager = new KeyManager(tmpDir, testKeyStorage);
      keyManager.initialize();
      taskRepo = new TaskRepository(dbManager);
      snapshotRepo = new SnapshotRepository(dbManager, keyManager);
      annotationRepo = new AnnotationRepository(dbManager, keyManager);
      retentionService = new RetentionService(dbManager, taskRepo, snapshotRepo, annotationRepo);
    });

    afterEach(() => {
      keyManager.destroy();
    });

    it('should delete task and associated data', async () => {
      // Create task with snapshots and annotations
      taskRepo.save({
        id: 'task-1',
        displayName: 'Test',
        status: 'ready',
        docAFilename: 'a.docx',
        docBFilename: 'b.docx',
        docAHash: 'hash-a',
        docBHash: 'hash-b',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      });

      await snapshotRepo.saveDocumentAst('task-1', 'a', {
        id: 'a', filename: 'a.docx', sha256: 'hash-a',
        pageCount: 1, wordCount: 10, parserVersion: '1.0', blocks: [],
      }, '1.0');

      await annotationRepo.save({
        id: 'ann-1',
        taskId: 'task-1',
        matchId: 'match-1',
        status: 'unreviewed',
        important: false,
        note: '',
      });

      // Delete task
      retentionService.deleteTask('task-1');

      // Verify all data is deleted
      expect(taskRepo.getById('task-1')).toBeNull();
      expect(await snapshotRepo.loadDocumentAst('task-1', 'a')).toBeNull();
      expect(await annotationRepo.batchRead('task-1')).toHaveLength(0);
    });

    it('should clear non-retained tasks', () => {
      // Create retained and non-retained tasks
      taskRepo.save({
        id: 'task-1',
        displayName: 'Retained',
        status: 'ready',
        docAFilename: 'a.docx',
        docBFilename: 'b.docx',
        docAHash: 'hash-a',
        docBHash: 'hash-b',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        retained: true,
      });

      taskRepo.save({
        id: 'task-2',
        displayName: 'Not Retained',
        status: 'ready',
        docAFilename: 'c.docx',
        docBFilename: 'd.docx',
        docAHash: 'hash-c',
        docBHash: 'hash-d',
        options: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        retained: false,
      });

      const deleted = retentionService.clearNonRetained();

      expect(deleted).toBe(1);
      expect(taskRepo.getById('task-1')).not.toBeNull();
      expect(taskRepo.getById('task-2')).toBeNull();
    });

    it('should not auto-delete active or retained tasks', () => {
      const now = new Date().toISOString();
      taskRepo.save({
        id: 'active', displayName: 'Active', status: 'comparing',
        docAFilename: 'a.docx', docBFilename: 'b.docx',
        docAHash: 'a', docBHash: 'b', options: {}, startedAt: now, lastAccessedAt: now,
      });
      taskRepo.save({
        id: 'retained', displayName: 'Retained', status: 'ready', retained: true,
        docAFilename: 'a.docx', docBFilename: 'b.docx',
        docAHash: 'a', docBHash: 'b', options: {}, startedAt: now, lastAccessedAt: now,
      });
      taskRepo.save({
        id: 'cleanable', displayName: 'Cleanable', status: 'ready',
        docAFilename: 'a.docx', docBFilename: 'b.docx',
        docAHash: 'a', docBHash: 'b', options: {}, startedAt: now, lastAccessedAt: now,
      });

      expect(retentionService.deleteLRU(10)).toBe(1);
      expect(taskRepo.getById('active')).not.toBeNull();
      expect(taskRepo.getById('retained')).not.toBeNull();
      expect(taskRepo.getById('cleanable')).toBeNull();
    });
  });

  describe('BackupService', () => {
    let backupService: BackupService;

    beforeEach(() => {
      dbManager.open();
      backupService = new BackupService(tmpDir);
    });

    it('should create backup', () => {
      const backupPath = backupService.createBackup(dbManager.getDb(), 'test');
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should list backups', () => {
      backupService.createBackup(dbManager.getDb(), 'backup1');
      backupService.createBackup(dbManager.getDb(), 'backup2');

      const backups = backupService.listBackups();
      expect(backups.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('RecoveryService', () => {
    let recoveryService: RecoveryService;

    beforeEach(() => {
      dbManager.open();
      recoveryService = new RecoveryService(tmpDir);
    });

    it('should report healthy database', () => {
      const result = recoveryService.checkAndRecover(
        path.join(tmpDir, 'bidlens.db'),
        dbManager.getDb()
      );

      expect(result.recovered).toBe(true);
      expect(result.action).toBe('none');
    });

    it('should provide diagnostic summary', () => {
      const summary = recoveryService.getDiagnosticSummary();
      expect(summary.corruptedDirExists).toBe(false);
      expect(summary.corruptedSessions).toHaveLength(0);
    });
  });
});
