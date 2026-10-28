import { Logger } from '@nestjs/common';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { EnvConfig } from '../config/env.config';

const logger = new Logger('Migrate');

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const url =
    databaseUrl ??
    EnvConfig.getInstance().load().get(
      'DATABASE_URL',
      'postgres://nexo:nexo@localhost:5432/nexo',
    ) ??
    'postgres://nexo:nexo@localhost:5432/nexo';
  const sql = postgres(url, { max: 1 });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

    const dir = join(__dirname, 'migrations');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    await sql`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    for (const file of files) {
      const hash = file;
      const existing = await sql<{ hash: string }[]>`
        SELECT hash FROM "__drizzle_migrations" WHERE hash = ${hash}
      `;
      if (existing.length > 0) {
        continue;
      }
      const body = readFileSync(join(dir, file), 'utf8');
      await sql.unsafe(body);
      await sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        VALUES (${hash}, ${Date.now()})
      `;
      logger.log(`Applied ${file}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  await runMigrations();
}

if (require.main === module) {
  main().catch((err: unknown) => {
    logger.error(
      err instanceof Error ? err.message : 'Migration failed',
      err instanceof Error ? err.stack : undefined,
    );
    process.exit(1);
  });
}
