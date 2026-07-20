import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import { Button, type ButtonProps } from '../ui/button';
import { cn } from '../../lib/utils';

export interface LoadingButtonProps extends ButtonProps {
  /** When true, shows a spinner and disables the button. */
  loading?: boolean;
}

/**
 * Button that shows a spinner during async operations.
 * Automatically sets `disabled` when `loading` is true.
 */
const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, disabled, children, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={loading || disabled}
        className={cn(className)}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </Button>
    );
  }
);
LoadingButton.displayName = 'LoadingButton';

export { LoadingButton };
