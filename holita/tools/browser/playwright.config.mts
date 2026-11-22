import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'holita.smoke.spec.mts',
  timeout: 360_000,
  use: {
    browserName: 'chromium',
    headless: true,
    actionTimeout: 15000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  reporter: [['list']],
});
