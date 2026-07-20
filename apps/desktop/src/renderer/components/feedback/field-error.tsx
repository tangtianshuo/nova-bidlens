import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FormMessage } from '../ui/form-message';

export interface FieldErrorProps {
  message: string;
  className?: string;
}

/**
 * Inline field error display.
 * Delegates to FormMessage for consistent a11y (role="alert").
 */
export function FieldError({ message, className }: FieldErrorProps) {
  return (
    <FormMessage
      className={cn('flex items-center gap-1.5', className)}
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </FormMessage>
  );
}
