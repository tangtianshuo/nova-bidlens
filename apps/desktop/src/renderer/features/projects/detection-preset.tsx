import { useState, useCallback } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, Play } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

export type DetectionPresetId = 'strict' | 'standard' | 'loose';

export interface DetectionPresetOption {
  id: DetectionPresetId;
  label: string;
  description: string;
  detail: string;
  icon: typeof Shield;
}

export interface DetectionPresetProps {
  value: DetectionPresetId;
  onChange: (preset: DetectionPresetId) => void;
  onStartAnalysis?: () => void;
  canStart?: boolean;
  startDisabledReason?: string;
  submissionCount: number;
  hasBaseline: boolean;
}

// ─── Preset definitions ─────────────────────────────────────────────

export const DETECTION_PRESETS: DetectionPresetOption[] = [
  {
    id: 'strict',
    label: '严格',
    description: '更高召回，适合初筛和合规要求严格的场景',
    detail: '相似度阈值更低，会标记更多疑似雷同项，包括较弱的文本和表格相似。适合需要全面排查的审计场景。',
    icon: ShieldAlert,
  },
  {
    id: 'standard',
    label: '标准',
    description: '平衡召回与精确，适合大多数招标审查',
    detail: '在召回和误报之间取得平衡，过滤低置信度匹配，保留有实质依据的雷同发现。推荐日常使用。',
    icon: ShieldCheck,
  },
  {
    id: 'loose',
    label: '宽松',
    description: '更高精确度，减少误报，适合快速复核',
    detail: '仅保留高置信度、高相似度的雷同发现。可能遗漏部分弱信号，但误报率最低。',
    icon: Shield,
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function DetectionPreset({
  value,
  onChange,
  onStartAnalysis,
  canStart = true,
  startDisabledReason,
  submissionCount,
  hasBaseline,
}: DetectionPresetProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePresetChange = useCallback(
    (presetId: string) => {
      onChange(presetId as DetectionPresetId);
    },
    [onChange],
  );

  const handleStartClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    onStartAnalysis?.();
  }, [onStartAnalysis]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const selectedPreset = DETECTION_PRESETS.find((p) => p.id === value)!;
  const SelectedIcon = selectedPreset.icon;

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div>
        <span className="text-sm font-medium text-[var(--color-text)]">
          检测预设
        </span>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          选择雷同性检测的灵敏度级别
        </p>
      </div>

      {/* Preset radio group */}
      <RadioGroup value={value} onValueChange={handlePresetChange}>
        <div className="flex flex-col gap-2">
          {DETECTION_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = value === preset.id;
            return (
              <label
                key={preset.id}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-3 transition-colors ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <RadioGroupItem value={preset.id} className="mt-0.5" />
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${
                  isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                }`} />
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {preset.label}
                    </span>
                    {preset.id === 'standard' && (
                      <Badge variant="default" className="text-[10px]">推荐</Badge>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {preset.description}
                  </span>
                  {isSelected && (
                    <span className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {preset.detail}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </RadioGroup>

      {/* Launch section */}
      <div className="mt-2 flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-[var(--color-text)]">
              准备开始分析
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {submissionCount} 个投标文件
              {hasBaseline ? ' + 招标基线' : '（无基线）'}
              {' · '}
              预设：{selectedPreset.label}
            </span>
          </div>
        </div>

        {!canStart && startDisabledReason && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{startDisabledReason}</span>
          </Alert>
        )}

        {!hasBaseline && (
          <Alert variant="default">
            <AlertTriangle className="h-4 w-4" />
            <span>未提供招标基线文件，误报风险较高。建议在可能的情况下补充基线。</span>
          </Alert>
        )}

        <Button
          variant="primary"
          size="md"
          disabled={!canStart}
          onClick={handleStartClick}
          className="self-start"
        >
          <Play className="h-3.5 w-3.5" />
          开始分析
        </Button>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="确认开始分析"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={handleCancelConfirm}
        >
          <div
            className="mx-4 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-overlay)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              确认开始分析
            </h2>
            <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--color-text-secondary)]">
              <p>
                将使用<strong>{selectedPreset.label}</strong>预设对{' '}
                <strong>{submissionCount}</strong> 个投标文件进行雷同性分析。
              </p>
              {hasBaseline ? (
                <p>已关联招标基线文件，将用于过滤公共内容。</p>
              ) : (
                <p className="text-[var(--color-modified)]">
                  未提供招标基线，公共内容可能被误标为雷同。
                </p>
              )}
              <p>分析过程中可随时取消，已处理的检查点将保留。</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={handleCancelConfirm}>
                取消
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirm}>
                确认开始
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
