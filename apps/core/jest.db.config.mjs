import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'core:db',
  testMatch: ['<rootDir>/test/**/*.db.spec.ts'],
  testTimeout: 60000,
};
