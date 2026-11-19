import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import type { Scope } from './scope.js';

@Injectable()
export class ShopperRepository {
  constructor(private readonly database: DatabaseService) {}

  create(scope: Scope, input: { name: string; email: string; passwordHash: string }) {
    return this.database.client.customer.create({ data: { ...scope, ...input } });
  }

  findByEmail(scope: Scope, email: string) {
    return this.database.client.customer.findFirst({
      where: { ...scope, email: { equals: email, mode: 'insensitive' } },
    });
  }

  createSession(scope: Scope, customerId: string, tokenHash: string, expiresAt: Date) {
    return this.database.client.shopperSession.create({
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
