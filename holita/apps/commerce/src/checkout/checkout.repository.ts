import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

const paymentFields = {
  id: true,
  label: true,
  instructions: true,
} satisfies Prisma.PaymentMethodSelect;
const shippingFields = {
  id: true,
  label: true,
  fixedFee: true,
} satisfies Prisma.ShippingMethodSelect;
const methodOrder = [
  { sortOrder: 'asc' },
  { id: 'asc' },
] satisfies Prisma.PaymentMethodOrderByWithRelationInput[];

@Injectable()
export class CheckoutRepository {
  constructor(private readonly database: DatabaseService) {}

  readTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  paymentMethods(tx: Prisma.TransactionClient, scope: Scope) {
    return tx.paymentMethod.findMany({
      where: { ...scope, enabled: true },
      orderBy: methodOrder,
      select: paymentFields,
    });
  }

  shippingMethods(tx: Prisma.TransactionClient, scope: Scope) {
    return tx.shippingMethod.findMany({
      where: { ...scope, enabled: true },
      orderBy: methodOrder,
      select: shippingFields,
    });
  }

  paymentMethod(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    return tx.paymentMethod.findUnique({
      where: { ...scope, id, enabled: true },
      select: paymentFields,
    });
  }

  shippingMethod(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    return tx.shippingMethod.findUnique({
      where: { ...scope, id, enabled: true },
      select: shippingFields,
    });
  }
}
