import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { SessionIdentity } from './session.js';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Email is globally unique: this lookup establishes identity before a session exists.
  findCredentials(email: string) {
    return this.prisma.client.user.findUnique({ where: { email } });
  }

  findUser(identity: SessionIdentity) {
    return this.prisma.client.user.findUnique({
      where: { id: identity.userId, tenantId: identity.tenantId },
    });
  }

  createSession(tenantId: string, userId: string, tokenHash: string, now: Date, expiresAt: Date) {
    return this.prisma.client.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: userId, tenantId },
        data: { lastSignInAt: now },
        include: { tenant: true },
      });
      await transaction.session.create({
        data: { tenantId, userId, tokenHash, createdAt: now, expiresAt, lastSeenAt: now },
      });
      return user;
    });
  }

  // Only the hash of a cryptographically random bearer can select the session's Tenant.
  findSession(tokenHash: string, now: Date) {
    return this.prisma.client.session.findUnique({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, user: { active: true } },
      include: { user: { select: { role: true } } },
    });
  }

  async touchSession(identity: SessionIdentity, now: Date): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: identity.sessionId, tenantId: identity.tenantId, userId: identity.userId },
      data: { lastSeenAt: now },
    });
  }

  async revokeSession(identity: SessionIdentity): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: identity.sessionId, tenantId: identity.tenantId, userId: identity.userId },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(identity: SessionIdentity, passwordHash: string): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: identity.userId, tenantId: identity.tenantId },
        data: { passwordHash },
      }),
      this.prisma.client.session.updateMany({
        where: {
          tenantId: identity.tenantId,
          userId: identity.userId,
          id: { not: identity.sessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
