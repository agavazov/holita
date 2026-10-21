import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { expect, test as base, type Page } from '@playwright/test';
import { workspaceRoot } from '../graphql/contracts.mjs';
import { createFederationFixture } from '../graphql/federation-fixture.mjs';

export async function chooseBranch(page: Page, name: string): Promise<void> {
  await page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: /^(Branch|Клон):/ })
    .click();
  await chooseMenuItem(page, name);
}

/** PrimeNG handles item activation on the item's link, rather than its menuitem container. */
export async function chooseMenuItem(page: Page, name: string | RegExp): Promise<void> {
  const item = page.getByRole('menuitem', { name, exact: typeof name === 'string' });
  const menuId = await item.evaluate((element) => element.closest('[role="menu"][id]')?.id);
  if (!menuId) {
    throw new Error('The selected menu item has no owning menu ID.');
  }
  const popup = page.locator(`[id="${menuId}"]`);
  await item.locator('a').click();
  // Theme commands change the item's label before the popup's leave animation finishes.
  await expect(popup).toBeHidden();
}

export async function chooseLanguage(page: Page, name: 'English' | 'Български'): Promise<void> {
  await page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: /^(Language|Език):/ })
    .click();
  await chooseMenuItem(page, name);
}

export async function setDarkTheme(page: Page, dark: boolean): Promise<void> {
  if (
    (await page.locator('html').evaluate((element) => element.classList.contains('app-dark'))) ===
    dark
  ) {
    return;
  }
  await page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: /^(Account|Профил):/ })
    .click();
  await chooseMenuItem(
    page,
    dark ? /^(Use dark theme|Включи тъмна тема)$/ : /^(Use light theme|Включи светла тема)$/,
  );
  await expect(page.locator('html')).toHaveClass(dark ? /app-dark/ : /^(?!.*app-dark)/);
}

export async function signOut(page: Page): Promise<void> {
  await page
    .locator('holita-admin-topbar')
    .getByRole('button', { name: /^(Account|Профил):/ })
    .click();
  await chooseMenuItem(page, /^(Sign out|Изход)$/);
}

export const test = base.extend<{
  app: {
    url: string;
    gatewayUrl: string;
    demoSession: { token: string; tenant: { id: string; name: string } };
    karma: Awaited<ReturnType<typeof createFederationFixture>>['karma'];
  };
  demoSignedIn: boolean;
  fleetEnabled: boolean;
  deviceOperations: boolean;
  deviceConfigurationWrites: boolean;
}>({
  demoSignedIn: [true, { option: true }],
  page: async ({ page, app, demoSignedIn }, use) => {
    if (demoSignedIn) {
      await page.addInitScript((session) => {
        sessionStorage.setItem(
          'holita.admin.demo-session',
          JSON.stringify({ ...session, branchId: '10000000-0000-4000-8000-000000000001' }),
        );
      }, app.demoSession);
    }
    await use(page);
  },
  fleetEnabled: [true, { option: true }],
  deviceOperations: [false, { option: true }],
  deviceConfigurationWrites: [false, { option: true }],
  app: [
    async ({ browserName, fleetEnabled, deviceOperations, deviceConfigurationWrites }, use) => {
      if (browserName !== 'chromium') {
        throw new Error('This focused smoke target uses Chromium.');
      }
      const root = join(workspaceRoot, 'apps/admin/dist/browser');
      let gatewayUrl: string | undefined;
      const server = createServer((request, response) => {
        void (async () => {
          const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
          if (pathname === '/config.json') {
            if (!gatewayUrl) {
              throw new Error('The test gateway is not ready.');
            }
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ graphqlUrl: gatewayUrl, fleetEnabled }));
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
            ) {
              throw error;
            }
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
          response.writeHead(200, {
            'content-type': types[extension] ?? 'application/octet-stream',
          });
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
        if (!address || typeof address === 'string') {
          throw new Error('Missing Angular fixture port.');
        }
        const url = `http://127.0.0.1:${String(address.port)}`;
        const backend = await createFederationFixture({
          adminOrigin: url,
          fleetEnabled,
          deviceOperations,
          deviceConfigurationWrites,
        });
        try {
          gatewayUrl = backend.url;
          const demoSession = backend.demoSession;
          await use({ url, gatewayUrl, demoSession, karma: backend.karma });
        } finally {
          await backend.close();
        }
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
          server.closeAllConnections();
        });
      }
    },
    { timeout: 120000 },
  ],
});
