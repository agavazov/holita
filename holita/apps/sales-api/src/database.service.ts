import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly connectionString = process.env.SALES_DATABASE_URL ?? '';
  private readonly schema = new URL(this.connectionString).searchParams.get('schema') ?? 'public';
  readonly client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: this.connectionString }, { schema: this.schema }),
  });

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
