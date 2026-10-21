import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const reviewDirectory = fileURLToPath(new URL('../../.references/review/', import.meta.url));

// Visual review of the static admin Storybook. Missing or changed screenshots fail and are written
// under .references/review as candidates; baselines change only through an explicit --update-snapshots run
// after a person approves the candidates.
export default defineConfig({
  testDir: '.',
  testMatch: 'storybook-visual.spec.mts',
  outputDir: join(reviewDirectory, 'storybook-visual-results'),
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
    ['html', { outputFolder: join(reviewDirectory, 'storybook-visual-report'), open: 'never' }],
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
