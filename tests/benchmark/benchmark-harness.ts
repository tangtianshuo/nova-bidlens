/**
 * P6-01: Benchmark harness for measuring performance across pipeline phases.
 *
 * Provides:
 * - Phase timing (validation, parsing, comparison, finalization)
 * - Memory tracking (heap used, RSS)
 * - Baseline comparison
 * - Machine/build metadata
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkResult {
  name: string;
  timestamp: string;
  machine: MachineInfo;
  phases: PhaseTiming[];
  memory: MemorySnapshot;
  metadata: Record<string, string>;
}

export interface PhaseTiming {
  name: string;
  durationMs: number;
  startMemoryMb: number;
  endMemoryMb: number;
}

export interface MemorySnapshot {
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
}

export interface MachineInfo {
  platform: string;
  arch: string;
  cpus: number;
  totalMemoryGb: number;
  nodeVersion: string;
}

export interface BaselineComparison {
  testName: string;
  currentMs: number;
  baselineMs: number | null;
  deltaMs: number;
  deltaPercent: number | null;
  status: 'improvement' | 'regression' | 'new' | 'unchanged';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMachineInfo(): MachineInfo {
  const os = require('node:os');
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemoryGb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    nodeVersion: process.version,
  };
}

function getMemorySnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
    heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
    rssMb: Math.round(mem.rss / (1024 * 1024)),
    externalMb: Math.round(mem.external / (1024 * 1024)),
  };
}

// ---------------------------------------------------------------------------
// Benchmark Runner
// ---------------------------------------------------------------------------

export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];
  private baselinePath: string;
  private outputDir: string;

  constructor(outputDir: string = 'tests/benchmark/results') {
    this.outputDir = outputDir;
    this.baselinePath = join(outputDir, 'baseline.json');

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Run a benchmark and record timing/memory.
   */
  async run(
    name: string,
    fn: () => Promise<void> | void,
    metadata: Record<string, string> = {}
  ): Promise<BenchmarkResult> {
    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    const machine = getMachineInfo();
    const phases: PhaseTiming[] = [];
    let currentPhase: string | null = null;
    let phaseStart: number = 0;
    let phaseStartMemory: number = 0;

    // Phase tracking API
    const tracker = {
      startPhase: (phaseName: string) => {
        if (currentPhase) {
          tracker.endPhase();
        }
        currentPhase = phaseName;
        phaseStart = performance.now();
        phaseStartMemory = getMemorySnapshot().heapUsedMb;
      },
      endPhase: () => {
        if (currentPhase) {
          const endMemory = getMemorySnapshot().heapUsedMb;
          phases.push({
            name: currentPhase,
            durationMs: Math.round(performance.now() - phaseStart),
            startMemoryMb: phaseStartMemory,
            endMemoryMb: endMemory,
          });
          currentPhase = null;
        }
      },
    };

    // Run the benchmark
    const startTime = performance.now();
    await fn(tracker);
    const totalDurationMs = Math.round(performance.now() - startTime);

    // Close any open phase
    tracker.endPhase();

    const result: BenchmarkResult = {
      name,
      timestamp: new Date().toISOString(),
      machine,
      phases,
      memory: getMemorySnapshot(),
      metadata: {
        ...metadata,
        totalDurationMs: String(totalDurationMs),
      },
    };

    this.results.push(result);
    return result;
  }

  /**
   * Compare current results against baseline.
   */
  compareWithBaseline(): BaselineComparison[] {
    const baseline = this.loadBaseline();
    const comparisons: BaselineComparison[] = [];

    for (const result of this.results) {
      const baselineResult = baseline?.find((b) => b.name === result.name);
      const currentMs = parseInt(result.metadata.totalDurationMs);
      const baselineMs = baselineResult
        ? parseInt(baselineResult.metadata.totalDurationMs)
        : null;

      let status: BaselineComparison['status'] = 'new';
      let deltaMs = 0;
      let deltaPercent: number | null = null;

      if (baselineMs !== null) {
        deltaMs = currentMs - baselineMs;
        deltaPercent = Math.round((deltaMs / baselineMs) * 100);

        if (deltaPercent < -5) {
          status = 'improvement';
        } else if (deltaPercent > 5) {
          status = 'regression';
        } else {
          status = 'unchanged';
        }
      }

      comparisons.push({
        testName: result.name,
        currentMs,
        baselineMs,
        deltaMs,
        deltaPercent,
        status,
      });
    }

    return comparisons;
  }

  /**
   * Save current results as the new baseline.
   */
  saveBaseline(): void {
    writeFileSync(
      this.baselinePath,
      JSON.stringify(this.results, null, 2),
      'utf-8'
    );
  }

  /**
   * Save results to a timestamped file.
   */
  saveResults(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmark-${timestamp}.json`;
    const filepath = join(this.outputDir, filename);

    writeFileSync(filepath, JSON.stringify(this.results, null, 2), 'utf-8');
    return filepath;
  }

  /**
   * Print comparison report to console.
   */
  printReport(): void {
    const comparisons = this.compareWithBaseline();

    console.log('\n=== Benchmark Report ===\n');
    console.log(`Machine: ${getMachineInfo().platform} ${getMachineInfo().arch}, ${getMachineInfo().cpus} CPUs, ${getMachineInfo().totalMemoryGb}GB RAM`);
    console.log(`Node: ${getMachineInfo().nodeVersion}\n`);

    for (const comp of comparisons) {
      const statusIcon = {
        improvement: '✅',
        regression: '❌',
        new: '🆕',
        unchanged: '➡️',
      }[comp.status];

      console.log(`${statusIcon} ${comp.testName}`);
      console.log(`   Current: ${comp.currentMs}ms`);

      if (comp.baselineMs !== null) {
        console.log(`   Baseline: ${comp.baselineMs}ms`);
        console.log(`   Delta: ${comp.deltaMs > 0 ? '+' : ''}${comp.deltaMs}ms (${comp.deltaPercent}%)`);
      } else {
        console.log(`   Baseline: N/A (new test)`);
      }
      console.log('');
    }
  }

  private loadBaseline(): BenchmarkResult[] | null {
    if (!existsSync(this.baselinePath)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(this.baselinePath, 'utf-8'));
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience: quick benchmark wrapper
// ---------------------------------------------------------------------------

export async function benchmark(
  name: string,
  fn: (tracker: { startPhase: (name: string) => void; endPhase: () => void }) => Promise<void> | void,
  metadata: Record<string, string> = {}
): Promise<BenchmarkResult> {
  const runner = new BenchmarkRunner();
  return runner.run(name, fn, metadata);
}
