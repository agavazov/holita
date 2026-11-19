import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { SignInPayload } from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { AuthRepository } from './auth.repository.js';
import { hashPassword, normalizedEmail, validatePassword, verifyPassword } from '@osnova/auth';
import { requireSession, type SessionIdentity } from './session.js';
import { tokenPrefix } from './token-prefix.js';

const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const signInFailure = 'Invalid email or password';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(private readonly auth: AuthRepository) {}

  async signIn(email: string, password: string): Promise<SignInPayload> {
    let normalized: string;
    try {
      normalized = normalizedEmail(email);
      validatePassword(password);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw new UnauthorizedException(signInFailure);
      }
      throw error;
    }
    const credentials = await this.auth.findCredentials(normalized);
    if (
      !credentials?.active ||
      credentials.tenant.status !== 'ACTIVE' ||
      !(await verifyPassword(password, credentials.passwordHash))
    ) {
      throw new UnauthorizedException(signInFailure);
    }
    const token = `${tokenPrefix()}-session.${randomBytes(32).toString('base64url')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + sessionLifetimeMs);
    const user = await this.auth.createSession(
      credentials.tenantId,
      credentials.id,
      tokenHash(token),
      now,
      expiresAt,
    );
    return { token, user, tenant: user.tenant, expiresAt };
  }

  async verifyAuthorization(
    authorization: string | undefined,
  ): Promise<SessionIdentity | undefined> {
    const match = new RegExp(`^Bearer (${tokenPrefix()}-session\\.[A-Za-z0-9_-]{43})$`, 'i').exec(
      authorization ?? '',
    );
    const token = match?.[1];
    if (!token) {
      return undefined;
    }
    const now = new Date();
    const session = await this.auth.findSession(tokenHash(token), now);
    if (!session) {
      return undefined;
    }
    const identity: SessionIdentity = {
      tenantId: session.tenantId,
      userId: session.userId,
      sessionId: session.id,
      role: session.user.role,
      platform: session.tenant.kind === 'PLATFORM',
    };
    await this.auth.touchSession(identity, now);
    return identity;
  }

  async activeDemoTenant(tenantId: string): Promise<boolean> {
    return (await this.auth.findActiveDemoTenant(tenantId)) !== null;
  }

  async signOut(context: RequestContext): Promise<boolean> {
    await this.auth.revokeSession(requireSession(context));
    return true;
  }

  async changePassword(
    context: RequestContext,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const identity = requireSession(context);
    validatePassword(currentPassword, 'currentPassword');
    validatePassword(newPassword, 'newPassword');
    const user = await this.auth.findUser(identity);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      const message = 'Current password is incorrect';
      throw new BadRequestException({
        message,
        fieldErrors: [{ path: 'currentPassword', message, code: 'INVALID_PASSWORD' }],
      });
    }
    await this.auth.changePassword(identity, await hashPassword(newPassword));
    return true;
  }
}
