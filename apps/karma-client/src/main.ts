import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const value = process.env.PORT ?? '11014';
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer between 1 and 65535.');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.info(`karma-client listening at ${await app.getUrl()}`);
}

bootstrap().catch(() => {
  console.error('Karma Client failed to start; check its configuration.');
  process.exitCode = 1;
});
