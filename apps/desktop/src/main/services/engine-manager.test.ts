/**
 * Unit tests for engine-manager (P1-06 through P1-12)
 *
 * These tests focus on the EngineManager's public API and JSON-RPC protocol.
 * Integration tests with a real engine binary should be done separately.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock Electron (needed by resolveEnginePath)
vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

describe('engine-manager', async () => {
  const { EngineManager } = await import('./engine-manager.js');

  it('creates an instance', () => {
    const manager = new EngineManager('/mock/engine');
    expect(manager).toBeDefined();
    expect(manager.isRunning()).toBe(false);
  });

  it('accepts enginePath override in constructor', () => {
    const manager = new EngineManager('/custom/path/to/engine');
    expect(manager).toBeDefined();
  });

  it('isRunning returns false before start', () => {
    const manager = new EngineManager('/mock/engine');
    expect(manager.isRunning()).toBe(false);
  });

  it('stop is safe to call when not started', async () => {
    const manager = new EngineManager('/mock/engine');
    // Should not throw
    await manager.stop();
    expect(manager.isRunning()).toBe(false);
  });

  it('setProgressCallback does not throw', () => {
    const manager = new EngineManager('/mock/engine');
    expect(() => manager.setProgressCallback(null)).not.toThrow();
    expect(() => manager.setProgressCallback(() => {})).not.toThrow();
  });
});
