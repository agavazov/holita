import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'erm-server:db',
  testMatch: ['<rootDir>/test/**/*.db.spec.ts'],
  testTimeout: 120000,
  maxWorkers: 2,
};
