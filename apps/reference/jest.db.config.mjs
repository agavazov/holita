import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'reference:db',
  testMatch: ['<rootDir>/test/**/*.db.spec.ts'],
  testTimeout: 60000,
};
