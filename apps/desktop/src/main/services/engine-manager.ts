/**
 * Engine manager (P1-06 through P1-12)
 * Spawns bidlens-engine as child process, implements JSON-RPC over stdio,
 * handles ping/compare/cancel/shutdown, progress notifications, crash recovery.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { DocumentAst } from '@bidlens/shared';
import type { DiffAst } from '@bidlens/shared';

// --- JSON-RPC types ---

interface RpcRequest {
  id: string;
  method: string;
  params: unknown;
}

interface RpcResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

interface RpcNotification {
  method: string;
  params: unknown;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

// --- Public types ---

export interface EngineHandshakeResult {
  engineVersion: string;
  protocolVersion: string;
  capabilities: string[];
}

export interface CompareRequest {
  docA: DocumentAst;
  docB: DocumentAst;
  options?: { similarity_threshold?: number };
}

export type ProgressCallback = (phase: string, current: number, total: number, message: string) => void;

// --- Constants ---

const ENGINE_REQUEST_TIMEOUT_MS = 300_000; // 5 minutes for compare
const PING_TIMEOUT_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 3_000;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BACKOFF_BASE_MS = 500;

/**
 * Manage the bidlens-engine child process lifecycle.
 */
export class EngineManager {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private nextRequestId = 1;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private started = false;
  private restarting = false;
  private stopping = false;
  private restartAttempts = 0;
  private onProgress: ProgressCallback | null = null;
  private enginePathOverride: string | null = null;

  /**
   * Create an EngineManager.
   * @param enginePath Optional override for the engine binary path (useful for testing).
   */
  constructor(enginePath?: string) {
    this.enginePathOverride = enginePath ?? null;
  }

  /**
   * Resolve the engine binary path for dev vs packaged mode.
   */
  private resolveEnginePath(): string {
    // Allow override for testing
    if (this.enginePathOverride) {
      return this.enginePathOverride;
    }

    const isDev = !app.isPackaged;

    if (isDev) {
      // In dev, look for cargo build output
      // Use app.getAppPath() to get the app directory (apps/desktop) and go up to project root
      const appPath = app.getAppPath();
      const projectRoot = path.resolve(appPath, '..', '..');
      
      const candidates = [
        path.join(projectRoot, 'bidlens-engine', 'target', 'release', 'bidlens-engine'),
        path.join(projectRoot, 'bidlens-engine', 'target', 'debug', 'bidlens-engine'),
        path.join(projectRoot, 'bidlens-engine', 'target', 'release', 'bidlens-engine.exe'),
        path.join(projectRoot, 'bidlens-engine', 'target', 'debug', 'bidlens-engine.exe'),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
      }
      throw new Error('Engine binary not found. Run: cargo build --manifest-path bidlens-engine/Cargo.toml');
    }

    // In packaged app, look in resources
    const resourcesPath = process.resourcesPath;
    const candidates = [
      path.join(resourcesPath, 'engine', 'bidlens-engine'),
      path.join(resourcesPath, 'engine', 'bidlens-engine.exe'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    throw new Error('Engine binary not found in resources');
  }
  async start(resetRestartAttempts = true): Promise<void> {
    if (this.process && this.started) return;

    const enginePath = this.resolveEnginePath();
    this.stopping = false;
    const spawnOpts: Record<string, unknown> = {
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    // Hide console window on Windows
    if (process.platform === 'win32') {
      spawnOpts.windowsHide = true;
      // Use CREATE_NO_WINDOW flag
      spawnOpts.windowsHide = true;
    }

    this.process = spawn(enginePath, [], spawnOpts);
    this.started = false;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.handleStdout(chunk.toString());
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString();
    });

    this.process.on('exit', (code, signal) => {
      this.handleExit(code, signal);
    });

    this.process.on('error', (err) => {
      this.handleProcessError(err);
    });

    // Wait for the process to be ready (we'll know when we can ping it)
    // Small delay to let process start
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.started = true;
    if (resetRestartAttempts) {
      this.restartAttempts = 0;
    }
  }

  /**
   * Stop the engine process gracefully.
   */
  async stop(): Promise<void> {
    if (!this.process) return;
    this.stopping = true;
    const child = this.process;

    try {
      // Try graceful shutdown via JSON-RPC
      await this.sendRequest('shutdown', {}, SHUTDOWN_TIMEOUT_MS);
    } catch {
      // Ignore shutdown errors
    }

    // Force kill if still running
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      // Give it a moment, then force kill
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, 1000);
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error('Engine shutting down'));
    }
    this.pendingRequests.clear();

    this.process = null;
    this.started = false;
  }

  /**
   * Perform handshake with the engine.
   */
  async handshake(): Promise<EngineHandshakeResult> {
    const result = (await this.sendRequest('ping', {}, PING_TIMEOUT_MS)) as {
      pong: boolean;
      engine_version: string;
      protocol_version: string;
      capabilities: string[];
    };
    return {
      engineVersion: result.engine_version,
      protocolVersion: result.protocol_version,
      capabilities: result.capabilities,
    };
  }

  /**
   * Send a compare request to the engine.
   */
  async compare(
    request: CompareRequest,
    signal?: AbortSignal,
    onProgress?: ProgressCallback
  ): Promise<DiffAst> {
    this.onProgress = onProgress ?? null;
    let cancelDeadline: ReturnType<typeof setTimeout> | undefined;

    // Register abort handler
    const abortHandler = () => {
      void this.sendRequest('compare.cancel', {}, SHUTDOWN_TIMEOUT_MS).catch(() => undefined);
      cancelDeadline = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, SHUTDOWN_TIMEOUT_MS);
      cancelDeadline.unref();
    };
    signal?.addEventListener('abort', abortHandler, { once: true });
    if (signal?.aborted) abortHandler();

    try {
      const result = (await this.sendRequest(
        'compare',
        {
          doc_a: request.docA,
          doc_b: request.docB,
          options: request.options ?? {},
        },
        ENGINE_REQUEST_TIMEOUT_MS
      )) as { diff: DiffAst; duration_ms: number };
      return result.diff;
    } finally {
      if (cancelDeadline) clearTimeout(cancelDeadline);
      signal?.removeEventListener('abort', abortHandler);
      this.onProgress = null;
    }
  }

  /**
   * Set progress callback for compare operations.
   */
  setProgressCallback(callback: ProgressCallback | null): void {
    this.onProgress = callback;
  }

  /**
   * Check if the engine is running.
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed && this.started;
  }

  // --- Private implementation ---

  private sendRequest(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || this.process.killed) {
        reject(new Error('Engine process not running'));
        return;
      }

      const id = String(this.nextRequestId++);
      const request: RpcRequest = { id, method, params };

      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref();

      this.pendingRequests.set(id, { resolve, reject, timer });

      // Send the request
      const line = JSON.stringify(request) + '\n';
      this.process.stdin?.write(line, (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          if (timer) clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    // Process complete lines
    let newlineIdx: number;
    while ((newlineIdx = this.stdoutBuffer.indexOf('\n')) !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIdx).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch {
        // Ignore malformed lines
        console.warn('[EngineManager] Malformed stdout line:', line.slice(0, 200));
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    // Response: has 'id' field
    if ('id' in msg && msg.id) {
      const response = msg as unknown as RpcResponse;
      const pending = this.pendingRequests.get(response.id);
      if (!pending) return;

      this.pendingRequests.delete(response.id);
      if (pending.timer) clearTimeout(pending.timer);

      if (response.error) {
        pending.reject(new Error(`Engine error [${response.error.code}]: ${response.error.message}`));
      } else {
        pending.resolve(response.result);
      }
      return;
    }

    // Notification: has 'method' field but no 'id'
    if ('method' in msg && !('id' in msg)) {
      const notification = msg as unknown as RpcNotification;
      this.handleNotification(notification);
    }
  }

  private handleNotification(notification: RpcNotification): void {
    if (notification.method === 'compare.progress' && this.onProgress) {
      const params = notification.params as {
        phase?: string;
        current?: number;
        total?: number;
        message?: string;
      };
      this.onProgress(
        params.phase ?? 'unknown',
        params.current ?? 0,
        params.total ?? 0,
        params.message ?? ''
      );
    }
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    console.warn(`[EngineManager] Engine exited: code=${code}, signal=${signal}`);
    this.started = false;
    this.process = null;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error(`Engine exited unexpectedly (code=${code}, signal=${signal})`));
    }
    this.pendingRequests.clear();

    // Attempt restart if not intentionally stopped
    if (!this.stopping && !this.restarting) {
      void this.attemptRestart();
    }
  }

  private handleProcessError(err: Error): void {
    console.error('[EngineManager] Process error:', err.message);
    this.started = false;

    for (const [id, pending] of this.pendingRequests) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error(`Engine process error: ${err.message}`));
    }
    this.pendingRequests.clear();
  }

  /**
   * Attempt to restart the engine with bounded exponential backoff.
   */
  private async attemptRestart(): Promise<void> {
    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      console.error('[EngineManager] Max restart attempts reached');
      return;
    }

    this.restarting = true;
    this.restartAttempts++;

    const backoffMs = RESTART_BACKOFF_BASE_MS * Math.pow(2, this.restartAttempts - 1);
    console.log(`[EngineManager] Restarting engine in ${backoffMs}ms (attempt ${this.restartAttempts})`);

    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    try {
      this.restarting = false;
      await this.start(false);
      console.log('[EngineManager] Engine restarted successfully');
    } catch (err) {
      console.error('[EngineManager] Failed to restart engine:', err);
      this.restarting = false;
    }
  }
}
