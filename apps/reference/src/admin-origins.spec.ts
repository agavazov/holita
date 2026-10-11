import { describe, expect, it } from '@jest/globals';
import { referenceAdminOrigins } from './admin-origins.js';

describe('Reference upload origins', () => {
  it('allows only the explicit default Angular loopback origins', () => {
    expect(referenceAdminOrigins(undefined, undefined)).toEqual([
      'http://127.0.0.1:11000',
      'http://localhost:11000',
    ]);
  });
  it('deduplicates an explicit allowlist and preserves the legacy single origin', () => {
    expect(
      referenceAdminOrigins(
        ' https://admin.example.com,http://localhost:11000,https://admin.example.com ',
        'https://legacy.example.com',
      ),
    ).toEqual(['https://admin.example.com', 'http://localhost:11000']);
    expect(referenceAdminOrigins(undefined, 'https://admin.example.com')).toEqual([
      'https://admin.example.com',
    ]);
  });
  it.each([
    '',
    '*',
    'https://admin.example.com/',
    'https://user:secret@admin.example.com',
    'https://admin.example.com/path',
    'https://admin.example.com?x=1',
    'null',
    'ftp://admin.example.com',
    'https://admin.example.com,',
  ])('rejects a non-origin allowlist: %s', (value) => {
    expect(() => referenceAdminOrigins(value, undefined)).toThrow('exact HTTP(S) origins');
  });
});
