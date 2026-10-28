import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversations } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { AgentOrchestrator } from '../src/agent/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy.engine';
import { ScriptedLlmProvider } from '../src/agent/llm.provider';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { UsageGuard, MAX_EMPLOYEE_MESSAGES } from '../src/conversations/usage.guard';
import { setupIntegrationDb } from './helpers/db';

describe('API integration — usage and concurrency guards', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('rejects the 31st employee message without calling the model', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);

    const [conv] = await db
      .insert(conversations)
      .values({
        employeeId: IDS.ana,
        status: 'with_agent',
        employeeMessageCount: MAX_EMPLOYEE_MESSAGES,
      })
      .returning();

    await expect(
      orchestrator.handleEmployeeMessage({
        employeeId: IDS.ana,
        conversationId: conv!.id,
        content: 'ainda mais uma',
      }),
    ).rejects.toThrow(/30/);
    expect(provider.callCount).toBe(0);
  });

  it('rejects messages over 4000 characters', () => {
    const usage = new UsageGuard();
    expect(() => usage.assertMessageSize('x'.repeat(4001))).toThrow();
  });

  it('rejects a second concurrent agent execution on the same conversation', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const [conv] = await db
      .insert(conversations)
      .values({
        employeeId: IDS.ana,
        status: 'with_agent',
        employeeMessageCount: 0,
        busyUntil: new Date(Date.now() + 60_000),
      })
      .returning();

    await expect(
      orchestrator.handleEmployeeMessage({
        employeeId: IDS.ana,
        conversationId: conv!.id,
        content: 'VPN erro 809',
      }),
    ).rejects.toThrow(/execução/i);
    expect(provider.callCount).toBe(0);
  });
});
