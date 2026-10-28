import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  createDb,
  createDedicatedSql,
  type AppDatabase,
  type SqlClient,
} from '../db/client';
import { conversationEvents, conversations } from '../db/schema';

export const CONVERSATION_EVENTS_CHANNEL = 'nexo_conversation_events';
export const REPLAY_LIMIT = 500;
export const SUBSCRIBER_BUFFER_SIZE = 256;

export type ConversationEventRecord = {
  id: string;
  conversationId: string;
  seq: number;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type ConversationEventNotify = {
  conversationId: string;
  seq: number;
};

type DbLike = AppDatabase | Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

type LocalSubscriber = {
  id: string;
  conversationId: string | null;
  buffer: ConversationEventRecord[];
  lastPushedSeqByConversation: Map<string, number>;
  push: (event: ConversationEventRecord) => void;
};

@Injectable()
export class ConversationEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConversationEventsService.name);
  private readonly db: AppDatabase;
  private readonly subscribers = new Map<string, LocalSubscriber>();
  private listenSql: SqlClient | null = null;
  private listenUnsub: (() => Promise<void>) | null = null;
  private started = false;

  constructor() {
    this.db = createDb();
  }

  async onModuleInit(): Promise<void> {
    await this.startListening();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopListening();
  }

  /** Test / multi-hub seam: start LISTEN on a dedicated connection. */
  async startListening(sqlClient?: SqlClient): Promise<void> {
    if (this.started && !sqlClient) {
      return;
    }
    const client = sqlClient ?? createDedicatedSql();
    if (!sqlClient) {
      this.listenSql = client;
    }
    const meta = await client.listen(
      CONVERSATION_EVENTS_CHANNEL,
      (payload) => {
        void this.onNotify(payload);
      },
    );
    if (!sqlClient) {
      this.listenUnsub = async () => {
        await meta.unlisten();
      };
      this.started = true;
    } else {
      // External hub: caller owns lifecycle; still route notifies through this instance.
      this.listenUnsub = async () => {
        await meta.unlisten();
        await client.end({ timeout: 5 });
      };
      this.started = true;
    }
  }

  async stopListening(): Promise<void> {
    if (this.listenUnsub) {
      try {
        await this.listenUnsub();
      } catch (err) {
        this.logger.warn(`Failed to stop LISTEN: ${String(err)}`);
      }
      this.listenUnsub = null;
    }
    if (this.listenSql) {
      try {
        await this.listenSql.end({ timeout: 5 });
      } catch {
        // ignore
      }
      this.listenSql = null;
    }
    this.started = false;
  }

  /**
   * Append one durable event under conversation row lock.
   * Must be called inside an open transaction that already holds (or will take) FOR UPDATE.
   */
  async appendInTx(
    tx: DbLike,
    input: {
      conversationId: string;
      type: string;
      payload: Record<string, unknown>;
      version?: number;
    },
  ): Promise<ConversationEventRecord> {
    await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .for('update');

    const [updated] = await tx
      .update(conversations)
      .set({
        lastEventSeq: sql`${conversations.lastEventSeq} + 1`,
      })
      .where(eq(conversations.id, input.conversationId))
      .returning({ lastEventSeq: conversations.lastEventSeq });

    if (!updated) {
      throw new Error(`Conversation ${input.conversationId} not found for event append`);
    }

    const [row] = await tx
      .insert(conversationEvents)
      .values({
        conversationId: input.conversationId,
        seq: updated.lastEventSeq,
        type: input.type,
        version: input.version ?? 1,
        payload: input.payload,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to insert conversation event');
    }

    const notify: ConversationEventNotify = {
      conversationId: row.conversationId,
      seq: row.seq,
    };
    await tx.execute(
      sql`SELECT pg_notify(${CONVERSATION_EVENTS_CHANNEL}, ${JSON.stringify(notify)})`,
    );

    return mapEvent(row);
  }

  /** Append in a fresh transaction (no extra business mutations). */
  async append(input: {
    conversationId: string;
    type: string;
    payload: Record<string, unknown>;
    version?: number;
  }): Promise<ConversationEventRecord> {
    return this.db.transaction(async (tx) => this.appendInTx(tx, input));
  }

  /**
   * Run business mutations and event appends in one transaction.
   * Caller should call appendInTx for each event inside `fn`.
   */
  async withConversationLock<T>(
    conversationId: string,
    fn: (tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .for('update');
      return fn(tx);
    });
  }

  async replay(input: {
    conversationId: string;
    afterSeq: number;
    limit?: number;
  }): Promise<{ events: ConversationEventRecord[]; truncated: boolean }> {
    const limit = input.limit ?? REPLAY_LIMIT;
    const rows = await this.db
      .select()
      .from(conversationEvents)
      .where(
        and(
          eq(conversationEvents.conversationId, input.conversationId),
          gt(conversationEvents.seq, input.afterSeq),
        ),
      )
      .orderBy(asc(conversationEvents.seq))
      .limit(limit);

    return {
      events: rows.map(mapEvent),
      truncated: rows.length === limit,
    };
  }

  async getByPk(
    conversationId: string,
    seq: number,
  ): Promise<ConversationEventRecord | null> {
    const [row] = await this.db
      .select()
      .from(conversationEvents)
      .where(
        and(
          eq(conversationEvents.conversationId, conversationId),
          eq(conversationEvents.seq, seq),
        ),
      );
    return row ? mapEvent(row) : null;
  }

  async getLastEventSeq(conversationId: string): Promise<number> {
    const [row] = await this.db
      .select({ lastEventSeq: conversations.lastEventSeq })
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    return row?.lastEventSeq ?? 0;
  }

  subscribe(input: {
    conversationId: string | null;
    onEvent: (event: ConversationEventRecord) => void;
  }): { id: string; drain: (afterSeq: number) => ConversationEventRecord[]; unsubscribe: () => void } {
    const id = randomUUID();
    const subscriber: LocalSubscriber = {
      id,
      conversationId: input.conversationId,
      buffer: [],
      lastPushedSeqByConversation: new Map(),
      push: (event) => {
        if (
          subscriber.conversationId !== null &&
          event.conversationId !== subscriber.conversationId
        ) {
          return;
        }
        const last = subscriber.lastPushedSeqByConversation.get(event.conversationId) ?? 0;
        if (event.seq <= last) {
          return;
        }
        subscriber.lastPushedSeqByConversation.set(event.conversationId, event.seq);
        subscriber.buffer.push(event);
        if (subscriber.buffer.length > SUBSCRIBER_BUFFER_SIZE) {
          subscriber.buffer.shift();
        }
        input.onEvent(event);
      },
    };
    this.subscribers.set(id, subscriber);

    return {
      id,
      drain: (afterSeq: number) => {
        const pending = subscriber.buffer.filter(
          (event) =>
            (subscriber.conversationId === null ||
              event.conversationId === subscriber.conversationId) &&
            event.seq > afterSeq,
        );
        return pending;
      },
      unsubscribe: () => {
        this.subscribers.delete(id);
      },
    };
  }

  /** Fan-out a locally known event (also used when NOTIFY payload is signal-only). */
  publishLocal(event: ConversationEventRecord): void {
    for (const subscriber of this.subscribers.values()) {
      subscriber.push(event);
    }
  }

  private async onNotify(raw: string): Promise<void> {
    let parsed: ConversationEventNotify;
    try {
      parsed = JSON.parse(raw) as ConversationEventNotify;
    } catch {
      this.logger.warn(`Ignoring invalid NOTIFY payload: ${raw}`);
      return;
    }
    if (!parsed.conversationId || typeof parsed.seq !== 'number') {
      return;
    }
    const event = await this.getByPk(parsed.conversationId, parsed.seq);
    if (!event) {
      // Commit race: retry once shortly.
      await new Promise((resolve) => setTimeout(resolve, 25));
      const retry = await this.getByPk(parsed.conversationId, parsed.seq);
      if (!retry) {
        return;
      }
      this.publishLocal(retry);
      return;
    }
    this.publishLocal(event);
  }
}

function mapEvent(row: typeof conversationEvents.$inferSelect): ConversationEventRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    seq: row.seq,
    type: row.type,
    version: row.version,
    payload: row.payload,
    createdAt: row.createdAt,
  };
}
