import { eq } from 'drizzle-orm';
import { evaluateConfirmation } from '@nexo-assist/domain';
import type { AppDatabase } from '../db/client';
import { drafts } from '../db/schema';
import type { TicketGateway } from '../tickets/ticket.gateway';
import type { PolicyEngine } from './policy.engine';
import { applyDraft, type DraftRow } from './agent.draft-store';
import type { FailExecution, PersistAgentOutcome, TurnEvent } from './agent.types';
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
      intent: 'create',
      tool: null,
      rule: confirmation.rule,
      result: 'draft_confirmed',
      justification: 'Employee confirmed the exact pending draft.',
    });
    await input.persistAgentOutcome({
      conversationId: input.conversationId,
      executionId: input.executionId,
      agentContent: `Pronto. Operação confirmada: ${JSON.stringify(mutation)}.`,
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
      agentContent: 'Rascunho cancelado. Como posso ajudar agora?',
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
