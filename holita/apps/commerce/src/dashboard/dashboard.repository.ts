import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

@Injectable()
export class DashboardRepository {
  constructor(private readonly database: DatabaseService) {}

  async read(scope: Scope, from: Date, asOf: Date) {
    const window = { gte: from, lt: asOf };
    const [orders, newCustomerCount, outOfStockVariantCount, recentOrders] =
      await this.database.client.$transaction(
        [
          this.database.client.order.findMany({
            where: { ...scope, placedAt: window },
            select: { placedAt: true, status: true, currency: true, total: true },
          }),
          this.database.client.customer.count({ where: { ...scope, createdAt: window } }),
          this.database.client.productVariant.count({
            where: { ...scope, inventoryTracked: true, quantity: 0 },
          }),
          this.database.client.order.findMany({
            where: { ...scope, placedAt: { lt: asOf } },
            select: {
              id: true,
              orderNumber: true,
              placedAt: true,
              status: true,
              currency: true,
              total: true,
            },
            orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
            take: 8,
          }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    return { orders, newCustomerCount, outOfStockVariantCount, recentOrders };
  }
}
