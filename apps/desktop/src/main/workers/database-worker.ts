import { parentPort, workerData } from 'node:worker_threads';
import type { CompareResult, DiffAst, DocumentAst } from '@bidlens/shared';
import { loadNativeDatabase } from '../db/native-database.js';
import { decryptFromBuffer, encryptToBuffer } from '../services/encryption.js';

interface WorkerRequest {
  id: number;
  operation: 'persistResult' | 'loadDocumentAst' | 'loadDiffAst';
  payload: Record<string, unknown>;
}

const port = parentPort;
if (!port) throw new Error('Database worker requires a parent port');

const config = workerData as { databasePath: string; nativeModulesRoot?: string };
const NativeDatabase = loadNativeDatabase(config.nativeModulesRoot);
const db = new NativeDatabase(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

port.on('message', (request: WorkerRequest) => {
  void handleRequest(request)
    .then((result) => port.postMessage({ id: request.id, result }))
    .catch((error: unknown) => port.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    }));
});

async function handleRequest(request: WorkerRequest): Promise<unknown> {
  switch (request.operation) {
    case 'persistResult':
      return persistResult(
        request.payload.result as CompareResult,
        Buffer.from(request.payload.key as Uint8Array),
      );
    case 'loadDocumentAst':
      return loadDocumentAst(
        request.payload.taskId as string,
        request.payload.side as 'a' | 'b',
        Buffer.from(request.payload.key as Uint8Array),
      );
    case 'loadDiffAst':
      return loadDiffAst(
        request.payload.taskId as string,
        Buffer.from(request.payload.key as Uint8Array),
      );
  }
}

async function persistResult(result: CompareResult, key: Buffer): Promise<void> {
  const [docA, docB, diff] = await Promise.all([
    encryptToBuffer(Buffer.from(JSON.stringify(result.docA)), key, {
      recordType: 'document_ast', recordId: result.taskId, side: 'a',
    }),
    encryptToBuffer(Buffer.from(JSON.stringify(result.docB)), key, {
      recordType: 'document_ast', recordId: result.taskId, side: 'b',
    }),
    encryptToBuffer(Buffer.from(JSON.stringify(result.diffAst)), key, {
      recordType: 'diff_ast', recordId: result.taskId,
    }),
  ]);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO tasks (
        id, display_name, status, doc_a_filename, doc_b_filename,
        doc_a_hash, doc_b_hash, options_json, diff_summary_json,
        review_progress_json, started_at, completed_at, duration_ms,
        last_accessed_at, retained
      ) VALUES (?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        status = excluded.status,
        doc_a_filename = excluded.doc_a_filename,
        doc_b_filename = excluded.doc_b_filename,
        doc_a_hash = excluded.doc_a_hash,
        doc_b_hash = excluded.doc_b_hash,
        options_json = excluded.options_json,
        diff_summary_json = excluded.diff_summary_json,
        review_progress_json = excluded.review_progress_json,
        completed_at = excluded.completed_at,
        duration_ms = excluded.duration_ms,
        last_accessed_at = excluded.last_accessed_at
    `).run(
      result.taskId,
      `${result.docA.filename} vs ${result.docB.filename}`,
      result.docA.filename,
      result.docB.filename,
      result.docA.sha256,
      result.docB.sha256,
      JSON.stringify(result.options),
      JSON.stringify(result.diffAst.summary),
      JSON.stringify({ total: result.diffAst.items.length, reviewed: 0, important: 0 }),
      result.startedAt,
      result.completedAt,
      result.durationMs,
      new Date().toISOString(),
    );
    saveDocument(result.taskId, 'a', docA, result.docA.parserVersion);
    saveDocument(result.taskId, 'b', docB, result.docB.parserVersion);
    db.prepare(`
      INSERT INTO diff_snapshots (task_id, payload_encrypted, engine_version)
      VALUES (?, ?, 'compare')
      ON CONFLICT(task_id) DO UPDATE SET
        payload_encrypted = excluded.payload_encrypted,
        engine_version = excluded.engine_version
    `).run(result.taskId, diff);
  })();
  key.fill(0);
}

function saveDocument(
  taskId: string,
  side: 'a' | 'b',
  encrypted: Buffer,
  parserVersion: string,
): void {
  db.prepare(`
    INSERT INTO document_snapshots (task_id, side, payload_encrypted, parser_version)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(task_id, side) DO UPDATE SET
      payload_encrypted = excluded.payload_encrypted,
      parser_version = excluded.parser_version
  `).run(taskId, side, encrypted, parserVersion);
}

async function loadDocumentAst(
  taskId: string,
  side: 'a' | 'b',
  key: Buffer,
): Promise<DocumentAst | null> {
  const row = db.prepare(
    'SELECT payload_encrypted FROM document_snapshots WHERE task_id = ? AND side = ?'
  ).get(taskId, side) as { payload_encrypted: Buffer } | undefined;
  if (!row) return null;
  const plaintext = await decryptFromBuffer(row.payload_encrypted, key, {
    recordType: 'document_ast', recordId: taskId, side,
  });
  key.fill(0);
  return JSON.parse(plaintext.toString('utf8')) as DocumentAst;
}

async function loadDiffAst(taskId: string, key: Buffer): Promise<DiffAst | null> {
  const row = db.prepare(
    'SELECT payload_encrypted FROM diff_snapshots WHERE task_id = ?'
  ).get(taskId) as { payload_encrypted: Buffer } | undefined;
  if (!row) return null;
  const plaintext = await decryptFromBuffer(row.payload_encrypted, key, {
    recordType: 'diff_ast', recordId: taskId,
  });
  key.fill(0);
  return JSON.parse(plaintext.toString('utf8')) as DiffAst;
}
