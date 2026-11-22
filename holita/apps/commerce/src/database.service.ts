import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly connectionString = process.env.COMMERCE_DATABASE_URL ?? '';
  private readonly schema = new URL(this.connectionString).searchParams.get('schema') ?? 'public';
  readonly client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: this.connectionString }, { schema: this.schema }),
  });

  table(
    name:
      | 'product'
      | 'productVariant'
      | 'productVariantValue'
      | 'productTagAssignment'
      | 'productCollectionItem'
      | 'cartLine',
  ): Prisma.Sql {
    return Prisma.raw(`"${this.schema.replaceAll('"', '""')}"."${name}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
