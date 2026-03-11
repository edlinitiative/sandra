/**
 * Structured error types for Sandra.
 * Provides consistent error handling across the platform.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'TOOL_EXECUTION_ERROR'
  | 'CHANNEL_ERROR'
  | 'INDEXING_ERROR';

export class SandraError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = 'INTERNAL_ERROR',
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SandraError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export class ValidationError extends SandraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends SandraError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      'NOT_FOUND',
      404,
    );
    this.name = 'NotFoundError';
  }
}

export class ProviderError extends SandraError {
  constructor(provider: string, message: string, details?: Record<string, unknown>) {
    super(`[${provider}] ${message}`, 'PROVIDER_ERROR', 502, details);
    this.name = 'ProviderError';
  }
}

export class ConfigurationError extends SandraError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.name = 'ConfigurationError';
  }
}

export class ToolExecutionError extends SandraError {
  constructor(toolName: string, message: string, details?: Record<string, unknown>) {
    super(`Tool '${toolName}' failed: ${message}`, 'TOOL_EXECUTION_ERROR', 500, details);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Wrap an async operation with structured error handling.
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SandraError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new SandraError(`${context}: ${message}`, 'INTERNAL_ERROR', 500);
  }
}

/**
 * Create a structured API error response.
 */
export function errorResponse(error: unknown): { error: { code: ErrorCode; message: string }; status: number } {
  if (error instanceof SandraError) {
    return { error: { code: error.code, message: error.message }, status: error.statusCode };
  }
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return { error: { code: 'INTERNAL_ERROR', message }, status: 500 };
}
