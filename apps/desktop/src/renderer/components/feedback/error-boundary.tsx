import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary with retry capability.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-[var(--color-modified)]" />
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text)]">
              出现错误
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {this.state.error?.message || '发生了未知错误'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
