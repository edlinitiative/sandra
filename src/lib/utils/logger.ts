import { env } from '@/lib/config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[env.LOG_LEVEL];
}

function formatMessage(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}

/**
 * Lightweight structured logger.
 * Outputs to console; replace with a transport (e.g., Pino) for production.
 */
export function createLogger(context: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('debug')) console.debug(formatMessage('debug', context, message, meta));
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('info')) console.info(formatMessage('info', context, message, meta));
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', context, message, meta));
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('error')) console.error(formatMessage('error', context, message, meta));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
