import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversationEvents, conversations } from '../src/db/schema';
import { IDS } from '../src/db/seed';
import {
  ConversationEventsService,
  type ConversationEventRecord,
} from '../src/events/conversation-events.service';
import { setupIntegrationDb } from './helpers/db';
import { waitFor } from './helpers/wait-for';

describe('SSE / conversation events — ordering and replay', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('serializes concurrent writers: commit order equals seq order', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const writer = async (label: string) => {
      await events.withConversationLock(conv!.id, async (tx) => {
        await new Promise((r) => setTimeout(r, label === 'A' ? 40 : 5));
        await events.appendInTx(tx, {
          conversationId: conv!.id,
          type: 'message.created',
          payload: { label },
        });
      });
    };

    await Promise.all([writer('A'), writer('B')]);

    const rows = await db
      .select()
      .from(conversationEvents)
      .where(eq(conversationEvents.conversationId, conv!.id))
      .orderBy(asc(conversationEvents.seq));

    expect(rows.map((r) => r.seq)).toEqual([1, 2]);
    expect(rows.map((r) => r.payload['label']).sort()).toEqual(['A', 'B']);
    expect(rows).toHaveLength(2);
  });

  it('buffers NOTIFY that arrives during replay window (gap buffer + dedupe)', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    await events.startListening();
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    await events.append({
      conversationId: conv!.id,
      type: 'message.created',
      payload: { n: 1 },
    });

    const received: ConversationEventRecord[] = [];
    const sub = events.subscribe({
      conversationId: conv!.id,
      onEvent: (event) => {
        received.push(event);
      },
    });

    const live = events.append({
      conversationId: conv!.id,
      type: 'message.created',
      payload: { n: 2 },
    });

    const { events: replayed } = await events.replay({
      conversationId: conv!.id,
      afterSeq: 0,
    });
    await live;
    await waitFor(() => received.some((e) => e.seq === 2));

    const seen = new Set<number>();
    const merged: ConversationEventRecord[] = [];
    for (const event of [...replayed, ...sub.drain(0), ...received]) {
      if (seen.has(event.seq)) {
        continue;
      }
      seen.add(event.seq);
      merged.push(event);
    }
    expect(merged.map((e) => e.seq).sort((a, b) => a - b)).toEqual([1, 2]);
    sub.unsubscribe();
    await events.stopListening();
  });

  it('reconnect replay recovers events when NOTIFY was lost', async () => {
    const db = createDb();
    const events = new ConversationEventsService();
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    await events.append({
      conversationId: conv!.id,
      type: 'agent.started',
      payload: { executionId: randomUUID() },
    });
    await events.append({
      conversationId: conv!.id,
      type: 'agent.completed',
      payload: { executionId: randomUUID() },
    });

    const { events: replayed } = await events.replay({
      conversationId: conv!.id,
      afterSeq: 0,
    });
    expect(replayed.map((e) => e.seq)).toEqual([1, 2]);
    expect(replayed.map((e) => e.type)).toEqual(['agent.started', 'agent.completed']);
  });
});
