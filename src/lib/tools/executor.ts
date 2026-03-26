import { toolRegistry } from './registry';
import type { ToolResult, ToolContext } from './types';
import { createLogger, AuthError, ValidationError } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';
import { isPrivateToolScopes } from '@/lib/auth/permissions';
import {
  withRetry,
  withTimeout,
  getCircuitBreaker,
  getCorrelationId,
  getToolResilienceConfig,
  isRetryableError,
  CircuitOpenError,
  TimeoutError,
} from './resilience';

const log = createLogger('tools:executor');

/**
 * Execute a tool by name with the given input and execution context.
 * Validates permissions, validates input, applies resilience (timeout, retry, circuit breaker), runs the tool.
 */
export async function executeTool(
  name: string,
  input: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const correlationId = getCorrelationId();
  const tool = toolRegistry.get(name);

  if (!tool) {
    log.error(`Tool not found: ${name}`, { correlationId });
    return { success: false, data: null, error: `Tool '${name}' not found` };
  }

  // Permission check: all required scopes must be present in context
  const missingScopes = tool.requiredScopes.filter((s) => !context.scopes.includes(s));
  if (missingScopes.length > 0) {
    throw new AuthError(`Missing required scopes for tool '${name}': ${missingScopes.join(', ')}`, {
      tool: name,
      missingScopes,
    });
  }

  // Validate input with Zod schema
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ValidationError(`Invalid input for tool '${name}': ${issues}`, { tool: name });
  }

  const start = Date.now();
  const shouldAudit = isPrivateToolScopes(tool.requiredScopes);
  const resilienceConfig = getToolResilienceConfig(name);

  // Build the execution function with resilience wrappers
  const execute = async (): Promise<ToolResult> => {
    return tool.handler(parsed.data, context);
  };

  // Wrap with timeout
  const withTimeoutFn = resilienceConfig.timeoutMs > 0
    ? () => withTimeout(execute, resilienceConfig.timeoutMs, name)
    : execute;

  // Wrap with circuit breaker
  const withCircuitBreakerFn = resilienceConfig.circuitBreaker
    ? () => getCircuitBreaker(resilienceConfig.circuitBreaker!).execute(withTimeoutFn)
    : withTimeoutFn;

  // Wrap with retry
  const withRetryFn = resilienceConfig.retry
    ? () => withRetry(withCircuitBreakerFn, name, {
        ...resilienceConfig.retry!,
        shouldRetry: (error) => isRetryableError(error),
      })
    : withCircuitBreakerFn;

  try {
    log.info(`Executing tool: ${name}`, { sessionId: context.sessionId, correlationId });
    const result = await withRetryFn();
    const duration = Date.now() - start;
    log.info(`Tool '${name}' completed in ${duration}ms`, { success: result.success, correlationId });

    if (shouldAudit) {
      logAuditEvent({
        userId: context.userId,
        sessionId: context.sessionId,
        action: 'tool_execution',
        resource: name,
        details: { duration, success: result.success, correlationId },
        success: result.success,
      }).catch(() => { /* best-effort */ });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    let msg: string;

    if (error instanceof TimeoutError) {
      msg = `Tool '${name}' timed out after ${resilienceConfig.timeoutMs}ms`;
    } else if (error instanceof CircuitOpenError) {
      msg = `Tool '${name}' is temporarily unavailable (circuit breaker open)`;
    } else {
      msg = error instanceof Error ? error.message : 'Unknown error';
    }

    log.error(`Tool '${name}' failed after ${duration}ms`, { error: msg, correlationId });

    if (shouldAudit) {
      logAuditEvent({
        userId: context.userId,
        sessionId: context.sessionId,
        action: 'tool_execution',
        resource: name,
        details: { duration, error: msg, correlationId },
        success: false,
      }).catch(() => { /* best-effort */ });
    }

    return { success: false, data: null, error: msg };
  }
}
