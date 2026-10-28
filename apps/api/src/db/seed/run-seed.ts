import { Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '../client';
import { seedMeta } from '../schema';
import { LEGACY_SEED_IDS, SEED_ID } from './constants';
import { insertDemoData } from './insert-demo-data';
import { wipeDemoTables } from './wipe-demo-tables';

const logger = new Logger('Seed');

export async function runSeed(now = new Date()): Promise<void> {
  const db = createDb();
  const existing = await db.select().from(seedMeta).where(eq(seedMeta.id, SEED_ID));
  if (existing.length > 0) {
    logger.log('Seed already applied; skipping.');
    return;
  }

  const legacy = await db
    .select()
    .from(seedMeta)
    .where(inArray(seedMeta.id, [...LEGACY_SEED_IDS]));
  if (legacy.length > 0) {
    logger.log('Upgrading demo seed to v3 (wiping prior demo tables)…');
    await wipeDemoTables(db);
  }

  await insertDemoData(db, now);
  logger.log('Seed applied.');
}
