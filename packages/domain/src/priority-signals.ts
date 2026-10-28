import type { PriorityInput } from '@nexo-assist/contracts';

export type PriorityTextSignals = {
  readonly sameDayCommitment: boolean | null;
  readonly workStopped: boolean | null;
  readonly hasAlternative: boolean | null;
};

/**
 * Infer Annex A urgency signals from free-text (title/description/employee message).
 * Accent-insensitive and tolerant of informal Portuguese ("reuniao", "hoje as 23h").
 */
export function inferPrioritySignalsFromText(text: string): PriorityTextSignals {
  const normalized = stripDiacritics(text).toLowerCase();
  if (!normalized.trim()) {
    return { sameDayCommitment: null, workStopped: null, hasAlternative: null };
  }

  return {
    sameDayCommitment: detectSameDayCommitment(normalized),
    workStopped: detectWorkStopped(normalized),
    hasAlternative: detectHasAlternative(normalized),
  };
}

/**
 * Merge LLM/tool payload flags with text inference.
 * Positive evidence from text upgrades null/false for urgency signals
 * (LLM often forgets sameDayCommitment even when the description mentions a meeting).
 */
export function enrichPriorityInputFromText(
  input: PriorityInput,
  text: string,
): PriorityInput {
  const inferred = inferPrioritySignalsFromText(text);
  const sameDayCommitment = upgradeFlag(
    input.sameDayCommitment,
    inferred.sameDayCommitment,
  );
  const workStopped = upgradeFlag(input.workStopped, inferred.workStopped);
  let hasAlternative = mergeAlternative(
    input.hasAlternative,
    inferred.hasAlternative,
  );

  if (
    (sameDayCommitment === true || workStopped === true) &&
    hasAlternative !== true
  ) {
    hasAlternative = false;
  }

  return {
    affectedScope: input.affectedScope,
    sameDayCommitment,
    workStopped,
    hasAlternative,
  };
}

function upgradeFlag(
  fromPayload: boolean | null,
  fromText: boolean | null,
): boolean | null {
  if (fromPayload === true || fromText === true) {
    return true;
  }
  if (fromPayload === null) {
    return fromText;
  }
  return fromPayload;
}

function mergeAlternative(
  fromPayload: boolean | null,
  fromText: boolean | null,
): boolean | null {
  if (fromText === true || fromPayload === true) {
    return true;
  }
  if (fromText === false) {
    return false;
  }
  return fromPayload;
}

function detectSameDayCommitment(normalized: string): boolean | null {
  const mentionsMeeting =
    /\breuniao\b/.test(normalized) ||
    normalized.includes('compromisso') ||
    normalized.includes('mesmo dia');

  const mentionsTime =
    /\b\d{1,2}\s*h\b/.test(normalized) ||
    /\b\d{1,2}:\d{2}\b/.test(normalized) ||
    /\bas\s+\d{1,2}\s*h\b/.test(normalized);

  const mentionsTodayOrTomorrow =
    /\bhoje\b/.test(normalized) || /\bamanha\b/.test(normalized);

  if (mentionsMeeting) {
    return true;
  }
  if (mentionsTime && mentionsTodayOrTomorrow) {
    return true;
  }
  if (
    mentionsTime &&
    (normalized.includes('preciso') ||
      normalized.includes('antes das') ||
      normalized.includes('cliente') ||
      normalized.includes('apresenta'))
  ) {
    return true;
  }
  // Bare clock alone (e.g. "Reiniciei às 10h") is historical narrative, not same-day urgency.
  return null;
}

function detectWorkStopped(normalized: string): boolean | null {
  if (
    normalized.includes('nao consigo trabalhar') ||
    normalized.includes('trabalho parado') ||
    normalized.includes('impede de trabalhar') ||
    normalized.includes('parado por causa')
  ) {
    return true;
  }
  if (
    normalized.includes('consigo trabalhar') ||
    normalized.includes('tenho alternativa') ||
    normalized.includes('workaround')
  ) {
    return false;
  }
  return null;
}

function detectHasAlternative(normalized: string): boolean | null {
  if (
    normalized.includes('tenho alternativa') ||
    normalized.includes('workaround') ||
    normalized.includes('consigo trabalhar sem') ||
    normalized.includes('posso continuar')
  ) {
    return true;
  }
  if (
    normalized.includes('sem alternativa') ||
    normalized.includes('nao tenho alternativa') ||
    normalized.includes('nao consigo trabalhar')
  ) {
    return false;
  }
  return null;
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}
