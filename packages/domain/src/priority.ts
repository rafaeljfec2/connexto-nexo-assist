import type { PriorityDecision, PriorityInput, TicketPriority } from '@nexo-assist/contracts';

/**
 * Annex A priority rules (deterministic).
 * - Team/company with work stopped → critical
 * - One person unable to work, or same-day commitment → high
 * - Alternative available → medium
 * - No urgency → low
 * - Unknown scope, or one person without workStopped → ask
 */
export function decidePriority(input: PriorityInput): PriorityDecision {
  const { affectedScope, workStopped, sameDayCommitment, hasAlternative } = input;

  if (affectedScope === 'unknown') {
    return clarify(
      'Quem está sendo afetado: só você, sua equipe ou toda a empresa?',
      'priority.unknown_scope',
    );
  }

  if (
    (affectedScope === 'team' || affectedScope === 'company') &&
    workStopped === true
  ) {
    return decided('critical', 'priority.team_or_company_stopped');
  }

  if (
    (affectedScope === 'team' || affectedScope === 'company') &&
    workStopped === null
  ) {
    return clarify(
      'O trabalho da equipe ou da empresa está parado por causa disso?',
      'priority.team_or_company_work_unknown',
    );
  }

  if (affectedScope === 'self' && workStopped === null && sameDayCommitment === null) {
    return clarify(
      'Isso te impede de trabalhar agora, ou você tem um compromisso no mesmo dia?',
      'priority.self_impact_unknown',
    );
  }

  if (affectedScope === 'self' && (workStopped === true || sameDayCommitment === true)) {
    return decided('high', 'priority.self_blocked_or_same_day');
  }

  if (hasAlternative === true) {
    return decided('medium', 'priority.has_alternative');
  }

  if (hasAlternative === false && workStopped === false && sameDayCommitment === false) {
    return decided('low', 'priority.no_urgency');
  }

  if (hasAlternative === null) {
    return clarify(
      'Existe alguma alternativa para você continuar o trabalho?',
      'priority.alternative_unknown',
    );
  }

  return decided('low', 'priority.default_low');
}

function decided(priority: TicketPriority, rule: string): PriorityDecision {
  return {
    priority,
    needsClarification: false,
    clarificationQuestion: null,
    rule,
  };
}

function clarify(question: string, rule: string): PriorityDecision {
  return {
    priority: null,
    needsClarification: true,
    clarificationQuestion: question,
    rule,
  };
}
