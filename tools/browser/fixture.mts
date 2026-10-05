import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer as createPortReservation } from 'node:net';
import { test as base } from '@playwright/test';
import { createServer } from 'vite';

import { workspaceRoot } from '../graphql/contracts.mjs';
import { createFederationFixture } from '../graphql/federation-fixture.mjs';

export const test = base.extend<{
  referenceEnabled: boolean;
  app: { url: string; gatewayUrl: string };
}>({
  referenceEnabled: [true, { option: true }],
  app: async ({ browserName, referenceEnabled }, use) => {
    if (browserName !== 'chromium') throw new Error('This focused smoke target uses Chromium.');
    const reservation = createPortReservation();
    async function releasePort() {
      if (!reservation.listening) return;
      await new Promise<void>((resolve, reject) => {
        reservation.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    try {
      const listening = once(reservation, 'listening');
      reservation.listen(0, '127.0.0.1');
      await listening;
      const address = reservation.address();
      if (!address || typeof address === 'string') throw new Error('Missing ephemeral admin port');
      const port = address.port;
      const url = `http://127.0.0.1:${String(port)}`;
      // Keep the admin port occupied while the backend selects its own ephemeral ports.
      const backend = await createFederationFixture({ adminOrigin: url, referenceEnabled });
      try {
        const cacheDir = await mkdtemp(join(tmpdir(), 'holita-real-smoke-'));
        try {
          const admin = await createServer({
            cacheDir,
            root: join(workspaceRoot, 'apps/admin-react'),
            configFile: join(workspaceRoot, 'apps/admin-react/vite.config.ts'),
            envFile: false,
            define: {
              'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('graphql'),
              'import.meta.env.VITE_GATEWAY_URL': JSON.stringify(backend.url),
              'import.meta.env.VITE_REFERENCE_ENABLED': JSON.stringify(String(referenceEnabled)),
            },
            server: { host: '127.0.0.1', port, strictPort: true },
            logLevel: 'error',
          });
          try {
            await releasePort();
            await admin.listen();
            await use({ url, gatewayUrl: backend.url });
          } finally {
            await admin.close();
          }
        } finally {
          await rm(cacheDir, { recursive: true, force: true });
        }
      } finally {
        await backend.close();
      }
    } finally {
      await releasePort();
    }
  },
});
