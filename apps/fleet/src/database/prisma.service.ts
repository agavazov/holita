import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { getDatabaseUrl } from './connection.js';
import { createPrismaClient } from './client.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly schema = new URL(getDatabaseUrl()).searchParams.get('schema') ?? 'public';
  readonly client = createPrismaClient(undefined, this.schema);

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
