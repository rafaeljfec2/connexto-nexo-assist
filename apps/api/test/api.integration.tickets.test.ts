import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, createDb } from '../src/db/client';
import { IDS } from '../src/db/seed';
import { AuthService } from '../src/auth/auth.service';
import { TicketGateway } from '../src/tickets/ticket.gateway';
import { setupIntegrationDb } from './helpers/db';

describe('API integration — tickets and auth', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
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

  it('accepts demo login for Ana with any non-empty password', async () => {
    const auth = AuthService.withDb(createDb());
    const session = await auth.login('ana.souza@nexo.com.br', 'qualquer', false);
    expect(session.user.role).toBe('employee');
    await expect(auth.login('ana.souza@nexo.com.br', '', false)).rejects.toThrow();
    await expect(auth.login('unknown@nexo.com.br', 'x', false)).rejects.toThrow();
  });
});
