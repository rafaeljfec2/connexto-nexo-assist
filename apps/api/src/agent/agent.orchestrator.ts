import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { createDb, type AppDatabase } from '../db/client';
import { conversations, messages } from '../db/schema';
import { ConversationEventsService } from '../events/conversation-events.service';
import { TicketGateway } from '../tickets/ticket.gateway';
import { UsageGuard } from '../conversations/usage.guard';
import { PolicyEngine } from './policy.engine';
import { createLlmProvider, type LlmProvider } from './llm.provider';
import { AGENT_INCOMPLETE_GRACE_MS, AGENT_LEASE_MS } from './agent.lease';
import {
  acceptAgentMessage,
  acceptHumanMessage,
  type AcceptMessageResult,
} from './agent.accept';
import { logTurnStarted } from '../observability/agent-trace.log';
import { confirmDraftAction, type DraftRow } from './agent.draft-store';
import { failExecution, persistAgentOutcome } from './agent.persist';
import { runAgentTurn } from './agent.turn-runner';
import type { TurnEvent } from './agent.types';

export { AGENT_LEASE_MS } from './agent.lease';
export type { AcceptMessageResult } from './agent.accept';

@Injectable()
export class AgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);
  private provider: LlmProvider | null;
  private readonly db: AppDatabase;
  private readonly pendingRuns = new Map<string, Promise<void>>();
  private events: ConversationEventsService;

  constructor(
    @Inject(TicketGateway) private readonly tickets: TicketGateway,
    @Inject(PolicyEngine) private readonly policy: PolicyEngine,
    @Inject(UsageGuard) private readonly usage: UsageGuard,
    @Optional() @Inject(ConversationEventsService) events?: ConversationEventsService,
  ) {
    this.db = createDb();
    this.provider = createLlmProvider();
    this.events = events ?? new ConversationEventsService();
  }

  setProvider(provider: LlmProvider | null): void {
    this.provider = provider;
  }

  getProvider(): LlmProvider | null {
    return this.provider;
  }

  hasPendingExecution(executionId: string): boolean {
    return this.pendingRuns.has(executionId);
  }

  async awaitExecution(executionId: string): Promise<void> {
    const pending = this.pendingRuns.get(executionId);
    if (pending) {
      await pending;
    }
  }

  /** Test seam for F5 incomplete vs in-flight ownership. */
  async signalIncompleteForTests(
    conversationId: string,
    executionId: string,
  ): Promise<void> {
    await this.signalIncompleteIfNeeded(conversationId, executionId);
  }

  async handleEmployeeMessage(input: {
    readonly employeeId: string;
    readonly conversationId: string;
    readonly content: string;
    readonly clientMessageId?: string;
  }): Promise<AcceptMessageResult> {
    this.usage.assertMessageSize(input.content);

    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId));

    if (!conversation || conversation.employeeId !== input.employeeId) {
      throw new UnprocessableEntityException('Conversa inválida.');
    }
    if (conversation.status === 'closed') {
      throw new UnprocessableEntityException('Esta conversa está encerrada.');
    }
    if (conversation.status === 'waiting_analyst') {
      throw new UnprocessableEntityException(
        'O agente está pausado nesta conversa. Aguarde um analista ou o encerramento.',
      );
    }

    this.usage.assertEmployeeMessageLimit(conversation.employeeMessageCount);

    if (input.clientMessageId) {
      const idempotent = await this.findIdempotentAccept(
        conversation.id,
        input.clientMessageId,
        conversation.employeeMessageCount,
        conversation.status,
      );
      if (idempotent) {
        return idempotent;
      }
    }

    if (conversation.status === 'with_analyst') {
      return acceptHumanMessage({
        events: this.events,
        conversation,
        content: input.content,
        clientMessageId: input.clientMessageId ?? null,
      });
    }

    if (!this.provider) {
      throw new ServiceUnavailableException(
        'O modelo de IA está indisponível. Configure OPENAI_API_KEY ou LLM_PROVIDER=scripted.',
      );
    }

    try {
      const accepted = await acceptAgentMessage({
        events: this.events,
        conversation,
        content: input.content,
        clientMessageId: input.clientMessageId ?? null,
      });
      logTurnStarted({
        conversationId: conversation.id,
        executionId: accepted.executionId,
        employeeId: conversation.employeeId,
        contentPreview: input.content,
      });
      this.scheduleExecution({
        conversationId: conversation.id,
        employeeId: conversation.employeeId,
        content: input.content,
        executionId: accepted.executionId,
      });
      return accepted;
    } catch (err) {
      if (err instanceof ConflictException || err instanceof UnprocessableEntityException) {
        throw err;
      }
      if (input.clientMessageId && isUniqueViolation(err)) {
        return this.handleEmployeeMessage({
          employeeId: input.employeeId,
          conversationId: input.conversationId,
          content: input.content,
          clientMessageId: input.clientMessageId,
        });
      }
      throw err;
    }
  }

  async confirmDraft(input: {
    readonly employeeId: string;
    readonly conversationId: string;
    readonly draftId: string;
    readonly version: number;
    readonly confirm: boolean;
  }) {
    return confirmDraftAction(this.db, this.tickets, this.policy, this.events, input);
  }

  async persistAgentOutcome(input: {
    readonly conversationId: string;
    readonly executionId: string;
    readonly agentContent: string;
    readonly events: TurnEvent[];
    readonly draft: DraftRow | null;
    readonly status: string;
    readonly summary: string | null;
  }) {
    return persistAgentOutcome(this.events, input);
  }

  private scheduleExecution(input: {
    readonly conversationId: string;
    readonly employeeId: string;
    readonly content: string;
    readonly executionId: string;
  }): void {
    const runPromise = runAgentTurn({
      db: this.db,
      provider: this.provider,
      tickets: this.tickets,
      policy: this.policy,
      conversationId: input.conversationId,
      employeeId: input.employeeId,
      content: input.content,
      executionId: input.executionId,
      persistAgentOutcome: (payload) => this.persistAgentOutcome(payload),
      failExecution: (payload) => failExecution(this.events, payload),
    });
    this.pendingRuns.set(input.executionId, runPromise);
    setImmediate(() => {
      void runPromise.finally(() => {
        this.pendingRuns.delete(input.executionId);
      });
    });
    setTimeout(() => {
      void this.signalIncompleteIfNeeded(input.conversationId, input.executionId);
    }, AGENT_LEASE_MS + AGENT_INCOMPLETE_GRACE_MS);
  }

  private async findIdempotentAccept(
    conversationId: string,
    clientMessageId: string,
    fallbackCount: number,
    fallbackStatus: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.clientMessageId, clientMessageId),
        ),
      );
    if (!existing) {
      return null;
    }
    const [fresh] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    return {
      accepted: true as const,
      executionId: fresh?.activeExecutionId ?? null,
      clientMessageId,
      employeeMessage: existing,
      employeeMessageCount: fresh?.employeeMessageCount ?? fallbackCount,
      conversationStatus: fresh?.status ?? fallbackStatus,
    };
  }

  private async signalIncompleteIfNeeded(
    conversationId: string,
    executionId: string,
  ): Promise<void> {
    if (this.pendingRuns.has(executionId)) {
      return;
    }
    try {
      await this.events.withConversationLock(conversationId, async (tx) => {
        const [locked] = await tx
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .for('update');
        if (!locked || locked.activeExecutionId !== executionId) {
          return;
        }
        if (this.pendingRuns.has(executionId)) {
          return;
        }
        const now = new Date();
        if (locked.busyUntil && locked.busyUntil.getTime() > now.getTime()) {
          return;
        }
        await tx
          .update(conversations)
          .set({
            activeExecutionId: null,
            busyUntil: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.activeExecutionId, executionId),
            ),
          );
        await this.events.appendInTx(tx, {
          conversationId,
          type: 'agent.incomplete',
          payload: { executionId, reason: 'lease_expired' },
        });
      });
    } catch (err) {
      this.logger.warn(`Incomplete signal failed: ${String(err)}`);
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const code = (err as { code?: string }).code;
  if (code === '23505') {
    return true;
  }
  const message = String((err as { message?: string }).message ?? err);
  return /unique|duplicate/i.test(message);
}
