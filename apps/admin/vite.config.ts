import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { msw } from 'msw/vite';
import { readDataSource } from './src/config.js';

export default defineConfig(({ mode, command }) => {
  const dataSource = readDataSource(
    process.env.VITE_DATA_SOURCE ??
      loadEnv(mode, process.cwd(), 'VITE_DATA_SOURCE').VITE_DATA_SOURCE,
  );
  return {
    cacheDir: `node_modules/.vite/${dataSource}`,
    plugins: [
      react(),
      ...(command === 'serve' || dataSource === 'mock' ? [msw({ mode: 'worker-only' })] : []),
    ],
    define: { 'import.meta.env.VITE_DATA_SOURCE': JSON.stringify(dataSource) },
    server: {
      host: '127.0.0.1',
      port: dataSource === 'mock' ? 11087 : 11081,
      strictPort: true,
    },
  };
});
