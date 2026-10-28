import { describe, expect, it } from 'vitest';
import { resolveSseAfterSeq } from '../src/events/sse-after-seq';

describe('resolveSseAfterSeq (S4)', () => {
  it('defaults to 0 when both missing', () => {
    expect(resolveSseAfterSeq(undefined, undefined)).toBe(0);
    expect(resolveSseAfterSeq('', '')).toBe(0);
  });

  it('uses query alone or header alone', () => {
    expect(resolveSseAfterSeq('12', undefined)).toBe(12);
    expect(resolveSseAfterSeq(undefined, '7')).toBe(7);
  });

  it('uses max when both are numeric', () => {
    expect(resolveSseAfterSeq('3', '10')).toBe(10);
    expect(resolveSseAfterSeq('15', '4')).toBe(15);
    expect(resolveSseAfterSeq('8', '8')).toBe(8);
  });

  it('rejects non-numeric values', () => {
    expect(resolveSseAfterSeq('abc', '1')).toBe('invalid');
    expect(resolveSseAfterSeq('1', '1.5')).toBe('invalid');
    expect(resolveSseAfterSeq('-1', undefined)).toBe('invalid');
  });
});
