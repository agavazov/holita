import { createHash } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import type { UserRole } from './roles.js';

interface SessionIdentity {
  tenantId: string;
  userId: string;
  sessionId: string;
  role: UserRole;
}

const verifiedSessions = new Map<string, { identity: SessionIdentity; expiresAt: number }>();
const cacheMilliseconds = 5000;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

export async function readSession(
  authorization: string | undefined,
): Promise<SessionIdentity | undefined> {
  if (!authorization || !/^Bearer discocan-session\.[A-Za-z0-9_-]{43}$/i.test(authorization)) {
    return undefined;
  }
  const internalToken = process.env.CORE_INTERNAL_AUTH_TOKEN;
  if (!internalToken || internalToken.length < 32) {
    return undefined;
  }
  const now = Date.now();
  for (const [hash, entry] of verifiedSessions) {
    if (entry.expiresAt <= now) {
      verifiedSessions.delete(hash);
    }
  }
  const hash = createHash('sha256').update(authorization.slice(7)).digest('hex');
  const cached = verifiedSessions.get(hash);
  if (cached) {
    return cached.identity;
  }

  try {
    const response = await fetch(
      process.env.CORE_AUTH_VERIFY_URL ?? 'http://127.0.0.1:11011/internal/auth/verify',
      {
        method: 'POST',
        headers: { authorization, 'x-core-internal-token': internalToken },
        redirect: 'error',
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException('Session verification is unavailable');
    }
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('tenantId' in body) ||
      !isUuid(body.tenantId) ||
      !('userId' in body) ||
      !isUuid(body.userId) ||
      !('sessionId' in body) ||
      !isUuid(body.sessionId) ||
      !('role' in body) ||
      (body.role !== 'VIEWER' &&
        body.role !== 'OPERATOR' &&
        body.role !== 'ENGINEER' &&
        body.role !== 'ADMINISTRATOR')
    ) {
      return undefined;
    }
    const identity: SessionIdentity = {
      tenantId: body.tenantId,
      userId: body.userId,
      sessionId: body.sessionId,
      role: body.role,
    };
    verifiedSessions.set(hash, { identity, expiresAt: now + cacheMilliseconds });
    return identity;
  } catch {
    throw new ServiceUnavailableException('Session verification is unavailable');
  }
}
