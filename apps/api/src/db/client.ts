import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type AppDatabase = PostgresJsDatabase<typeof schema>;

let cached: { sql: ReturnType<typeof postgres>; db: AppDatabase } | null = null;

export function createDb(databaseUrl = process.env.DATABASE_URL): AppDatabase {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (cached) {
    return cached.db;
  }
  const sql = postgres(databaseUrl, { max: 10 });
  const db = drizzle(sql, { schema });
  cached = { sql, db };
  return db;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.sql.end({ timeout: 5 });
    cached = null;
  }
}

export function resetDbCache(): void {
  cached = null;
}
