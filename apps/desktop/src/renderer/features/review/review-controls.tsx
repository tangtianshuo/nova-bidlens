/**
 * P4-09: Review controls with status, importance toggle, note autosave.
 * Allows reviewers to mark items as confirmed/needs-confirmation/ignored,
 * toggle importance, and write notes.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Check, AlertTriangle, EyeOff, Flag, FlagOff, MessageSquare } from 'lucide-react';
import type { ReviewStatus, ReviewAnnotation } from '@bidlens/shared/types-only';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/input';

interface ReviewControlsProps {
  matchId: string;
  annotation: ReviewAnnotation | null;
  onSaveStatus: (matchId: string, status: ReviewStatus) => void;
  onSaveImportant: (matchId: string, important: boolean) => void;
  onSaveNote: (matchId: string, note: string) => void;
  disabled?: boolean;
  className?: string;
}

const STATUS_OPTIONS: { value: ReviewStatus; label: string; icon: typeof Check }[] = [
  { value: 'confirmed', label: '确认', icon: Check },
  { value: 'needs-confirmation', label: '待确认', icon: AlertTriangle },
  { value: 'ignored', label: '忽略', icon: EyeOff },
];

export function ReviewControls({
  matchId,
  annotation,
  onSaveStatus,
  onSaveImportant,
  onSaveNote,
  disabled = false,
  className,
}: ReviewControlsProps) {
  const currentStatus = annotation?.status ?? 'unreviewed';
  const isImportant = annotation?.important ?? false;
  const [noteText, setNoteText] = useState(annotation?.note ?? '');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync note text when annotation changes
  useEffect(() => {
    setNoteText(annotation?.note ?? '');
  }, [annotation?.note]);

  const handleStatusClick = useCallback(
    (status: ReviewStatus) => {
      if (disabled) return;
      // Toggle: clicking same status reverts to unreviewed
      const newStatus = currentStatus === status ? 'unreviewed' : status;
      onSaveStatus(matchId, newStatus);
    },
    [matchId, currentStatus, disabled, onSaveStatus]
  );

  const handleImportantToggle = useCallback(() => {
    if (disabled) return;
    onSaveImportant(matchId, !isImportant);
  }, [matchId, isImportant, disabled, onSaveImportant]);

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setNoteText(value);

      // Debounced autosave (500ms)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSaveNote(matchId, value);
      }, 500);
    },
    [matchId, onSaveNote]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Status buttons */}
      <div>
        <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">
          审核状态
        </label>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="审核状态">
          {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = currentStatus === value;
            return (
              <Button
                key={value}
                variant={isActive ? 'active' : 'secondary'}
                size="sm"
                onClick={() => handleStatusClick(value)}
                disabled={disabled}
                role="radio"
                aria-checked={isActive}
                aria-label={label}
                className="min-w-0 px-1.5 text-[11px] gap-1"
              >
                <Icon className="h-3 w-3" />
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Importance toggle */}
      <div style={{ marginTop: 7 }}>
        <Button
          variant={isImportant ? 'active' : 'secondary'}
          size="sm"
          onClick={handleImportantToggle}
          disabled={disabled}
          aria-label={isImportant ? '取消重要标记' : '标记为重要'}
          className={cn(
            'w-full px-1.5 text-[11px] gap-1 justify-start',
            isImportant && 'text-[var(--color-warning)]'
          )}
        >
          {isImportant ? (
            <Flag className="h-3 w-3 fill-current" />
          ) : (
            <FlagOff className="h-3 w-3" />
          )}
          {isImportant ? '已标记重要' : '标记重要'}
        </Button>
      </div>

      {/* Note */}
      <div style={{ marginTop: 9 }}>
        <label
          htmlFor={`note-${matchId}`}
          className="text-xs text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1"
        >
          <MessageSquare className="h-3 w-3" />
          备注
        </label>
        <textarea
          id={`note-${matchId}`}
          value={noteText}
          onChange={handleNoteChange}
          disabled={disabled}
          placeholder="添加备注..."
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-input)] p-2 text-xs text-[var(--color-text)] resize-vertical focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          style={{ minHeight: 66 }}
          aria-label="审核备注"
        />
      </div>
    </div>
  );
}
