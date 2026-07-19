import { FileText, History, Minus, Monitor, Moon, Settings, ShieldCheck, Square, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../stores/app-store';
import { getThemePreference, setThemePreference, watchSystemTheme, type Theme } from '../../lib/theme';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Separator } from '../ui/separator';
import { SettingsDialog } from '../../features/settings/settings-dialog';

export function TopBar() {
  const { view, setView } = useAppStore();
  const [theme, setTheme] = useState<Theme>(getThemePreference);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Sync maximize state from main process
  useEffect(() => {
    void window.bidlens.windowIsMaximized().then(setIsMaximized);
    return window.bidlens.onMaximizeChanged(setIsMaximized);
  }, []);

  // Re-render when system theme changes
  useEffect(() => {
    const unwatch = watchSystemTheme(() => {
      if (getThemePreference() === 'system') {
        setTheme('system');
      }
    });
    return unwatch;
  }, []);

  const cycleTheme = useCallback(() => {
    const themes: Theme[] = ['system', 'light', 'dark'];
    const currentIndex = themes.indexOf(theme);
    const next = themes[(currentIndex + 1) % themes.length];
    setThemePreference(next);
    setTheme(next);
  }, [theme]);

  const handleDoubleClick = useCallback(() => {
    void window.bidlens.windowMaximize();
  }, []);

  const themeIcon = theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  const themeLabel = theme === 'dark' ? '深色模式' : theme === 'light' ? '浅色模式' : '跟随系统';

  return (
    <>
      <header
        className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]"
        role="banner"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-3 pl-5" style={{ WebkitAppRegion: 'no-drag', minWidth: 190 } as React.CSSProperties}>
          <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-sm font-bold text-white">B</span>
          <span className="font-bold text-[var(--color-text)]" style={{ fontSize: 17 }}>BidLens</span>
          <Separator orientation="vertical" className="h-4" />
          <Button
            variant={view === 'new' ? 'active' : 'ghost'}
            size="sm"
            onClick={() => setView('new')}
            aria-label="新建比对"
          >
            <FileText className="h-3.5 w-3.5" />
            新建比对
          </Button>
          <Button
            variant={view === 'history' ? 'active' : 'ghost'}
            size="sm"
            onClick={() => setView('history')}
            aria-label="最近比对"
          >
            <History className="h-3.5 w-3.5" />
            最近比对
          </Button>
          <span className="hidden items-center gap-1.5 text-xs text-[var(--color-text-muted)] lg:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            本地保护
          </span>
        </div>

        <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <IconButton
            icon={themeIcon}
            tooltip={themeLabel}
            onClick={cycleTheme}
            aria-label={`切换主题: ${themeLabel}`}
          />
          <IconButton
            icon={<Settings className="h-4 w-4" />}
            tooltip="设置"
            onClick={() => setSettingsOpen(true)}
            aria-label="打开设置"
          />
          <Separator orientation="vertical" className="h-4 mx-1" />
          {/* Window controls */}
          <button
            className="flex h-14 w-11 items-center justify-center text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
            onClick={() => void window.bidlens.windowMinimize()}
            aria-label="最小化"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            className="flex h-14 w-11 items-center justify-center text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
            onClick={() => void window.bidlens.windowMaximize()}
            aria-label={isMaximized ? '还原' : '最大化'}
          >
            <Square className={cn('h-3.5 w-3.5', isMaximized && 'hidden')} />
            <svg
              className={cn('h-3.5 w-3.5', !isMaximized && 'hidden')}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <rect x="3.5" y="5.5" width="8" height="8" rx="1" />
              <path d="M5.5 5.5V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1.5" />
            </svg>
          </button>
          <button
            className="flex h-14 w-11 items-center justify-center text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-danger)] hover:text-white"
            onClick={() => void window.bidlens.windowClose()}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
