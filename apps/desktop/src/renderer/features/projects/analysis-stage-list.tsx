import { Circle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { AnalysisPhase, ProjectStatus } from '@bidlens/shared/types-only';
import { STAGE_LABELS } from './stage-labels';

// ── Types ─────────────────────────────────────────────────────────────

type StageState = 'pending' | 'active' | 'done';

export interface AnalysisStage {
  key: AnalysisPhase | ProjectStatus;
  label: string;
  state: StageState;
  elapsedSec: number | null;
}

// ── Stage definitions ─────────────────────────────────────────────────

const PIPELINE_ORDER: AnalysisPhase[] = [
  'validating',
  'parsing',
  'extracting-nodes',
  'extracting-entities',
  'filtering-tender-content',
  'recalling-candidates',
  'detecting',
  'aggregating',
  'persisting',
  'completed',
];

// ── Derive stages from project status and phase ───────────────────────

export function deriveStages(
  projectStatus: ProjectStatus,
  currentPhase?: AnalysisPhase | null,
  /** Optional elapsed seconds when supplied by the main-process progress snapshot. */
  stageTimings?: Partial<Record<string, number>>,
): AnalysisStage[] {
  const failed = projectStatus === 'failed';
  const isTerminal = projectStatus === 'ready' || projectStatus === 'partial' || projectStatus === 'interrupted' || failed;
  const currentIdx = currentPhase ? PIPELINE_ORDER.indexOf(currentPhase) : -1;

  const pipelineStages = PIPELINE_ORDER.map((key, idx) => {
    let state: StageState;
    if (isTerminal) {
      state = 'done';
    } else if (idx < currentIdx) {
      state = 'done';
    } else if (idx === currentIdx) {
      state = 'active';
    } else {
      state = 'pending';
    }

    return {
      key,
      label: STAGE_LABELS[key] ?? key,
      state,
      elapsedSec: stageTimings?.[key] ?? null,
    };
  });

  // Append terminal status indicator
  pipelineStages.push({
    key: 'completed' as AnalysisPhase,
    label: failed ? '失败' : '完成',
    state: failed ? 'done' : isTerminal ? 'done' : 'pending',
    elapsedSec: null,
  });

  return pipelineStages;
}

// ── Component ─────────────────────────────────────────────────────────

interface AnalysisStageListProps {
  stages: AnalysisStage[];
}

const STATE_ICONS: Record<StageState, React.ElementType> = {
  pending: Circle,
  active: Loader2,
  done: CheckCircle2,
};

const STATE_COLORS: Record<StageState, string> = {
  pending: 'text-[var(--color-text-muted)]',
  active: 'text-[var(--color-accent)]',
  done: 'text-[var(--color-added)]',
};

function formatElapsed(sec: number | null): string {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function AnalysisStageList({ stages }: AnalysisStageListProps) {
  return (
    <div className="flex flex-col gap-0" role="list" aria-label="分析阶段">
      {stages.map((stage, idx) => {
        const Icon = STATE_ICONS[stage.state];
        const spinning = stage.state === 'active';
        const isLast = idx === stages.length - 1;

        return (
          <div
            key={stage.key}
            role="listitem"
            aria-current={stage.state === 'active' ? 'step' : undefined}
            className="flex items-start gap-3"
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <Icon
                className={`h-4 w-4 shrink-0 ${STATE_COLORS[stage.state]} ${spinning ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {!isLast && (
                <div
                  className={`w-px flex-1 min-h-[24px] ${
                    stage.state === 'done' ? 'bg-[var(--color-added)]' : 'bg-[var(--color-border)]'
                  }`}
                />
              )}
            </div>

            {/* Label + elapsed */}
            <div className={`flex items-baseline gap-2 pb-6 ${stage.state === 'pending' ? 'opacity-50' : ''}`}>
              <span className="text-sm font-medium text-[var(--color-text)]">
                {stage.label}
              </span>
              {stage.elapsedSec != null && (
                <span className="text-xs text-[var(--color-text-muted)] font-mono">
                  {formatElapsed(stage.elapsedSec)}
                </span>
              )}
              {stage.state === 'active' && stage.elapsedSec == null && (
                <span className="text-xs text-[var(--color-accent)]">进行中...</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
