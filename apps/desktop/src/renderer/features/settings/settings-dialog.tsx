import { useState, useEffect, useCallback } from 'react';
import { Monitor, Moon, Sun, HardDrive, Info, Key, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getThemePreference, setThemePreference, type Theme } from '../../lib/theme';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
} from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [theme, setTheme] = useState<Theme>(getThemePreference);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [cleaningTasks, setCleaningTasks] = useState(false);
  const [cleaningAll, setCleaningAll] = useState(false);

  useEffect(() => {
    if (open) {
      window.bidlens.mineruGetToken().then(({ token }) => {
        setMaskedToken(token);
        setHasStoredToken(!!token);
        setValidationResult(null);
      });
    }
  }, [open]);

  const handleThemeChange = (newTheme: Theme) => {
    setThemePreference(newTheme);
    setTheme(newTheme);
  };

  const handleSaveToken = useCallback(async () => {
    if (!tokenInput.trim()) return;
    setSaving(true);
    try {
      await window.bidlens.mineruSaveToken({ token: tokenInput.trim() });
      setTokenInput('');
      const { token } = await window.bidlens.mineruGetToken();
      setMaskedToken(token);
      setHasStoredToken(!!token);
    } finally {
      setSaving(false);
    }
  }, [tokenInput]);

  const handleValidateToken = useCallback(async () => {
    setValidating(true);
    try {
      const result = await window.bidlens.mineruValidateToken(
        tokenInput.trim() ? { token: tokenInput.trim() } : undefined
      );
      setValidationResult(result);
    } finally {
      setValidating(false);
    }
  }, [tokenInput]);

  const handleDeleteToken = useCallback(async () => {
    await window.bidlens.mineruDeleteToken();
    setMaskedToken(null);
    setHasStoredToken(false);
    setValidationResult(null);
  }, []);

  const handleCleanCompleted = useCallback(async () => {
    setCleaningTasks(true);
    try {
      const result = await window.bidlens.clearHistory({ type: 'cleanable', confirm: true });
      alert(`已清除 ${result.deletedCount} 条记录`);
    } catch (err) {
      alert(`清除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCleaningTasks(false);
    }
  }, []);

  const handleCleanAll = useCallback(async () => {
    if (!window.confirm('确定要清除所有数据吗？此操作不可撤销。')) return;
    setCleaningAll(true);
    try {
      const result = await window.bidlens.cleanup({ type: 'all', confirm: true });
      alert(`已清除 ${result.deletedCount} 条记录`);
    } catch (err) {
      alert(`清除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCleaningAll(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-h-[360px] max-h-[calc(100vh-32px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <DialogBody className="min-h-[280px]">
        <Tabs defaultValue="appearance" className="flex min-h-[240px] flex-col">
          <TabsList>
            <TabsTrigger value="appearance">外观</TabsTrigger>
            <TabsTrigger value="data">数据与隐私</TabsTrigger>
            <TabsTrigger value="api">API 配置</TabsTrigger>
            <TabsTrigger value="about">关于</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">
                主题
              </label>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                选择应用的外观主题
              </p>
              <div className="settings-theme-grid mt-3">
                <ThemeOption
                  icon={<Monitor className="h-4 w-4" />}
                  label="跟随系统"
                  active={theme === 'system'}
                  onClick={() => handleThemeChange('system')}
                />
                <ThemeOption
                  icon={<Sun className="h-4 w-4" />}
                  label="浅色"
                  active={theme === 'light'}
                  onClick={() => handleThemeChange('light')}
                />
                <ThemeOption
                  icon={<Moon className="h-4 w-4" />}
                  label="深色"
                  active={theme === 'dark'}
                  onClick={() => handleThemeChange('dark')}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">
                存储使用
              </label>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                当前应用数据占用的存储空间
              </p>
              <div className="mt-2 flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-[var(--color-text-muted)]" />
                <div>
                  <div className="text-sm text-[var(--color-text)]">0 MB</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    无限额
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">
                历史记录
              </label>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                管理比对历史和缓存数据
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleCleanCompleted} disabled={cleaningTasks}>
                  {cleaningTasks ? '清除中...' : '清除已完成任务'}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCleanAll} disabled={cleaningAll}>
                  {cleaningAll ? '清除中...' : '清除所有数据'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">
                MinerU API Token
              </label>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                用于解析扫描版 PDF 文档的云端 API 令牌
              </p>

              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="sk-..."
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveToken}
                  disabled={!tokenInput.trim() || saving}
                >
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  保存
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleValidateToken}
                  disabled={validating}
                >
                  {validating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  验证
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteToken}
                  disabled={!hasStoredToken}
                >
                  清除
                </Button>
              </div>

              {validationResult !== null && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {validationResult.valid ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">Token 有效</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600">{validationResult.error ?? 'Token 无效'}</span>
                    </>
                  )}
                </div>
              )}

              {maskedToken && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  当前存储: {maskedToken}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-[var(--color-text-muted)]" />
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  BidLens
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  招标文档语义比对工具
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">应用版本</span>
                <span className="text-[var(--color-text)]">0.2.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Electron</span>
                <span className="text-[var(--color-text)]">--</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">引擎版本</span>
                <span className="text-[var(--color-text)]">--</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

interface ThemeOptionProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ThemeOption({ icon, label, active, onClick }: ThemeOptionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-3 text-sm transition-colors',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
      )}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}
