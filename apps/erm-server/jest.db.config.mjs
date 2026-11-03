import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'erm-server:db',
  testMatch: ['<rootDir>/test/**/*.db.spec.ts'],
  testTimeout: 60000,
  maxWorkers: 2,
};
