import { defineConfig } from '@playwright/test';

const screenshots = process.env['HOLITA_BROWSER_SCREENSHOTS'] === '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'angular-*.smoke.spec.mts',
  outputDir: '../../test-results/angular-browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: screenshots ? 'only-on-failure' : 'off',
    trace: {
      mode: 'retain-on-failure',
      screenshots,
      snapshots: { dom: true, aria: true, screen: screenshots },
    },
  },
});
