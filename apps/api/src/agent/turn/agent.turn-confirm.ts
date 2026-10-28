import { eq } from 'drizzle-orm';
import {
  inferPrioritySignalsFromText,
  evaluateConfirmation,
} from '@nexo-assist/domain';
import type { AppDatabase } from '../../db/client';
import { drafts } from '../../db/schema';
import type { TicketGateway } from '../../tickets/ticket.gateway';
import type { PolicyEngine } from '../policy/policy.engine';
import {
  applyDraft,
  formatDraftConfirmFeedback,
  handlePrepareDraft,
  type DraftRow,
} from '../drafts/agent.draft-store';
import {
  findPriorProblemReport,
  inferCategoryFromText,
  lastAssistantAskedImpact,
  parseAffectedScope,
  titleFromProblemReport,
} from '../intents/impact-answer';
import { UNSURE_OFFER_TEXT } from '../intents/handoff-summary';
import type { FailExecution, PersistAgentOutcome, TurnEvent } from '../agent.types';
export async function tryHandleDraftConfirmation(input: {
  readonly db: AppDatabase;
  readonly tickets: TicketGateway;
  readonly policy: PolicyEngine;
  readonly conversationId: string;
  readonly employeeId: string;
  readonly content: string;
  readonly executionId: string;
  readonly pendingDraft: DraftRow | null;
  readonly persistAgentOutcome: PersistAgentOutcome;
  readonly failExecution: FailExecution;
}): Promise<boolean> {
  const confirmation = evaluateConfirmation({
    draft: input.pendingDraft
      ? {
          id: input.pendingDraft.id,
          version: input.pendingDraft.version,
          status: 'pending',
        }
      : null,
    freeText: input.content,
  });
  const events: TurnEvent[] = [];

  if (confirmation.kind === 'confirm' && input.pendingDraft) {
    const mutation = await applyDraft(
      input.db,
      input.tickets,
      input.policy,
      input.pendingDraft,
      input.employeeId,
      input.executionId,
    );
    events.push({
      intent: String(input.pendingDraft.action),
      tool: null,
      rule: confirmation.rule,
      result: 'draft_confirmed',
      justification: 'Employee confirmed the exact pending draft.',
    });
    await input.persistAgentOutcome({
      conversationId: input.conversationId,
      executionId: input.executionId,
      agentContent: formatDraftConfirmFeedback({
        confirmed: true,
        action: input.pendingDraft.action,
        mutation,
      }),
      events,
      draft: null,
      status: 'with_agent',
      summary: null,
    });
    return true;
  }

  if (confirmation.kind === 'reject' && input.pendingDraft) {
    await input.db
      .update(drafts)
      .set({ status: 'rejected' })
      .where(eq(drafts.id, input.pendingDraft.id));
    events.push({
      intent: null,
      tool: null,
      rule: confirmation.rule,
      result: 'draft_rejected',
      justification: 'Employee rejected the pending draft.',
    });
    await input.persistAgentOutcome({
      conversationId: input.conversationId,
      executionId: input.executionId,
      agentContent: formatDraftConfirmFeedback({
        confirmed: false,
        action: input.pendingDraft.action,
        mutation: null,
      }),
      events,
      draft: null,
      status: 'with_agent',
      summary: null,
    });
    return true;
  }

  if (
    confirmation.kind === 'ask_again' &&
    input.pendingDraft &&
    (confirmation.rule === 'confirm.weak_affirmation' ||
      confirmation.rule === 'confirm.empty')
  ) {
    events.push({
      intent: null,
      tool: null,
      rule: confirmation.rule,
      result: 'ask_again',
      justification: confirmation.reason,
    });
    await input.persistAgentOutcome({
      conversationId: input.conversationId,
      executionId: input.executionId,
      agentContent:
        'Para confirmar o rascunho, responda "confirmo" / "confirmado" ou use o botão de confirmação da versão exibida.',
      events,
      draft: input.pendingDraft,
      status: 'with_agent',
      summary: null,
    });
    return true;
  }

  // Short confirmation-like phrases that still did not match (typos, extra words)
  // must not fall through to the LLM — that re-calls prepare_draft and loops.
  if (
    confirmation.kind === 'ask_again' &&
    input.pendingDraft &&
    confirmation.rule === 'confirm.unrecognized' &&
    looksLikeFailedConfirmation(input.content)
  ) {
    events.push({
      intent: null,
      tool: null,
      rule: confirmation.rule,
      result: 'ask_again',
      justification: confirmation.reason,
    });
    await input.persistAgentOutcome({
      conversationId: input.conversationId,
      executionId: input.executionId,
      agentContent:
        'Não entendi a confirmação. Responda "confirmo" / "confirmado" ou use o botão Confirmar do rascunho.',
      events,
      draft: input.pendingDraft,
      status: 'with_agent',
      summary: null,
    });
    return true;
  }

  return false;
}

/**
 * Novo chamado: after "Quem está sendo afetado?", chip answers must continue create —
 * never fall through to Consulta list_my_tickets / list intro.
 */
export async function tryHandleImpactAnswer(input: {
  readonly db: AppDatabase;
  readonly tickets: TicketGateway;
  readonly policy: PolicyEngine;
  readonly conversationId: string;
  readonly employeeId: string;
  readonly content: string;
  readonly executionId: string;
  readonly pendingDraft: DraftRow | null;
  readonly recentMessages: readonly { readonly role: string; readonly content: string }[];
  readonly persistAgentOutcome: PersistAgentOutcome;
}): Promise<boolean> {
  if (input.pendingDraft) {
    return false;
  }
  const scope = parseAffectedScope(input.content);
  if (!scope || !lastAssistantAskedImpact(input.recentMessages)) {
    return false;
  }

  const problem =
    findPriorProblemReport(input.recentMessages, input.content) ?? input.content;
  const signals = inferPrioritySignalsFromText(`${problem}\n${input.content}`);
  const events: TurnEvent[] = [
    {
      intent: 'create',
      tool: 'prepare_draft',
      rule: null,
      result: 'ok',
      justification: 'Prepared create draft from impact-scope answer.',
    },
  ];
  const outcome = await handlePrepareDraft({
    db: input.db,
    policy: input.policy,
    tickets: input.tickets,
    conversationId: input.conversationId,
    employeeId: input.employeeId,
    args: {
      action: 'create',
      title: titleFromProblemReport(problem),
      description: problem,
      category: inferCategoryFromText(problem),
      type: 'incident',
      affectedScope: scope,
      workStopped: signals.workStopped,
      sameDayCommitment: signals.sameDayCommitment,
      hasAlternative: signals.hasAlternative,
    },
    events,
  });

  let agentContent =
    outcome.assistantText ??
    'Preciso de mais informações para montar o rascunho. Pode detalhar o impacto?';

  // Unknown / incomplete impact → explicit analyst offer (AA-5), never auto-transfer.
  if (!outcome.preparedDraft && scope === 'unknown') {
    events.push({
      intent: 'talk_to_analyst',
      tool: null,
      rule: 'transfer.offer_unsure',
      result: 'offer',
      justification: 'Low confidence after unknown affected scope — offering analyst.',
      confidence: 'low',
    });
    agentContent = `${agentContent.trim()}\n\n${UNSURE_OFFER_TEXT}`;
  }

  await input.persistAgentOutcome({
    conversationId: input.conversationId,
    executionId: input.executionId,
    agentContent,
    events,
    draft: outcome.preparedDraft,
    status: 'with_agent',
    summary: null,
  });
  return true;
}

/**
 * Consulta C6: "Adicionar informação ao chamado INC-XXXX" must start a complement
 * prompt — never the new-incident impact question ("Quem está sendo afetado?").
 * Skips when a pending draft exists so duplicity/HITL phrases like "complementar"
 * are not hijacked.
 */
export async function tryHandleComplementStart(input: {
  readonly content: string;
  readonly conversationId: string;
  readonly executionId: string;
  readonly pendingDraft: DraftRow | null;
  readonly persistAgentOutcome: PersistAgentOutcome;
}): Promise<boolean> {
  if (input.pendingDraft) {
    return false;
  }
  const match = parseAddInformationRequest(input.content);
  if (!match) {
    return false;
  }
  const numberLabel = match.ticketNumber;
  await input.persistAgentOutcome({
    conversationId: input.conversationId,
    executionId: input.executionId,
    agentContent: `Pode me dizer qual informação deseja acrescentar ao ${numberLabel}?`,
    events: [
      {
        intent: 'update',
        tool: null,
        rule: 'consulta.complement_start',
        result: numberLabel,
        justification: 'Employee requested to add information to an existing ticket.',
      },
    ],
    draft: null,
    status: 'with_agent',
    summary: null,
  });
  return true;
}

/**
 * C6 button / explicit add-info phrases with a ticket number only.
 * Bare "complementar" is excluded — it collides with duplicity HITL copy.
 */
export function parseAddInformationRequest(
  content: string,
): { ticketNumber: string } | null {
  const normalized = content
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const isAddInfo =
    normalized.includes('adicionar informacao') ||
    normalized.includes('acrescentar informacao') ||
    /\badicionar info\b/.test(normalized);
  if (!isAddInfo) {
    return null;
  }
  const numberMatch = /\b((?:inc|req)-\d+)\b/i.exec(content);
  if (!numberMatch?.[1]) {
    return null;
  }
  return {
    ticketNumber: numberMatch[1].toUpperCase(),
  };
}

function looksLikeFailedConfirmation(content: string): boolean {
  const text = content
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (text.length === 0 || text.length > 48) {
    return false;
  }
  // Typos / near-misses around confirmation — do not fall through to prepare_draft.
  return /\bconfirm/.test(text) || /\bpode criar\b/.test(text);
}
