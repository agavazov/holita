import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const portValue = process.env['PORT'] ?? '11083';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.info(`products listening at ${await app.getUrl()}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
