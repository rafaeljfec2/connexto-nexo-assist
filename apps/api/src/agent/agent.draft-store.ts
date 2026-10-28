import { UnprocessableEntityException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { computeDueAt, evaluateConfirmation } from '@nexo-assist/domain';
import type { TicketPriority } from '@nexo-assist/contracts';
import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/client';
import { drafts, executionEvents, operations } from '../db/schema';
import { logDraftConfirm } from '../observability/agent-trace.log';
import type { PolicyEngine } from './policy.engine';
import { toDuplicateCandidates } from './policy.engine';
import type { TicketGateway } from '../tickets/ticket.gateway';
import type { TurnEvent } from './agent.types';

export type DraftRow = typeof drafts.$inferSelect;

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
    const priority = policy.decidePriorityFromDraft(draft.payload);
    if (!priority.priority) {
      throw new UnprocessableEntityException('Priority still needs clarification.');
    }
    mutation = await tickets.create({
      employeeId,
      type: (draft.payload['type'] as 'incident' | 'request') ?? 'incident',
      category: (draft.payload['category'] as never) ?? 'other',
      title: String(draft.payload['title'] ?? 'Chamado'),
      description: String(draft.payload['description'] ?? ''),
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

  const decision = evaluateConfirmation({
    draft: { id: draft.id, version: draft.version, status: 'pending' },
    draftId: input.draftId,
    version: input.version,
    confirm: input.confirm,
  });

  const executionId = randomUUID();
  if (decision.kind === 'confirm') {
    const mutation = await applyDraft(db, tickets, policy, draft, input.employeeId, executionId);
    await db.insert(executionEvents).values({
      conversationId: input.conversationId,
      executionId,
      intent: String(draft.action),
      tool: null,
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
  const priority = input.policy.decidePriorityFromDraft(input.args);
  const draftPayload: Record<string, unknown> = { ...input.args };
  if (priority.priority) {
    const dueAt = computeDueAt(priority.priority as TicketPriority, new Date());
    draftPayload['priority'] = priority.priority;
    draftPayload['dueAt'] = dueAt.toISOString();
  }
  const preparedDraft = await saveDraft(input.db, input.conversationId, draftPayload);
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
  } else {
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
      assistantText = `Preparei o rascunho versão ${versionLabel} com prioridade ${priority.priority}. Confirme para criar.`;
    }
  }

  return { preparedDraft, assistantText, transferRequested };
}
