import config from './jest.schema.config.mjs';

export default {
  ...config,
  testMatch: ['<rootDir>/tools/graphql/**/*.db.spec.mts'],
  testTimeout: 60000,
};
