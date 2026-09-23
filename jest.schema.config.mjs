import { createDefaultEsmPreset } from 'ts-jest';

export default {
  ...createDefaultEsmPreset({ tsconfig: './tools/tsconfig.json' }),
  rootDir: import.meta.dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tools/graphql/**/*.unit.spec.mts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.mjs$': '$1.mts' },
  clearMocks: true,
};
