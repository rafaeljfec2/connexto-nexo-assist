import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversations } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { ConsoleService } from '../src/console/console.service';
import { setupIntegrationDb } from './helpers/db';

async function ensureAnaWaitingConversation(): Promise<void> {
  const db = createDb();
  await db
    .insert(conversations)
    .values({
      id: IDS.convAna,
      employeeId: IDS.ana,
      status: 'waiting_analyst',
      analystId: null,
      employeeMessageCount: 4,
      summary: 'Está parado há 5 dias. Quero falar com um analista. · INC-20311',
    })
    .onConflictDoUpdate({
      target: conversations.id,
      set: {
        status: 'waiting_analyst',
        analystId: null,
        summary: 'Está parado há 5 dias. Quero falar com um analista. · INC-20311',
        updatedAt: new Date(),
      },
    });
}

describe('API integration — console claim and return', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('claims a conversation exclusively', async () => {
    const db = createDb();
    const consoleService = new ConsoleService();
    const [waiting] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, IDS.convWaiting));
    expect(waiting?.status).toBe('waiting_analyst');

    await consoleService.claim(IDS.convWaiting, IDS.rafael);
    await expect(consoleService.claim(IDS.convWaiting, IDS.bruno)).rejects.toThrow(/claimed/i);
  });

  it('returns a waiting conversation to the agent without claim', async () => {
    await ensureAnaWaitingConversation();
    const db = createDb();
    const consoleService = new ConsoleService();
    const before = await consoleService.getConversation(IDS.convAna);
    expect(before.conversation.status).toBe('waiting_analyst');
    expect(before.tickets.some((ticket) => ticket.number === 'INC-20311' && ticket.lastHistory)).toBe(
      true,
    );

    const returned = await consoleService.returnToAgent(IDS.convAna, IDS.rafael);
    expect(returned.conversation.status).toBe('with_agent');
    expect(
      returned.messages.some(
        (msg) => msg.role === 'system' && msg.content === 'Atendimento devolvido ao agente.',
      ),
    ).toBe(true);

    await db
      .update(conversations)
      .set({ status: 'waiting_analyst', analystId: null, updatedAt: new Date() })
      .where(eq(conversations.id, IDS.convAna));
  });

  it('claim vs return from waiting does not insert a false return system message', async () => {
    await ensureAnaWaitingConversation();
    const db = createDb();
    const consoleService = new ConsoleService();
    await db
      .update(conversations)
      .set({ status: 'waiting_analyst', analystId: null, updatedAt: new Date() })
      .where(eq(conversations.id, IDS.convAna));

    const before = await consoleService.getConversation(IDS.convAna);
    const beforeReturnMsgs = before.messages.filter(
      (msg) => msg.content === 'Atendimento devolvido ao agente.',
    ).length;

    await Promise.allSettled([
      consoleService.claim(IDS.convAna, IDS.rafael),
      consoleService.returnToAgent(IDS.convAna, IDS.bruno),
    ]);

    const after = await consoleService.getConversation(IDS.convAna);
    const afterReturnMsgs = after.messages.filter(
      (msg) => msg.content === 'Atendimento devolvido ao agente.',
    ).length;

    if (after.conversation.status === 'with_analyst') {
      expect(afterReturnMsgs).toBe(beforeReturnMsgs);
      expect(after.conversation.analystId).toBe(IDS.rafael);
    } else if (after.conversation.status === 'with_agent') {
      expect(afterReturnMsgs).toBe(beforeReturnMsgs + 1);
      expect(after.conversation.analystId).toBeNull();
    } else {
      throw new Error(`Unexpected status after race: ${after.conversation.status}`);
    }

    await db
      .update(conversations)
      .set({ status: 'waiting_analyst', analystId: null, updatedAt: new Date() })
      .where(eq(conversations.id, IDS.convAna));
  });
});
