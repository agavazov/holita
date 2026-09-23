import { describe, expect, it } from '@jest/globals';
import { getTestDatabaseUrl } from './test-database-url.js';

const valid = 'postgresql://holita_products_test:local@127.0.0.1:11084/holita_products_test';

describe('test database URL guard', () => {
  it('accepts only the dedicated local test identity', () => {
    expect(getTestDatabaseUrl(valid)).toBe(valid);
  });
  it.each([
    'invalid-url-with-private-content',
    valid.replace('11084/holita_products_test', '11084/holita_products'),
    valid.replace('holita_products_test:', 'holita_admin:'),
    valid.replace('127.0.0.1', 'db.example.com'),
    valid + '?schema=public',
    valid + '?options=-csearch_path=public',
    valid.replace(':local@', '@'),
    valid.replace('11084/holita_products_test', '11084/holita_core_test'),
  ])('rejects unsafe test configuration %s', (value) => {
    expect(() => getTestDatabaseUrl(value)).toThrow('dedicated local');
  });
});
