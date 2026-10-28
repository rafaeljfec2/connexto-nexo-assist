import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  Catch,
  Logger,
  type ExceptionFilter,
  type ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { resolveModelId } from './agent/providers/mastra';
import { EnvConfig } from './config/env.config';
import { runMigrations } from './db/migrate';
import { AppModule } from './app.module';

EnvConfig.getInstance().load();

const bootstrapLogger = new Logger('Bootstrap');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => (
  req: unknown,
  res: unknown,
  next: (err?: unknown) => void,
) => void;

@Catch()
class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent || res.writableEnded) {
      this.logger.warn(
        `Response already committed; skipping JSON error body (${
          exception instanceof Error ? exception.message : 'Unexpected error'
        })`,
      );
      return;
    }
    if (exception instanceof ZodError) {
      res.status(400).json({
        message: 'Invalid request',
        issues: exception.issues.map((i) => i.message),
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const body =
        typeof response === 'string'
          ? { message: response }
          : (response as Record<string, unknown>);
      res.status(status).json({
        statusCode: status,
        message: body['message'] ?? exception.message,
      });
      return;
    }
    this.logger.error(
      exception instanceof Error ? exception.message : 'Unexpected error',
      exception instanceof Error ? exception.stack : undefined,
    );
    res.status(500).json({ message: 'Unexpected error' });
  }
}

function nestLogLevels(): Array<'error' | 'warn' | 'log' | 'debug' | 'verbose'> {
  const raw = (process.env.LOG_LEVEL ?? 'log').toLowerCase().trim();
  if (raw === 'debug' || raw === 'verbose') {
    return ['error', 'warn', 'log', 'debug', 'verbose'];
  }
  if (raw === 'warn') {
    return ['error', 'warn'];
  }
  if (raw === 'error') {
    return ['error'];
  }
  return ['error', 'warn', 'log'];
}

async function bootstrap(): Promise<void> {
  const env = EnvConfig.getInstance().load().snapshot();
  bootstrapLogger.log('Running database migrations...');
  await runMigrations(env.databaseUrl);
  const app = await NestFactory.create(AppModule, { logger: nestLogLevels() });
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.enableCors({
    origin: env.corsOrigin,
    credentials: true,
  });
  app.useGlobalFilters(new SafeExceptionFilter());

  await app.listen(env.apiPort);
  bootstrapLogger.log(`API listening on http://localhost:${env.apiPort}`);
  if (env.llmProvider === 'scripted') {
    bootstrapLogger.log('LLM: scripted (deterministic, no remote model)');
  } else {
    bootstrapLogger.log(`LLM: provider=${env.llmProvider} model=${resolveModelId()}`);
  }
}

bootstrap().catch((err: unknown) => {
  bootstrapLogger.error(
    err instanceof Error ? err.message : 'Bootstrap failed',
    err instanceof Error ? err.stack : undefined,
  );
  process.exit(1);
});
