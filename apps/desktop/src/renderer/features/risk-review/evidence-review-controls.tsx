import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Star, MessageSquare } from 'lucide-react';
import type { FindingReviewStatus } from '../../__fixtures__/risk-project';

interface EvidenceReviewControlsProps {
  findingId: string;
  currentStatus: FindingReviewStatus;
  reviewNote: string;
  onStatusChange?: (id: string, status: FindingReviewStatus) => void;
  onNoteChange?: (id: string, note: string) => void;
}

export function EvidenceReviewControls({
  findingId,
  currentStatus,
  reviewNote,
  onStatusChange,
  onNoteChange,
}: EvidenceReviewControlsProps) {
  const handleConfirm = useCallback(
    () => onStatusChange?.(findingId, 'confirmed'),
    [findingId, onStatusChange],
  );
  const handleIgnore = useCallback(
    () => onStatusChange?.(findingId, 'ignored'),
    [findingId, onStatusChange],
  );
  const handleImportant = useCallback(
    () => onStatusChange?.(findingId, 'important'),
    [findingId, onStatusChange],
  );
  const handleReset = useCallback(
    () => onStatusChange?.(findingId, 'pending'),
    [findingId, onStatusChange],
  );

  const statusLabel =
    currentStatus === 'confirmed' ? '已确认' :
    currentStatus === 'ignored' ? '已忽略' :
    currentStatus === 'important' ? '重要' : '待确认';

  return (
    <div className="flex flex-col gap-3 p-4 text-xs" role="region" aria-label="人工复核">
      {/* Current status */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-text-muted)]">当前状态</span>
        <Badge
          variant={currentStatus === 'confirmed' ? 'added' : currentStatus === 'important' ? 'accent' : 'default'}
          className="text-[10px]"
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={currentStatus === 'confirmed' ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleConfirm}
          disabled={currentStatus === 'confirmed'}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          确认雷同
        </Button>
        <Button
          variant={currentStatus === 'ignored' ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleIgnore}
          disabled={currentStatus === 'ignored'}
        >
          <XCircle className="h-3.5 w-3.5" />
          忽略
        </Button>
        <Button
          variant={currentStatus === 'important' ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleImportant}
          disabled={currentStatus === 'important'}
        >
          <Star className="h-3.5 w-3.5" />
          标记重要
        </Button>
        {currentStatus !== 'pending' && (
          <Button variant="secondary" size="sm" onClick={handleReset}>
            重置
          </Button>
        )}
      </div>

      {/* Note input */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1 text-[var(--color-text-muted)]">
          <MessageSquare className="h-3 w-3" />
          备注
        </label>
        <textarea
          value={reviewNote}
          onChange={(e) => onNoteChange?.(findingId, e.target.value)}
          placeholder="添加复核备注..."
          className="min-h-[60px] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>
    </div>
  );
}
