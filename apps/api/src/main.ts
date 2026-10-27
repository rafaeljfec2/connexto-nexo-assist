import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => (
  req: unknown,
  res: unknown,
  next: (err?: unknown) => void,
) => void;

@Catch()
class SafeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
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
    // eslint-disable-next-line no-console
    console.error(exception);
    res.status(500).json({ message: 'Unexpected error' });
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalFilters(new SafeExceptionFilter());

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
