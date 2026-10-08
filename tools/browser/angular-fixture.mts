import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { expect, test as base, type Page } from '@playwright/test';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { createFederationFixture } from '../graphql/federation-fixture.mjs';

export async function chooseStore(page: Page, name: string): Promise<void> {
  const selector = page.getByRole('combobox', { name: /^(Store|Магазин)$/ });
  const panel = page.getByRole('listbox', { includeHidden: true });
  await expect(panel).toHaveCount(0);
  await selector.click();
  await expect(selector).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('option', { name, exact: true }).click();
  await expect(selector).toHaveAttribute('aria-expanded', 'false');
  // Wait for the closing overlay to detach before another store selection can reopen it.
  await expect(panel).toHaveCount(0);
}

export const test = base.extend<{
  app: { url: string; gatewayUrl: string };
  referenceEnabled: boolean;
  dataSource: 'graphql' | 'mock';
}>({
  referenceEnabled: [true, { option: true }],
  dataSource: ['graphql', { option: true }],
  app: async ({ browserName, referenceEnabled, dataSource }, use) => {
    if (browserName !== 'chromium') throw new Error('This focused smoke target uses Chromium.');
    const root = join(workspaceRoot, 'apps/admin/dist/browser');
    let gatewayUrl: string | undefined;
    const server = createServer((request, response) => {
      void (async () => {
        const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
        if (pathname === '/config.json') {
          if (!gatewayUrl) throw new Error('The test gateway is not ready.');
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ graphqlUrl: gatewayUrl, referenceEnabled, dataSource }));
          return;
        }
        const path =
          pathname === '/'
            ? join(root, 'index.html')
            : resolve(root, '.' + decodeURIComponent(pathname));
        if (!path.startsWith(root + sep)) {
          response.writeHead(400);
          response.end();
          return;
        }
        let file: Buffer;
        let extension = extname(path);
        try {
          file = await readFile(path);
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !('code' in error) ||
            !['ENOENT', 'EISDIR'].includes(String(error.code))
          )
            throw error;
          if (!request.headers.accept?.includes('text/html')) {
            response.writeHead(404);
            response.end();
            return;
          }
          file = await readFile(join(root, 'index.html'));
          extension = '.html';
        }
        const types: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.webp': 'image/webp',
        };
        response.writeHead(200, { 'content-type': types[extension] ?? 'application/octet-stream' });
        response.end(file);
      })().catch((error: unknown) => {
        console.error(error);
        response.writeHead(500);
        response.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing Angular fixture port.');
      const url = `http://127.0.0.1:${String(address.port)}`;
      if (dataSource === 'mock') {
        gatewayUrl = 'https://unavailable.example/graphql';
        await use({ url, gatewayUrl });
        return;
      }
      const backend = await createFederationFixture({ adminOrigin: url, referenceEnabled });
      try {
        gatewayUrl = backend.url;
        await use({ url, gatewayUrl });
      } finally {
        await backend.close();
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        server.closeAllConnections();
      });
    }
  },
});
