export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ConfidenceSignal = {
  readonly rule: string | null;
  readonly result: string;
  readonly tool: string | null;
};

/**
 * Deterministic confidence for execution transparency (BUILD-7).
 * Never uses an LLM score.
 */
export function deriveConfidence(signals: readonly ConfidenceSignal[]): ConfidenceLevel {
  if (signals.length === 0) {
    return 'medium';
  }

  let level: ConfidenceLevel = 'high';

  for (const signal of signals) {
    const rule = (signal.rule ?? '').toLowerCase();
    const result = signal.result.toLowerCase();
    const tool = (signal.tool ?? '').toLowerCase();

    if (
      result.includes('error') ||
      result.includes('fail') ||
      result === 'unavailable' ||
      result === 'tool_error'
    ) {
      return 'low';
    }

    if (
      rule.includes('out_of_it') ||
      result === 'needs_clarification' ||
      result === 'ambiguous' ||
      rule.includes('ambiguous')
    ) {
      level = 'low';
      continue;
    }

    if (
      result === 'ask' ||
      rule.includes('priority.ask') ||
      result === 'needs_ticket' ||
      result === 'needs_description' ||
      (tool.includes('search_help') && result === 'empty')
    ) {
      if (level === 'high') {
        level = 'medium';
      }
    }
  }

  return level;
}

export function confidenceLabelPt(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'Alta';
    case 'medium':
      return 'Média';
    case 'low':
      return 'Baixa';
  }
}
