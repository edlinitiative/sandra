import { env } from '@/lib/config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return false;
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[env.LOG_LEVEL];
}

function logEntry(
  level: LogLevel,
  context: string,
  message: string,
  meta: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...meta,
    }),
  );
}

/**
 * Lightweight structured logger.
 * Outputs JSON to console; each entry includes timestamp, level, context, message, and any extra fields.
 */
export function createLogger(context: string, boundMeta: Record<string, unknown> = {}) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      logEntry('debug', context, message, { ...boundMeta, ...meta });
    },
    info(message: string, meta?: Record<string, unknown>) {
      logEntry('info', context, message, { ...boundMeta, ...meta });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      logEntry('warn', context, message, { ...boundMeta, ...meta });
    },
    error(message: string, meta?: Record<string, unknown>) {
      logEntry('error', context, message, { ...boundMeta, ...meta });
    },
    withRequestId(requestId: string) {
      return createLogger(context, { ...boundMeta, requestId });
    },
  };
}

/** Default application-level logger */
export const logger = createLogger('app');

export type Logger = ReturnType<typeof createLogger>;
