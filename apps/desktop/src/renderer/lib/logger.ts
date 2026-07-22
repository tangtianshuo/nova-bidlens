/**
 * Renderer logger — sends logs to main process via IPC for unified log stream.
 * Tags: [IPC], [UI], [Store], [Parser], [Risk], [Error]
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

function send(level: LogLevel, tag: string, ...args: unknown[]) {
  const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  try {
    (window as any).bidlens?.sendLog({ level, tag, text });
  } catch {
    // fallback to console if IPC not ready
    console[level](`[${tag}]`, ...args);
  }
}

const logger = {
  error: (tag: string, ...args: unknown[]) => send('error', tag, ...args),
  warn: (tag: string, ...args: unknown[]) => send('warn', tag, ...args),
  info: (tag: string, ...args: unknown[]) => send('info', tag, ...args),
  debug: (tag: string, ...args: unknown[]) => send('debug', tag, ...args),

  /** Create a scoped logger with a fixed tag */
  scope: (tag: string) => ({
    error: (...args: unknown[]) => send('error', tag, ...args),
    warn: (...args: unknown[]) => send('warn', tag, ...args),
    info: (...args: unknown[]) => send('info', tag, ...args),
    debug: (...args: unknown[]) => send('debug', tag, ...args),
  }),
};

export default logger;
