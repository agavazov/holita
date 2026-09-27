import { join } from 'node:path';
import { test as base } from '@playwright/test';
import { createServer } from 'vite';

import { workspaceRoot } from '../graphql/contracts.mjs';
import { availablePort, createFederationFixture } from '../graphql/federation-fixture.mjs';

export const test = base.extend<{
  referenceEnabled: boolean;
  app: { url: string; gatewayUrl: string };
}>({
  referenceEnabled: [true, { option: true }],
  app: async ({ browserName, referenceEnabled }, use) => {
    if (browserName !== 'chromium') throw new Error('This focused smoke target uses Chromium.');
    const port = await availablePort();
    const url = `http://127.0.0.1:${String(port)}`;
    const backend = await createFederationFixture({ adminOrigin: url, referenceEnabled });
    try {
      const admin = await createServer({
        root: join(workspaceRoot, 'apps/admin'),
        configFile: join(workspaceRoot, 'apps/admin/vite.config.ts'),
        envFile: false,
        define: {
          'import.meta.env.VITE_GATEWAY_URL': JSON.stringify(backend.url),
          'import.meta.env.VITE_REFERENCE_ENABLED': JSON.stringify(String(referenceEnabled)),
        },
        server: { host: '127.0.0.1', port, strictPort: true },
        logLevel: 'error',
      });
      try {
        await admin.listen();
        await use({ url, gatewayUrl: backend.url });
      } finally {
        await admin.close();
      }
    } finally {
      await backend.close();
    }
  },
});
