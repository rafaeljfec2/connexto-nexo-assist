import { describe, expect, it } from 'vitest';
import { formatTraceFields, previewContent } from './agent-trace.log';

describe('agent-trace.log helpers', () => {
  it('formats stable key=value fields and quotes spaced values', () => {
    const line = formatTraceFields({
      conversationId: 'c1',
      executionId: 'e1',
      intent: 'create',
      tool: null,
      rule: 'priority.self_impact_unknown',
      result: 'needs_clarification',
      justification: 'Ask who is affected',
      eventCount: 3,
      confirm: true,
    });
    expect(line).toContain('conversationId=c1');
    expect(line).toContain('executionId=e1');
    expect(line).toContain('tool=-');
    expect(line).toContain('rule=priority.self_impact_unknown');
    expect(line).toContain('justification="Ask who is affected"');
    expect(line).toContain('eventCount=3');
    expect(line).toContain('confirm=true');
  });

  it('truncates content previews without leaking long bodies', () => {
    const long = 'x'.repeat(200);
    const preview = previewContent(long, 120);
    expect(preview.length).toBeLessThanOrEqual(121);
    expect(preview.endsWith('…')).toBe(true);
    expect(previewContent('  VPN erro 809  ')).toBe('VPN erro 809');
  });

  it('does not include cookie or secret keys in the formatter contract', () => {
    const line = formatTraceFields({
      conversationId: 'c1',
      contentPreview: previewContent('confirmado'),
    });
    expect(line.toLowerCase()).not.toContain('cookie');
    expect(line.toLowerCase()).not.toContain('secret');
    expect(line.toLowerCase()).not.toContain('authorization');
  });
});
