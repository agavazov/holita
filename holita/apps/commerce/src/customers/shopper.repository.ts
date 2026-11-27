import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope, ShopperScope } from '../scope.js';

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
  type: true,
  isDefault: true,
  recipient: true,
  line1: true,
  line2: true,
  phone: true,
  city: true,
  postalCode: true,
  countryCode: true,
} satisfies Prisma.CustomerAddressSelect;

const addressList = {
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  select: addressFields,
} satisfies Prisma.CustomerAddressFindManyArgs;

type AddressData = Pick<
  Prisma.CustomerAddressCreateInput,
  | 'type'
  | 'isDefault'
  | 'recipient'
  | 'line1'
  | 'line2'
  | 'phone'
  | 'city'
  | 'postalCode'
  | 'countryCode'
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
          ...addressList,
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

  addresses(owner: ShopperScope) {
    return this.database.client.customerAddress.findMany({ where: owner, ...addressList });
  }

  address(tx: Prisma.TransactionClient, owner: ShopperScope, id: string) {
    return tx.customerAddress.findUniqueOrThrow({
      where: { ...owner, id },
      select: { type: true, isDefault: true },
    });
  }

  async lockAddressBook(
    tx: Prisma.TransactionClient,
    { tenantId, branchId, customerId }: ShopperScope,
  ) {
    // Serialize default replacements within the customer's address book.
    await tx.$queryRaw`
      SELECT "id" FROM ${this.database.table('customer')}
      WHERE "tenantId" = ${tenantId}::uuid AND "branchId" = ${branchId}::uuid
        AND "id" = ${customerId}::uuid
      FOR NO KEY UPDATE
    `;
  }

  clearAddressDefault(
    tx: Prisma.TransactionClient,
    owner: ShopperScope,
    type: NonNullable<AddressData['type']>,
    exceptId: string | undefined,
  ) {
    return tx.customerAddress.updateMany({
      where: { ...owner, type, isDefault: true, ...(exceptId && { id: { not: exceptId } }) },
      data: { isDefault: false },
    });
  }

  createAddress(
    tx: Prisma.TransactionClient,
    { customerId, ...scope }: ShopperScope,
    data: AddressData,
  ) {
    return tx.customerAddress.create({
      data: {
        ...data,
        customer: { connect: { tenantId_branchId_id: { ...scope, id: customerId } } },
      },
      select: addressFields,
    });
  }

  updateAddress(tx: Prisma.TransactionClient, owner: ShopperScope, id: string, data: AddressData) {
    return tx.customerAddress.update({
      where: { ...owner, id },
      data,
      select: addressFields,
    });
  }

  removeAddress(owner: ShopperScope, id: string) {
    return this.database.client.customerAddress.delete({
      where: { ...owner, id },
      select: { id: true },
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
