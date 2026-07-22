import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Trash2, Download, Filter, Search, Terminal } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

interface LogEntry {
  ts: string;
  level: string;
  tag: string;
  text: string;
  source: 'main' | 'renderer';
}

const LEVEL_COLORS: Record<string, string> = {
  error: 'text-[var(--color-danger)]',
  warn: 'text-[var(--color-warning, #e5a500)]',
  info: 'text-[var(--color-accent)]',
  debug: 'text-[var(--color-text-muted)]',
  verbose: 'text-[var(--color-text-muted)]',
};

const LEVEL_BG: Record<string, string> = {
  error: 'bg-red-500/10',
  warn: 'bg-yellow-500/10',
  info: '',
  debug: '',
  verbose: '',
};

const SOURCE_BADGE: Record<string, string> = {
  main: 'bg-blue-500/20 text-blue-400',
  renderer: 'bg-green-500/20 text-green-400',
};

interface LogViewerProps {
  open: boolean;
  onClose: () => void;
}

export function LogViewer({ open, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial buffer and subscribe
  useEffect(() => {
    if (!open) return;
    const api = (window as any).bidlens;
    if (!api) return;

    api.getLogBuffer().then((buffer: LogEntry[]) => {
      setLogs(buffer);
    });

    const unsub = api.onLogEntry((entry: LogEntry) => {
      setLogs(prev => {
        const next = [...prev, entry];
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    });
    return unsub;
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  // Collect unique tags
  const tags = useMemo(() => {
    const set = new Set(logs.map(l => l.tag));
    return ['all', ...Array.from(set).sort()];
  }, [logs]);

  // Filter
  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterLevel !== 'all' && l.level !== filterLevel) return false;
      if (filterTag !== 'all' && l.tag !== filterTag) return false;
      if (filterSource !== 'all' && l.source !== filterSource) return false;
      if (search && !l.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filterLevel, filterTag, filterSource, search]);

  const clear = () => setLogs([]);

  const exportLogs = () => {
    const text = filtered.map(l => `[${l.ts}] [${l.level}] [${l.tag}] [${l.source}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bidlens-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 flex max-h-[80vh] flex-col rounded-t-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-sm font-medium">日志查看器</span>
            <span className="text-xs text-[var(--color-text-muted)]">{filtered.length} / {logs.length} 条</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={clear} title="清空">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={exportLogs} title="导出">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-1.5">
          <Filter className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />

          {/* Level */}
          <select
            className="rounded bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs text-[var(--color-text)]"
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
          >
            <option value="all">全部级别</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Tag */}
          <select
            className="rounded bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs text-[var(--color-text)]"
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
          >
            {tags.map(t => (
              <option key={t} value={t}>{t === 'all' ? '全部标签' : t}</option>
            ))}
          </select>

          {/* Source */}
          <select
            className="rounded bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs text-[var(--color-text)]"
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
          >
            <option value="all">全部来源</option>
            <option value="main">Main</option>
            <option value="renderer">Renderer</option>
          </select>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              className="w-full rounded bg-[var(--color-bg-muted)] py-0.5 pl-7 pr-2 text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none"
              placeholder="搜索日志..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Log lines */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto font-mono text-xs leading-relaxed"
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
              暂无日志
            </div>
          ) : (
            filtered.map((l, i) => (
              <div
                key={`${l.ts}-${i}`}
                className={cn(
                  'flex items-start gap-2 border-b border-[var(--color-border)]/30 px-4 py-0.5 hover:bg-[var(--color-bg-hover)]',
                  LEVEL_BG[l.level],
                )}
              >
                <span className="shrink-0 text-[10px] text-[var(--color-text-muted)] w-20 pt-px">
                  {l.ts.slice(11, 23)}
                </span>
                <span className={cn('shrink-0 w-12 text-center font-medium', LEVEL_COLORS[l.level])}>
                  {l.level.toUpperCase()}
                </span>
                <span className={cn('shrink-0 rounded px-1.5 py-0 text-[10px]', SOURCE_BADGE[l.source])}>
                  {l.source}
                </span>
                <span className="shrink-0 w-20 truncate text-[var(--color-accent)]">
                  [{l.tag}]
                </span>
                <span className="min-w-0 flex-1 break-all text-[var(--color-text)]">
                  {l.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
