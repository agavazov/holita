import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Process the packages' ESM imports through Vite, as in the browser build.
    server: { deps: { inline: ['@refinedev/graphql', '@refinedev/react-router'] } },
    environment: 'jsdom',
    // Nx already runs projects concurrently; run DOM-heavy files one at a time.
    fileParallelism: false,
    // Multi-step Ant Design/Refine workflows share CPU with backend and DB tests.
    testTimeout: 30_000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
