import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '7mb' });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? '12013'), '127.0.0.1');
  console.info(`commerce listening at ${await app.getUrl()}`);
}
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
