import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { storybookAngularVitest } from '@storybook/angular-vite/vitest';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Runs every story as a test in Chromium: rendering, play functions and axe checks
// (`a11y.test: 'error'` in preview.ts). Not read by `ng test`, which ignores Vitest configs.
const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    // The same styles and SCSS paths as the Storybook targets in angular.json.
    storybookAngularVitest({
      tsConfig: join(configDir, 'tsconfig.json'),
      styles: ['src/styles.scss'],
      stylePreprocessorOptions: { loadPaths: ['src/styles'] },
    }),
    storybookTest({ configDir }),
  ],
  // Scan every story up front: a dependency discovered mid-run makes Vite re-optimize and reload,
  // which loads Angular twice (NG0203) and fails the stories of that run.
  optimizeDeps: {
    entries: ['src/**/*.stories.ts', '.storybook/preview.ts'],
  },
  test: {
    name: 'storybook',
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: 'chromium' }],
    },
  },
});
