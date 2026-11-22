import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

@Injectable()
export class ShopperRepository {
  constructor(private readonly database: DatabaseService) {}

  customers(scope: Scope) {
    return this.database.client.customer.findMany({
      where: scope,
      orderBy: [{ name: 'asc' }, { id: 'desc' }],
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
