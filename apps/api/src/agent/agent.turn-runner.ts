import { Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  isTicketOverdue,
  MEDIUM_SLA_BUSINESS_DAYS,
} from '@nexo-assist/domain';
import type { AppDatabase } from '../db/client';
import { conversations, messages } from '../db/schema';
import {
  MAX_CONTEXT_MESSAGES,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
  PROVIDER_TIMEOUT_MS,
} from '../conversations/usage.guard';
import type { TicketGateway } from '../tickets/ticket.gateway';
import type { PolicyEngine } from './policy.engine';
import {
  ScriptedLlmProvider,
  type LlmMessage,
  type LlmProvider,
} from './llm.provider';
import {
  requestsAnalystTransfer,
  TRANSFER_CONFIRMATION_TEXT,
} from './transfer-intent';
import { getPendingDraft, handlePrepareDraft, type DraftRow } from './agent.draft-store';
import {
  AGENT_TOOLS,
  asTicketInspectResult,
  buildConsultaDetailReply,
  resolveListOnlyAssistantText,
  runAgentTool,
} from './agent.tools';
import { NEXO_ASSIST_INSTRUCTIONS, runMastraTurn } from './mastra';
import {
  tryHandleComplementStart,
  tryHandleDraftConfirmation,
  tryHandleImpactAnswer,
} from './agent.turn-confirm';
import type { FailExecution, PersistAgentOutcome, TurnEvent } from './agent.types';

export type { TurnEvent, PersistAgentOutcome, FailExecution } from './agent.types';

const logger = new Logger('AgentTurnRunner');

async function runScriptedTurn(input: {
  readonly db: AppDatabase;
  readonly provider: LlmProvider;
  readonly tickets: TicketGateway;
  readonly policy: PolicyEngine;
  readonly conversationId: string;
  readonly employeeId: string;
  readonly llmMessages: LlmMessage[];
  readonly pendingDraft: DraftRow | null;
  readonly events: TurnEvent[];
}): Promise<{
  assistantText: string;
  preparedDraft: DraftRow | null;
  transferRequested: boolean;
}> {
  let assistantText = '';
  let preparedDraft: DraftRow | null = input.pendingDraft;
  let listedOpenCount: number | null = null;
  const seenToolKeys = new Set<string>();
  let steps = 0;
  let transferRequested = false;
  let intent: string | null = null;
  const llmMessages = [...input.llmMessages];

  while (true) {
    steps += 1;
    if (steps > MAX_TOOL_STEPS) {
      input.events.push({
        intent,
        tool: null,
        rule: 'usage.max_tool_steps',
        result: 'stopped',
        justification: 'Fifth tool step is not allowed; execution stopped.',
      });
      assistantText =
        assistantText ||
        'Alcancei o limite de passos desta resposta. Resuma o que falta e eu continuo.';
      break;
    }

    const step = await input.provider.complete({
      messages: llmMessages,
      tools: AGENT_TOOLS,
      maxTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });

    if (step.toolCalls.length === 0) {
      assistantText = step.content ?? 'Como posso ajudar?';
      break;
    }

    for (const call of step.toolCalls) {
      const key = `${call.name}:${JSON.stringify(call.arguments)}`;
      if (seenToolKeys.has(key)) {
        input.events.push({
          intent,
          tool: call.name,
          rule: 'usage.duplicate_tool_call',
          result: 'skipped',
          justification: 'Same tool with same arguments already ran in this turn.',
        });
        continue;
      }
      seenToolKeys.add(key);

      const toolResult = await runAgentTool(
        input.db,
        input.tickets,
        call.name,
        call.arguments,
        input.employeeId,
      );

      if (call.name === 'get_ticket') {
        const inspected = asTicketInspectResult(toolResult);
        input.events.push({
          intent: 'consult',
          tool: call.name,
          rule: null,
          result: inspected?.number ?? 'not_found',
          justification: inspected
            ? `Inspected ticket ${inspected.number}`
            : 'Ticket not found for this employee',
        });
        if (inspected) {
          input.events.push({
            intent: 'consult',
            tool: null,
            rule: 'ticket.inspect',
            result: inspected.number,
            justification: `Selected ticket ${inspected.number} detail loaded.`,
          });
          const overdue = isTicketOverdue({
            dueAt: new Date(inspected.dueAt),
            status: inspected.status,
          });
          input.events.push({
            intent: 'consult',
            tool: null,
            rule: 'sla.compute_due',
            result: overdue ? 'overdue' : inspected.dueAt,
            justification: overdue
              ? `Deadline passed. Medium SLA is ${MEDIUM_SLA_BUSINESS_DAYS} business days (Annex A).`
              : `Due date evaluated for priority ${inspected.priority}.`,
          });
          if (!assistantText) {
            assistantText = buildConsultaDetailReply(inspected, overdue);
          }
        }
      } else {
        if (call.name === 'list_my_tickets') {
          listedOpenCount = Array.isArray(toolResult) ? toolResult.length : 0;
        }
        input.events.push({
          intent,
          tool: call.name,
          rule: null,
          result: 'ok',
          justification: `Executed ${call.name}`,
        });
      }

      if (call.name === 'prepare_draft') {
        const outcome = await handlePrepareDraft({
          db: input.db,
          policy: input.policy,
          tickets: input.tickets,
          conversationId: input.conversationId,
          employeeId: input.employeeId,
          args: call.arguments,
          events: input.events,
        });
        preparedDraft = outcome.preparedDraft;
        if (outcome.assistantText) {
          assistantText = outcome.assistantText;
        }
        if (outcome.transferRequested) {
          transferRequested = true;
          intent = 'critical';
        }
      }

      llmMessages.push({ role: 'assistant', content: step.content ?? '' });
      llmMessages.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(toolResult),
      });
    }
  }

  const lastUser = [...llmMessages].reverse().find((m) => m.role === 'user');
  return {
    assistantText: resolveListOnlyAssistantText({
      events: input.events,
      listedOpenCount,
      fallback: assistantText || 'Como posso ajudar?',
      userContent: lastUser?.content,
    }),
    preparedDraft,
    transferRequested,
  };
}

export async function runAgentTurn(input: {
  readonly db: AppDatabase;
  readonly provider: LlmProvider | null;
  readonly tickets: TicketGateway;
  readonly policy: PolicyEngine;
  readonly conversationId: string;
  readonly employeeId: string;
  readonly content: string;
  readonly executionId: string;
  readonly persistAgentOutcome: PersistAgentOutcome;
  readonly failExecution: FailExecution;
}): Promise<void> {
  const [conversation] = await input.db
    .select()
    .from(conversations)
    .where(eq(conversations.id, input.conversationId));
  if (!conversation) {
    return;
  }

  const events: TurnEvent[] = [];
  let transferToWaiting = false;

  try {
    if (!input.provider) {
      await input.failExecution({
        conversationId: input.conversationId,
        executionId: input.executionId,
        reason: 'provider_unavailable',
        agentContent: 'O modelo de IA ficou indisponível durante o atendimento.',
      });
      return;
    }

    const pendingDraft = await getPendingDraft(input.db, conversation.id);
    const handledConfirm = await tryHandleDraftConfirmation({
      db: input.db,
      tickets: input.tickets,
      policy: input.policy,
      conversationId: input.conversationId,
      employeeId: input.employeeId,
      content: input.content,
      executionId: input.executionId,
      pendingDraft,
      persistAgentOutcome: input.persistAgentOutcome,
      failExecution: input.failExecution,
    });
    if (handledConfirm) {
      return;
    }

    const handledComplement = await tryHandleComplementStart({
      content: input.content,
      conversationId: input.conversationId,
      executionId: input.executionId,
      pendingDraft,
      persistAgentOutcome: input.persistAgentOutcome,
    });
    if (handledComplement) {
      return;
    }

    const history = await input.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(MAX_CONTEXT_MESSAGES);

    const handledImpact = await tryHandleImpactAnswer({
      db: input.db,
      tickets: input.tickets,
      policy: input.policy,
      conversationId: input.conversationId,
      employeeId: input.employeeId,
      content: input.content,
      executionId: input.executionId,
      pendingDraft,
      recentMessages: history,
      persistAgentOutcome: input.persistAgentOutcome,
    });
    if (handledImpact) {
      return;
    }

    const llmMessages: LlmMessage[] = [
      { role: 'system', content: NEXO_ASSIST_INSTRUCTIONS },
      ...history.reverse().map((m) => ({
        role:
          m.role === 'employee'
            ? ('user' as const)
            : m.role === 'agent'
              ? ('assistant' as const)
              : ('user' as const),
        content: m.content,
      })),
    ];

    if (pendingDraft) {
      llmMessages.splice(1, 0, {
        role: 'system',
        content: `Pending draft v${pendingDraft.version}: ${JSON.stringify(pendingDraft.payload)}`,
      });
    }

    const useScripted =
      input.provider instanceof ScriptedLlmProvider ||
      (process.env.LLM_PROVIDER ?? '').toLowerCase() === 'scripted';

    const loopResult = useScripted
      ? await runScriptedTurn({
          db: input.db,
          provider: input.provider,
          tickets: input.tickets,
          policy: input.policy,
          conversationId: conversation.id,
          employeeId: input.employeeId,
          llmMessages,
          pendingDraft,
          events,
        })
      : await runMastraTurn({
          db: input.db,
          tickets: input.tickets,
          policy: input.policy,
          conversationId: conversation.id,
          employeeId: input.employeeId,
          llmMessages,
          pendingDraft,
          events,
        });

    let assistantText = loopResult.assistantText;
    const preparedDraft = loopResult.preparedDraft;
    const transferRequested = loopResult.transferRequested;

    const employeeAskedTransfer = requestsAnalystTransfer(input.content);
    if (employeeAskedTransfer || transferRequested) {
      transferToWaiting = true;
      events.push({
        intent: transferRequested && !employeeAskedTransfer ? 'critical' : 'talk_to_analyst',
        tool: null,
        rule: 'transfer.conversation',
        result: 'waiting_analyst',
        justification: 'Conversation transferred to analyst queue.',
      });
      // Always overwrite LLM text — models must not invent "I cannot transfer".
      assistantText = employeeAskedTransfer
        ? TRANSFER_CONFIRMATION_TEXT
        : assistantText ||
          'Transferi você para a fila de analistas. O agente fica pausado até o atendimento humano.';
    }

    await input.persistAgentOutcome({
      conversationId: input.conversationId,
      executionId: input.executionId,
      agentContent: assistantText,
      events,
      draft: preparedDraft,
      status: transferToWaiting ? 'waiting_analyst' : 'with_agent',
      summary: transferToWaiting ? input.content.slice(0, 280) : null,
    });
  } catch (err) {
    logger.error(`Execution ${input.executionId} failed: ${String(err)}`);
    await input.failExecution({
      conversationId: input.conversationId,
      executionId: input.executionId,
      reason: 'execution_error',
      agentContent: null,
    });
  }
}
