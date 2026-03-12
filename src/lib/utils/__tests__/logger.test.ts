import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, logger } from '../logger';

describe('createLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('outputs valid JSON on info call', () => {
    const log = createLogger('test');
    log.info('hello');

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output).toMatchObject({
      level: 'info',
      context: 'test',
      message: 'hello',
    });
    expect(typeof output.timestamp).toBe('string');
  });

  it('includes extra meta fields in output', () => {
    const log = createLogger('test');
    log.info('msg', { requestId: '123', extra: 'data' });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.requestId).toBe('123');
    expect(output.extra).toBe('data');
  });

  it('withRequestId binds requestId to all subsequent calls', () => {
    const log = createLogger('api').withRequestId('req-abc');
    log.info('processing');

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.requestId).toBe('req-abc');
  });

  it('withRequestId still accepts per-call meta', () => {
    const log = createLogger('api').withRequestId('req-xyz');
    log.warn('warning', { code: 42 });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.requestId).toBe('req-xyz');
    expect(output.code).toBe(42);
    expect(output.level).toBe('warn');
  });

  it('exports a default logger singleton', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.withRequestId).toBe('function');
  });
});
