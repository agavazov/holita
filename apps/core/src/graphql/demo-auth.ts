import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

// Demo session protocol shared with the other subgraph; covered by federation tests.
function key(): string {
  const configured = process.env.DEMO_AUTH_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production')
    throw new Error('DEMO_AUTH_SECRET must contain at least 32 characters.');
  return 'holita-local-demo-only-change-before-deployment';
}
export function demoAuthEnabled(): boolean {
  return (
    process.env.DEMO_AUTH_ENABLED !== 'false' &&
    (process.env.NODE_ENV !== 'production' || process.env.DEMO_AUTH_ENABLED === 'true')
  );
}
export function issueDemoToken(tenantId: string): string {
  if (!demoAuthEnabled()) throw new UnauthorizedException('Demo login is disabled');
  const payload = `holita-demo.${tenantId}.${String(Math.floor(Date.now() / 1000) + 28800)}`;
  return `${payload}.${createHmac('sha256', key()).update(payload).digest('base64url')}`;
}
export function readDemoTenant(authorization: unknown): string | undefined {
  if (!demoAuthEnabled() || typeof authorization !== 'string' || authorization.length > 256)
    return undefined;
  const match =
    /^Bearer (holita-demo\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9]{10}))\.([A-Za-z0-9_-]{43})$/.exec(
      authorization,
    );
  if (!match) return undefined;
  const [, payload, tenantId, expiry, signature] = match;
  if (!payload || !tenantId || !expiry || !signature || Number(expiry) <= Date.now() / 1000)
    return undefined;
  const expected = createHmac('sha256', key()).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
    ? tenantId
    : undefined;
}
export function requireTenant(context: { tenantId: string | undefined }): string {
  if (!context.tenantId) throw new UnauthorizedException('Sign in to a tenant first');
  return context.tenantId;
}
