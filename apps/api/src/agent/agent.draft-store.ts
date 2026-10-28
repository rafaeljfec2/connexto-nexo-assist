import { UnprocessableEntityException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  assertCreateDraftComplete,
  computeDueAt,
  deriveConfidence,
  evaluateConfirmation,
  formatMissingCreateFields,
} from '@nexo-assist/domain';
import type { TicketCategory, TicketPriority, TicketType } from '@nexo-assist/contracts';
import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/client';
import { drafts, executionEvents, messages, operations } from '../db/schema';
import type { ConversationEventsService } from '../events/conversation-events.service';
import { logDraftConfirm } from '../observability/agent-trace.log';
import type { PolicyEngine } from './policy.engine';
import { toDuplicateCandidates } from './policy.engine';
import type { TicketGateway } from '../tickets/ticket.gateway';
import type { TurnEvent } from './agent.types';

export type DraftRow = typeof drafts.$inferSelect;

/** User-facing chat feedback after HITL confirm/reject (button or free text). */
export function formatDraftConfirmFeedback(input: {
  readonly confirmed: boolean;
  readonly action: string;
  readonly mutation: Record<string, unknown> | null;
}): string {
  if (!input.confirmed) {
    return 'Rascunho cancelado. Como posso ajudar agora?';
  }
  const number =
    typeof input.mutation?.['number'] === 'string' ? input.mutation['number'] : null;
  switch (input.action) {
    case 'create':
      return number
        ? `Pronto. Criei o chamado ${number}. Ele está na fila de analistas.`
        : 'Pronto. Criei o chamado. Ele está na fila de analistas.';
    case 'update':
      return number
        ? `Pronto. Atualizei o chamado ${number} com as novas informações.`
        : 'Pronto. Atualizei o chamado com as novas informações.';
    case 'reopen':
      return number
        ? `Pronto. Reabri o chamado ${number}.`
        : 'Pronto. Reabri o chamado.';
    case 'transfer':
      return number
        ? `Pronto. Transfiri o chamado ${number} para a fila de analistas.`
        : 'Pronto. Transfiri o chamado para a fila de analistas.';
    default:
      return number
        ? `Pronto. Operação confirmada no chamado ${number}.`
        : 'Pronto. Operação confirmada.';
  }
}

export async function getPendingDraft(
  db: AppDatabase,
  conversationId: string,
): Promise<DraftRow | null> {
  const rows = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.conversationId, conversationId), eq(drafts.status, 'pending')))
    .orderBy(desc(drafts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveDraft(
  db: AppDatabase,
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<DraftRow | null> {
  const existing = await getPendingDraft(db, conversationId);
  const version = existing ? existing.version + 1 : 1;
  if (existing) {
    await db.update(drafts).set({ status: 'rejected' }).where(eq(drafts.id, existing.id));
  }
  const [created] = await db
    .insert(drafts)
    .values({
      conversationId,
      version,
      action: String(payload['action'] ?? 'create'),
      payload,
      ticketId: typeof payload['ticketId'] === 'string' ? payload['ticketId'] : null,
      status: 'pending',
    })
    .returning();
  return created ?? null;
}

export async function applyDraft(
  db: AppDatabase,
  tickets: TicketGateway,
  policy: PolicyEngine,
  draft: {
    readonly id: string;
    readonly action: string;
    readonly payload: Record<string, unknown>;
    readonly ticketId: string | null;
    readonly version: number;
  },
  employeeId: string,
  executionId: string,
): Promise<Record<string, unknown>> {
  const operationId = `draft:${draft.id}:v${draft.version}`;
  let mutation: Record<string, unknown>;
  if (draft.action === 'create') {
    const completeness = assertCreateDraftComplete(draft.payload);
    if (!completeness.complete) {
      throw new UnprocessableEntityException(
        formatMissingCreateFields(completeness.missing) ||
          'Draft create payload is incomplete.',
      );
    }
    const priority = policy.decidePriorityFromDraft(draft.payload);
    if (!priority.priority) {
      throw new UnprocessableEntityException('Priority still needs clarification.');
    }
    mutation = await tickets.create({
      employeeId,
      type: draft.payload['type'] as TicketType,
      category: draft.payload['category'] as TicketCategory,
      title: String(draft.payload['title']).trim(),
      description: String(draft.payload['description']).trim(),
      errorCode: (draft.payload['errorCode'] as string | null) ?? null,
      priority: priority.priority,
      operationId,
    });
  } else if (draft.action === 'update' && draft.ticketId) {
    mutation = await tickets.complement({
      ticketId: draft.ticketId,
      employeeId,
      descriptionAppend: String(draft.payload['description'] ?? ''),
      operationId,
    });
  } else if (draft.action === 'reopen' && draft.ticketId) {
    mutation = await tickets.reopen({
      ticketId: draft.ticketId,
      employeeId,
      note: String(draft.payload['description'] ?? 'Reabertura'),
      operationId,
    });
  } else if (draft.action === 'transfer' && draft.ticketId) {
    mutation = await tickets.transferTicket({
      ticketId: draft.ticketId,
      employeeId,
      operationId,
    });
  } else {
    throw new UnprocessableEntityException('Draft action not supported.');
  }

  await db.update(drafts).set({ status: 'confirmed' }).where(eq(drafts.id, draft.id));
  void executionId;
  return mutation;
}

export async function confirmDraftAction(
  db: AppDatabase,
  tickets: TicketGateway,
  policy: PolicyEngine,
  eventsService: ConversationEventsService,
  input: {
    readonly employeeId: string;
    readonly conversationId: string;
    readonly draftId: string;
    readonly version: number;
    readonly confirm: boolean;
  },
): Promise<{ ok: true; mutation: Record<string, unknown> | null }> {
  const [draft] = await db
    .select()
    .from(drafts)
    .where(
      and(eq(drafts.id, input.draftId), eq(drafts.conversationId, input.conversationId)),
    );

  if (!draft || draft.version !== input.version) {
    throw new UnprocessableEntityException('Confirmation must target the exact draft version.');
  }

  const operationId = `draft:${draft.id}:v${draft.version}`;

  if (draft.status === 'confirmed') {
    const [existing] = await db
      .select()
      .from(operations)
      .where(eq(operations.operationId, operationId));
    return {
      ok: true as const,
      mutation: existing?.result ?? null,
    };
  }

  if (draft.status !== 'pending') {
    throw new UnprocessableEntityException('Draft is no longer pending.');
  }

  if (input.confirm === true && draft.action === 'create') {
    const completeness = assertCreateDraftComplete(draft.payload);
    if (!completeness.complete) {
      throw new UnprocessableEntityException(
        formatMissingCreateFields(completeness.missing) ||
          'Draft create payload is incomplete.',
      );
    }
  }

  const decision = evaluateConfirmation({
    draft: { id: draft.id, version: draft.version, status: 'pending' },
    draftId: input.draftId,
    version: input.version,
    confirm: input.confirm,
  });

  const executionId = randomUUID();
  if (decision.kind === 'confirm') {
    const mutation = await applyDraft(db, tickets, policy, draft, input.employeeId, executionId);
    const agentContent = formatDraftConfirmFeedback({
      confirmed: true,
      action: draft.action,
      mutation,
    });
    await persistDraftConfirmFeedback(eventsService, {
      conversationId: input.conversationId,
      executionId,
      agentContent,
      intent: String(draft.action),
      rule: decision.rule,
      result: 'draft_confirmed',
      justification: 'Confirmed via UI button with exact version.',
    });
    logDraftConfirm({
      conversationId: input.conversationId,
      draftId: input.draftId,
      version: input.version,
      confirm: true,
      rule: decision.rule,
      result: 'draft_confirmed',
    });
    return { ok: true as const, mutation };
  }
  if (decision.kind === 'reject') {
    await db.update(drafts).set({ status: 'rejected' }).where(eq(drafts.id, draft.id));
    const agentContent = formatDraftConfirmFeedback({
      confirmed: false,
      action: draft.action,
      mutation: null,
    });
    await persistDraftConfirmFeedback(eventsService, {
      conversationId: input.conversationId,
      executionId,
      agentContent,
      intent: null,
      rule: decision.rule,
      result: 'draft_rejected',
      justification: 'Rejected via UI button with exact version.',
    });
    logDraftConfirm({
      conversationId: input.conversationId,
      draftId: input.draftId,
      version: input.version,
      confirm: false,
      rule: decision.rule,
      result: 'draft_rejected',
    });
    return { ok: true as const, mutation: null };
  }
  throw new UnprocessableEntityException(
    'reason' in decision ? decision.reason : 'Confirmação inválida.',
  );
}

async function persistDraftConfirmFeedback(
  eventsService: ConversationEventsService,
  input: {
    readonly conversationId: string;
    readonly executionId: string;
    readonly agentContent: string;
    readonly intent: string | null;
    readonly rule: string;
    readonly result: string;
    readonly justification: string;
  },
): Promise<void> {
  await eventsService.withConversationLock(input.conversationId, async (tx) => {
    const [agentMessage] = await tx
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        role: 'agent',
        content: input.agentContent,
      })
      .returning();
    if (!agentMessage) {
      throw new Error('Failed to persist draft confirmation feedback');
    }
    await tx.insert(executionEvents).values({
      conversationId: input.conversationId,
      executionId: input.executionId,
      messageId: agentMessage.id,
      intent: input.intent,
      tool: null,
      rule: input.rule,
      result: input.result,
      justification: input.justification,
      confidence: deriveConfidence([
        {
          rule: input.rule,
          result: input.result,
          tool: null,
        },
      ]),
    });
    await eventsService.appendInTx(tx, {
      conversationId: input.conversationId,
      type: 'message.created',
      payload: {
        messageId: agentMessage.id,
        role: 'agent',
        content: agentMessage.content,
        executionId: input.executionId,
      },
    });
    await eventsService.appendInTx(tx, {
      conversationId: input.conversationId,
      type: 'agent.completed',
      payload: {
        executionId: input.executionId,
        messageId: agentMessage.id,
      },
    });
  });
}

export async function handlePrepareDraft(input: {
  readonly db: AppDatabase;
  readonly policy: PolicyEngine;
  readonly tickets: TicketGateway;
  readonly conversationId: string;
  readonly employeeId: string;
  readonly args: Record<string, unknown>;
  readonly events: TurnEvent[];
}): Promise<{
  preparedDraft: DraftRow | null;
  assistantText: string | null;
  transferRequested: boolean;
}> {
  const action = String(input.args['action'] ?? 'create');
  if (action === 'update' || action === 'reopen' || action === 'transfer') {
    return handleMutationDraft(input, action);
  }

  const { decision: priority, enriched: enrichedSignals } =
    input.policy.resolvePriorityFromDraft(input.args);
  const draftPayload: Record<string, unknown> = {
    ...input.args,
    sameDayCommitment: enrichedSignals.sameDayCommitment,
    workStopped: enrichedSignals.workStopped,
    hasAlternative: enrichedSignals.hasAlternative,
  };
  if (priority.priority) {
    const dueAt = computeDueAt(priority.priority as TicketPriority, new Date());
    draftPayload['priority'] = priority.priority;
    draftPayload['dueAt'] = dueAt.toISOString();
  }
  input.events.push({
    intent: 'create',
    tool: null,
    rule: priority.rule,
    result: priority.needsClarification ? 'needs_clarification' : String(priority.priority),
    justification: priority.clarificationQuestion ?? 'Priority decided by domain policy.',
  });
  if (priority.priority) {
    input.events.push({
      intent: 'create',
      tool: null,
      rule: 'sla.compute_due',
      result: String(draftPayload['dueAt'] ?? ''),
      justification: `SLA due date computed for priority ${priority.priority}.`,
    });
  }

  let assistantText: string | null = null;
  const transferRequested = priority.priority === 'critical';
  if (priority.needsClarification) {
    assistantText =
      priority.clarificationQuestion ??
      'Preciso de mais informações para definir a prioridade.';
    return { preparedDraft: null, assistantText, transferRequested };
  }

  const completeness = assertCreateDraftComplete(draftPayload);
  if (!completeness.complete) {
    input.events.push({
      intent: 'create',
      tool: null,
      rule: 'draft.create_incomplete',
      result: completeness.missing.join(','),
      justification: 'Create draft missing required Annex A fields.',
    });
    return {
      preparedDraft: null,
      assistantText: formatMissingCreateFields(completeness.missing),
      transferRequested: false,
    };
  }

  const preparedDraft = await saveDraft(input.db, input.conversationId, draftPayload);
  const open = await input.tickets.listOpenForDuplicity(input.employeeId);
  const dup = input.policy.detectDuplicates(
    {
      category: (input.args['category'] as never) ?? null,
      title: String(input.args['title'] ?? ''),
      description: String(input.args['description'] ?? ''),
      errorCode: (input.args['errorCode'] as string | null) ?? null,
    },
    toDuplicateCandidates(open),
  );
  input.events.push({
    intent: 'create',
    tool: null,
    rule: dup.rule,
    result: dup.match,
    justification: `Duplicity score ${dup.score}`,
  });
  if (dup.match === 'strong' || dup.match === 'multiple' || dup.match === 'ambiguous') {
    assistantText = `Encontrei possível duplicidade (${dup.match}). Candidatos: ${dup.candidates
      .map((c) => c.number)
      .join(', ')}. Confirme se deseja complementar ou criar mesmo assim.`;
  } else {
    const versionLabel = preparedDraft ? preparedDraft.version : '?';
    assistantText =
      priority.priority === 'high' && enrichedSignals.sameDayCommitment === true
        ? `Coloquei prioridade alta por causa do compromisso no mesmo dia. Confira o rascunho versão ${versionLabel} antes de eu criar:`
        : `Preparei o rascunho versão ${versionLabel} com prioridade ${priority.priority}. Confirme para criar.`;
  }

  return { preparedDraft, assistantText, transferRequested };
}

async function handleMutationDraft(
  input: {
    readonly db: AppDatabase;
    readonly tickets: TicketGateway;
    readonly conversationId: string;
    readonly employeeId: string;
    readonly args: Record<string, unknown>;
    readonly events: TurnEvent[];
  },
  action: string,
): Promise<{
  preparedDraft: DraftRow | null;
  assistantText: string | null;
  transferRequested: boolean;
}> {
  const draftPayload: Record<string, unknown> = { ...input.args, action };
  let ticketId =
    typeof draftPayload['ticketId'] === 'string' ? draftPayload['ticketId'] : null;
  const ticketNumber =
    typeof draftPayload['ticketNumber'] === 'string'
      ? draftPayload['ticketNumber']
      : null;

  if (!ticketId && ticketNumber) {
    const owned = await input.tickets.findOwnedByNumberOrId(
      input.employeeId,
      ticketNumber,
    );
    if (owned) {
      ticketId = owned.id;
      draftPayload['ticketId'] = owned.id;
      draftPayload['ticketNumber'] = owned.number;
    }
  } else if (ticketId && !ticketNumber) {
    const owned = await input.tickets.findOwnedByNumberOrId(
      input.employeeId,
      ticketId,
    );
    if (owned) {
      draftPayload['ticketNumber'] = owned.number;
    }
  }

  if (!ticketId) {
    input.events.push({
      intent: action,
      tool: null,
      rule: 'draft.update_needs_ticket',
      result: 'needs_ticket',
      justification: 'Complement/update draft requires a ticket id or number.',
    });
    return {
      preparedDraft: null,
      assistantText:
        'Para acrescentar informação preciso do número do chamado (INC-/REQ-). Qual é?',
      transferRequested: false,
    };
  }

  const description = String(draftPayload['description'] ?? '').trim();
  if (action === 'update' && !description) {
    input.events.push({
      intent: 'update',
      tool: null,
      rule: 'draft.update_needs_description',
      result: 'needs_description',
      justification: 'Complement draft requires the information to append.',
    });
    return {
      preparedDraft: null,
      assistantText: 'Pode me dizer qual informação deseja acrescentar ao chamado?',
      transferRequested: false,
    };
  }

  const preparedDraft = await saveDraft(input.db, input.conversationId, draftPayload);
  const numberLabel =
    typeof draftPayload['ticketNumber'] === 'string'
      ? draftPayload['ticketNumber']
      : 'chamado';
  const versionLabel = preparedDraft ? preparedDraft.version : '?';
  input.events.push({
    intent: action,
    tool: null,
    rule: `draft.${action}_prepared`,
    result: numberLabel,
    justification: `Prepared ${action} draft for ${numberLabel}.`,
  });

  const assistantText =
    action === 'update'
      ? `Preparei o rascunho versão ${versionLabel} para complementar o ${numberLabel}. Confirme para atualizar.`
      : action === 'reopen'
        ? `Preparei o rascunho versão ${versionLabel} para reabrir o ${numberLabel}. Confirme para continuar.`
        : `Preparei o rascunho versão ${versionLabel} para transferir o ${numberLabel}. Confirme para continuar.`;

  return { preparedDraft, assistantText, transferRequested: false };
}
