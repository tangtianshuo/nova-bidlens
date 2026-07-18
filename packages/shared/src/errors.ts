import type { ErrorCode, StructuredError, ComparePhase } from './compare-task.js';

export function createError(
  code: ErrorCode,
  message: string,
  opts?: { retryable?: boolean; phase?: ComparePhase; diagnosticId?: string }
): StructuredError {
  return {
    code,
    message,
    retryable: opts?.retryable ?? false,
    phase: opts?.phase,
    diagnosticId: opts?.diagnosticId,
  };
}

export function isRetryableError(error: StructuredError): boolean {
  return error.retryable;
}

export function formatErrorCode(error: StructuredError): string {
  const parts: string[] = [error.code];
  if (error.phase) parts.push(`phase=${error.phase}`);
  if (error.diagnosticId) parts.push(`diag=${error.diagnosticId}`);
  return parts.join(' | ');
}
