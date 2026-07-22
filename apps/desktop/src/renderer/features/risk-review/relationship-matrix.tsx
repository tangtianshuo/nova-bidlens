import { useMemo, useCallback } from 'react';
import type { SubmissionSummary, RiskFinding } from '@bidlens/shared/types-only';

interface RelationshipMatrixProps {
  submissions: SubmissionSummary[];
  findings: RiskFinding[];
  onCellClick?: (fromId: string, toId: string) => void;
}

interface CellData {
  fromId: string;
  toId: string;
  maxSimilarity: number;
  riskLevel: 'high' | 'medium' | 'low' | null;
  findingCount: number;
}

export function RelationshipMatrix({ submissions, findings, onCellClick }: RelationshipMatrixProps) {
  const matrix = useMemo(() => buildMatrix(submissions, findings), [submissions, findings]);

  const handleCellClick = useCallback(
    (fromId: string, toId: string) => {
      if (fromId !== toId) onCellClick?.(fromId, toId);
    },
    [onCellClick],
  );

  if (submissions.length < 2) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-muted)]">
        至少需要 2 个文件才能显示关系矩阵
      </div>
    );
  }

  return (
    <div className="relationship-matrix-scroll overflow-x-auto overscroll-behavior-inline-contain" role="grid" aria-label="文件关系矩阵">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-bg)] p-2 text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]" />
            {submissions.map((sub) => (
              <th
                key={sub.id}
                className="p-2 text-center text-[var(--color-text-muted)] border-b border-[var(--color-border)] min-w-[80px]"
                title={sub.fileName}
              >
                <span className="truncate block max-w-[80px]">{truncateName(sub.fileName)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {submissions.map((fromSub) => (
            <tr key={fromSub.id}>
              <td
                className="sticky left-0 z-10 bg-[var(--color-bg)] p-2 text-[var(--color-text-muted)] border-b border-[var(--color-border)] whitespace-nowrap"
                title={fromSub.fileName}
              >
                {truncateName(fromSub.fileName)}
              </td>
              {submissions.map((toSub) => {
                const cell = matrix.get(`${fromSub.id}->${toSub.id}`);
                const isDiagonal = fromSub.id === toSub.id;
                return (
                  <td
                    key={toSub.id}
                    role={isDiagonal ? undefined : 'gridcell'}
                    tabIndex={isDiagonal ? -1 : 0}
                    onClick={() => handleCellClick(fromSub.id, toSub.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCellClick(fromSub.id, toSub.id);
                      }
                    }}
                    className={`border-b border-[var(--color-border)] p-2 text-center transition-colors ${
                      isDiagonal
                        ? 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]'
                        : cell
                          ? `cursor-pointer hover:opacity-80 ${getCellBg(cell.riskLevel)}`
                          : 'bg-[var(--color-bg)]'
                    }`}
                    title={
                      isDiagonal
                        ? '自身'
                        : cell
                          ? `${cell.findingCount} 个发现项，最高相似度 ${(cell.maxSimilarity * 100).toFixed(0)}%`
                          : '无关联'
                    }
                  >
                    {isDiagonal ? (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    ) : cell ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`font-medium ${getCellText(cell.riskLevel)}`}>
                          {(cell.maxSimilarity * 100).toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {cell.findingCount}项
                        </span>
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">0</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function truncateName(name: string, maxLen = 10): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '…';
}

function buildMatrix(
  submissions: SubmissionSummary[],
  findings: RiskFinding[],
): Map<string, CellData> {
  const map = new Map<string, CellData>();

  // Initialize all pairs
  for (const from of submissions) {
    for (const to of submissions) {
      if (from.id !== to.id) {
        map.set(`${from.id}->${to.id}`, {
          fromId: from.id,
          toId: to.id,
          maxSimilarity: 0,
          riskLevel: null,
          findingCount: 0,
        });
      }
    }
  }

  // Fill from findings
  for (const finding of findings) {
    for (const coverage of finding.directionalCoverage) {
      const key = `${coverage.fromId}->${coverage.toId}`;
      const cell = map.get(key);
      if (cell) {
        cell.findingCount++;
        if (coverage.coverage > cell.maxSimilarity) {
          cell.maxSimilarity = coverage.coverage;
          cell.riskLevel = finding.riskLevel;
        }
      }
    }
  }

  return map;
}

function getCellBg(risk: 'high' | 'medium' | 'low' | null): string {
  switch (risk) {
    case 'high': return 'bg-[var(--risk-high-bg)]';
    case 'medium': return 'bg-[var(--risk-medium-bg)]';
    case 'low': return 'bg-[var(--risk-low-bg)]';
    default: return 'bg-[var(--color-bg)]';
  }
}

function getCellText(risk: 'high' | 'medium' | 'low' | null): string {
  switch (risk) {
    case 'high': return 'text-[var(--risk-high)]';
    case 'medium': return 'text-[var(--risk-medium)]';
    case 'low': return 'text-[var(--risk-low)]';
    default: return 'text-[var(--color-text)]';
  }
}
