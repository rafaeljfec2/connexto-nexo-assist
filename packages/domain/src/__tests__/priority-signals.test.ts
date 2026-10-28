import { describe, expect, it } from 'vitest';
import {
  enrichPriorityInputFromText,
  inferPrioritySignalsFromText,
} from '../priority-signals.js';
import { decidePriority } from '../priority.js';

describe('inferPrioritySignalsFromText', () => {
  it('detects informal same-day meeting without accents', () => {
    const signals = inferPrioritySignalsFromText(
      'Só eu porem tenho reuniao hoje as 23h',
    );
    expect(signals.sameDayCommitment).toBe(true);
  });

  it('detects Figma VPN meeting at 14h', () => {
    const signals = inferPrioritySignalsFromText(
      'Só eu. Tenho reunião com um cliente às 14h e preciso da VPN funcionando.',
    );
    expect(signals.sameDayCommitment).toBe(true);
  });

  it('detects urgency embedded in draft title/description', () => {
    const signals = inferPrioritySignalsFromText(
      [
        'Não consigo acessar a VPN no PC - urgência por reunião próxima',
        'Sou o único afetado. Tenho uma reunião hoje às 23h.',
      ].join('\n'),
    );
    expect(signals.sameDayCommitment).toBe(true);
  });

  it('returns null when there is no urgency cue', () => {
    const signals = inferPrioritySignalsFromText(
      'VPN lenta de vez em quando no home office',
    );
    expect(signals.sameDayCommitment).toBeNull();
  });

  it('does not treat a bare historical clock as same-day urgency', () => {
    const signals = inferPrioritySignalsFromText(
      'Reiniciei às 10h e o notebook continua lento sem urgência.',
    );
    expect(signals.sameDayCommitment).toBeNull();
  });
});

describe('enrichPriorityInputFromText + decidePriority', () => {
  it('upgrades LLM false sameDayCommitment when text mentions a meeting', () => {
    const enriched = enrichPriorityInputFromText(
      {
        affectedScope: 'self',
        workStopped: false,
        sameDayCommitment: false,
        hasAlternative: false,
      },
      'Não consigo acessar a VPN. Tenho reunião hoje às 23h.',
    );
    expect(enriched.sameDayCommitment).toBe(true);
    expect(decidePriority(enriched).priority).toBe('high');
  });

  it('keeps low when text has no same-day cue', () => {
    const enriched = enrichPriorityInputFromText(
      {
        affectedScope: 'self',
        workStopped: false,
        sameDayCommitment: false,
        hasAlternative: false,
      },
      'VPN ocasionalmente lenta, sem urgência.',
    );
    expect(enriched.sameDayCommitment).toBe(false);
    expect(decidePriority(enriched).priority).toBe('low');
  });

  it('keeps low when only a bare clock appears in the narrative', () => {
    const enriched = enrichPriorityInputFromText(
      {
        affectedScope: 'self',
        workStopped: false,
        sameDayCommitment: false,
        hasAlternative: false,
      },
      'Reiniciei às 10h e o notebook continua lento sem urgência.',
    );
    expect(enriched.sameDayCommitment).toBe(false);
    expect(decidePriority(enriched).priority).toBe('low');
  });
});
