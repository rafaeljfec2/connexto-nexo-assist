import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'postgres://nexo:nexo@localhost:5432/nexo';
  const sql = postgres(url, { max: 1 });
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
    // eslint-disable-next-line no-console
    console.log(`Applied ${file}`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
