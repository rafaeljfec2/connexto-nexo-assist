import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type EnvSnapshot = {
  readonly databaseUrl: string;
  readonly apiPort: number;
  readonly corsOrigin: string;
  readonly llmProvider: string;
  readonly openaiApiKey: string | undefined;
  readonly openaiBaseUrl: string;
  readonly openaiModel: string;
  readonly ticketFault: string;
  readonly sessionSecret: string | undefined;
};

/**
 * Singleton that loads `.env` files into `process.env` for local development.
 * Existing process environment always wins (Docker, CI, shell exports).
 * Package `.env` wins over monorepo root for keys still unset.
 */
export class EnvConfig {
  private static instance: EnvConfig | null = null;

  private loaded = false;
  private readonly loadedFrom: string[] = [];

  private constructor() {}

  static getInstance(): EnvConfig {
    if (EnvConfig.instance === null) {
      EnvConfig.instance = new EnvConfig();
    }
    return EnvConfig.instance;
  }

  /** Test-only: clears the singleton so the next load starts clean. */
  static resetForTests(): void {
    EnvConfig.instance = null;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  get sources(): readonly string[] {
    return this.loadedFrom;
  }

  load(): this {
    if (this.loaded) {
      return this;
    }

    for (const filePath of this.resolveCandidatePaths()) {
      if (!existsSync(filePath)) {
        continue;
      }
      this.applyFile(filePath);
      this.loadedFrom.push(filePath);
    }

    this.loaded = true;
    return this;
  }

  require(key: string): string {
    this.load();
    const value = process.env[key];
    if (value === undefined || value.length === 0) {
      throw new Error(`${key} is required`);
    }
    return value;
  }

  get(key: string, fallback?: string): string | undefined {
    this.load();
    const value = process.env[key];
    if (value === undefined || value.length === 0) {
      return fallback;
    }
    return value;
  }

  snapshot(): EnvSnapshot {
    this.load();
    return {
      databaseUrl: this.require('DATABASE_URL'),
      apiPort: Number(this.get('API_PORT', '3001') ?? '3001'),
      corsOrigin: this.get('CORS_ORIGIN', 'http://localhost:3000') ?? 'http://localhost:3000',
      llmProvider: (this.get('LLM_PROVIDER', 'openai') ?? 'openai').toLowerCase(),
      openaiApiKey: this.get('OPENAI_API_KEY'),
      openaiBaseUrl:
        this.get('OPENAI_BASE_URL', 'https://api.openai.com/v1') ??
        'https://api.openai.com/v1',
      openaiModel: this.get('OPENAI_MODEL', 'gpt-4.1-mini') ?? 'gpt-4.1-mini',
      ticketFault: this.get('TICKET_FAULT', 'off') ?? 'off',
      sessionSecret: this.get('SESSION_SECRET'),
    };
  }

  private resolveCandidatePaths(): readonly string[] {
    const apiRoot = resolve(__dirname, '../..');
    const monorepoRoot = resolve(apiRoot, '../..');
    const cwd = process.cwd();

    const candidates = [
      join(apiRoot, '.env'),
      join(cwd, '.env'),
      join(monorepoRoot, '.env'),
      join(dirname(cwd), '.env'),
    ];

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const candidate of candidates) {
      const absolute = resolve(candidate);
      if (seen.has(absolute)) {
        continue;
      }
      seen.add(absolute);
      unique.push(absolute);
    }
    return unique;
  }

  private applyFile(filePath: string): void {
    const content = readFileSync(filePath, 'utf8');
    for (const [key, value] of parseEnvFile(content)) {
      if (process.env[key] !== undefined) {
        continue;
      }
      process.env[key] = value;
    }
  }
}

export function parseEnvFile(content: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const exportPrefix = line.startsWith('export ') ? 'export '.length : 0;
    const body = line.slice(exportPrefix);
    const separator = body.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = body.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let value = body.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.set(key, value);
  }

  return entries;
}
