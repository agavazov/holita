import { createDefaultEsmPreset } from 'ts-jest';

export default {
  ...createDefaultEsmPreset({ tsconfig: './discocan/tools/tsconfig.json' }),
  rootDir: import.meta.dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/discocan/tools/graphql/**/*.db.spec.mts'],
  testTimeout: 60000,
  modulePathIgnorePatterns: [
    '<rootDir>/.tmp/',
    '<rootDir>/.misc/',
    '<rootDir>/.credentials/',
    '<rootDir>/.volumes/',
    '<rootDir>/.references/',
  ],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.mjs$': '$1.mts' },
};
