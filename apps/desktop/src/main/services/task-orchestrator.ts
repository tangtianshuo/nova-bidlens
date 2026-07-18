/**
 * Task orchestrator (P1-13)
 * Orchestrates: validate -> parse baseline -> parse review -> compare via Rust -> finalize
 * Emits real progress via webContents.send('compare:progress', ...)
 * Supports cancellation at any phase
 * Only one active task at a time
 */

import type { BrowserWindow } from 'electron';
import type {
  CompareResult,
  CompareProgress,
  ComparePhase,
  CompareOptions,
  DiffAst,
  DiffItem,
  DocumentAst,
  StructuredError,
} from '@bidlens/shared';
import { createDiffSummary, createError } from '@bidlens/shared';
import { validateFile } from './file-validator.js';
import { parseDocumentFile } from './parser-service.js';
import { EngineManager, type CompareRequest } from './engine-manager.js';

// --- Task state ---

type TaskPhase = ComparePhase | 'ready' | 'cancelling' | 'cancelled' | 'failed';

interface ActiveTask {
  taskId: string;
  fileAPath: string;
  fileBPath: string;
  options: CompareOptions;
  abortController: AbortController;
  status: TaskPhase;
  startedAt: string;
  result?: CompareResult;
  error?: StructuredError;
  warnings: string[];
}

// --- Orchestrator ---

/** Maximum results to keep in memory (P6-03: LRU eviction). */
const MAX_RESULTS = 5;

export class TaskOrchestrator {
  private activeTask: ActiveTask | null = null;
  private results = new Map<string, CompareResult>();
  private resultOrder: string[] = [];
  private engineManager: EngineManager;

  constructor(
    private window: BrowserWindow,
    private readonly persistResult: (result: CompareResult) => Promise<void> = async () => undefined,
  ) {
    this.engineManager = new EngineManager();
  }

  /**
   * Start the orchestrator (boot engine).
   */
  async start(): Promise<void> {
    await this.engineManager.start();
  }

  /**
   * Stop the orchestrator (shutdown engine).
   */
  async stop(): Promise<void> {
    await this.engineManager.stop();
  }

  /**
   * Get the engine manager.
   */
  getEngineManager(): EngineManager {
    return this.engineManager;
  }

  /**
   * Perform engine handshake.
   */
  async handshake() {
    return this.engineManager.handshake();
  }

  /**
   * Start a comparison task. Only one task may be active at a time.
   */
  async startCompare(
    taskId: string,
    fileAPath: string,
    fileBPath: string,
    options: CompareOptions
  ): Promise<string> {
    // Check if a task is already active
    if (this.activeTask && !isTerminalStatus(this.activeTask.status)) {
      throw createError('ENGINE_BUSY', '已有比对任务正在运行');
    }

    const abortController = new AbortController();
    const task: ActiveTask = {
      taskId,
      fileAPath,
      fileBPath,
      options,
      abortController,
      status: 'validating',
      startedAt: new Date().toISOString(),
      warnings: [],
    };

    this.activeTask = task;

    // Run the pipeline asynchronously
    this.runPipeline(task).catch((err) => {
      console.error('[TaskOrchestrator] Pipeline error:', err);
    });

    return taskId;
  }

  /**
   * Cancel the active task.
   */
  cancelCompare(taskId: string): { taskId: string; cancelled: boolean } {
    if (!this.activeTask || this.activeTask.taskId !== taskId) {
      return { taskId, cancelled: false };
    }

    this.activeTask.abortController.abort();
    this.activeTask.status = 'cancelling';
    this.emitProgress(this.activeTask, '正在取消...');
    return { taskId, cancelled: true };
  }

  /**
   * Get a stored compare result by taskId.
   */
  getResult(taskId: string): CompareResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Clear a stored result from memory (P6-03: memory release).
   */
  clearResult(taskId: string): void {
    this.results.delete(taskId);
    this.resultOrder = this.resultOrder.filter((id) => id !== taskId);
  }

  /**
   * Check if a task is currently active.
   */
  isTaskActive(): boolean {
    return this.activeTask !== null && !isTerminalStatus(this.activeTask.status);
  }

  /**
   * Get the active task ID.
   */
  getActiveTaskId(): string | null {
    if (this.activeTask && !isTerminalStatus(this.activeTask.status)) {
      return this.activeTask.taskId;
    }
    return null;
  }

  // --- Pipeline implementation ---

  private async runPipeline(task: ActiveTask): Promise<void> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    let docA: DocumentAst | undefined;
    let docB: DocumentAst | undefined;
    let diffAst: DiffAst | undefined;

    try {
      // Phase 1: Validate files
      task.status = 'validating';
      this.emitProgress(task, '正在验证文件...');

      const [validationA, validationB] = await Promise.all([
        validateFile(task.fileAPath),
        validateFile(task.fileBPath),
      ]);

      if (task.abortController.signal.aborted) {
        return this.cancelTask(task);
      }

      // Check validation errors
      if (validationA.error) {
        throw createError(validationA.error.code, validationA.error.message);
      }
      if (validationB.error) {
        throw createError(validationB.error.code, validationB.error.message);
      }
      if (!validationA.supported) {
        throw createError('UNSUPPORTED_FORMAT', `不支持的文件格式: ${validationA.extension}`);
      }
      if (!validationB.supported) {
        throw createError('UNSUPPORTED_FORMAT', `不支持的文件格式: ${validationB.extension}`);
      }

      warnings.push(...validationA.warnings, ...validationB.warnings);
      task.warnings = warnings;

      // Phase 2: Parse baseline document
      task.status = 'parsing_baseline';
      this.emitProgress(task, '正在解析基准文档...');

      const parseResultA = await parseDocumentFile(task.fileAPath, {
        signal: task.abortController.signal,
      });

      if (task.abortController.signal.aborted) {
        return this.cancelTask(task);
      }

      if (!parseResultA.success || !parseResultA.ast) {
        throw createError(
          'PARSE_ERROR',
          parseResultA.error?.message ?? '基准文档解析失败',
          { phase: 'parsing_baseline' }
        );
      }
      docA = parseResultA.ast;
      warnings.push(...parseResultA.warnings.map((w) => w.message));
      task.warnings = warnings;

      // Phase 3: Parse review document
      task.status = 'parsing_review';
      this.emitProgress(task, '正在解析比较文档...');

      const parseResultB = await parseDocumentFile(task.fileBPath, {
        signal: task.abortController.signal,
      });

      if (task.abortController.signal.aborted) {
        return this.cancelTask(task);
      }

      if (!parseResultB.success || !parseResultB.ast) {
        throw createError(
          'PARSE_ERROR',
          parseResultB.error?.message ?? '比较文档解析失败',
          { phase: 'parsing_review' }
        );
      }
      docB = parseResultB.ast;
      warnings.push(...parseResultB.warnings.map((w) => w.message));
      task.warnings = warnings;

      // Phase 4: Compare via Rust engine
      task.status = 'comparing';
      this.emitProgress(task, '正在语义比对...');

      const compareRequest: CompareRequest = {
        docA,
        docB,
        options: {
          similarity_threshold: sensitivityToThreshold(task.options.sensitivity),
        },
      };

      const engineDiffAst = await this.engineManager.compare(
        compareRequest,
        task.abortController.signal,
        (phase, current, total, message) => {
          // Forward engine progress as sub-progress within comparing phase
          this.emitProgress(task, message || `比对中... ${current}/${total}`, current, total);
        }
      );

      if (task.abortController.signal.aborted) {
        return this.cancelTask(task);
      }

      // Adapt engine DiffAst to shared DiffAst format
      diffAst = adaptDiffAst(engineDiffAst, task.taskId, docA.id, docB.id);

      // Phase 5: Finalize
      task.status = 'finalizing';
      this.emitProgress(task, '正在生成报告...');

      // Compute capabilities
      const capabilities = computeCapabilities(validationA, validationB, docA, docB);

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedAt;

      const result: CompareResult = {
        taskId: task.taskId,
        docA,
        docB,
        diffAst,
        annotations: [],
        capabilities,
        options: task.options,
        warnings,
        startedAt: task.startedAt,
        completedAt,
        durationMs,
      };

      try {
        await this.persistResult(result);
      } catch (error) {
        console.error('[TaskOrchestrator] Failed to persist completed result:', error);
        throw createError('PERSISTENCE_ERROR', '无法安全保存比对结果', {
          retryable: true,
          phase: 'finalizing',
        });
      }

      task.result = result;
      task.status = 'ready';
      this.results.set(task.taskId, result);
      this.resultOrder.push(task.taskId);

      // LRU eviction: keep only MAX_RESULTS most recent
      while (this.resultOrder.length > MAX_RESULTS) {
        const evictId = this.resultOrder.shift()!;
        this.results.delete(evictId);
      }

      // Emit final progress
      this.emitProgress(task, '比对完成');

      // Send the full result as a final progress event
      // Note: 'ready' extends beyond ComparePhase but is used by the renderer to detect completion
      this.window.webContents.send('compare:progress', {
        taskId: task.taskId,
        phase: 'finalizing' as ComparePhase,
        stageLabel: '比对完成',
        elapsedMs: durationMs,
        warnings,
      } satisfies CompareProgress);
    } catch (err) {
      const wasCancelling = task.status === 'cancelling';

      const structuredError = isStructuredError(err)
        ? err
        : createError('UNKNOWN_ERROR', err instanceof Error ? err.message : 'Unknown error', {
            retryable: false,
            phase: wasCancelling ? undefined : (task.status as ComparePhase),
          });

      task.status = 'failed';
      task.error = structuredError;

      this.window.webContents.send('compare:progress', {
        taskId: task.taskId,
        phase: wasCancelling ? 'validating' : structuredError.phase ?? 'validating',
        stageLabel: wasCancelling ? '已取消' : structuredError.message,
        elapsedMs: Date.now() - startedAt,
        warnings,
        error: structuredError,
      } as CompareProgress & { error: StructuredError });
    }
  }

  private cancelTask(task: ActiveTask): void {
    task.status = 'cancelled';
    this.window.webContents.send('compare:progress', {
      taskId: task.taskId,
      phase: 'validating',
      stageLabel: '已取消',
      elapsedMs: 0,
      warnings: [],
    });
  }

  private emitProgress(task: ActiveTask, stageLabel: string, current?: number, total?: number): void {
    const progress: CompareProgress = {
      taskId: task.taskId,
      phase: task.status as ComparePhase,
      stageLabel,
      current,
      total,
      elapsedMs: Date.now() - new Date(task.startedAt).getTime(),
      warnings: [...task.warnings],
    };
    this.window.webContents.send('compare:progress', progress);
  }
}

// --- Helpers ---

function isTerminalStatus(status: string): boolean {
  return ['ready', 'cancelled', 'failed', 'interrupted'].includes(status);
}

function sensitivityToThreshold(sensitivity: string): number {
  switch (sensitivity) {
    case 'strict':
      return 0.6;
    case 'standard':
      return 0.45;
    case 'loose':
      return 0.3;
    default:
      return 0.45;
  }
}

/**
 * Raw Rust engine DiffAst response (snake_case fields).
 */
interface EngineDiffAstRaw {
  task_id?: string;
  doc_a_id?: string;
  doc_b_id?: string;
  items?: EngineDiffItemRaw[];
}

interface EngineDiffItemRaw {
  match_id?: string;
  match_type?: string;
  confidence?: number;
  similarity?: number;
  source_a?: string | null;
  source_b?: string | null;
  node_ids_a?: string[];
  node_ids_b?: string[];
  summary?: string;
}

/**
 * Adapt the Rust engine DiffAst format to the shared TypeScript DiffAst format.
 * The Rust engine serializes with snake_case field names.
 */
function adaptDiffAst(
  engineRaw: EngineDiffAstRaw,
  taskId: string,
  docAId: string,
  docBId: string
): DiffAst {
  const items: DiffItem[] = (engineRaw.items ?? []).map((raw) => ({
    matchId: raw.match_id ?? crypto.randomUUID(),
    matchType: (raw.match_type ?? 'uncertain') as DiffItem['matchType'],
    confidence: raw.confidence ?? 0,
    similarity: raw.similarity ?? 0,
    sourceA: raw.source_a ?? null,
    sourceB: raw.source_b ?? null,
    nodeIdsA: raw.node_ids_a ?? [],
    nodeIdsB: raw.node_ids_b ?? [],
    diffDetail: [],
    summary: raw.summary ?? '',
  }));

  return {
    taskId,
    docAId,
    docBId,
    generatedAt: new Date().toISOString(),
    items,
    summary: createDiffSummary(items),
  };
}

/**
 * Compute capabilities based on validation results and parsed documents.
 */
function computeCapabilities(
  _validationA: ReturnType<typeof validateFile> extends Promise<infer R> ? R : never,
  _validationB: ReturnType<typeof validateFile> extends Promise<infer R> ? R : never,
  docA: DocumentAst,
  docB: DocumentAst
) {
  // For now, use a simple heuristic: content always changes if docs differ
  const hasDocATables = docA.blocks.some((b) => b.type === 'table');
  const hasDocBTables = docB.blocks.some((b) => b.type === 'table');

  return [
    { dimension: 'content' as const, state: 'changed' as const },
    {
      dimension: 'table' as const,
      state: hasDocATables || hasDocBTables ? ('changed' as const) : ('no_change' as const),
    },
    { dimension: 'format' as const, state: 'no_change' as const },
    { dimension: 'comment' as const, state: 'no_change' as const },
    { dimension: 'revision' as const, state: 'no_change' as const },
  ];
}

function isStructuredError(err: unknown): err is StructuredError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}
