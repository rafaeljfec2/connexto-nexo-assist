import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, createDb } from '../src/db/client';
import { IDS } from '../src/db/seed';
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

});
