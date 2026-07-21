import { StatusBadge } from '@/components/feedback/status-badge';
import type { SubmissionSummary } from '@bidlens/shared/types-only';
import { STAGE_LABELS } from './stage-labels';

function getStageLabel(status: string): string {
  return STAGE_LABELS[status] ?? status;
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
              <StatusBadge status={sub.status} />
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
