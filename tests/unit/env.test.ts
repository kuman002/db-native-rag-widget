import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Environment Configuration Validation (src/config/env.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  it('successfully parses valid environment variables with defaults', async () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'rag_widget_db';
    process.env.POSTGRES_USER = 'rag_user';
    process.env.POSTGRES_PASSWORD = 'rag_secure_password';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6380';
    delete process.env.VECTOR_DIMENSION;

    const { loadConfig } = await import('../../src/config/env.js');
    const config = loadConfig(process.env);

    expect(config.POSTGRES_HOST).toBe('localhost');
    expect(config.POSTGRES_PORT).toBe(5432);
    expect(config.POSTGRES_DB).toBe('rag_widget_db');
    expect(config.VECTOR_DIMENSION).toBe(1536); // Default
    expect(config.REDIS_PORT).toBe(6380);
  });

  it('throws a validation error when mandatory variables are missing', async () => {
    const { loadConfig } = await import('../../src/config/env.js');
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(/Configuration validation failed/);
  });

  it('throws a validation error when port is non-numeric', async () => {
    const invalidEnv = {
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: 'invalid-port',
      POSTGRES_DB: 'rag_widget_db',
      POSTGRES_USER: 'rag_user',
      POSTGRES_PASSWORD: 'rag_secure_password',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6380',
      NODE_ENV: 'test' as const,
    };

    const { loadConfig } = await import('../../src/config/env.js');
    expect(() => loadConfig(invalidEnv)).toThrow(/POSTGRES_PORT/);
  });
});
