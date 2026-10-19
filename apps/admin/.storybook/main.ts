import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: { name: '@storybook/angular-vite', options: {} },
  core: { disableTelemetry: true },
  // Keep Vite's public directory for local development; static builds copy only the fonts.
  staticDirs: (dirs, { configType }) =>
    configType === 'PRODUCTION'
      ? [...(dirs ?? []), { from: '../public/fonts', to: '/fonts' }]
      : dirs,
  viteFinal: (viteConfig, { configType }) =>
    configType === 'PRODUCTION'
      ? { ...viteConfig, build: { ...viteConfig.build, copyPublicDir: false } }
      : viteConfig,
};

export default config;
