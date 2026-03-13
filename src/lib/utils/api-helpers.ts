/**
 * API helper utilities: request ID generation, standard JSON response envelopes,
 * and error formatting for all API routes.
 */
import { SandraError } from './errors';
import type { ErrorCode } from './errors';

export interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    [key: string]: unknown;
  };
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
  };
}

/**
 * Generate a UUID for request tracing.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Build a standard success response envelope.
 */
export function successResponse<T>(
  data: T,
  meta?: { requestId?: string; [key: string]: unknown },
): SuccessEnvelope<T> {
  const requestId = meta?.requestId ?? generateRequestId();
  return {
    success: true,
    data,
    meta: { ...meta, requestId },
  };
}

/**
 * Build a standard error response envelope.
 */
export function apiErrorResponse(
  error: unknown,
  requestId: string,
): { envelope: ErrorEnvelope; status: number } {
  if (error instanceof SandraError) {
    return {
      envelope: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        meta: { requestId },
      },
      status: error.statusCode,
    };
  }
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return {
    envelope: {
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
      meta: { requestId },
    },
    status: 500,
  };
}
