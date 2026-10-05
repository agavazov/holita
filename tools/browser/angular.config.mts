import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

export default defineConfig(base, {
  testMatch: 'angular-foundation.smoke.spec.mts',
  testIgnore: [],
  outputDir: '../../test-results/angular-browser',
});
