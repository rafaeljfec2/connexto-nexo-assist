import { and, desc, eq } from 'drizzle-orm';
import type { AgentOrchestrator } from '../../src/agent/orchestrator/agent.orchestrator';
import { createDb } from '../../src/db/client';
import { drafts, executionEvents, messages } from '../../src/db/schema';

export async function completeTurn(
  orchestrator: AgentOrchestrator,
  input: {
    employeeId: string;
    conversationId: string;
    content: string;
    clientMessageId?: string;
  },
) {
  const accept = await orchestrator.handleEmployeeMessage(input);
  if (accept.executionId) {
    await orchestrator.awaitExecution(accept.executionId);
  }
  const db = createDb();
  const events = accept.executionId
    ? await db
        .select()
        .from(executionEvents)
        .where(eq(executionEvents.executionId, accept.executionId))
    : [];
  const [agentMessage] = accept.executionId
    ? await db
        .select()
        .from(messages)
        .where(
          and(eq(messages.conversationId, input.conversationId), eq(messages.role, 'agent')),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1)
    : [null];
  const [draft] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.conversationId, input.conversationId), eq(drafts.status, 'pending')))
    .orderBy(desc(drafts.createdAt))
    .limit(1);
  return {
    ...accept,
    events,
    agentMessage: agentMessage ?? null,
    draft: draft ?? null,
  };
}
