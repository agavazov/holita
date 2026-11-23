import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor() {
    const connectionString = process.env.SALES_DATABASE_URL ?? '';
    const database = URL.parse(connectionString);
    if (!database) {
      throw new Error('SALES_DATABASE_URL must be a valid URL');
    }
    const schema = database.searchParams.get('schema') ?? 'public';
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
