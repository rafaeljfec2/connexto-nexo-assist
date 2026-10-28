import { describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

describe('API security bootstrap', () => {
  it('enables trust proxy for throttler behind reverse proxies', async () => {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
    });
    app.set('trust proxy', 1);
    expect(app.getHttpAdapter().getInstance().get('trust proxy')).toBe(1);
    await app.close();
  });
});
