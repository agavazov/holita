import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'fleet:db',
  testMatch: ['<rootDir>/test/**/*.db.spec.ts'],
  testTimeout: 60000,
  // Files share no state: each deploys its own schema. `--runInBand` still overrides this.
  maxWorkers: 2,
};
