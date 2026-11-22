import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

function customerFields(scope: Scope) {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
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

  customers(scope: Scope) {
    return this.database.client.customer.findMany({
      where: scope,
      orderBy: [{ name: 'asc' }, { id: 'desc' }],
      select: customerFields(scope),
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
