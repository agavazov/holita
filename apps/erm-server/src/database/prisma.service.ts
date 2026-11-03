import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createPrismaClient } from './client.js';
import { getDatabaseUrl } from './connection.js';

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  readonly schema = new URL(getDatabaseUrl()).searchParams.get('schema') ?? 'public';
  readonly client = createPrismaClient();

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
