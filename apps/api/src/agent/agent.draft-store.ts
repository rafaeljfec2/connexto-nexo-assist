import { UnprocessableEntityException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { drafts, operations } from '../db/schema';
import type { PolicyEngine } from './policy.engine';
import type { TicketGateway } from '../tickets/ticket.gateway';
import { evaluateConfirmation } from '@nexo-assist/domain';
import { randomUUID } from 'node:crypto';
import { executionEvents } from '../db/schema';

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
    return { ok: true as const, mutation };
  }
  if (decision.kind === 'reject') {
    await db.update(drafts).set({ status: 'rejected' }).where(eq(drafts.id, draft.id));
    return { ok: true as const, mutation: null };
  }
  throw new UnprocessableEntityException(
    'reason' in decision ? decision.reason : 'Confirmação inválida.',
  );
}
