import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

const customerContactFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
} satisfies Prisma.CustomerSelect;

function customerFields(scope: Scope) {
  return {
    ...customerContactFields,
    createdAt: true,
    updatedAt: true,
    orders: {
      where: scope,
      orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
      take: 1,
      select: { contactEmail: true, contactPhone: true },
    },
  } satisfies Prisma.CustomerSelect;
}

const addressFields = {
  id: true,
  recipient: true,
  line1: true,
  city: true,
  postalCode: true,
  countryCode: true,
} satisfies Prisma.CustomerAddressSelect;

type AddressData = Pick<
  Prisma.CustomerAddressCreateInput,
  'recipient' | 'line1' | 'city' | 'postalCode' | 'countryCode'
>;

@Injectable()
export class ShopperRepository {
  constructor(private readonly database: DatabaseService) {}

  async customers(scope: Scope, offset: number, limit: number, words: string[]) {
    const where: Prisma.CustomerWhereInput = {
      ...scope,
      AND: words.map((word) => {
        const match = { contains: word.replace(/[\\%_]/gu, '\\$&'), mode: 'insensitive' } as const;
        return { OR: [{ name: match }, { email: match }] };
      }),
    };
    const customer = this.database.client.customer;
    const [items, total] = await this.database.client.$transaction(
      [
        customer.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ name: 'asc' }, { id: 'desc' }],
          select: customerContactFields,
        }),
        customer.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, offset, limit };
  }

  customerContact(scope: Scope, id: string) {
    return this.database.client.customer.findUnique({
      where: { ...scope, id },
      select: customerContactFields,
    });
  }

  customer(scope: Scope, id: string) {
    return this.database.client.customer.findUnique({
      where: { ...scope, id },
      select: {
        ...customerFields(scope),
        addresses: {
          where: scope,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: addressFields,
        },
      },
    });
  }

  updateContact(scope: Scope, id: string, data: { name: string; phone?: string | null }) {
    return this.database.client.customer.update({
      where: { ...scope, id },
      data,
      select: customerFields(scope),
    });
  }

  createAddress(scope: Scope, customerId: string, data: AddressData) {
    return this.database.client.customerAddress.create({
      data: {
        ...data,
        customer: { connect: { tenantId_branchId_id: { ...scope, id: customerId } } },
      },
      select: addressFields,
    });
  }

  updateAddress(scope: Scope, customerId: string, id: string, data: AddressData) {
    return this.database.client.customerAddress.update({
      where: { ...scope, customerId, id },
      data,
      select: addressFields,
    });
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work);
  }

  create(
    tx: Prisma.TransactionClient,
    scope: Scope,
    input: { name: string; email: string; passwordHash: string },
  ) {
    return tx.customer.create({ data: { ...scope, ...input } });
  }

  findById(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    return tx.customer.findUnique({ where: { ...scope, id }, select: { id: true } });
  }

  findByEmail(scope: Scope, email: string) {
    return this.database.client.customer.findFirst({
      where: { ...scope, email: { equals: email, mode: 'insensitive' } },
    });
  }

  createSession(
    tx: Prisma.TransactionClient,
    scope: Scope,
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return tx.shopperSession.create({
      data: { ...scope, customerId, tokenHash, expiresAt },
    });
  }

  findSession(scope: Scope, tokenHash: string) {
    return this.database.client.shopperSession.findFirst({
      where: { ...scope, tokenHash, expiresAt: { gt: new Date() }, customer: scope },
      include: { customer: true },
    });
  }

  deleteSessions(scope: Scope, tokenHash: string) {
    return this.database.client.shopperSession.deleteMany({ where: { ...scope, tokenHash } });
  }
}
