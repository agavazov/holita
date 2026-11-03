import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createPrismaClient } from './client.js';

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  readonly client = createPrismaClient();

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
