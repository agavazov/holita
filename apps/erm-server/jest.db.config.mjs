import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'erm-server:db',
  testMatch: ['<rootDir>/test/**/*.db.spec.ts'],
  // The capture spec alone ran 223 s on 2026-11-18.
  testTimeout: 600000,
  maxWorkers: 2,
};
