import { describe, expect, it } from '@jest/globals';
import { guardedTestUrl } from './federation-fixture.mjs';

describe('whole-graph test database guard', () => {
  it.each(['core', 'products', 'reference'] as const)(
    'limits %s setup and cleanup to its dedicated local test database',
    (service) => {
      const name = `holita_${service}_test`;
      const valid = `postgresql://${name}:local@127.0.0.1:11084/${name}`;
      expect(guardedTestUrl(service, valid).pathname).toBe(`/${name}`);
      for (const value of [
        valid.replace(`11084/${name}`, `11084/holita_${service}`),
        valid.replace(`${name}:`, 'holita_admin:'),
        valid.replace('127.0.0.1', 'example.com'),
        valid + '?schema=public',
        'malformed-private-value',
      ]) {
        expect(() => guardedTestUrl(service, value)).toThrow(/dedicated local/);
      }
    },
  );
});
