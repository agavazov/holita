import { defineConfig } from '@playwright/test';

// Visual review of the static admin Storybook. Missing or changed screenshots fail and are written
// to test-results as candidates; baselines change only through an explicit --update-snapshots run
// after a person approves the candidates.
export default defineConfig({
  testDir: '.',
  testMatch: 'storybook-visual.spec.mts',
  outputDir: '../../test-results/storybook-visual',
  snapshotPathTemplate: '{testDir}/../../.references/review/storybook-baselines/{arg}{ext}',
  updateSnapshots: 'none',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../playwright-report/storybook-visual', open: 'never' }],
  ],
  use: {
    browserName: 'chromium',
    headless: true,
    locale: 'bg-BG',
    timezoneId: 'Europe/Sofia',
    colorScheme: 'light',
    deviceScaleFactor: 1,
  },
});
