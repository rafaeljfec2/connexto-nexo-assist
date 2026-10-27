import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { createDb, closeDb, resetDbCache } from '../src/db/client';
import { runSeed, IDS } from '../src/db/seed';
import { tickets, conversations } from '../src/db/schema';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { AuthService } from '../src/auth/auth.service';
import { UsageGuard, MAX_EMPLOYEE_MESSAGES } from '../src/conversations/usage.guard';
import { AgentOrchestrator } from '../src/agent/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy.engine';
import { ScriptedLlmProvider } from '../src/agent/llm.provider';
import { ConsoleService } from '../src/console/console.service';
import { ConversationsService } from '../src/conversations/conversations.service';
import { drafts } from '../src/db/schema';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://nexo:nexo@localhost:5432/nexo';

async function migrate(): Promise<void> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  // Reset for deterministic tests
  await sql.unsafe(`
    DROP TABLE IF EXISTS execution_events CASCADE;
    DROP TABLE IF EXISTS drafts CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS conversations CASCADE;
    DROP TABLE IF EXISTS ticket_history CASCADE;
    DROP TABLE IF EXISTS tickets CASCADE;
    DROP TABLE IF EXISTS help_articles CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS operations CASCADE;
    DROP TABLE IF EXISTS seed_meta CASCADE;
    DROP TABLE IF EXISTS __drizzle_migrations CASCADE;
  `);
  const dir = join(__dirname, '../src/db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await sql.unsafe(readFileSync(join(dir, file), 'utf8'));
  }
  await sql.end({ timeout: 5 });
}

describe('API integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    process.env.LLM_PROVIDER = 'scripted';
    process.env.TICKET_FAULT = 'off';
    resetDbCache();
    await migrate();
    resetDbCache();
    await runSeed(new Date('2026-10-27T15:00:00.000Z'));
  });

  afterAll(async () => {
    await closeDb();
  });

  it('keeps INC-20150 private from Ana', async () => {
    const gateway = TicketGateway.withDb(createDb());
    const owned = await gateway.listOwned(IDS.ana);
    expect(owned.some((t) => t.number === 'INC-20150')).toBe(false);
    await expect(gateway.getOwned(IDS.inc20150, IDS.ana)).rejects.toThrow();
  });

  it('creates tickets idempotently by operationId', async () => {
    const gateway = TicketGateway.withDb(createDb());
    const first = await gateway.create({
      employeeId: IDS.ana,
      type: 'incident',
      category: 'software',
      title: 'Idempotent',
      description: 'test',
      errorCode: null,
      priority: 'low',
      operationId: 'op-idem-1',
    });
    const second = await gateway.create({
      employeeId: IDS.ana,
      type: 'incident',
      category: 'software',
      title: 'Idempotent',
      description: 'test',
      errorCode: null,
      priority: 'low',
      operationId: 'op-idem-1',
    });
    expect(second).toEqual(first);
  });

  it('searches help articles for VPN 809', async () => {
    const db = createDb();
    const { helpArticles } = await import('../src/db/schema');
    const articles = await db.select().from(helpArticles);
    const hit = articles.find((a) => a.errorCodes.includes('809'));
    expect(hit?.slug).toBe('vpn-erro-809');
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

  it('scripted agent can list tickets and expose overdue INC-20311', async () => {
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
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const result = await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Qual o status do meu chamado INC-20311?',
    });
    expect(provider.callCount).toBeGreaterThan(0);
    expect(result.events.some((e) => e.tool === 'list_my_tickets')).toBe(true);
  });

  it('accepts demo login for Ana with any non-empty password', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('ana.souza@nexo.com.br', 'qualquer', false);
    expect(session.user.role).toBe('employee');
    await expect(auth.login('ana.souza@nexo.com.br', '', false)).rejects.toThrow();
    await expect(auth.login('unknown@nexo.com.br', 'x', false)).rejects.toThrow();
  });

  it('does not auto-reply when conversation waits for analyst', async () => {
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
        status: 'waiting_analyst',
        employeeMessageCount: 1,
      })
      .returning();
    await expect(
      orchestrator.handleEmployeeMessage({
        employeeId: IDS.ana,
        conversationId: conv!.id,
        content: 'oi',
      }),
    ).rejects.toThrow(/pausado/i);
    expect(provider.callCount).toBe(0);
  });

  it('does not create a fresh with_agent conversation while paused', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const service = new ConversationsService(orchestrator, new UsageGuard());

    const [paused] = await db
      .insert(conversations)
      .values({
        employeeId: IDS.bruno,
        status: 'waiting_analyst',
        employeeMessageCount: 12,
        summary: 'Paused for analyst',
      })
      .returning();

    const current = await service.getOrCreateCurrent(IDS.bruno);
    expect(current.conversation?.id).toBe(paused!.id);
    expect(current.conversation?.status).toBe('waiting_analyst');
    expect(current.conversation?.employeeMessageCount).toBe(12);

    await expect(service.sendMessage(IDS.bruno, 'ainda quero ajuda')).rejects.toThrow(
      /pausado/i,
    );
    expect(provider.callCount).toBe(0);

    const openRows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.employeeId, IDS.bruno));
    expect(openRows.some((row) => row.id === paused!.id && row.status === 'waiting_analyst')).toBe(
      true,
    );
    const withAgentAfterPause = openRows.filter(
      (row) => row.status === 'with_agent' && row.createdAt.getTime() >= paused!.createdAt.getTime(),
    );
    expect(withAgentAfterPause).toHaveLength(0);
  });

  it('does not transfer on bare analista mention', async () => {
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
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'O analista já viu meu chamado INC-20311?',
    });

    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.status).toBe('with_agent');
  });

  it('transfers only on explicit analyst request', async () => {
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
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'Quero falar com um analista',
    });

    const [after] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conv!.id));
    expect(after?.status).toBe('waiting_analyst');
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

  it('stops before a fifth tool step', async () => {
    const db = createDb();
    const provider = new ScriptedLlmProvider();
    provider.forceToolLoop = true;
    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    orchestrator.setProvider(provider);
    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const result = await orchestrator.handleEmployeeMessage({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      content: 'VPN erro 809',
    });

    const toolOks = result.events.filter(
      (event) => event.tool === 'search_help' && event.result === 'ok',
    );
    expect(toolOks.length).toBeLessThanOrEqual(4);
    expect(result.events.some((event) => event.rule === 'usage.max_tool_steps')).toBe(true);
  });

  it('confirming the same draft twice does not create a second ticket', async () => {
    const db = createDb();
    const gateway = TicketGateway.withDb(db);
    const orchestrator = new AgentOrchestrator(gateway, new PolicyEngine(), new UsageGuard());
    orchestrator.setProvider(new ScriptedLlmProvider());

    const [conv] = await db
      .insert(conversations)
      .values({ employeeId: IDS.ana, status: 'with_agent', employeeMessageCount: 0 })
      .returning();

    const [draft] = await db
      .insert(drafts)
      .values({
        conversationId: conv!.id,
        version: 1,
        action: 'create',
        payload: {
          action: 'create',
          title: 'Draft confirm retry',
          description: 'same draft twice',
          category: 'software',
          type: 'incident',
          affectedScope: 'self',
          workStopped: false,
          sameDayCommitment: false,
          hasAlternative: true,
        },
        status: 'pending',
      })
      .returning();

    const first = await orchestrator.confirmDraft({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      draftId: draft!.id,
      version: 1,
      confirm: true,
    });
    const second = await orchestrator.confirmDraft({
      employeeId: IDS.ana,
      conversationId: conv!.id,
      draftId: draft!.id,
      version: 1,
      confirm: true,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.mutation).toEqual(first.mutation);

    const created = await db.select().from(tickets);
    const matches = created.filter((ticket) => ticket.title === 'Draft confirm retry');
    expect(matches).toHaveLength(1);
  });
});
