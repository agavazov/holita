import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const portValue = process.env['PORT'] ?? '11080';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Allow the 100 KiB rich-text input plus JSON escaping and the other event fields.
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: process.env.ADMIN_ORIGIN ?? ['http://127.0.0.1:11081', 'http://localhost:11081'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-store-id', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.info(`gateway listening at ${await app.getUrl()}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
