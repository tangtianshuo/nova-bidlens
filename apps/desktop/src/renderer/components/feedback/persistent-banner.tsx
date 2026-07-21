import { AlertTriangle, Info, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';

export type BannerVariant = 'warning' | 'info';

export interface PersistentBannerProps {
  variant?: BannerVariant;
  title: string;
  children?: ReactNode;
  dismissable?: boolean;
  onDismiss?: () => void;
  hidden?: boolean;
  className?: string;
}

export function PersistentBanner({
  variant = 'warning',
  title,
  children,
  dismissable = false,
  onDismiss,
  hidden = false,
  className,
}: PersistentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (hidden || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const Icon = variant === 'warning' ? AlertTriangle : Info;

  return (
    <Alert variant={variant === 'info' ? 'default' : 'warning'} className={className}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <AlertTitle>{title}</AlertTitle>
          {children && <AlertDescription>{children}</AlertDescription>}
        </div>
        {dismissable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleDismiss}
            aria-label="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Alert>
  );
}
