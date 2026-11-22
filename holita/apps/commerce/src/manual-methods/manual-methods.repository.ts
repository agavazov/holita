import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { PaymentMethodInput, ShippingMethodInput } from '../generated/graphql/types.js';
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

type ShippingMethodFields = Omit<ShippingMethodInput, 'fixedFee'> & { fixedFee: Prisma.Decimal };

function matchLabels(words: string[]) {
  return words.map((word) => ({
    label: { contains: word.replace(/[\\%_]/gu, '\\$&'), mode: 'insensitive' as const },
  }));
}

@Injectable()
export class ManualMethodsRepository {
  constructor(private readonly database: DatabaseService) {}

  async listPaymentMethods(scope: Scope, offset: number, limit: number, words: string[]) {
    const where: Prisma.PaymentMethodWhereInput = { ...scope, AND: matchLabels(words) };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.paymentMethod.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: methodOrder,
        }),
        this.database.client.paymentMethod.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  findPaymentMethod(scope: Scope, id: string) {
    return this.database.client.paymentMethod.findUnique({ where: { ...scope, id } });
  }

  createPaymentMethod(scope: Scope, fields: PaymentMethodInput) {
    return this.database.client.paymentMethod.create({ data: { ...scope, ...fields } });
  }

  updatePaymentMethod(scope: Scope, id: string, fields: PaymentMethodInput) {
    return this.database.client.paymentMethod.update({ where: { ...scope, id }, data: fields });
  }

  async listShippingMethods(scope: Scope, offset: number, limit: number, words: string[]) {
    const where: Prisma.ShippingMethodWhereInput = { ...scope, AND: matchLabels(words) };
    const [items, total] = await this.database.client.$transaction(
      [
        this.database.client.shippingMethod.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: methodOrder,
        }),
        this.database.client.shippingMethod.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  findShippingMethod(scope: Scope, id: string) {
    return this.database.client.shippingMethod.findUnique({ where: { ...scope, id } });
  }

  createShippingMethod(scope: Scope, fields: ShippingMethodFields) {
    return this.database.client.shippingMethod.create({ data: { ...scope, ...fields } });
  }

  updateShippingMethod(scope: Scope, id: string, fields: ShippingMethodFields) {
    return this.database.client.shippingMethod.update({ where: { ...scope, id }, data: fields });
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
