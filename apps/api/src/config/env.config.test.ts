import { afterEach, describe, expect, it } from 'vitest';
import { EnvConfig, parseEnvFile } from './env.config';

describe('parseEnvFile', () => {
  it('parses keys, ignores comments, and strips quotes', () => {
    const parsed = parseEnvFile(`
# comment
DATABASE_URL=postgres://nexo:nexo@localhost:5432/nexo
API_PORT="3001"
export OPENAI_MODEL='gpt-4.1-mini'
INVALID
=no-key
`);
    expect(parsed.get('DATABASE_URL')).toBe(
      'postgres://nexo:nexo@localhost:5432/nexo',
    );
    expect(parsed.get('API_PORT')).toBe('3001');
    expect(parsed.get('OPENAI_MODEL')).toBe('gpt-4.1-mini');
    expect(parsed.has('INVALID')).toBe(false);
  });
});

describe('EnvConfig', () => {
  afterEach(() => {
    EnvConfig.resetForTests();
    delete process.env.ENV_CONFIG_TEST_KEY;
  });

  it('does not override an existing process environment value', () => {
    process.env.ENV_CONFIG_TEST_KEY = 'from-shell';
    const env = EnvConfig.getInstance();
    env.load();
    expect(process.env.ENV_CONFIG_TEST_KEY).toBe('from-shell');
  });

  it('returns the same singleton instance', () => {
    expect(EnvConfig.getInstance()).toBe(EnvConfig.getInstance());
  });

  it('loads DATABASE_URL from a local .env when unset', () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const env = EnvConfig.getInstance().load();
      expect(env.require('DATABASE_URL').length).toBeGreaterThan(0);
      expect(env.sources.length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previous;
      }
    }
  });
});
