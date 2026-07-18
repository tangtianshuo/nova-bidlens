import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { app } from 'electron';
import type { CompareResult, DiffAst, DocumentAst } from '@bidlens/shared';

interface WorkerResponse {
  id: number;
  result?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class DatabaseWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private alive = true;
  private closing = false;

  constructor(databasePath: string) {
    this.worker = new Worker(path.join(__dirname, '../workers/database-worker.js'), {
      workerData: {
        databasePath,
        nativeModulesRoot: app.isPackaged
          ? path.join(process.resourcesPath, 'native')
          : undefined,
      },
    });
    this.worker.on('message', (response: WorkerResponse) => this.handleResponse(response));
    this.worker.on('error', (error) => {
      this.alive = false;
      this.rejectAll(error);
    });
    this.worker.on('exit', (code) => {
      this.alive = false;
      if (!this.closing || code !== 1) {
        this.rejectAll(new Error(`Database worker exited with code ${code}`));
      }
    });
  }

  persistResult(result: CompareResult, key: Buffer): Promise<void> {
    return this.request('persistResult', { result, key });
  }

  loadDocumentAst(
    taskId: string,
    side: 'a' | 'b',
    key: Buffer,
  ): Promise<DocumentAst | null> {
    return this.request('loadDocumentAst', { taskId, side, key });
  }

  loadDiffAst(taskId: string, key: Buffer): Promise<DiffAst | null> {
    return this.request('loadDiffAst', { taskId, key });
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.worker.terminate();
    this.rejectAll(new Error('Database worker closed'));
  }

  private request<T>(operation: string, payload: unknown): Promise<T> {
    if (!this.alive) return Promise.reject(new Error('Database worker is unavailable'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.worker.postMessage({ id, operation, payload });
    });
  }

  private handleResponse(response: WorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.error) pending.reject(new Error(response.error));
    else pending.resolve(response.result);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
