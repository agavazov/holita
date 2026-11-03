import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { readPort } from './modules/devices/config.js';

async function bootstrap(): Promise<void> {
  const port = readPort('PORT', process.env.PORT ?? '11015');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.info(`erm-server listening at ${await app.getUrl()}`);
}

bootstrap().catch(() => {
  console.error('ERM server failed to start; check its configuration.');
  process.exitCode = 1;
});
