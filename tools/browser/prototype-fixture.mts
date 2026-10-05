import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base } from '@playwright/test';
import { createServer } from 'vite';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { availablePort } from '../graphql/federation-fixture.mjs';

// This fixture starts only Vite. Prototype must work with no backend or database.
export const test = base.extend<{ app: { url: string } }>({
  app: async ({ browserName }, use) => {
    if (browserName !== 'chromium') throw new Error('This focused smoke target uses Chromium.');
    const port = await availablePort();
    const cacheDir = await mkdtemp(join(tmpdir(), 'holita-prototype-smoke-'));
    try {
      const admin = await createServer({
        cacheDir,
        root: join(workspaceRoot, 'apps/admin-react'),
        configFile: join(workspaceRoot, 'apps/admin-react/vite.config.ts'),
        envFile: false,
        define: {
          'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('mock'),
          'import.meta.env.VITE_GATEWAY_URL': JSON.stringify('https://unavailable.example/graphql'),
          'import.meta.env.VITE_REFERENCE_ENABLED': JSON.stringify('false'),
        },
        server: { host: '127.0.0.1', port, strictPort: true },
        logLevel: 'error',
      });
      try {
        await admin.listen();
        await use({ url: `http://127.0.0.1:${String(port)}` });
      } finally {
        await admin.close();
      }
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  },
});
