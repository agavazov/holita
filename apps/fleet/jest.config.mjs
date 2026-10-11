import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'fleet',
  testMatch: [...preset.testMatch, '<rootDir>/test/**/*.unit.spec.ts'],
};
