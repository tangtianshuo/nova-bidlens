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

let _installed = false;

/**
 * Install global error capture hooks so unhandled exceptions, unhandled
 * promise rejections, and console.error/warn are forwarded to the log viewer.
 * Idempotent — safe to call multiple times.
 */
export function installGlobalErrorCapture() {
  if (_installed) return;
  _installed = true;

  // Unhandled exceptions
  window.onerror = (_event, _source, _lineno, _colno, error) => {
    const msg = error instanceof Error ? error.message : String(_event);
    const src = _source ? ` at ${_source}:${_lineno}` : '';
    send('error', 'Error', `${msg}${src}`);
    return false; // let browser default handler fire too
  };

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const text = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);
    send('error', 'Promise', text);
  });

  // console.error intercept
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    if (!(console as any)._bidlensCapturing) {
      (console as any)._bidlensCapturing = true;
      try {
        send('error', 'Console', ...args);
      } finally {
        (console as any)._bidlensCapturing = false;
      }
    }
  };

  // console.warn intercept
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args);
    if (!(console as any)._bidlensCapturing) {
      (console as any)._bidlensCapturing = true;
      try {
        send('warn', 'Console', ...args);
      } finally {
        (console as any)._bidlensCapturing = false;
      }
    }
  };
}

export default logger;
