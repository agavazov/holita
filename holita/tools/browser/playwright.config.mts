import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'holita.smoke.spec.mts',
  timeout: 1_200_000,
  expect: { timeout: 15_000 },
  use: {
    browserName: 'chromium',
    headless: true,
    actionTimeout: 30_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  reporter: [['list']],
});
