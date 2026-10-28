import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { resetDbCache } from '../../src/db/client';
import { runSeed } from '../../src/db/seed';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://nexo:nexo@localhost:5432/nexo';

export const INTEGRATION_SEED_NOW = new Date('2026-10-27T15:00:00.000Z');

export async function migrate(): Promise<void> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql.unsafe(`
    DROP TABLE IF EXISTS conversation_events CASCADE;
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
  const dir = join(__dirname, '../../src/db/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await sql.unsafe(readFileSync(join(dir, file), 'utf8'));
  }
  await sql.end({ timeout: 5 });
}

export async function setupIntegrationDb(): Promise<void> {
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.LLM_PROVIDER = 'scripted';
  process.env.TICKET_FAULT = 'off';
  resetDbCache();
  await migrate();
  resetDbCache();
  await runSeed(INTEGRATION_SEED_NOW);
}
