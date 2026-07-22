# Phase 7: Structured Logging - Research

**Researched:** 2026-07-22
**Domain:** Electron desktop application logging
**Confidence:** HIGH

## Summary

electron-log is the correct choice for BidLens. It is the only maintained logging library purpose-built for Electron, handling main/renderer/preload process separation, OS-specific log file paths, and IPC-based log forwarding out of the box. Zero dependencies, 93KB unpacked, ships its own TypeScript types, and has been actively maintained since 2016 (v5.4.4 released 2026-05-14).

The codebase currently has 45 `console.log/error/warn` calls across `apps/desktop/src/`, with the renderer's console messages captured via a `console-message` event listener piped to `console.log` in main. This is fragile and loses structured data. electron-log replaces all of this with a single coherent system.

**Primary recommendation:** Install `electron-log`, wire it in main + preload + renderer (3 files), then replace `console.*` calls incrementally.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-log | 5.4.4 | Structured logging for Electron | Only maintained Electron-native logger. Zero deps. Built-in file rotation, IPC transport, OS-path resolution. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | — | — | electron-log is self-contained |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-log | winston | General-purpose Node logger. No Electron awareness. Must manually wire renderer IPC, file paths, rotation. 3x the config for worse results. |
| electron-log | pino | Fastest Node logger, but no Electron support. Requires custom renderer bridge, manual file path setup. Overkill for desktop app volume. |
| electron-log | Custom console wrapper | Reimplements what electron-log does. YAGNI. |

**Installation:**
```bash
pnpm --filter @bidlens/desktop add electron-log
```

**Version verified:** 5.4.4 published 2026-05-14 on npm. Zero dependencies. 93KB unpacked.

## Architecture Patterns

### Import Strategy — Three Entry Points

electron-log v5 ships separate entry points for each Electron process context:

```typescript
// Main process (Node.js / CommonJS)
import log from 'electron-log/main';

// Renderer process (bundled by Vite)
import log from 'electron-log/renderer';

// Preload script (bridge only — sets up IPC)
import log from 'electron-log/preload';
```

Each entry point auto-configures the correct transports for its context. No manual transport wiring needed.

### Main Process Setup

```typescript
// apps/desktop/src/main/index.ts — top of file
import log from 'electron-log/main';

// Must be called once, before any BrowserWindow is created
log.initialize();

// Configure levels
log.transports.file.level = 'info';      // file gets info+
log.transports.console.level = 'debug';  // dev console gets everything

// Optional: set max log file size (rotation)
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB
```

`log.initialize()` does two things:
1. Configures file transport with OS-appropriate path (`%AppData%/BidLens/logs/main.log` on Windows)
2. Sets up IPC listeners so renderer logs are forwarded to main's file transport

### Renderer Process Setup

```typescript
// apps/desktop/src/renderer/src/lib/logger.ts
import log from 'electron-log/renderer';

export default log;
```

That is it. The renderer import auto-connects to main via IPC (using the preload bridge). Logs from renderer appear in the same `main.log` file.

### Preload Script Setup

```typescript
// apps/desktop/src/preload/index.ts — add one import
import log from 'electron-log/preload';
log.initialize(); // sets up IPC bridge for renderer
```

This must run before the renderer imports `electron-log/renderer`. It registers the IPC channels that renderer logging uses to forward to main.

### Integration with Existing Preload

The current preload (`apps/desktop/src/preload/index.ts`) exposes `window.bidlens` API via `contextBridge`. electron-log's preload works independently — it uses its own IPC channels, not the `bidlens` ones. No conflict.

**Important:** `log.initialize()` in preload must be called before `contextBridge.exposeInMainWorld()`. The preload initializes first, then the renderer can use `electron-log/renderer`.

### Replacing Existing console-message Listener

The current code in `main/index.ts` lines 92-94:
```typescript
win.webContents.on('console-message', (event, level, message, line, sourceId) => {
  console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
});
```

This becomes unnecessary once renderer uses `electron-log/renderer`. The IPC transport handles renderer→main forwarding natively. Remove this listener.

### Log File Locations (Default)

| OS | Path |
|----|------|
| Windows | `%USERPROFILE%\AppData\Roaming\BidLens\logs\main.log` |
| macOS | `~/Library/Logs/BidLens/main.log` |
| Linux | `~/.config/BidLens/logs/main.log` |

Custom path override if needed:
```typescript
log.transports.file.resolvePathFn = (variables) => {
  // variables: { appName, fileName, libraryDefaultDir }
  return path.join(app.getPath('userData'), 'logs', 'bidlens.log');
};
```

### Log Format

Default file format: `[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}`

Output example: `[2026-07-22 14:30:15.123] [info] Risk analysis started for project abc-123]`

### IPC Transport Behavior

| Mode | File Transport | Console Transport | IPC Transport |
|------|---------------|-------------------|---------------|
| Dev | enabled | enabled | enabled (renderer→main) |
| Production | enabled | disabled | enabled (renderer→main) |

In production, renderer logs are forwarded to main via IPC and written to file. No DevTools needed.

### TypeScript Support

electron-log ships its own `.d.ts` files:
- `main.d.ts` — main process types
- `renderer.d.ts` — renderer types
- `node.d.ts` — Node.js types
- `src/index.d.ts` — generic types

No `@types/electron-log` needed. Types resolve automatically via the `exports` field in package.json.

The main TypeScript interface:
```typescript
import type { ElectronLog, LogMessage, Transport } from 'electron-log';
```

Key types:
- `ElectronLog` — the logger instance (has `info`, `warn`, `error`, `debug`, `verbose`, `silly`)
- `Transport` — transport configuration (has `level`, `format`, `maxSize`)
- `LogMessage` — internal log message structure

### Log Levels

```
error > warn > info > verbose > debug > silly
```

Default: both file and console accept `silly` (all messages). Set `level` to filter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Renderer→main log forwarding | Custom IPC channels + preload bridge | electron-log's built-in IPC transport | It handles the full lifecycle: preload registration, IPC channel naming, message serialization, error recovery |
| Log file path resolution | `path.join(app.getPath('userData'), 'logs')` + OS detection | electron-log's default paths | Handles all 3 OSes, respects appName, handles edge cases (sandboxed macOS, Flatpak Linux) |
| Log rotation | Custom file size check + rename logic | `log.transports.file.maxSize` | Built-in rotation with archive function. Default behavior is correct for desktop apps. |
| Structured log format | String template functions | electron-log's `{text}` format tokens | Ships with timestamp, level, scope, process info. Customizable if needed. |

**Key insight:** Every Electron app reinvents the same logging plumbing. electron-log is the standard solution. Custom implementations always end up reimplementing the same IPC bridge and file path logic, just worse.

## Common Pitfalls

### Pitfall 1: Calling log.initialize() Twice

**What goes wrong:** Error or duplicate log entries
**Why it happens:** Calling `log.initialize()` in both main AND preload
**How to avoid:** Call `log.initialize()` in main process ONLY. In preload, call `log.initialize()` only if you want preload-specific logging (usually not needed — just import `electron-log/preload` without calling initialize).

Actually, correction from the docs: `log.initialize()` in main sets up the main-side IPC listener. In preload, the import `electron-log/preload` sets up the renderer-side bridge. They are different functions. Follow the docs exactly.

### Pitfall 2: Importing Wrong Entry Point

**What goes wrong:** `Cannot find module 'electron-log/main'` in renderer, or vice versa
**Why it happens:** Using main entry in renderer code
**How to avoid:** Strict file organization:
- `src/main/**` → `import log from 'electron-log/main'`
- `src/renderer/**` → `import log from 'electron-log/renderer'`
- `src/preload/**` → `import log from 'electron-log/preload'`

### Pitfall 3: Vite Bundling Main Entry in Renderer

**What goes wrong:** Vite tries to bundle Node.js-only code into renderer
**Why it happens:** Import path not correctly scoped to process type
**How to avoid:** electron-log's `exports` map in package.json handles this. The `./renderer` export resolves to browser-compatible code. As long as you import from `electron-log/renderer` in renderer files, Vite picks the correct entry.

### Pitfall 4: Log Flooding in Development

**What goes wrong:** Debug-level logging from file parsing floods the log file
**Why it happens:** Default level is `silly` (all messages)
**How to avoid:** Set `log.transports.file.level = 'info'` in production and `'debug'` in development. Or use scoped loggers: `log.scope('parser')` for subsystem identification.

### Pitfall 5: Windows File Locking

**What goes wrong:** Log file cannot be read while app is running, or log rotation fails
**Why it happens:** Windows locks files that are open for writing
**How to avoid:** electron-log handles this correctly — it uses append-mode file writes and handles rotation by closing+renaming. No special handling needed. However, external tools (like `tail -f`) may not work on Windows while the file is locked. Use PowerShell's `Get-Content -Wait` instead.

## Code Examples

### Minimal Integration (3 files to change)

**File 1: `apps/desktop/src/main/index.ts`**
```typescript
import log from 'electron-log/main';

log.initialize();
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB

// Replace: console.log('[Main] Creating window...')
// With:    log.info('[Main] Creating window...')
```

**File 2: `apps/desktop/src/preload/index.ts`**
```typescript
import log from 'electron-log/preload';
// No initialize() needed in preload — just import for bridge setup
```

**File 3: `apps/desktop/src/renderer/src/lib/logger.ts`** (new file)
```typescript
import log from 'electron-log/renderer';
export default log;
```

Then in renderer components: `import log from '@/lib/logger'`

### Scoped Loggers for Subsystems

```typescript
// In main process
const parserLog = log.scope('parser');
const riskLog = log.scope('risk-engine');

parserLog.info('Parsing document', filePath);
riskLog.warn('Low confidence finding', { findingId, score });
// Output: [2026-07-22 14:30:15.123] [info] [parser] Parsing document /path/to/file.docx
```

### IPC Handler Error Logging Pattern

```typescript
// In main process IPC handlers
import log from 'electron-log/main';

ipcMain.handle('risk:createProject', async (event, request) => {
  log.info('[IPC] risk:createProject', { fileCount: request.files.length });
  try {
    const result = await createProject(request);
    log.info('[IPC] risk:createProject success', { projectId: result.projectId });
    return result;
  } catch (err) {
    log.error('[IPC] risk:createProject failed', err);
    throw err;
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `console.log` everywhere | Structured logger with levels | — | Searchable, filterable logs |
| Manual `console-message` event forwarding | electron-log IPC transport | v5 (2022) | Automatic renderer→main forwarding |
| Manual log path construction | Default OS-aware paths | v5 | No OS detection code needed |
| No rotation | `maxSize` + built-in archive | v5 | Prevents unbounded disk usage |

## Open Questions

1. **Log retention policy**
   - What we know: electron-log rotates at maxSize but doesn't auto-delete old files
   - What's unclear: How many rotated log files to keep
   - Recommendation: Implement a simple cleanup in `app.whenReady()`: scan logs dir, delete files older than 30 days. Or accept manual cleanup — desktop users rarely hit disk limits.

2. **Production log level**
   - What we know: Dev should log debug+, production should log info+
   - What's unclear: Whether to make this configurable in settings UI
   - Recommendation: Start with hardcoded `isDev ? 'debug' : 'info'`. Add settings toggle only if users request it.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — electron-log is a pure npm package with zero native bindings)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.8 |
| Config file | `apps/desktop/vitest.config.ts` (assumed) |
| Quick run command | `pnpm --filter @bidlens/desktop test` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOG-01 | Main process logs to file | integration | Manual verification — check log file created | N/A |
| LOG-02 | Renderer logs forwarded to main file | integration | Manual verification — renderer log appears in main.log | N/A |
| LOG-03 | Log levels filter correctly | unit | `vitest run tests/logger-levels.test.ts` | Wave 0 |
| LOG-04 | Log file rotation at maxSize | manual | Set small maxSize, generate logs, verify rotation | N/A |

### Sampling Rate
- **Per task commit:** Manual verification (check log file exists, has expected content)
- **Per wave merge:** `pnpm --filter @bidlens/desktop test`
- **Phase gate:** Manual log inspection + test suite green

### Wave 0 Gaps
- [ ] No automated tests needed — logging is infrastructure, verified by inspection
- [ ] Consider one smoke test: import electron-log, call `log.info()`, verify no crash

## Sources

### Primary (HIGH confidence)
- npm registry: `electron-log@5.4.4` — version, exports, dependencies, types confirmed
- npm readme: Full API surface, transport configuration, IPC setup, file locations
- package.json exports map: Confirmed `./main`, `./renderer`, `./preload` entry points with types

### Secondary (MEDIUM confidence)
- npm view: Weekly download count, maintenance history (last release 2026-05-14)
- GitHub repo: megahertz/electron-log — MIT license, active since 2016

### Tertiary (LOW confidence)
- Training data: Specific `maxSize` default behavior, `archiveLogFn` API — not verified against v5.4.4 source directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — electron-log is the de facto standard for Electron logging, verified on npm
- Architecture: HIGH — API surface confirmed via npm readme and exports map
- Pitfalls: MEDIUM — Windows file locking and rotation behavior based on training data, not live tested

**Research date:** 2026-07-22
**Valid until:** 2026-08-22 (stable library, infrequent breaking changes)
