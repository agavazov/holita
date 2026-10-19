import { afterEach, describe, expect, it } from '@jest/globals';
import { createHmac, randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { issueDemoToken, readDemoTenant, requireTenant } from './demo-auth.js';

const initial = {
  secret: process.env.DEMO_AUTH_SECRET,
  enabled: process.env.DEMO_AUTH_ENABLED,
  nodeEnv: process.env.NODE_ENV,
};
afterEach(() => {
  if (initial.secret === undefined) {
    delete process.env.DEMO_AUTH_SECRET;
  } else {
    process.env.DEMO_AUTH_SECRET = initial.secret;
  }
  if (initial.enabled === undefined) {
    delete process.env.DEMO_AUTH_ENABLED;
  } else {
    process.env.DEMO_AUTH_ENABLED = initial.enabled;
  }
  if (initial.nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = initial.nodeEnv;
  }
});
describe('Demo tenant session verification', () => {
  it('accepts issued tokens and rejects tenant tampering, expiry, arrays and unbounded headers', () => {
    process.env.DEMO_AUTH_SECRET = 'test-secret-with-more-than-thirty-two-characters';
    process.env.DEMO_AUTH_ENABLED = 'true';
    const tenantId = randomUUID();
    const token = issueDemoToken(tenantId);
    expect(readDemoTenant(`Bearer ${token}`)).toBe(tenantId);
    expect(readDemoTenant(`Bearer ${token.replace(tenantId, randomUUID())}`)).toBeUndefined();
    const expired = `holita-demo.${tenantId}.${String(Math.floor(Date.now() / 1000) - 1)}`;
    const signature = createHmac('sha256', process.env.DEMO_AUTH_SECRET)
      .update(expired)
      .digest('base64url');
    for (const header of [
      `Bearer ${expired}.${signature}`,
      token,
      ['Bearer ' + token],
      'Bearer ' + 'x'.repeat(1000),
      undefined,
    ]) {
      expect(readDemoTenant(header)).toBeUndefined();
    }
    expect(() => requireTenant({ tenantId: undefined })).toThrow(UnauthorizedException);
  });
  it('rejects a token signed with another secret and disables demo login and sessions together', () => {
    process.env.DEMO_AUTH_ENABLED = 'true';
    process.env.DEMO_AUTH_SECRET = 'first-secret-with-at-least-thirty-two-characters';
    const token = issueDemoToken(randomUUID());
    process.env.DEMO_AUTH_SECRET = 'second-secret-with-at-least-thirty-two-characters';
    expect(readDemoTenant(`Bearer ${token}`)).toBeUndefined();
    process.env.DEMO_AUTH_ENABLED = 'false';
    expect(() => issueDemoToken(randomUUID())).toThrow(UnauthorizedException);
    expect(readDemoTenant(`Bearer ${token}`)).toBeUndefined();
  });
  it('requires explicit production opt-in and a configured secret', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEMO_AUTH_ENABLED;
    expect(() => issueDemoToken(randomUUID())).toThrow(UnauthorizedException);
    process.env.DEMO_AUTH_ENABLED = 'true';
    delete process.env.DEMO_AUTH_SECRET;
    expect(() => issueDemoToken(randomUUID())).toThrow('DEMO_AUTH_SECRET');
  });
});
