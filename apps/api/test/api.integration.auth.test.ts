import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from '../src/db/client';
import { conversations, users } from '../src/db/schema';
import { IDS, runSeed } from '../src/db/seed';
import { AuthService } from '../src/auth/auth.service';
import { AnalystGuard, EmployeeGuard } from '../src/auth/auth.guard';
import { AgentOrchestrator } from '../src/agent/agent.orchestrator';
import { PolicyEngine } from '../src/agent/policy.engine';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { UsageGuard } from '../src/conversations/usage.guard';
import { INTEGRATION_SEED_NOW, setupIntegrationDb } from './helpers/db';

function contextWithSession(token: string | undefined): {
  context: ExecutionContext;
  req: { cookies?: Record<string, string>; user?: unknown };
} {
  const req: { cookies?: Record<string, string>; user?: unknown } = {
    cookies: token ? { nexo_session: token } : {},
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
  return { context, req };
}

describe('API integration — auth, roles, and seed', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('logs in employee Ana and persists role on the session', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('ana.souza@nexo.com.br', 'demo', false);
    expect(session.user.role).toBe('employee');
    expect(session.user.email).toBe('ana.souza@nexo.com.br');

    const resolved = await auth.resolveSession(session.token);
    expect(resolved.role).toBe('employee');
    expect(resolved.id).toBe(IDS.ana);
  });

  it('logs in analyst Rafael and persists role on the session', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('rafael.lima@nexo.com.br', 'demo', false);
    expect(session.user.role).toBe('analyst');
    expect(session.user.email).toBe('rafael.lima@nexo.com.br');

    const resolved = await auth.resolveSession(session.token);
    expect(resolved.role).toBe('analyst');
    expect(resolved.id).toBe(IDS.rafael);
  });

  it('rejects empty password and unknown email with the same generic error', async () => {
    const auth = AuthService.withDb(createDb());
    await expect(auth.login('ana.souza@nexo.com.br', '', false)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(auth.login('unknown@nexo.com.br', 'x', false)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('blocks employee sessions from AnalystGuard', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('ana.souza@nexo.com.br', 'demo', false);
    const guard = new AnalystGuard(auth);
    const { context } = contextWithSession(session.token);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(/analistas/i);
  });

  it('allows analyst sessions through AnalystGuard', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('rafael.lima@nexo.com.br', 'demo', false);
    const guard = new AnalystGuard(auth);
    const { context, req } = contextWithSession(session.token);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: IDS.rafael, role: 'analyst' });
  });

  it('blocks analyst sessions from EmployeeGuard', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('rafael.lima@nexo.com.br', 'demo', false);
    const guard = new EmployeeGuard(auth);
    const { context } = contextWithSession(session.token);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(/funcionários/i);
  });

  it('allows employee sessions through EmployeeGuard', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('ana.souza@nexo.com.br', 'demo', false);
    const guard = new EmployeeGuard(auth);
    const { context, req } = contextWithSession(session.token);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: IDS.ana, role: 'employee' });
  });

  it('blocks an employee from acting on another employee conversation', async () => {
    const db = createDb();
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, IDS.convWaiting));
    expect(conversation?.employeeId).toBe(IDS.carla);

    // Mirrors ConversationsController SSE ownership gate
    expect(conversation!.employeeId !== IDS.bruno).toBe(true);

    const orchestrator = new AgentOrchestrator(
      TicketGateway.withDb(db),
      new PolicyEngine(),
      new UsageGuard(),
    );
    await expect(
      orchestrator.handleEmployeeMessage({
        employeeId: IDS.bruno,
        conversationId: IDS.convWaiting,
        content: 'tentativa cruzada',
      }),
    ).rejects.toThrow(/inválida/i);
  });

  it('keeps seed idempotent without duplicating users', async () => {
    const db = createDb();
    const before = await db.select({ email: users.email }).from(users);
    expect(before.map((row) => row.email).sort()).toEqual(
      [
        'ana.souza@nexo.com.br',
        'bruno.mendes@nexo.com.br',
        'carla.nunes@nexo.com.br',
        'rafael.lima@nexo.com.br',
      ].sort(),
    );

    await runSeed(INTEGRATION_SEED_NOW);

    const after = await db.select({ email: users.email }).from(users);
    expect(after).toHaveLength(before.length);
    expect(after.map((row) => row.email).sort()).toEqual(before.map((row) => row.email).sort());
  });
});
