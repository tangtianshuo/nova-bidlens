import { Badge } from '@/components/ui/badge';
import type { SubmissionSummary, SubmissionState } from '@bidlens/shared/types-only';

const SUBMISSION_STATE_LABELS: Record<SubmissionState, string> = {
  pending: '待处理',
  validated: '已校验',
  parsing: '解析中',
  parsed: '已解析',
  extracting: '提取中',
  extracted: '已提取',
  failed: '失败',
  removed: '已移除',
};

const STATE_VARIANT: Record<SubmissionState, string> = {
  pending: 'default', validated: 'default', parsing: 'accent', parsed: 'accent',
  extracting: 'accent', extracted: 'added', failed: 'deleted', removed: 'deleted',
};

function getStageLabel(status: SubmissionState): string {
  return SUBMISSION_STATE_LABELS[status] ?? status;
}

function SubmissionStateBadge({ state }: { state: SubmissionState }) {
  return (
    <Badge variant={(STATE_VARIANT[state] ?? 'default') as 'default' | 'accent' | 'added' | 'deleted'}>
      {getStageLabel(state)}
    </Badge>
  );
}

// ── Component ─────────────────────────────────────────────────────────

interface SubmissionProgressTableProps {
  submissions: SubmissionSummary[];
}

export function SubmissionProgressTable({ submissions }: SubmissionProgressTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)]">
          <th className="px-3 py-2 text-left text-xs font-bold text-[var(--color-text-muted)]">
            文件名
          </th>
          <th className="px-3 py-2 text-left text-xs font-bold text-[var(--color-text-muted)]">
            当前阶段
          </th>
          <th className="px-3 py-2 text-left text-xs font-bold text-[var(--color-text-muted)]">
            状态
          </th>
          <th className="px-3 py-2 text-left text-xs font-bold text-[var(--color-text-muted)]">
            警告
          </th>
        </tr>
      </thead>
      <tbody>
        {submissions.map((sub) => (
          <tr
            key={sub.id}
            className="border-b border-[var(--color-border)] last:border-b-0"
          >
            <td className="px-3 py-2 text-[var(--color-text)] font-medium truncate max-w-[200px]">
              {sub.fileName}
            </td>
            <td className="px-3 py-2 text-[var(--color-text-secondary)]">
              {getStageLabel(sub.status)}
            </td>
            <td className="px-3 py-2">
              <SubmissionStateBadge state={sub.status} />
            </td>
            <td className="px-3 py-2 text-xs text-[var(--color-modified)]">
              {sub.warnings.length > 0 ? sub.warnings.join('；') : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
