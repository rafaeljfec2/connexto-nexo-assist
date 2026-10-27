import { describe, expect, it } from 'vitest';
import { decidePriority } from '../priority.js';

describe('decidePriority', () => {
  it('asks when affected scope is unknown', () => {
    const result = decidePriority({
      affectedScope: 'unknown',
      workStopped: null,
      sameDayCommitment: null,
      hasAlternative: null,
    });
    expect(result.needsClarification).toBe(true);
    expect(result.priority).toBeNull();
    expect(result.rule).toBe('priority.unknown_scope');
  });

  it('marks critical when team work is stopped', () => {
    const result = decidePriority({
      affectedScope: 'team',
      workStopped: true,
      sameDayCommitment: null,
      hasAlternative: null,
    });
    expect(result).toMatchObject({
      priority: 'critical',
      needsClarification: false,
      rule: 'priority.team_or_company_stopped',
    });
  });

  it('marks critical when company work is stopped', () => {
    const result = decidePriority({
      affectedScope: 'company',
      workStopped: true,
      sameDayCommitment: false,
      hasAlternative: false,
    });
    expect(result.priority).toBe('critical');
  });

  it('marks high when self is blocked', () => {
    const result = decidePriority({
      affectedScope: 'self',
      workStopped: true,
      sameDayCommitment: false,
      hasAlternative: null,
    });
    expect(result.priority).toBe('high');
    expect(result.rule).toBe('priority.self_blocked_or_same_day');
  });

  it('marks high for same-day commitment', () => {
    const result = decidePriority({
      affectedScope: 'self',
      workStopped: false,
      sameDayCommitment: true,
      hasAlternative: null,
    });
    expect(result.priority).toBe('high');
  });

  it('marks medium when alternative exists', () => {
    const result = decidePriority({
      affectedScope: 'self',
      workStopped: false,
      sameDayCommitment: false,
      hasAlternative: true,
    });
    expect(result.priority).toBe('medium');
  });

  it('marks low when there is no urgency', () => {
    const result = decidePriority({
      affectedScope: 'self',
      workStopped: false,
      sameDayCommitment: false,
      hasAlternative: false,
    });
    expect(result.priority).toBe('low');
  });

  it('asks when self impact is unknown', () => {
    const result = decidePriority({
      affectedScope: 'self',
      workStopped: null,
      sameDayCommitment: null,
      hasAlternative: null,
    });
    expect(result.needsClarification).toBe(true);
    expect(result.rule).toBe('priority.self_impact_unknown');
  });
});
