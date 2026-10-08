import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { referenceAdminOrigins } from './admin-origins.js';

async function bootstrap(): Promise<void> {
  const portValue = process.env['PORT'] ?? '11086';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const origins = referenceAdminOrigins(process.env.ADMIN_ORIGINS, process.env.ADMIN_ORIGIN);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Allow the 100 KiB rich-text input plus JSON escaping and the other event fields.
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: origins,
    methods: ['PUT', 'GET', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
  });
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.info(`reference listening at ${await app.getUrl()}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
