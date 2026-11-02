import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/angular-vite', options: {} },
  // Storybook listens on all interfaces; accept the LAN name used to open it from other devices.
  core: { disableTelemetry: true, allowedHosts: ['dev.lab'] },
};

export default config;
