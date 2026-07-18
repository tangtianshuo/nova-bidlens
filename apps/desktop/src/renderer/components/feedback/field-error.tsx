import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FieldErrorProps {
  message: string;
  className?: string;
}

/**
 * Inline field error display.
 */
export function FieldError({ message, className }: FieldErrorProps) {
  return (
    <div
      className={cn('flex items-center gap-1.5 text-xs text-[var(--color-deleted)]', className)}
      role="alert"
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
