import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, createDb, createDedicatedSql } from '../src/db/client';
import { conversations } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import { ConversationEventsService } from '../src/events/conversation-events.service';
import { setupIntegrationDb } from './helpers/db';
import { waitFor } from './helpers/wait-for';

describe('SSE / conversation events — NOTIFY fan-out', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('two LISTEN hubs both receive NOTIFY (level B)', async () => {
    const hubA = new ConversationEventsService();
    const hubB = new ConversationEventsService();
    await hubA.startListening();
    await hubB.startListening(createDedicatedSql());

    const db = createDb();
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const receivedA: number[] = [];
    const receivedB: number[] = [];
    const subA = hubA.subscribe({
      conversationId: conv!.id,
      onEvent: (e) => receivedA.push(e.seq),
    });
    const subB = hubB.subscribe({
      conversationId: conv!.id,
      onEvent: (e) => receivedB.push(e.seq),
    });

    await hubA.append({
      conversationId: conv!.id,
      type: 'message.created',
      payload: { hello: true },
    });

    await waitFor(() => receivedA.includes(1) && receivedB.includes(1));
    expect(receivedA).toContain(1);
    expect(receivedB).toContain(1);

    subA.unsubscribe();
    subB.unsubscribe();
    await hubA.stopListening();
    await hubB.stopListening();
  });
});
