import { describe, it, expect } from 'vitest';
import {
  SandraError,
  ValidationError,
  AuthError,
  NotFoundError,
  ProviderError,
  ToolError,
  ConfigurationError,
} from '../errors';

describe('SandraError', () => {
  it('has correct default code and statusCode', () => {
    const err = new SandraError('something went wrong');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('something went wrong');
  });

  it('toJSON returns structured error shape', () => {
    const err = new SandraError('oops', 'INTERNAL_ERROR', 500, { key: 'val' });
    expect(err.toJSON()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'oops', details: { key: 'val' } },
    });
  });

  it('toJSON omits details when not provided', () => {
    const err = new SandraError('oops');
    expect(err.toJSON()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'oops' } });
  });
});

describe('ValidationError', () => {
  it('has code VALIDATION_ERROR and status 400', () => {
    const err = new ValidationError('bad input');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });

  it('is instanceof SandraError', () => {
    expect(new ValidationError('x') instanceof SandraError).toBe(true);
  });

  it('toJSON returns expected shape', () => {
    const err = new ValidationError('bad input');
    expect(err.toJSON().error.code).toBe('VALIDATION_ERROR');
    expect(err.toJSON().error.message).toBe('bad input');
  });
});

describe('AuthError', () => {
  it('has code AUTH_ERROR and status 401', () => {
    const err = new AuthError('unauthorized');
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.statusCode).toBe(401);
  });

  it('is instanceof SandraError', () => {
    expect(new AuthError('x') instanceof SandraError).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('has code NOT_FOUND and status 404', () => {
    const err = new NotFoundError('Session');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('includes resource and id in message', () => {
    const err = new NotFoundError('Session', 'abc123');
    expect(err.message).toContain('Session');
    expect(err.message).toContain('abc123');
  });

  it('is instanceof SandraError', () => {
    expect(new NotFoundError('x') instanceof SandraError).toBe(true);
  });
});

describe('ProviderError', () => {
  it('has code PROVIDER_ERROR and status 502', () => {
    const err = new ProviderError('openai', 'API error');
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.message).toContain('openai');
    expect(err.message).toContain('API error');
  });

  it('is instanceof SandraError', () => {
    expect(new ProviderError('x', 'y') instanceof SandraError).toBe(true);
  });
});

describe('ToolError', () => {
  it('has code TOOL_ERROR and status 500', () => {
    const err = new ToolError('search', 'failed');
    expect(err.code).toBe('TOOL_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.message).toContain('search');
    expect(err.message).toContain('failed');
  });

  it('is instanceof SandraError', () => {
    expect(new ToolError('x', 'y') instanceof SandraError).toBe(true);
  });
});

describe('ConfigurationError', () => {
  it('has code CONFIGURATION_ERROR and status 500', () => {
    const err = new ConfigurationError('missing key');
    expect(err.code).toBe('CONFIGURATION_ERROR');
    expect(err.statusCode).toBe(500);
  });
});
