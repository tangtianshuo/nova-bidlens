/**
 * Main process logger — wraps electron-log with IPC streaming to renderer.
 */
import log from 'electron-log/main';
import { BrowserWindow, ipcMain } from 'electron';

// Initialize once
log.initialize();

// Configure transports
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB
log.transports.console.level = false; // we handle console output via IPC streaming

// Custom format with tag support
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{tag}] {text}';

// ── IPC streaming to renderer ──

interface LogEntry {
  ts: string;
  level: string;
  tag: string;
  text: string;
  source: 'main' | 'renderer';
}

const MAX_LOG_BUFFER = 2000;
const logBuffer: LogEntry[] = [];

function broadcast(entry: LogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('log:entry', entry);
    }
  }
}

// Intercept all log calls to also broadcast to renderer
const originalMethods = {
  error: log.error.bind(log),
  warn: log.warn.bind(log),
  info: log.info.bind(log),
  debug: log.debug.bind(log),
  verbose: log.verbose.bind(log),
};

function wrapLogMethod(level: string, fn: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    fn(...args);
    const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    const tagMatch = text.match(/^\[([^\]]+)\]/);
    const tag = tagMatch ? tagMatch[1] : 'general';
    broadcast({ ts: new Date().toISOString(), level, tag, text, source: 'main' });
  };
}

log.error = wrapLogMethod('error', originalMethods.error);
log.warn = wrapLogMethod('warn', originalMethods.warn);
log.info = wrapLogMethod('info', originalMethods.info);
log.debug = wrapLogMethod('debug', originalMethods.debug);
log.verbose = wrapLogMethod('verbose', originalMethods.verbose);

// ── IPC handlers for renderer log viewer ──

ipcMain.handle('log:getBuffer', () => logBuffer);

// Receive logs from renderer
ipcMain.on('log:fromRenderer', (_event, entry: Omit<LogEntry, 'source'>) => {
  const full: LogEntry = { ts: entry.ts || new Date().toISOString(), level: entry.level, tag: entry.tag, text: entry.text, source: 'renderer' };
  // Write to file transport
  const logFn = log[entry.level as keyof typeof log] as ((...args: unknown[]) => void) | undefined;
  if (logFn) {
    logFn(`[renderer] ${entry.text}`);
  }
  broadcast(full);
});

export { log, type LogEntry };
