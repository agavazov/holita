import { expect, test, type Locator, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from 'dotenv';
import pg from 'pg';

const root = resolve(import.meta.dirname, '../../..');
config({
  path: [
    join(root, 'holita/config/core.env'),
    join(root, 'holita/config/commerce.env'),
    join(root, 'holita/config/seed-accounts.env'),
  ],
  quiet: true,
  override: true,
});

function testUrl(service: 'core' | 'commerce'): URL {
  const name = `holita_${service}_test`;
  const value = process.env[`${service.toUpperCase()}_TEST_DATABASE_URL`];
  if (!value) {
    throw new Error('The dedicated Holita test database is required');
  }
  const url = new URL(value);
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== `/${name}` ||
    url.username !== name ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use only the dedicated local Holita test database and role');
  }
  return url;
}

async function database(service: 'core' | 'commerce') {
  const url = testUrl(service);
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  await client.connect();
  let created = false;
  try {
    await client.query(`CREATE SCHEMA ${pg.escapeIdentifier(schema)}`);
    created = true;
    await client.query(`SET search_path TO ${pg.escapeIdentifier(schema)}`);
    const migrations = join(
      root,
      service === 'core'
        ? 'osnova/apps/core/prisma/migrations'
        : 'holita/apps/commerce/prisma/migrations',
    );
    const directories = (await readdir(migrations, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const directory of directories) {
      await client.query(await readFile(join(migrations, directory, 'migration.sql'), 'utf8'));
    }
    url.searchParams.set('schema', schema);
    return {
      url: url.toString(),
      close: async () => {
        await client.query(`DROP SCHEMA ${pg.escapeIdentifier(schema)} CASCADE`);
        await client.end();
      },
    };
  } catch (error: unknown) {
    if (created) {
      await client.query(`DROP SCHEMA ${pg.escapeIdentifier(schema)} CASCADE`);
    }
    await client.end();
    throw error;
  }
}

async function port(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePort);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Missing test port');
  }
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolveClose();
      }
    }),
  );
  return address.port;
}

async function waitReady(
  url: string,
  child: ChildProcess,
  method: 'health' | 'graphql',
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(
        url,
        method === 'graphql'
          ? {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ query: '{_service{sdl}}' }),
            }
          : {},
      );
      if (response.ok) {
        return;
      }
    } catch {
      /* The child may still be starting. */
    }
    await delay(200);
  }
  throw new Error('An isolated test service did not become ready');
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((done) =>
      child.once('exit', () => {
        done();
      }),
    ),
    delay(5000),
  ]);
  child.kill('SIGKILL');
}

async function runSeed(env: NodeJS.ProcessEnv): Promise<void> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
    cwd: join(root, 'osnova/apps/core'),
    env,
    stdio: 'ignore',
  });
  const code = await new Promise<number | null>((done, reject) => {
    child.once('error', reject);
    child.once('exit', done);
  });
  if (code !== 0) {
    throw new Error('The isolated Core seed failed');
  }
}

async function serve(
  app: 'admin' | 'backoffice' | 'storefront',
  routerUrl: string,
  commerceOrigin?: string,
) {
  const directory = join(root, `holita/apps/${app}/dist/browser`);
  const server = createServer((request, response) => {
    void (async () => {
      if (request.url?.startsWith('/graphql')) {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
          }
        }
        const headers = new Headers();
        for (const key of [
          'content-type',
          'authorization',
          'x-branch-id',
          'x-request-id',
          'accept-language',
          'origin',
        ]) {
          const value = request.headers[key];
          if (typeof value === 'string') {
            headers.set(key, value);
          }
        }
        const upstream = await fetch(routerUrl, {
          method: 'POST',
          headers,
          body: Buffer.concat(chunks),
        });
        response.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') ?? 'application/json',
        });
        response.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (commerceOrigin && request.url?.startsWith('/media/brands/')) {
        const authorization = request.headers.authorization;
        const upstream = await fetch(new URL(request.url, commerceOrigin), {
          headers: authorization ? { authorization } : {},
        });
        response.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
          'cache-control': upstream.headers.get('cache-control') ?? 'no-store',
        });
        response.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const candidate = resolve(directory, `.${pathname}`);
      if (candidate !== directory && !candidate.startsWith(`${directory}/`)) {
        response.writeHead(404);
        response.end();
        return;
      }
      let data: Buffer;
      let servedPath = candidate;
      try {
        data = await readFile(candidate);
      } catch {
        servedPath = join(directory, 'index.html');
        data = await readFile(servedPath);
      }
      const mime: Record<string, string> = {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.woff': 'font/woff',
        '.html': 'text/html',
      };
      response.writeHead(200, { 'content-type': mime[extname(servedPath)] ?? 'text/html' });
      response.end(data);
    })().catch(() => {
      response.writeHead(503);
      response.end();
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Missing application test port');
  }
  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    close: async () => {
      await new Promise<void>((done, reject) =>
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            done();
          }
        }),
      );
      server.closeAllConnections();
    },
  };
}

async function secretFill(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((element, secret) => {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('Missing password input');
    }
    element.value = secret;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByRole('button', { name: 'Език' }).click();
  await page.getByText('English', { exact: true }).click();
  await page.locator('#sign-in-email').fill(email);
  await secretFill(page.locator('#sign-in-password'), password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function createShop(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: 'Create shop', exact: true }).click();
  await page.locator('#shop-name').fill(name);
  const branchResponse = page.waitForResponse(
    (response) => response.request().postData()?.includes('OperatorCreateBranch') === true,
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const branchValue: unknown = await (await branchResponse).json();
  if (
    typeof branchValue !== 'object' ||
    branchValue === null ||
    !('data' in branchValue) ||
    typeof branchValue.data !== 'object' ||
    branchValue.data === null ||
    !('createMerchantBranch' in branchValue.data) ||
    typeof branchValue.data.createMerchantBranch !== 'object' ||
    branchValue.data.createMerchantBranch === null ||
    !('id' in branchValue.data.createMerchantBranch) ||
    typeof branchValue.data.createMerchantBranch.id !== 'string'
  ) {
    throw new Error('Shop creation did not return an ID');
  }
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  return branchValue.data.createMerchantBranch.id;
}

test('staff creates a merchant and its administrator creates a product', async ({ browser }) => {
  const staffEmail = process.env.HOLITA_STAFF_EMAIL;
  const staffPassword = process.env.HOLITA_STAFF_PASSWORD;
  const internal = process.env.CORE_INTERNAL_AUTH_TOKEN;
  if (!staffEmail || !staffPassword || !internal) {
    throw new Error('Holita test seed configuration is required');
  }
  const cleanup: (() => Promise<void>)[] = [];
  const errors: unknown[] = [];
  try {
    const images = await mkdtemp(join(tmpdir(), 'holita-smoke-images-'));
    cleanup.push(() => rm(images, { recursive: true, force: true }));
    const coreDb = await database('core');
    cleanup.push(coreDb.close);
    const commerceDb = await database('commerce');
    cleanup.push(commerceDb.close);
    const corePort = await port();
    const commercePort = await port();
    const routerPort = await port();
    const healthPort = await port();
    const publicRouterPort = await port();
    const publicHealthPort = await port();
    const coreEnv = {
      ...process.env,
      CORE_DATABASE_URL: coreDb.url,
      CORE_TOKEN_PREFIX: 'holita',
      CORE_SEED_FILE: join(root, 'holita/config/core-seed.json'),
      PORT: String(corePort),
      DEMO_AUTH_ENABLED: 'false',
    };
    await runSeed(coreEnv);
    const core = spawn(process.execPath, ['dist/main.js'], {
      cwd: join(root, 'osnova/apps/core'),
      env: coreEnv,
      stdio: 'ignore',
    });
    cleanup.push(() => stopChild(core));
    await waitReady(`http://127.0.0.1:${String(corePort)}/health`, core, 'health');
    const commerce = spawn(process.execPath, ['dist/main.js'], {
      cwd: join(root, 'holita/apps/commerce'),
      env: {
        ...process.env,
        COMMERCE_DATABASE_URL: commerceDb.url,
        HOLITA_COMMERCE_IMAGE_DIR: images,
        CORE_INTERNAL_AUTH_TOKEN: internal,
        CORE_AUTH_VERIFY_URL: `http://127.0.0.1:${String(corePort)}/internal/auth/verify`,
        CORE_GRAPHQL_URL: `http://127.0.0.1:${String(corePort)}/graphql`,
        PORT: String(commercePort),
      },
      stdio: 'ignore',
    });
    cleanup.push(() => stopChild(commerce));
    const commerceOrigin = `http://127.0.0.1:${String(commercePort)}`;
    await waitReady(`${commerceOrigin}/graphql`, commerce, 'graphql');
    const routerUrl = `http://127.0.0.1:${String(routerPort)}/graphql`;
    const admin = await serve('admin', routerUrl, commerceOrigin);
    cleanup.push(admin.close);
    const backoffice = await serve('backoffice', routerUrl);
    cleanup.push(backoffice.close);
    const publicUrl = `http://127.0.0.1:${String(publicRouterPort)}/graphql`;
    const shopApp = await serve('storefront', publicUrl, commerceOrigin);
    cleanup.push(shopApp.close);
    const router = spawn(
      join(root, 'osnova/tools/router/dist/router'),
      [
        '--anonymous-telemetry-disabled',
        '--config',
        'router/router.yaml',
        '--supergraph',
        'src/generated/graphql/supergraph.graphql',
      ],
      {
        cwd: join(root, 'holita/apps/gateway'),
        env: {
          ...process.env,
          ROUTER_PORT: String(routerPort),
          ROUTER_HEALTH_PORT: String(healthPort),
          CORE_GRAPHQL_URL: `http://127.0.0.1:${String(corePort)}/graphql`,
          COMMERCE_GRAPHQL_URL: `http://127.0.0.1:${String(commercePort)}/graphql`,
          ADMIN_ORIGIN: admin.origin,
          BACKOFFICE_ORIGIN: backoffice.origin,
        },
        stdio: 'ignore',
      },
    );
    cleanup.push(() => stopChild(router));
    await waitReady(`http://127.0.0.1:${String(healthPort)}/health`, router, 'health');
    const publicRouter = spawn(
      join(root, 'osnova/tools/router/dist/router'),
      [
        '--anonymous-telemetry-disabled',
        '--config',
        'router/storefront.yaml',
        '--supergraph',
        'src/generated/storefront/supergraph.graphql',
      ],
      {
        cwd: join(root, 'holita/apps/gateway'),
        env: {
          ...process.env,
          STOREFRONT_ROUTER_PORT: String(publicRouterPort),
          STOREFRONT_ROUTER_HEALTH_PORT: String(publicHealthPort),
          STOREFRONT_COMMERCE_URL: `http://127.0.0.1:${String(commercePort)}/storefront/graphql`,
          STOREFRONT_ORIGIN: shopApp.origin,
        },
        stdio: 'ignore',
      },
    );
    cleanup.push(() => stopChild(publicRouter));
    await waitReady(`http://127.0.0.1:${String(publicHealthPort)}/health`, publicRouter, 'health');
    const staffContext = await browser.newContext();
    cleanup.push(() => staffContext.close());
    const staff = await staffContext.newPage();
    await staff.goto(backoffice.origin);
    await signIn(staff, staffEmail, staffPassword);
    await staff.getByRole('button', { name: 'Create merchant', exact: true }).click();
    const merchantName = `Merchant ${randomUUID()}`;
    const merchantEmail = `merchant-${randomUUID()}@example.test`;
    const merchantPassword = `Temporary-${randomUUID()}`;
    await staff.locator('#merchant-name').fill(merchantName);
    await staff.locator('#merchant-admin-name').fill('Merchant administrator');
    await staff.locator('#merchant-admin-email').fill(merchantEmail);
    await secretFill(staff.locator('#merchant-password'), merchantPassword);
    await staff.getByRole('button', { name: 'Save', exact: true }).click();
    await staff.getByRole('link', { name: merchantName }).click();
    const shopId = await createShop(staff, 'First shop');
    const merchantContext = await browser.newContext();
    cleanup.push(() => merchantContext.close());
    const merchant = await merchantContext.newPage();
    await merchant.goto(admin.origin);
    await signIn(merchant, merchantEmail, merchantPassword);
    await merchant.getByRole('link', { name: 'Brands', exact: true }).click();
    await merchant.getByRole('button', { name: 'Add brand', exact: true }).click();
    await merchant.locator('#brand-name').fill('Smoke Brand');
    await merchant
      .locator('input[type=file]')
      .setInputFiles(join(root, 'holita/config/demo/northline.png'));
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(merchant.getByRole('button', { name: 'Smoke Brand', exact: true })).toBeVisible();
    await merchant.getByRole('link', { name: 'Products', exact: true }).click();
    await merchant.getByRole('button', { name: 'Create product', exact: true }).click();
    const productName = `Product ${randomUUID()}`;
    await merchant.locator('#product-name').fill(productName);
    await merchant.locator('#product-price').fill('25.50');
    await merchant.locator('p-select[formcontrolname="status"]').click();
    await merchant.getByRole('option', { name: 'Active', exact: true }).click();
    await merchant.locator('#product-brand').click();
    await merchant.getByRole('option', { name: 'Smoke Brand', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(merchant.getByText(productName, { exact: true })).toBeVisible();
    const shopperContext = await browser.newContext();
    cleanup.push(() => shopperContext.close());
    const shopper = await shopperContext.newPage();
    await shopper.goto(`${shopApp.origin}/s/${shopId}`);
    await shopper.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(shopper.getByRole('link', { name: productName })).toBeVisible();
    await expect(shopper.getByText('Smoke Brand', { exact: true })).toBeVisible();
    await shopper.getByRole('link', { name: productName }).click();
    await expect(shopper.getByText('Smoke Brand', { exact: true })).toBeVisible();
    const logo = await shopper.locator('.product-brand img').getAttribute('src');
    if (!logo) {
      throw new Error('Missing storefront brand logo');
    }
    const image = await shopper.request.get(new URL(logo, shopApp.origin).href);
    expect(image.status()).toBe(200);
    const logoBytes = await readFile(join(root, 'holita/config/demo/northline.png'));
    expect(await image.body()).toEqual(logoBytes);
    const productUrl = shopper.url();
    const secondShopId = await createShop(staff, 'Second shop');
    await shopper.goto(`${shopApp.origin}/s/${secondShopId}`);
    await expect(shopper.getByRole('link', { name: 'Second shop', exact: true })).toBeVisible();
    const foreignImage = logo.replace(shopId, secondShopId);
    expect((await shopper.request.get(new URL(foreignImage, shopApp.origin).href)).status()).toBe(
      404,
    );
    await merchant.getByRole('link', { name: 'Brands', exact: true }).click();
    await merchant.getByRole('button', { name: 'Smoke Brand', exact: true }).click();
    await expect(merchant.getByRole('img', { name: 'Logo', exact: true })).toBeVisible();
    await merchant.locator('#brand-name').fill('Smoke Brand revised');
    await merchant.locator('#brand-status').click();
    await merchant.getByRole('option', { name: 'Hidden', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      merchant.getByRole('button', { name: 'Smoke Brand revised', exact: true }),
    ).toBeVisible();
    expect((await shopper.request.get(new URL(logo, shopApp.origin).href)).status()).toBe(404);
    const preview = merchant.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === logo && response.request().method() === 'GET',
    );
    await merchant.getByRole('button', { name: 'Smoke Brand revised', exact: true }).click();
    const hiddenImage = await preview;
    expect(hiddenImage.status()).toBe(200);
    expect(await hiddenImage.body()).toEqual(logoBytes);
    await merchant
      .getByRole('dialog', { name: 'Edit brand' })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await shopper.goto(productUrl);
    await expect(shopper.getByRole('heading', { name: productName })).toBeVisible();
    await expect(shopper.locator('.product-brand')).toHaveCount(0);
    await merchant
      .getByRole('button', { name: 'Actions for Smoke Brand revised', exact: true })
      .click();
    await merchant.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await merchant.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(merchant.getByText('No brands yet', { exact: true })).toBeVisible();
    await shopper.getByRole('link', { name: 'My account' }).click();
    await shopper.getByRole('link', { name: 'Register', exact: true }).click();
    await shopper.locator('#name').fill('Shopper');
    await shopper.locator('#email').fill(`shopper-${randomUUID()}@example.test`);
    await secretFill(shopper.locator('#password'), `Temporary-${randomUUID()}`);
    await shopper.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(shopper.getByText('Shopper', { exact: true })).toBeVisible();
    await shopper.getByRole('link', { name: 'Products', exact: true }).click();
    await expect(shopper.getByRole('link', { name: productName })).toBeVisible();
    await merchant.getByRole('link', { name: 'Customers', exact: true }).click();
    await expect(merchant.getByText('Shopper', { exact: true })).toBeVisible();
  } finally {
    for (const close of cleanup.reverse()) {
      try {
        await close();
      } catch (error: unknown) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Isolated smoke cleanup failed');
  }
});
