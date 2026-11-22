import { Context, Query, Resolver } from '@nestjs/graphql';
import { requireScope, type RequestContext } from '../scope.js';
import { ShopperRepository } from './shopper.repository.js';

@Resolver()
export class CustomersResolver {
  constructor(private readonly shoppers: ShopperRepository) {}

  @Query('customers')
  async customers(@Context() context: RequestContext) {
    const rows = await this.shoppers.customers(await requireScope(context, false));
    return rows.map(({ id, name, email, createdAt, updatedAt }) => ({
      id,
      name,
      email,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    }));
  }
}
