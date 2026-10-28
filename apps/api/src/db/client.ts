import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { EnvConfig } from '../config/env.config';
import * as schema from './schema';

export type AppDatabase = PostgresJsDatabase<typeof schema>;
export type SqlClient = ReturnType<typeof postgres>;

let cached: { sql: SqlClient; db: AppDatabase; url: string } | null = null;

function resolveDatabaseUrl(databaseUrl?: string): string {
  const resolved =
    databaseUrl ?? EnvConfig.getInstance().load().require('DATABASE_URL');
  if (!resolved) {
    throw new Error('DATABASE_URL is required');
  }
  return resolved;
}

export function createDb(databaseUrl?: string): AppDatabase {
  const resolved = resolveDatabaseUrl(databaseUrl);
  if (cached) {
    return cached.db;
  }
  const sql = postgres(resolved, { max: 10 });
  const db = drizzle(sql, { schema });
  cached = { sql, db, url: resolved };
  return db;
}

export function getSql(): SqlClient {
  createDb();
  if (!cached) {
    throw new Error('Database is not initialized');
  }
  return cached.sql;
}

/** Dedicated single-connection client (LISTEN hubs, isolated tests). */
export function createDedicatedSql(databaseUrl?: string): SqlClient {
  const resolved = databaseUrl ?? cached?.url ?? resolveDatabaseUrl();
  return postgres(resolved, { max: 1 });
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
