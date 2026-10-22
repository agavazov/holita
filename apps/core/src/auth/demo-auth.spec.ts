import { afterEach, describe, expect, it } from '@jest/globals';
import { createHmac, randomUUID } from 'node:crypto';
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

function attempt(action: () => string | undefined): string | undefined {
  try {
    return action();
  } catch (error: unknown) {
    return error instanceof Error ? `${error.name}: ${error.message}` : 'Unexpected failure';
  }
}

describe('Demo tenant session verification', () => {
  it('verifies only correctly signed, unexpired demo sessions and keeps demo login off in production without explicit opt-in', () => {
    const secret = 'first-secret-with-at-least-thirty-two-characters';
    process.env.DEMO_AUTH_SECRET = secret;
    process.env.DEMO_AUTH_ENABLED = 'true';
    const tenantId = randomUUID();
    const token = issueDemoToken(tenantId);
    const expired = `holita-demo.${tenantId}.${String(Math.floor(Date.now() / 1000) - 1)}`;
    const signature = createHmac('sha256', secret).update(expired).digest('base64url');
    for (const [row, header, expected] of [
      ['issued token', `Bearer ${token}`, tenantId],
      ['tampered tenant', `Bearer ${token.replace(tenantId, randomUUID())}`, undefined],
      ['expired token', `Bearer ${expired}.${signature}`, undefined],
      ['missing Bearer prefix', token, undefined],
      ['header array', [`Bearer ${token}`], undefined],
      ['header over 256 characters', `Bearer ${'x'.repeat(1000)}`, undefined],
      ['missing header', undefined, undefined],
    ] satisfies [string, unknown, string | undefined][]) {
      expect({ row, value: readDemoTenant(header) }).toEqual({ row, value: expected });
    }
    expect(attempt(() => requireTenant({ tenantId: undefined }))).toBe(
      'UnauthorizedException: Sign in to a tenant first',
    );
    const disabled = 'UnauthorizedException: Demo login is disabled';
    const unconfigured = 'Error: DEMO_AUTH_SECRET must contain at least 32 characters.';
    for (const [row, configure, issued, verified] of [
      [
        'another secret',
        () => {
          process.env.DEMO_AUTH_SECRET = 'second-secret-with-at-least-thirty-two-characters';
        },
        'issued',
        undefined,
      ],
      [
        'demo login disabled',
        () => {
          process.env.DEMO_AUTH_ENABLED = 'false';
        },
        disabled,
        undefined,
      ],
      [
        'production without explicit opt-in',
        () => {
          process.env.NODE_ENV = 'production';
          delete process.env.DEMO_AUTH_ENABLED;
        },
        disabled,
        undefined,
      ],
      [
        'production without a secret',
        () => {
          process.env.NODE_ENV = 'production';
          delete process.env.DEMO_AUTH_SECRET;
        },
        unconfigured,
        unconfigured,
      ],
    ] satisfies [string, () => void, string, string | undefined][]) {
      process.env.DEMO_AUTH_SECRET = secret;
      process.env.DEMO_AUTH_ENABLED = 'true';
      process.env.NODE_ENV = 'test';
      configure();
      const actual = {
        issued: attempt(() => {
          issueDemoToken(randomUUID());
          return 'issued';
        }),
        verified: attempt(() => readDemoTenant(`Bearer ${token}`)),
      };
      expect({ row, value: actual }).toEqual({ row, value: { issued, verified } });
    }
  });
});
