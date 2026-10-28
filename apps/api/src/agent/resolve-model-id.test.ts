import { afterEach, describe, expect, it } from 'vitest';
import { resolveModelId } from './mastra';

const keys = [
  'LLM_PROVIDER',
  'OPENROUTER_MODEL',
  'OPENAI_MODEL',
] as const;

const original: Partial<Record<(typeof keys)[number], string | undefined>> = {};

describe('resolveModelId', () => {
  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it('builds openrouter/nvidia/nemotron for LLM_PROVIDER=openrouter', () => {
    for (const key of keys) {
      original[key] = process.env[key];
    }
    process.env.LLM_PROVIDER = 'openrouter';
    process.env.OPENROUTER_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
    delete process.env.OPENAI_MODEL;
    expect(resolveModelId()).toBe('openrouter/nvidia/nemotron-3.5-super-vl:free');
  });

  it('keeps openai/ prefix for bare OpenAI model ids', () => {
    for (const key of keys) {
      original[key] = process.env[key];
    }
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_MODEL = 'gpt-4.1-mini';
    expect(resolveModelId()).toBe('openai/gpt-4.1-mini');
  });
});
