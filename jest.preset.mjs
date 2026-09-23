import { createDefaultEsmPreset } from 'ts-jest';

/** @type {import('jest').Config} */
const config = {
  ...createDefaultEsmPreset(),
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['reflect-metadata'],
  clearMocks: true,
};

export default config;
