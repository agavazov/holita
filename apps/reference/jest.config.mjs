import preset from '../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'reference',
  testMatch: [...preset.testMatch, '<rootDir>/test/**/*.unit.spec.ts'],
};
