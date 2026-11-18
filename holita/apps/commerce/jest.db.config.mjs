import preset from '../../../jest.preset.mjs';

export default {
  ...preset,
  rootDir: import.meta.dirname,
  displayName: 'holita-commerce:db',
  testMatch: ['<rootDir>/test/**/*.db.spec.ts'],
};
