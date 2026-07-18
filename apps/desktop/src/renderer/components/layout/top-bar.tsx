import { FileText, History, Monitor, Moon, Settings, ShieldCheck, Sun } from 'lucide-react';
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

  const themeIcon = theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  const themeLabel = theme === 'dark' ? '深色模式' : theme === 'light' ? '浅色模式' : '跟随系统';

  return (
    <>
      <header
        className={cn(
          'flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 pt-1'
        )}
        role="banner"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-sm font-bold text-white">B</span>
          <span className="text-base font-semibold text-[var(--color-text)]">BidLens</span>
          <Separator orientation="vertical" className="h-4" />
          <Button
            variant={view === 'new' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('new')}
            aria-label="新建比对"
          >
            <FileText className="h-3.5 w-3.5" />
            新建比对
          </Button>
          <Button
            variant={view === 'history' ? 'secondary' : 'ghost'}
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

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
