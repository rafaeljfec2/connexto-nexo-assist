import { defineConfig } from 'drizzle-kit';
import { EnvConfig } from './src/config/env.config';

const databaseUrl =
  EnvConfig.getInstance().load().get(
    'DATABASE_URL',
    'postgres://nexo:nexo@localhost:5432/nexo',
  ) ?? 'postgres://nexo:nexo@localhost:5432/nexo';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
