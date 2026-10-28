import { describe, expect, it } from 'vitest';
import { deriveConfidence } from '../confidence.js';

describe('deriveConfidence (BUILD-7)', () => {
  it('defaults empty signals to medium', () => {
    expect(deriveConfidence([])).toBe('medium');
  });

  it('returns high for successful determinate rules', () => {
    expect(
      deriveConfidence([
        { rule: 'priority.self_alternative', result: 'medium', tool: null },
        { rule: 'duplicity.none', result: 'none', tool: null },
      ]),
    ).toBe('high');
  });

  it('returns low when priority still needs clarification', () => {
    expect(
      deriveConfidence([
        { rule: 'priority.ask_impact', result: 'needs_clarification', tool: null },
      ]),
    ).toBe('low');
  });

  it('returns low on tool failure or ambiguous duplicity', () => {
    expect(
      deriveConfidence([{ rule: null, result: 'tool_error', tool: 'list_my_tickets' }]),
    ).toBe('low');
    expect(
      deriveConfidence([{ rule: 'duplicity.ambiguous_band', result: 'ambiguous', tool: null }]),
    ).toBe('low');
  });
});
