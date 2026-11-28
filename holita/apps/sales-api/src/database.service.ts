import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly schema: string;
  readonly client: PrismaClient;

  constructor() {
    const connectionString = process.env.SALES_DATABASE_URL ?? '';
    const database = URL.parse(connectionString);
    if (!database) {
      throw new Error('SALES_DATABASE_URL must be a valid URL');
    }
    this.schema = database.searchParams.get('schema') ?? 'public';
    this.client = new PrismaClient({
      adapter: new PrismaPg({ connectionString }, { schema: this.schema }),
    });
  }

  table(name: 'appointmentBooking' | 'appointmentService' | 'lead'): Prisma.Sql {
    return Prisma.raw(`"${this.schema.replaceAll('"', '""')}"."${name}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
