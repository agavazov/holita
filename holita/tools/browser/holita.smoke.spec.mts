import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { hash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { crc32 } from 'node:zlib';
import { config } from 'dotenv';
import pg from 'pg';

const root = resolve(import.meta.dirname, '../../..');
config({
  path: [
    join(root, 'holita/config/core.env'),
    join(root, 'holita/config/commerce.env'),
    join(root, 'holita/config/sales.env'),
    join(root, 'holita/config/seed-accounts.env'),
  ],
  quiet: true,
  override: true,
});

const migrationPaths = {
  core: 'osnova/apps/core/prisma/migrations',
  commerce: 'holita/apps/commerce/prisma/migrations',
  sales: 'holita/apps/sales-api/prisma/migrations',
};
type TestDatabase = keyof typeof migrationPaths;

function testUrl(service: TestDatabase): URL {
  const name = `holita_${service}_test`;
  const value = process.env[`${service.toUpperCase()}_TEST_DATABASE_URL`];
  if (!value) {
    throw new Error('The dedicated Holita test database is required');
  }
  const url = URL.parse(value);
  if (
    !url ||
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

async function database(service: TestDatabase) {
  const url = testUrl(service);
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  await client.connect();
  let created = false;
  try {
    await client.query(`CREATE SCHEMA ${pg.escapeIdentifier(schema)}`);
    created = true;
    await client.query(`SET search_path TO ${pg.escapeIdentifier(schema)}`);
    const migrations = join(root, migrationPaths[service]);
    const directories = (await readdir(migrations, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const directory of directories) {
      await client.query(await readFile(join(migrations, directory, 'migration.sql'), 'utf8'));
    }
    url.searchParams.set('schema', schema);
    return {
      client,
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
  app: 'admin' | 'backoffice' | 'sales' | 'storefront',
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
          'x-cart-token',
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
      const invoiceDownload = app === 'admin' && request.url?.startsWith('/documents/invoices/');
      if (
        commerceOrigin &&
        request.url &&
        (invoiceDownload ||
          /^\/media\/(brands|products|shop-home|shop-branding)\//.test(request.url))
      ) {
        const headers = new Headers();
        for (const key of invoiceDownload ? ['authorization', 'x-branch-id'] : ['authorization']) {
          const value = request.headers[key];
          if (typeof value === 'string') {
            headers.set(key, value);
          }
        }
        const upstream = await fetch(new URL(request.url, commerceOrigin), { headers });
        const disposition = upstream.headers.get('content-disposition');
        response.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
          'cache-control': upstream.headers.get('cache-control') ?? 'no-store',
          'x-content-type-options': upstream.headers.get('x-content-type-options') ?? 'nosniff',
          ...(disposition ? { 'content-disposition': disposition } : {}),
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
        '.svg': 'image/svg+xml',
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
      throw new Error('Missing credential input');
    }
    element.value = secret;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

function waitForOperation(page: Page, endpoint: string, name: string): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.url() === endpoint &&
      response.request().postData()?.includes(`"operationName":"${name}"`) === true,
  );
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByRole('button', { name: 'Език' }).click();
  await page.getByText('English', { exact: true }).click();
  await secretFill(page.locator('#sign-in-email'), email);
  await secretFill(page.locator('#sign-in-password'), password);
  const [response] = await Promise.all([
    waitForOperation(page, new URL('/graphql', page.url()).href, 'AdminSignIn'),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
  if (!response.ok()) {
    throw new Error('Core sign-in request failed');
  }
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('data' in result)) {
    throw new Error('Core sign-in did not return a session');
  }
  const data = result.data;
  if (!data || typeof data !== 'object' || !('signIn' in data)) {
    throw new Error('Core sign-in did not return a session');
  }
  const session = data.signIn;
  if (
    !session ||
    typeof session !== 'object' ||
    !('token' in session) ||
    typeof session.token !== 'string' ||
    !session.token ||
    !('tenant' in session) ||
    !session.tenant ||
    typeof session.tenant !== 'object' ||
    !('id' in session.tenant) ||
    typeof session.tenant.id !== 'string' ||
    !('user' in session) ||
    !session.user ||
    typeof session.user !== 'object' ||
    !('id' in session.user) ||
    typeof session.user.id !== 'string' ||
    !('role' in session.user) ||
    typeof session.user.role !== 'string'
  ) {
    throw new Error('Core sign-in returned an incomplete session');
  }
  return {
    authorization: `Bearer ${session.token}`,
    tenantId: session.tenant.id,
    userId: session.user.id,
    role: session.user.role,
  };
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

async function addCategory(page: Page, name: string, parent?: string): Promise<void> {
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page.locator('#category-name').fill(name);
  await page.locator('#category-slug').fill(name.toLowerCase());
  if (parent) {
    await page.locator('#category-parent').click();
    await page.getByRole('option', { name: parent, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await dismissSuccess(page, 'Category saved.');
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
}

async function dismissSuccess(page: Page, message: string): Promise<void> {
  await page
    .locator('osnova-operation-toast')
    .getByRole('status')
    .filter({ hasText: message })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
}

async function editOption(page: Page) {
  await page.getByRole('link', { name: 'Options', exact: true }).click();
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await page.locator('#option-name').fill('Finish');
  const shown = page.getByRole('option', { name: 'Shown', exact: true });
  await page.locator('#option-show-in-filters').click();
  await shown.click();
  await expect(shown).toHaveCount(0);
  await page.locator('#option-show-in-listing').click();
  await shown.click();
  const addValue = page.getByRole('button', { name: 'Add value', exact: true });
  await addValue.click();
  await page.locator('#option-value-0').fill('Matt');
  await addValue.click();
  await page.locator('#option-value-1').fill('Gloss');
  await page.locator('#option-swatch-1').fill('#735143');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await dismissSuccess(page, 'Option saved.');
  const firstRead = page.waitForResponse(optionRead);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  const created = readOption(await (await firstRead).json());
  expect(created.values.map((value) => value.label)).toEqual(['Matt', 'Gloss']);
  await page.locator('#option-name').fill('Surface finish');
  await page.locator('#option-value-0').fill('Satin');
  await page.getByRole('button', { name: 'Move value 1 down', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await dismissSuccess(page, 'Option saved.');
  const secondRead = page.waitForResponse(optionRead);
  await page.getByRole('button', { name: 'Surface finish', exact: true }).click();
  const updated = readOption(await (await secondRead).json());
  expect(updated).toEqual({
    id: created.id,
    values: [
      { id: created.values[1]?.id, label: 'Gloss' },
      { id: created.values[0]?.id, label: 'Satin' },
    ],
  });
  await page
    .getByRole('dialog', { name: 'Edit option' })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  return updated.values;
}

function optionRead(response: Response): boolean {
  return response.request().postData()?.includes('"operationName":"OperatorOption"') === true;
}

function readOption(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('data' in value) ||
    typeof value.data !== 'object' ||
    value.data === null ||
    !('option' in value.data)
  ) {
    throw new Error('Option query did not return data');
  }
  const option = value.data.option;
  if (
    typeof option !== 'object' ||
    option === null ||
    !('id' in option) ||
    typeof option.id !== 'string' ||
    !('values' in option) ||
    !Array.isArray(option.values)
  ) {
    throw new Error('Option query did not return a record');
  }
  const values: readonly unknown[] = option.values;
  return {
    id: option.id,
    values: values.map((item) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('id' in item) ||
        typeof item.id !== 'string' ||
        !('label' in item) ||
        typeof item.label !== 'string'
      ) {
        throw new Error('Option query did not return a value');
      }
      return { id: item.id, label: item.label };
    }),
  };
}

async function newCollection(page: Page, name: string, slug: string): Promise<void> {
  await page.getByRole('button', { name: 'Add collection', exact: true }).click();
  await page.locator('#collection-name').fill(name);
  await page.locator('#collection-slug').fill(slug);
}

function waitForCategories(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().postData()?.includes('"operationName":"OperatorCategories"') === true,
  );
}

async function chooseCookware(
  page: Page,
  control: '#collection-category' | '#product-category',
  categories: Promise<Response>,
): Promise<void> {
  expect((await categories).ok()).toBe(true);
  const select = page.locator(control);
  await expect(select).toBeVisible();
  await expect(page.locator(`p-select:has(${control}) .p-select-loading-icon`)).toBeHidden();
  await select.press('Space');
  await page.getByRole('option', { name: 'Kitchen / Cookware', exact: true }).click();
}

async function previewBytes(image: Locator): Promise<Buffer> {
  const bytes = await image.evaluate(async (element) => {
    if (!(element instanceof HTMLImageElement)) {
      throw new Error('Missing preview image');
    }
    // The editor owns this Blob even if Chromium has discarded the network response body.
    const response = await fetch(element.src);
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  });
  return Buffer.from(bytes);
}

function publicPhotoUrls(result: unknown): string[] {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('data' in result) ||
    typeof result.data !== 'object' ||
    result.data === null ||
    !('catalogueProduct' in result.data) ||
    typeof result.data.catalogueProduct !== 'object' ||
    result.data.catalogueProduct === null ||
    !('images' in result.data.catalogueProduct) ||
    !Array.isArray(result.data.catalogueProduct.images)
  ) {
    throw new Error('Catalogue product did not return a gallery');
  }
  const images: readonly unknown[] = result.data.catalogueProduct.images;
  return images.map((image) => {
    if (
      typeof image !== 'object' ||
      image === null ||
      !('url' in image) ||
      typeof image.url !== 'string'
    ) {
      throw new Error('Catalogue photo did not return a URL');
    }
    return image.url;
  });
}

function pngAtSize(source: Buffer, size: number): Buffer {
  // Add a valid PNG text chunk before IEND to exercise the request size limit.
  const chunk = Buffer.alloc(size - source.length, 0x20);
  chunk.writeUInt32BE(chunk.length - 12);
  chunk.write('tEXtFixture\0', 4, 'ascii');
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return Buffer.concat([source.subarray(0, -12), chunk, source.subarray(-12)]);
}

test('staff provisions a shop, its merchant publishes a product and shoppers check out', async ({
  browser,
}, testInfo) => {
  const staffEmail = process.env.HOLITA_STAFF_EMAIL;
  const staffPassword = process.env.HOLITA_STAFF_PASSWORD;
  const salesEmail = process.env.HOLITA_SALES_EMAIL;
  const salesPassword = process.env.HOLITA_SALES_PASSWORD;
  const internal = process.env.CORE_INTERNAL_AUTH_TOKEN;
  if (!staffEmail || !staffPassword || !salesEmail || !salesPassword || !internal) {
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
    const salesDb = await database('sales');
    cleanup.push(salesDb.close);
    const corePort = await port();
    const commercePort = await port();
    const salesPort = await port();
    const routerPort = await port();
    const healthPort = await port();
    const publicPort = await port();
    const publicRouterPort = await port();
    const publicHealthPort = await port();
    const commerceOrigin = `http://127.0.0.1:${String(commercePort)}`;
    const publicUrl = `http://127.0.0.1:${String(publicPort)}/graphql`;
    const shopApp = await serve('storefront', publicUrl, commerceOrigin);
    cleanup.push(shopApp.close);
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
        STOREFRONT_GRAPHQL_PORT: String(publicPort),
        STOREFRONT_ROUTER_PORT: String(publicRouterPort),
        STOREFRONT_ORIGIN: shopApp.origin,
      },
      stdio: 'ignore',
    });
    cleanup.push(() => stopChild(commerce));
    await waitReady(`${commerceOrigin}/graphql`, commerce, 'graphql');
    const salesGraphqlUrl = `http://127.0.0.1:${String(salesPort)}/graphql`;
    const salesApi = spawn(process.execPath, ['dist/main.js'], {
      cwd: join(root, 'holita/apps/sales-api'),
      env: {
        ...process.env,
        SALES_DATABASE_URL: salesDb.url,
        CORE_INTERNAL_AUTH_TOKEN: internal,
        CORE_AUTH_VERIFY_URL: `http://127.0.0.1:${String(corePort)}/internal/auth/verify`,
        PORT: String(salesPort),
      },
      stdio: 'ignore',
    });
    cleanup.push(() => stopChild(salesApi));
    await waitReady(salesGraphqlUrl, salesApi, 'graphql');
    const routerUrl = `http://127.0.0.1:${String(routerPort)}/graphql`;
    const admin = await serve('admin', routerUrl, commerceOrigin);
    cleanup.push(admin.close);
    const backoffice = await serve('backoffice', routerUrl);
    cleanup.push(backoffice.close);
    const salesApp = await serve('sales', routerUrl);
    cleanup.push(salesApp.close);
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
          SALES_GRAPHQL_URL: salesGraphqlUrl,
          ADMIN_ORIGIN: admin.origin,
          BACKOFFICE_ORIGIN: backoffice.origin,
          SALES_ORIGIN: salesApp.origin,
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
    const staffSession = await signIn(staff, staffEmail, staffPassword);
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
    await expect(staff.getByRole('heading', { name: merchantName, exact: true })).toBeVisible();
    const shopId = await createShop(staff, 'First shop');
    const merchantContext = await browser.newContext();
    cleanup.push(() => merchantContext.close());
    const merchant = await merchantContext.newPage();
    await merchant.goto(admin.origin);
    const merchantSession = await signIn(merchant, merchantEmail, merchantPassword);

    const salesContext = await browser.newContext();
    cleanup.push(() => salesContext.close());
    const sales = await salesContext.newPage();
    await sales.goto(salesApp.origin);
    const salesEndpoint = `${salesApp.origin}/graphql`;
    const workspaceOperation = 'OperatorSalesWorkspace';
    const [workspace, salesSession] = await Promise.all([
      waitForOperation(sales, salesEndpoint, workspaceOperation),
      signIn(sales, salesEmail, salesPassword),
    ]);
    expect(salesSession.role).toBe('SALES');
    expect(workspace.status()).toBe(200);
    expect(await workspace.request().headerValue('x-branch-id')).toBeNull();
    const workspaceResult: unknown = await workspace.json();
    expect(workspaceResult).not.toHaveProperty('errors');
    expect(workspaceResult).toMatchObject({
      data: {
        salesWorkspaceAccess: { tenantId: salesSession.tenantId, userId: salesSession.userId },
      },
    });
    await expect(sales).toHaveURL(`${salesApp.origin}/en/merchants`);
    await expect(
      sales.getByText('You have access to the Sales workspace.', { exact: true }),
    ).toBeVisible();

    const accessRequest = JSON.stringify({
      operationName: workspaceOperation,
      query: `query ${workspaceOperation} { salesWorkspaceAccess { tenantId userId } }`,
    });
    for (const [authorization, code] of [
      [undefined, 'UNAUTHENTICATED'],
      [staffSession.authorization, 'FORBIDDEN'],
      [merchantSession.authorization, 'FORBIDDEN'],
    ] as const) {
      const denied = await fetch(salesEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: accessRequest,
      });
      expect(denied.status).toBe(200);
      const result: unknown = await denied.json();
      expect(result).toMatchObject({
        data: null,
        errors: [{ path: ['salesWorkspaceAccess'], extensions: { code } }],
      });
    }

    const salesGraphql = async (
      query: string,
      variables: Record<string, unknown> = {},
      authorization = salesSession.authorization,
    ) => {
      const response = await salesContext.request.post(salesEndpoint, {
        headers: { authorization },
        data: { query, variables },
      });
      expect(response.status()).toBe(200);
      const result: unknown = await response.json();
      return result;
    };
    const foreignLeadId = randomUUID();
    const foreignName = 'Foreign tenant smoke prospect';
    await salesDb.client.query(
      `INSERT INTO "lead" ("id", "tenantId", "displayName", "createdByUserId", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [foreignLeadId, merchantSession.tenantId, foreignName, merchantSession.userId],
    );
    expect(
      await salesGraphql(
        'query ForeignLead($id: ID!, $search: String!) { lead(id: $id) { id } leads(search: $search) { items { id } total } }',
        { id: foreignLeadId, search: foreignName },
      ),
    ).toEqual({ data: { lead: null, leads: { items: [], total: 0 } } });
    const updateLead =
      'mutation ScopedLeadUpdate($id: ID!, $input: LeadInput!) { updateLead(id: $id, input: $input) { id } }';
    for (const id of [foreignLeadId, randomUUID()]) {
      expect(
        await salesGraphql(updateLead, { id, input: { displayName: 'Attempted change' } }),
      ).toMatchObject({
        data: null,
        errors: [{ message: 'Lead not found', extensions: { code: 'NOT_FOUND' } }],
      });
    }
    const foreignLead = await salesDb.client.query(
      'SELECT "displayName" FROM "lead" WHERE "id" = $1 AND "tenantId" = $2',
      [foreignLeadId, merchantSession.tenantId],
    );
    expect(foreignLead.rows).toEqual([{ displayName: foreignName }]);

    expect(
      await salesGraphql(
        'mutation InvalidLead($input: LeadInput!) { createLead(input: $input) { id } }',
        {
          input: { displayName: 'Invalid website smoke prospect', websiteUrl: 'file:///tmp/lead' },
        },
      ),
    ).toMatchObject({
      data: null,
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'websiteUrl', code: 'INVALID_FORMAT' }],
          },
        },
      ],
    });

    const website = 'https://smoke-studio.example';
    const source = 'Изложение за ръчна изработка';
    await sales.getByRole('link', { name: 'Leads', exact: true }).click();
    await sales.getByRole('button', { name: 'New lead', exact: true }).click();
    await sales.locator('#lead-websiteUrl').fill(website);
    await sales.locator('#lead-sourceName').fill(source);
    await sales.getByRole('button', { name: 'Save', exact: true }).click();
    await sales.waitForURL((url) => /\/leads\/[0-9a-f-]{36}$/u.test(url.pathname));
    const leadUrl = sales.url();
    const leadId = new URL(leadUrl).pathname.split('/').pop();
    expect(leadId).toBeTruthy();

    await Promise.all([
      waitForOperation(sales, salesEndpoint, 'SalesLeads'),
      sales.goto(new URL('/en/leads#prospects', leadUrl).href),
    ]);
    const listRequest = waitForOperation(sales, salesEndpoint, 'SalesLeads');
    await sales.getByRole('searchbox').fill('ръчна smoke-studio');
    const listResponse = await listRequest;
    const pageResult: unknown = await listResponse.json();
    expect(pageResult).toMatchObject({
      data: {
        leads: {
          items: [{ id: leadId, displayName: null, websiteUrl: website, sourceName: source }],
          total: 1,
        },
      },
    });
    await sales.getByRole('link', { name: website, exact: true }).click();
    await sales.waitForURL(
      (url) => url.pathname === new URL(leadUrl).pathname && url.searchParams.has('search'),
    );
    await sales.getByRole('button', { name: 'Edit lead', exact: true }).click();
    const updatedName = 'Ателие за тестова керамика';
    await sales.locator('#lead-displayName').fill(updatedName);
    await Promise.all([
      waitForOperation(sales, salesEndpoint, 'SalesUpdateLead'),
      sales.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    await sales.waitForURL(
      (url) => url.pathname === new URL(leadUrl).pathname && url.searchParams.has('search'),
    );
    const detailUrl = new URL(sales.url());
    const bulgarianUrl = new URL(detailUrl);
    bulgarianUrl.pathname = detailUrl.pathname.replace('/en/', '/bg/');
    const resumedSales = await browser.newPage();
    cleanup.push(() => resumedSales.close());
    await resumedSales.goto(bulgarianUrl.href);
    const [leadRead] = await Promise.all([
      waitForOperation(resumedSales, salesEndpoint, 'SalesLead'),
      signIn(resumedSales, salesEmail, salesPassword),
    ]);
    await resumedSales.waitForURL(detailUrl.href);
    const readResult: unknown = await leadRead.json();
    expect(readResult).toMatchObject({
      data: {
        lead: {
          id: leadId,
          displayName: updatedName,
          websiteUrl: website,
          createdByUserId: salesSession.userId,
        },
      },
    });
    await resumedSales.getByRole('button', { name: /^Language:/u }).click();
    await resumedSales.getByText('Български', { exact: true }).click();
    await resumedSales.waitForURL(bulgarianUrl.href);

    const referralName = 'Ателие за тестови свещи';
    const referralSource = 'Препоръка';
    await sales.goto(new URL('/en/leads/new', leadUrl).href);
    await sales.locator('#lead-displayName').fill(referralName);
    await sales.locator('#lead-sourceName').fill(referralSource);
    await sales.getByRole('button', { name: 'Save', exact: true }).click();
    await sales.waitForURL((url) => /\/leads\/[0-9a-f-]{36}$/u.test(url.pathname));
    const referralResult = await salesGraphql(
      'query ReferralLead($search: String!) { leads(search: $search) { total items { displayName websiteUrl sourceName } } }',
      { search: 'свещи препоръка' },
    );
    expect(referralResult).toEqual({
      data: {
        leads: {
          total: 1,
          items: [{ displayName: referralName, websiteUrl: null, sourceName: referralSource }],
        },
      },
    });

    const referralId = new URL(sales.url()).pathname.split('/').at(-1);
    const foreignContactId = randomUUID();
    const foreignContactName = 'Foreign tenant smoke contact';
    await salesDb.client.query(
      `INSERT INTO "leadContact" ("id", "tenantId", "leadId", "name", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [foreignContactId, merchantSession.tenantId, foreignLeadId, foreignContactName],
    );
    const findContact = `query ScopedContact($lead: ID!, $contact: ID!, $search: String!) {
      leadContacts(leadId: $lead) { id }
      leadContact(leadId: $lead, id: $contact) { id }
      leads(search: $search) { items { id } total }
      salesContacts(search: $search) { items { contact { id } } total }
    }`;
    expect(
      await salesGraphql(findContact, {
        lead: foreignLeadId,
        contact: foreignContactId,
        search: foreignContactName,
      }),
    ).toEqual({
      data: {
        leadContacts: [],
        leadContact: null,
        leads: { items: [], total: 0 },
        salesContacts: { items: [], total: 0 },
      },
    });
    const createContact = `mutation ScopedContactCreate($lead: ID!, $input: LeadContactInput!) {
      createLeadContact(leadId: $lead, input: $input) { id }
    }`;
    const updateContact = `mutation ScopedContactUpdate($lead: ID!, $contact: ID!, $input: LeadContactInput!) {
      updateLeadContact(leadId: $lead, id: $contact, input: $input) { id }
    }`;
    const deleteContact = `mutation ScopedContactDelete($lead: ID!, $contact: ID!) {
      deleteLeadContact(leadId: $lead, id: $contact)
    }`;
    const missingContact = {
      data: null,
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    };
    const input = { name: 'Smoke contact', isPrimary: true };
    expect(await salesGraphql(createContact, { lead: foreignLeadId, input })).toMatchObject(
      missingContact,
    );
    for (const lead of [foreignLeadId, leadId]) {
      const variables = { lead, contact: foreignContactId };
      expect(await salesGraphql(updateContact, { ...variables, input })).toMatchObject(
        missingContact,
      );
      expect(await salesGraphql(deleteContact, variables)).toMatchObject(missingContact);
    }
    const foreignContact = await salesDb.client.query(
      'SELECT "name", "isPrimary" FROM "leadContact" WHERE "tenantId" = $1 AND "leadId" = $2',
      [merchantSession.tenantId, foreignLeadId],
    );
    expect(foreignContact.rows).toEqual([{ name: foreignContactName, isPrimary: false }]);

    const phone = '+12025550123';
    const formattedPhone = '00 1 202 555 01 23';
    const email = 'smoke-inbox@example.test';
    const browseContacts = `query BrowseSmokeContacts($search: String!) {
      salesContacts(search: $search) { total items { contact { id phone } lead { id } } }
    }`;
    await sales.goto(detailUrl.href);
    await sales.getByRole('button', { name: 'Add contact', exact: true }).click();
    await sales.locator('#contact-name').fill(input.name);
    await sales.locator('#contact-phone').fill('+1 (202) 555-0123');
    await sales.getByRole('switch', { name: 'Primary', exact: true }).click();
    await sales.getByRole('button', { name: 'Save', exact: true }).click();
    await sales.waitForURL(detailUrl.href);

    await sales.getByRole('button', { name: 'Add contact', exact: true }).click();
    await sales.locator('#contact-email').fill(email);
    await sales.getByRole('button', { name: 'Save', exact: true }).click();
    await sales.waitForURL(detailUrl.href);
    await sales.getByRole('button', { name: email, exact: true }).click();
    await sales.waitForURL((url) => /\/contacts\/[0-9a-f-]{36}\/edit$/u.test(url.pathname));
    const inboxContactId = new URL(sales.url()).pathname.split('/').at(-2);
    await sales.getByRole('switch', { name: 'Primary', exact: true }).click();
    await sales.getByRole('button', { name: 'Save', exact: true }).click();
    await sales.waitForURL(detailUrl.href);

    const listContacts = `query ReadSmokeContacts($lead: ID!) {
      leadContacts(leadId: $lead) { id name email isPrimary }
    }`;
    expect(await salesGraphql(listContacts, { lead: leadId })).toMatchObject({
      data: {
        leadContacts: [
          { name: null, email, isPrimary: true },
          { name: input.name, email: null, isPrimary: false },
        ],
      },
    });
    const browse = await salesGraphql(browseContacts, { search: formattedPhone });
    expect(browse).toMatchObject({
      data: { salesContacts: { total: 1, items: [{ contact: { phone }, lead: { id: leadId } }] } },
    });
    expect(
      await salesGraphql(browseContacts, { search: phone }, merchantSession.authorization),
    ).toMatchObject({ data: null, errors: [{ extensions: { code: 'FORBIDDEN' } }] });
    const wrongLead = { lead: referralId, contact: inboxContactId };
    expect(await salesGraphql(updateContact, { ...wrongLead, input })).toMatchObject(
      missingContact,
    );
    expect(await salesGraphql(deleteContact, wrongLead)).toMatchObject(missingContact);
    for (const search of [input.name, email, formattedPhone]) {
      expect(
        await salesGraphql(
          'query SearchSmokeContact($search: String!) { leads(search: $search) { total items { id } } }',
          { search },
        ),
      ).toEqual({ data: { leads: { total: 1, items: [{ id: leadId }] } } });
    }
    for (const [path, operation, expected] of [
      ['leads', 'SalesLeads', { leads: { total: 1, items: [{ id: leadId }] } }],
      [
        'contacts',
        'SalesContacts',
        { salesContacts: { total: 1, items: [{ contact: { phone }, lead: { id: leadId } }] } },
      ],
    ] as const) {
      await Promise.all([
        waitForOperation(sales, salesEndpoint, operation),
        sales.goto(new URL('/en/' + path, leadUrl).href),
      ]);
      const [response] = await Promise.all([
        waitForOperation(sales, salesEndpoint, operation),
        sales.getByRole('searchbox').fill(formattedPhone),
      ]);
      expect(await response.json()).toMatchObject({ data: expected });
    }
    await sales.goto(detailUrl.href);
    await sales
      .getByRole('row')
      .filter({ hasText: email })
      .getByRole('button', { name: `Actions for ${email}`, exact: true })
      .click();
    await sales.getByRole('menuitem', { name: 'Remove contact', exact: true }).click();
    await Promise.all([
      waitForOperation(sales, salesEndpoint, 'SalesDeleteLeadContact'),
      sales
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Remove contact', exact: true })
        .click(),
    ]);
    expect(
      await salesGraphql(
        'query ContactRemoval($lead: ID!) { lead(id: $lead) { id } leadContacts(leadId: $lead) { name isPrimary } }',
        { lead: leadId },
      ),
    ).toEqual({
      data: { lead: { id: leadId }, leadContacts: [{ name: input.name, isPrimary: false }] },
    });

    const contactSettings = {
      displayName: 'Дом и уют за тестове',
      contactEmail: 'contact@example.test',
      contactPhone: '+359 2 555 0101',
      contactAddress: 'ул. „Примерна“ 12\n1000 София',
    };
    await merchant.getByRole('link', { name: 'General Settings', exact: true }).click();
    for (const [field, value] of Object.entries(contactSettings)) {
      await merchant.locator(`#shop-settings-${field}`).fill(value);
    }
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Settings saved.');

    const pageSlug = 'delivery-notes';
    const pageTitle = 'Бележки за доставката';
    const pageBody = 'Изпращаме съдовете в работни дни.\n\nОпаковаме всеки съд отделно.';
    await merchant.getByRole('link', { name: 'Pages', exact: true }).click();
    await merchant.getByRole('button', { name: 'New page', exact: true }).click();
    await merchant.locator('#page-title-bg').fill(pageTitle);
    await merchant.locator('#page-slug').fill(pageSlug);
    await merchant.locator('#page-body-bg').fill(pageBody);
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Page saved.');
    const shopperContext = await browser.newContext();
    cleanup.push(() => shopperContext.close());
    const contentShopper = await shopperContext.newPage();
    const publicShopSettings = async (branchId: string): Promise<unknown> => {
      const response = await shopperContext.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId },
        data: {
          query: '{ shop { id name displayName contactEmail contactPhone contactAddress } }',
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    expect(await publicShopSettings(shopId)).toEqual({
      data: { shop: { id: shopId, name: 'First shop', ...contactSettings } },
    });
    const publicPage = async (): Promise<unknown> => {
      const response = await contentShopper.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': shopId },
        data: {
          query: 'query($slug: String!) { shopPage(slug: $slug) { slug } }',
          variables: { slug: pageSlug },
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    expect(await publicPage()).toEqual({ data: { shopPage: null } });
    const pageRow = merchant.getByRole('button', { name: pageTitle, exact: true });
    const setPageStatus = async (status: 'Draft' | 'Published') => {
      await pageRow.click();
      await merchant.locator('#page-status').click();
      await merchant.getByRole('option', { name: status, exact: true }).click();
      await merchant.getByRole('button', { name: 'Save', exact: true }).click();
      await dismissSuccess(merchant, 'Page saved.');
    };
    await setPageStatus('Published');
    await contentShopper.addInitScript(() => {
      sessionStorage.setItem('holita.storefront.language', 'en');
    });
    await contentShopper.goto(`${shopApp.origin}/s/${shopId}`);
    await expect(
      contentShopper.getByRole('link', { name: contactSettings.displayName, exact: true }),
    ).toBeVisible();
    await contentShopper.getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(
      contentShopper.getByRole('link', { name: contactSettings.contactEmail }),
    ).toHaveAttribute('href', `mailto:${contactSettings.contactEmail}`);
    await contentShopper.goto(`${shopApp.origin}/s/${shopId}/pages/${pageSlug}`);
    await expect(contentShopper.getByRole('heading', { name: pageTitle })).toBeVisible();
    await contentShopper.reload();
    const content = contentShopper.getByRole('article').filter({ hasText: pageTitle });
    await expect(content).toHaveAttribute('lang', 'bg');
    await expect(content.getByText(pageBody, { exact: true })).toBeVisible();

    const navigation = merchant.getByRole('link', { name: 'Navigation', exact: true });
    const footerMenu = merchant.getByRole('button', { name: 'Footer', exact: true });
    const addMenuLink = async (
      label: string,
      type: 'Blog' | 'Page' | 'Category',
      target?: string,
    ) => {
      await merchant.getByRole('button', { name: 'Add link', exact: true }).click();
      await merchant
        .getByRole('textbox', { name: 'Label (English)', exact: true })
        .last()
        .fill(label);
      if (type !== 'Category') {
        await merchant
          .getByRole('combobox', { name: /^Destination type\b/u })
          .last()
          .click();
        await merchant.getByRole('option', { name: type, exact: true }).click();
      }
      if (target) {
        if (type === 'Category') {
          await merchant
            .getByRole('button', { name: 'Search by name or slug', exact: true })
            .last()
            .click();
        } else {
          await merchant
            .getByRole('combobox', { name: /^Destination(?! type)\b/u })
            .last()
            .fill(target);
        }
        const destination = merchant.getByRole('option', { name: target });
        await destination.click();
        await expect(destination).toHaveCount(0);
      }
    };
    const saveMenu = async (mutation: 'createNavigationMenu' | 'updateNavigationMenu') => {
      const operation =
        mutation === 'createNavigationMenu'
          ? 'OperatorCreateNavigationMenu'
          : 'OperatorUpdateNavigationMenu';
      const saved = merchant.waitForResponse(
        (response) =>
          response.request().postData()?.includes(`"operationName":"${operation}"`) === true,
      );
      await merchant.getByRole('button', { name: 'Save', exact: true }).click();
      expect(await (await saved).json()).toMatchObject({
        data: { [mutation]: { id: expect.any(String) } },
      });
      await expect(merchant.getByRole('dialog', { name: /^(New|Edit) menu$/u })).toBeHidden();
    };
    const menuLinks = (page: Page) =>
      page.getByRole('navigation', { name: 'Shop footer links' }).getByRole('link');
    const expectMenu = async (page: Page, paths: string[]) => {
      await expect
        .poll(() =>
          menuLinks(page).evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        )
        .toEqual(paths.map((path) => `/s/${shopId}/${path}`));
    };
    await navigation.click();
    await merchant.getByRole('button', { name: 'New menu', exact: true }).click();
    await merchant.locator('#navigation-placement').click();
    await merchant.getByRole('option', { name: 'Footer', exact: true }).click();
    await addMenuLink('Shop news', 'Blog');
    await addMenuLink('Delivery notes', 'Page', pageTitle);
    await saveMenu('createNavigationMenu');
    await contentShopper.goto(`${shopApp.origin}/s/${shopId}`);
    await expectMenu(contentShopper, ['blog', `pages/${pageSlug}`]);
    await footerMenu.click();
    await merchant.getByRole('button', { name: 'Move link 2 up', exact: true }).click();
    await saveMenu('updateNavigationMenu');
    await contentShopper.reload();
    await expectMenu(contentShopper, [`pages/${pageSlug}`, 'blog']);
    await menuLinks(contentShopper).first().click();
    await expect(contentShopper.getByRole('heading', { name: pageTitle })).toBeVisible();
    await merchant.getByRole('link', { name: 'Pages', exact: true }).click();
    await setPageStatus('Draft');
    expect(await publicPage()).toEqual({ data: { shopPage: null } });
    await contentShopper.reload();
    await expectMenu(contentShopper, ['blog']);

    const blogTag = 'Cookware care';
    const blogTagSlug = 'cookware-care';
    const blogSlug = 'cast-iron-care';
    const blogTitle = 'Грижа за чугунения тиган';
    const blogBody = 'Измийте с топла вода.\n\nПодсушете тигана преди да го приберете.';
    await merchant.getByRole('link', { name: 'Blog Tags', exact: true }).click();
    await merchant.getByRole('button', { name: 'New blog tag', exact: true }).click();
    await merchant.locator('#blog-tag-name').fill(blogTag);
    await merchant.locator('#blog-tag-slug').fill(blogTagSlug);
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Blog tag saved.');
    await merchant.getByRole('link', { name: 'Blog Articles', exact: true }).click();
    await merchant.getByRole('button', { name: 'New article', exact: true }).click();
    await merchant.locator('#blog-article-slug').fill(blogSlug);
    await merchant.locator('#blog-article-title-bg').fill(blogTitle);
    await merchant.locator('#blog-article-body-bg').fill(blogBody);
    await expect(
      merchant.locator('p-select:has(#blog-article-tags) .p-select-loading-icon'),
    ).toBeHidden();
    await merchant.locator('#blog-article-tags').click();
    await merchant.getByRole('option', { name: blogTag, exact: true }).click();
    await merchant.getByRole('heading', { name: 'New article', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Article saved.');
    const publicBlog = async (): Promise<unknown> => {
      const response = await contentShopper.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': shopId },
        data: {
          query: `query($article: String!, $tag: String!) {
            all: blogArticles { items { slug } total }
            filtered: blogArticles(tagSlug: $tag) { items { slug } total }
            blogArticle(slug: $article) { slug }
            blogTags { slug }
          }`,
          variables: { article: blogSlug, tag: blogTagSlug },
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const emptyBlog = {
      data: {
        all: { items: [], total: 0 },
        filtered: { items: [], total: 0 },
        blogArticle: null,
        blogTags: [],
      },
    };
    expect(await publicBlog()).toEqual(emptyBlog);
    const articleRow = merchant.getByRole('button', { name: blogTitle, exact: true });
    const setArticleStatus = async (status: 'Draft' | 'Published') => {
      await articleRow.click();
      await merchant.locator('#blog-article-status').click();
      await merchant.getByRole('option', { name: status, exact: true }).click();
      await merchant.getByRole('button', { name: 'Save', exact: true }).click();
      await dismissSuccess(merchant, 'Article saved.');
    };
    await setArticleStatus('Published');
    expect(await publicBlog()).toEqual({
      data: {
        all: { items: [{ slug: blogSlug }], total: 1 },
        filtered: { items: [{ slug: blogSlug }], total: 1 },
        blogArticle: { slug: blogSlug },
        blogTags: [{ slug: blogTagSlug }],
      },
    });
    await contentShopper.goto(`${shopApp.origin}/s/${shopId}/blog?tag=${blogTagSlug}`);
    await contentShopper.getByRole('link', { name: blogTitle, exact: true }).click();
    await expect(
      contentShopper.getByRole('article').filter({ hasText: blogTitle }).getByText(blogBody),
    ).toBeVisible();
    await setArticleStatus('Draft');
    expect(await publicBlog()).toEqual(emptyBlog);
    await contentShopper.close();

    await merchant.getByRole('link', { name: 'Brands', exact: true }).click();
    await merchant.getByRole('button', { name: 'Add brand', exact: true }).click();
    await merchant.locator('#brand-name').fill('Smoke Brand');
    await merchant
      .locator('input[type=file]')
      .setInputFiles(join(root, 'holita/config/demo/northline.png'));
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Brand saved.');
    await expect(merchant.getByRole('button', { name: 'Smoke Brand', exact: true })).toBeVisible();
    await merchant.getByRole('link', { name: 'Categories', exact: true }).click();
    await addCategory(merchant, 'Kitchen');
    await addCategory(merchant, 'Home');
    await addCategory(merchant, 'Cookware', 'Kitchen');
    await navigation.click();
    await footerMenu.click();
    await addMenuLink('Cookware', 'Category', 'Cookware');
    await saveMenu('updateNavigationMenu');
    const optionValues = await editOption(merchant);
    await merchant.getByRole('link', { name: 'Characteristic groups', exact: true }).click();
    await merchant.getByRole('button', { name: 'Add characteristic group', exact: true }).click();
    await merchant.locator('#characteristic-group-name').fill('Materials');
    for (const [index, [name, order]] of (
      [
        ['Finish', '20'],
        ['Material', '10'],
      ] as const
    ).entries()) {
      await merchant.getByRole('button', { name: 'Add characteristic', exact: true }).click();
      await merchant.locator(`#characteristic-group-name-${String(index)}`).fill(name);
      await merchant.locator(`#characteristic-group-sort-order-${String(index)}`).fill(order);
    }
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Characteristic group saved.');
    const badgeName = 'New Arrival';
    const tagName = 'Ръчна изработка';
    await merchant.getByRole('link', { name: 'Badges', exact: true }).click();
    await merchant.getByRole('button', { name: 'Add badge', exact: true }).click();
    await merchant.locator('#badge-name').fill(badgeName);
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Badge saved.');
    await merchant.getByRole('link', { name: 'Products', exact: true }).click();
    await merchant.getByRole('button', { name: 'Create product', exact: true }).click();
    const productName = `Product ${randomUUID()}`;
    const descriptionBg = 'Керамичен съд за печене.';
    const descriptionEn = 'Ceramic baking dish.';
    await merchant.locator('#product-name').fill(productName);
    await merchant.locator('#product-description-bg').fill(descriptionBg);
    await merchant.locator('#product-description-en').fill(descriptionEn);
    await expect(
      merchant.locator('p-select:has(#product-badges) .p-select-loading-icon'),
    ).toBeHidden();
    await merchant.locator('#product-badges').click();
    await merchant.getByRole('option', { name: badgeName, exact: true }).click();
    await merchant.getByRole('heading', { name: 'Badges and tags', exact: true }).click();
    await merchant.locator('#product-tag-search').fill(tagName);
    const tagCreated = merchant.waitForResponse(
      (response) =>
        response.request().postData()?.includes('"operationName":"OperatorCreateProductTag"') ===
        true,
    );
    await merchant.getByRole('button', { name: 'Add tag', exact: true }).click();
    expect(await (await tagCreated).json()).toMatchObject({
      data: { createProductTag: { name: tagName } },
    });
    await merchant.getByRole('textbox', { name: 'Finish', exact: true }).fill('Matte glaze');
    await merchant.getByRole('textbox', { name: 'Material', exact: true }).fill('Ceramic');
    await merchant.locator('#product-variant-sku-0').fill('SMOKE-001');
    await merchant.locator('#product-variant-barcode-0').fill('0012345678905');
    await merchant.locator('#product-variant-price-0').fill('25.50');
    await merchant.locator('#product-variant-tracking-0').click();
    await merchant.getByRole('option', { name: 'Tracked', exact: true }).click();
    await merchant.locator('#product-variant-quantity-0').fill('1');
    await merchant.locator('#product-status').click();
    await merchant.getByRole('option', { name: 'Active', exact: true }).click();
    await merchant.locator('#product-brand').click();
    await merchant.getByRole('option', { name: 'Smoke Brand', exact: true }).click();
    await merchant.locator('#product-category').click();
    await merchant.getByRole('option', { name: 'Kitchen / Cookware', exact: true }).click();
    await merchant.locator('input[type=file]').setInputFiles({
      name: 'invalid.png',
      mimeType: 'image/png',
      buffer: Buffer.from('invalid raster fixture'),
    });
    const rejection = merchant.waitForResponse(
      (response) =>
        response.request().postData()?.includes('"operationName":"OperatorCreateProduct"') === true,
    );
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    expect(await (await rejection).json()).toMatchObject({
      data: null,
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'image0Upload', code: 'INVALID_IMAGE' }],
          },
        },
      ],
    });
    await merchant.getByRole('button', { name: 'Remove photo 1', exact: true }).click();
    const frontFile = join(root, 'holita/config/demo/product-58-front.png');
    const angledFile = join(root, 'holita/config/demo/product-58-angle.png');
    const angledBytes = await readFile(angledFile);
    const frontBytes = pngAtSize(await readFile(frontFile), 5 * 1024 * 1024 - angledBytes.length);
    await merchant.locator('input[type=file]').setInputFiles([
      { name: 'front.png', mimeType: 'image/png', buffer: frontBytes },
      { name: 'angle.png', mimeType: 'image/png', buffer: angledBytes },
    ]);
    await merchant.locator('#product-image-alt-0').fill('Front view');
    await merchant.locator('#product-image-alt-1').fill('Angled view');
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    await expect(merchant.getByText(productName, { exact: true })).toBeVisible();
    await merchant.getByRole('button', { name: 'Create product', exact: true }).click();
    const configuredProductName = 'Stoneware cookware';
    await merchant.locator('#product-name').fill(configuredProductName);
    await merchant.locator('#product-create-brand').click();
    await merchant.locator('#brand-name').fill('Inline Smoke Brand');
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Brand saved.');
    await merchant.locator('#product-variant-generation-values').click();
    for (const finish of ['Gloss', 'Satin']) {
      await merchant
        .getByRole('option', { name: `Surface finish: ${finish}`, exact: true })
        .click();
    }
    await merchant.getByRole('heading', { name: 'Create product', exact: true }).click();
    await merchant.getByRole('button', { name: 'Generate combinations', exact: true }).click();
    for (const [index, label, price] of [
      [0, 'Gloss', '24.00'],
      [1, 'Satin', '30.00'],
    ] as const) {
      await merchant.locator(`#product-variant-sku-${String(index)}`).fill(`CONFIG-${label}`);
      await merchant.locator(`#product-variant-price-${String(index)}`).fill(price);
    }
    await merchant.locator('input[type=file]').setInputFiles(angledFile);
    await merchant.locator('#product-image-alt-0').fill('Inline gallery draft');
    await merchant.locator('#product-create-category').click();
    await merchant.locator('#category-name').fill('Inline Smoke Category');
    await merchant.locator('#category-active').click();
    await merchant.getByRole('option', { name: 'Hidden', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Category saved.');
    await merchant.locator('#product-variant-tracking-0').click();
    await merchant.getByRole('option', { name: 'Tracked', exact: true }).click();
    await merchant.locator('#product-status').click();
    await merchant.getByRole('option', { name: 'Active', exact: true }).click();
    const configuredSave = waitForOperation(
      merchant,
      `${admin.origin}/graphql`,
      'OperatorCreateProduct',
    );
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    const configuredResult = await configuredSave;
    expect(configuredResult.request().postDataJSON()).toMatchObject({
      variables: {
        input: {
          name: configuredProductName,
          brandId: expect.any(String),
          categoryId: expect.any(String),
          variants: [{ sku: 'CONFIG-Gloss' }, { sku: 'CONFIG-Satin' }],
          images: [{ altText: 'Inline gallery draft' }],
        },
      },
    });
    expect(await configuredResult.json()).toMatchObject({
      data: { createProduct: { id: expect.any(String), name: configuredProductName } },
    });
    await dismissSuccess(merchant, 'Product saved.');
    const shopper = await shopperContext.newPage();
    await shopper.goto(`${shopApp.origin}/s/${shopId}`);
    await shopper.getByRole('button', { name: 'EN', exact: true }).click();
    await expectMenu(shopper, ['blog', 'categories/cookware']);
    await shopper.getByRole('link', { name: 'New arrivals', exact: true }).click();
    await expect(shopper).toHaveURL(`${shopApp.origin}/s/${shopId}/products?sort=newest`);
    await expect(shopper.locator('.catalogue-card h2')).toHaveText([
      configuredProductName,
      productName,
    ]);
    const productLink = shopper.getByRole('link', { name: productName, exact: true });
    const productCard = shopper.locator('.catalogue-card').filter({ has: productLink });
    await expect(productCard.getByText('Smoke Brand', { exact: true })).toBeVisible();
    await expect(productCard.getByText(badgeName, { exact: true })).toBeVisible();
    await expect(productCard.getByText('In stock', { exact: true })).toBeVisible();
    const untrackedCard = shopper.locator('.catalogue-card').filter({
      has: shopper.getByRole('link', { name: configuredProductName, exact: true }),
    });
    await expect(untrackedCard.getByText('In stock', { exact: true })).toBeVisible();
    await expect(untrackedCard.locator('.catalogue-option-previews')).toContainText('Gloss');
    await productLink.click();
    await expect(shopper.getByText('Smoke Brand', { exact: true })).toBeVisible();
    await expect(shopper.getByText(tagName, { exact: true })).toBeVisible();
    const productUrl = shopper.url();
    const productId = new URL(productUrl).pathname.split('/').at(-1);
    const specificationsQuery = async (branchId = shopId): Promise<unknown> => {
      const response = await shopper.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId },
        data: {
          query: `query($id:ID!){
            catalogueProductSpecifications(productId:$id){name values{name value}}
          }`,
          variables: { id: productId },
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    expect(await specificationsQuery()).toEqual({
      data: {
        catalogueProductSpecifications: [
          {
            name: 'Materials',
            values: [
              { name: 'Material', value: 'Ceramic' },
              { name: 'Finish', value: 'Matte glaze' },
            ],
          },
        ],
      },
    });
    const publicProductsQuery = async (branchId = shopId, id = productId): Promise<unknown> => {
      const response = await shopper.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId },
        data: {
          query: `query($id:ID!){
            catalogueProduct(id:$id){coverImage{url altText} images{url altText} ...Variants}
            catalogue{items{id name coverImage{url altText} ...Variants}}
          }
          fragment Variants on CatalogueProduct {
            variantSelection {
              options { name values { id label } }
              variants { id sku price available optionValueIds }
            }
          }`,
          variables: { id },
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const initialGallery = await publicProductsQuery();
    const [front, angled] = publicPhotoUrls(initialGallery);
    if (!front || !angled) {
      throw new Error('The storefront did not return both product photos');
    }
    const frontPhoto = { url: front, altText: 'Front view' };
    const angledPhoto = { url: angled, altText: 'Angled view' };
    const simpleSelection = (available: boolean) => ({
      options: [],
      variants: [
        { id: expect.any(String), sku: 'SMOKE-001', price: '25.50', available, optionValueIds: [] },
      ],
    });
    expect(initialGallery).toMatchObject({
      data: {
        catalogueProduct: {
          coverImage: frontPhoto,
          images: [frontPhoto, angledPhoto],
          variantSelection: simpleSelection(true),
        },
        catalogue: {
          items: expect.arrayContaining([
            expect.objectContaining({ id: productId, coverImage: frontPhoto }),
          ]),
        },
      },
    });
    const frontImage = await shopper.request.get(new URL(front, shopApp.origin).href);
    expect(frontImage.status()).toBe(200);
    expect((await frontImage.body()).equals(frontBytes)).toBe(true);
    const angledImage = await shopper.request.get(new URL(angled, shopApp.origin).href);
    expect(angledImage.status()).toBe(200);
    expect((await angledImage.body()).equals(angledBytes)).toBe(true);
    const description = shopper.locator('.product-description');
    await expect(description).toHaveText(descriptionEn);
    await shopper.getByRole('button', { name: 'BG', exact: true }).click();
    await expect(description).toHaveText(descriptionBg);
    await shopper.getByRole('button', { name: 'EN', exact: true }).click();
    await merchant.getByRole('link', { name: 'Inventory', exact: true }).click();
    await merchant.getByRole('searchbox').fill('0012345678905');
    await expect(merchant.locator('tbody tr')).toHaveCount(1);
    await merchant
      .getByRole('button', { name: `Adjust quantity · ${productName} · SMOKE-001`, exact: true })
      .click();
    await merchant.locator('#inventory-quantity').fill('0');
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Quantity saved.');
    expect(await publicProductsQuery()).toMatchObject({
      data: { catalogueProduct: { variantSelection: simpleSelection(false) } },
    });
    await merchant.getByRole('link', { name: 'Products', exact: true }).click();
    await merchant.getByRole('button', { name: productName, exact: true }).click();
    await expect(merchant.locator('#product-description-en')).toHaveValue(descriptionEn);
    await merchant.locator('#product-description-en').clear();
    await merchant.getByRole('textbox', { name: 'Finish', exact: true }).clear();
    await merchant.locator('#product-variant-image-0').click();
    await merchant.getByRole('option', { name: /Front view/u }).click();
    await merchant.getByRole('button', { name: 'Move photo 2 up', exact: true }).press('Enter');
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    await shopper.reload();
    await expect(description).toHaveText(descriptionBg);
    await expect(shopper.locator('img.detail-photo')).toHaveAttribute('src', front);
    expect(await specificationsQuery()).toEqual({
      data: {
        catalogueProductSpecifications: [
          { name: 'Materials', values: [{ name: 'Material', value: 'Ceramic' }] },
        ],
      },
    });
    await merchant.getByRole('link', { name: 'Characteristic groups', exact: true }).click();
    for (const [switchId, visible] of [
      ['characteristic-group-active', false],
      ['characteristic-group-active', true],
      ['characteristic-group-active-0', false],
      ['characteristic-group-active-0', true],
    ] as const) {
      await merchant.getByRole('button', { name: 'Materials', exact: true }).click();
      const toggle = merchant.getByRole('switch').and(merchant.locator(`#${switchId}`));
      await toggle.waitFor({ state: 'visible' });
      await toggle.press('Space');
      await merchant.getByRole('button', { name: 'Save', exact: true }).click();
      await dismissSuccess(merchant, 'Characteristic group saved.');
      expect(await specificationsQuery(), `${switchId} set to ${String(visible)}`).toEqual({
        data: {
          catalogueProductSpecifications: visible
            ? [{ name: 'Materials', values: [{ name: 'Material', value: 'Ceramic' }] }]
            : [],
        },
      });
    }
    await merchant.getByRole('link', { name: 'Products', exact: true }).click();
    const breadcrumbs = shopper.getByRole('navigation', { name: 'Product breadcrumbs' });
    await expect(breadcrumbs.locator('li > :last-child')).toHaveText([
      'Products',
      'Kitchen',
      'Cookware',
      productName,
    ]);
    const logo = await shopper.locator('.product-brand img').getAttribute('src');
    if (!logo) {
      throw new Error('Missing storefront brand logo');
    }
    const image = await shopper.request.get(new URL(logo, shopApp.origin).href);
    expect(image.status()).toBe(200);
    const logoBytes = await readFile(join(root, 'holita/config/demo/northline.png'));
    expect(await image.body()).toEqual(logoBytes);
    expect(await publicProductsQuery()).toMatchObject({
      data: {
        catalogueProduct: {
          coverImage: angledPhoto,
          images: [angledPhoto, frontPhoto],
          variantSelection: simpleSelection(false),
        },
        catalogue: {
          items: expect.arrayContaining([
            expect.objectContaining({ id: productId, coverImage: angledPhoto }),
          ]),
        },
      },
    });
    await merchant.getByRole('button', { name: productName, exact: true }).click();
    await merchant.getByRole('button', { name: 'Remove photo 2', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    expect(await publicProductsQuery()).toMatchObject({
      data: { catalogueProduct: { coverImage: angledPhoto, images: [angledPhoto] } },
    });
    await shopper.reload();
    await expect(shopper.locator('img.detail-photo')).toHaveAttribute('src', angled);
    expect((await shopper.request.get(new URL(front, shopApp.origin).href)).status()).toBe(404);

    await merchant.getByRole('link', { name: 'Badges', exact: true }).click();
    await merchant.getByRole('button', { name: badgeName, exact: true }).click();
    await merchant.locator('#badge-active').click();
    await merchant.getByRole('option', { name: 'Inactive', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Badge saved.');
    await shopper.goto(`${shopApp.origin}/s/${shopId}/products`);
    await expect(productLink).toBeVisible();
    await expect(productCard.getByText(badgeName, { exact: true })).toHaveCount(0);
    await productLink.click();

    const manualName = 'Cookware essentials';
    const manualSlug = 'cookware-essentials';
    const ruleName = 'Cookware category picks';
    const ruleSlug = 'cookware-category-picks';
    const collectionQuery = async (
      slug: string,
      offset = 0,
      branchId = shopId,
      filter?: { optionValueIds: string[]; inStock: boolean },
    ): Promise<unknown> => {
      const response = await shopper.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId },
        data: {
          query: `query($slug: String!, $offset: Int!, $filter: CatalogueBrowseFilter) {
            catalogueCollections { items { name slug } total }
            catalogueCollectionProducts(slug: $slug, offset: $offset, limit: 1, filter: $filter) {
              items { name }
              total offset limit
            }
          }`,
          variables: { slug, offset, filter },
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    await merchant.getByRole('link', { name: 'Collections', exact: true }).click();
    await newCollection(merchant, manualName, manualSlug);
    const collectionSearch = merchant.locator('#collection-products');
    for (const name of [productName, configuredProductName]) {
      await merchant.getByRole('listbox').waitFor({ state: 'hidden' });
      await collectionSearch.fill(name);
      await merchant.getByRole('option', { name, exact: true }).click();
    }
    await merchant
      .getByRole('button', { name: `Move ${configuredProductName} up`, exact: true })
      .click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Collection saved.');
    expect(await collectionQuery(manualSlug)).toEqual({
      data: {
        catalogueCollections: { items: [{ name: manualName, slug: manualSlug }], total: 1 },
        catalogueCollectionProducts: {
          items: [{ name: configuredProductName }],
          total: 2,
          offset: 0,
          limit: 1,
        },
      },
    });
    expect(await collectionQuery(manualSlug, 1)).toMatchObject({
      data: {
        catalogueCollectionProducts: {
          items: [{ name: productName }],
          total: 2,
          offset: 1,
          limit: 1,
        },
      },
    });

    await newCollection(merchant, ruleName, ruleSlug);
    await merchant.locator('#collection-mode').click();
    const collectionCategories = waitForCategories(merchant);
    await merchant.getByRole('option', { name: 'By category', exact: true }).click();
    await chooseCookware(merchant, '#collection-category', collectionCategories);
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Collection saved.');
    expect(await collectionQuery(ruleSlug)).toMatchObject({
      data: { catalogueCollectionProducts: { items: [{ name: productName }], total: 1 } },
    });

    await merchant.getByRole('link', { name: 'Products', exact: true }).click();
    const configuredProduct = merchant.getByRole('button', {
      name: configuredProductName,
      exact: true,
    });
    const productCategories = waitForCategories(merchant);
    await configuredProduct.click();
    await chooseCookware(merchant, '#product-category', productCategories);
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    expect(await collectionQuery(ruleSlug, 1)).toMatchObject({
      data: { catalogueCollectionProducts: { items: [{ name: configuredProductName }], total: 2 } },
    });

    const gloss = optionValues.find(({ label }) => label === 'Gloss');
    const satin = optionValues.find(({ label }) => label === 'Satin');
    if (!gloss || !satin) {
      throw new Error('The smoke option requires Gloss and Satin values');
    }
    expect(
      await collectionQuery(ruleSlug, 0, shopId, {
        optionValueIds: [gloss.id],
        inStock: true,
      }),
    ).toMatchObject({
      data: { catalogueCollectionProducts: { items: [], total: 0 } },
    });
    expect(await publicProductsQuery()).toMatchObject({
      data: {
        catalogue: {
          items: expect.arrayContaining([
            expect.objectContaining({ id: productId, variantSelection: simpleSelection(false) }),
            expect.objectContaining({
              name: configuredProductName,
              variantSelection: {
                options: [{ name: 'Surface finish', values: optionValues }],
                variants: [
                  {
                    id: expect.any(String),
                    sku: 'CONFIG-Gloss',
                    price: '24.00',
                    available: false,
                    optionValueIds: [gloss.id],
                  },
                  {
                    id: expect.any(String),
                    sku: 'CONFIG-Satin',
                    price: '30.00',
                    available: true,
                    optionValueIds: [satin.id],
                  },
                ],
              },
            }),
          ]),
        },
      },
    });

    const filtered = await shopperContext.newPage();
    await filtered.addInitScript(() => {
      sessionStorage.setItem('holita.storefront.language', 'en');
    });
    await filtered.goto(`${shopApp.origin}/s/${shopId}/categories/cookware`);
    await filtered.getByLabel('Surface finish').selectOption({ label: 'Satin' });
    await filtered.getByLabel('In stock only').check();
    await filtered.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(filtered.locator('.catalogue-card h2')).toHaveText([configuredProductName]);
    const sharedUrl = filtered.url();
    await filtered.close();
    const reopened = await shopperContext.newPage();
    await reopened.goto(sharedUrl);
    await expect(
      reopened.getByRole('link', { name: configuredProductName, exact: true }),
    ).toBeVisible();
    await expect(reopened.getByRole('link', { name: productName, exact: true })).toHaveCount(0);
    await reopened.close();

    await configuredProduct.click();
    await merchant.locator('#product-status').click();
    await merchant.getByRole('option', { name: 'Draft', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    for (const slug of [manualSlug, ruleSlug]) {
      expect(await collectionQuery(slug)).toMatchObject({
        data: { catalogueCollectionProducts: { items: [{ name: productName }], total: 1 } },
      });
    }

    await merchant.getByRole('link', { name: 'Collections', exact: true }).click();
    await merchant.getByRole('button', { name: manualName, exact: true }).click();
    await merchant.locator('#collection-active').click();
    await merchant.getByRole('option', { name: 'Inactive', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Collection saved.');
    expect(await collectionQuery(manualSlug)).toEqual({
      data: {
        catalogueCollections: { items: [{ name: ruleName, slug: ruleSlug }], total: 1 },
        catalogueCollectionProducts: null,
      },
    });

    await merchant.getByRole('link', { name: 'Categories', exact: true }).click();
    await merchant.getByRole('button', { name: 'Cookware', exact: true }).click();
    await merchant.locator('#category-parent').click();
    await merchant.getByRole('option', { name: 'Home', exact: true }).click();
    await merchant.locator('#category-sort-order').fill('15');
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(merchant.getByRole('dialog', { name: 'Edit category' })).toBeHidden();
    await shopper.reload();
    await expect(breadcrumbs.locator('li > :last-child')).toHaveText([
      'Products',
      'Home',
      'Cookware',
      productName,
    ]);
    await merchant.getByRole('button', { name: 'Home', exact: true }).click();
    await merchant.locator('#category-active').click();
    await merchant.getByRole('option', { name: 'Hidden', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(merchant.getByRole('dialog', { name: 'Edit category' })).toBeHidden();
    await shopper.reload();
    await expect(shopper.getByRole('heading', { name: productName })).toBeVisible();
    await expect(breadcrumbs).toHaveCount(0);
    await expectMenu(shopper, ['blog']);
    const activeCategories = await shopper.request.post(`${shopApp.origin}/graphql`, {
      headers: { 'x-branch-id': shopId },
      data: {
        query:
          '{ catalogueCategories { name } catalogueCategoryProducts(slug: "cookware") { total } }',
      },
    });
    expect(await activeCategories.json()).toEqual({
      data: { catalogueCategories: [{ name: 'Kitchen' }], catalogueCategoryProducts: null },
    });
    const secondShopId = await createShop(staff, 'Second shop');
    expect(await collectionQuery(ruleSlug, 0, secondShopId)).toEqual({
      data: { catalogueCollections: { items: [], total: 0 }, catalogueCollectionProducts: null },
    });
    expect(await specificationsQuery(secondShopId)).toEqual({
      data: { catalogueProductSpecifications: [] },
    });
    expect(await publicProductsQuery(secondShopId)).toEqual({
      data: { catalogueProduct: null, catalogue: { items: [] } },
    });
    expect(await publicShopSettings(secondShopId)).toEqual({
      data: {
        shop: {
          id: secondShopId,
          name: 'Second shop',
          displayName: 'Second shop',
          contactEmail: null,
          contactPhone: null,
          contactAddress: null,
        },
      },
    });
    const [secondNavigation] = await Promise.all([
      shopper.waitForResponse((response) => {
        const request = response.request();
        return (
          request.headers()['x-branch-id'] === secondShopId &&
          request.postData()?.includes('"operationName":"PublicShopNavigation"') === true
        );
      }),
      shopper.goto(`${shopApp.origin}/s/${secondShopId}`),
    ]);
    expect(await secondNavigation.json()).toMatchObject({
      data: { shopNavigation: { header: [], footer: [] } },
    });
    await expect(shopper.getByRole('link', { name: 'Second shop', exact: true })).toBeVisible();
    await expect(menuLinks(shopper)).toHaveCount(0);
    await shopper.getByRole('link', { name: 'Products', exact: true }).click();
    await expect(
      shopper.getByRole('main').getByText('No products.', { exact: true }),
    ).toBeVisible();
    const foreignProductImage = angled.replace(shopId, secondShopId);
    expect(
      (await shopper.request.get(new URL(foreignProductImage, shopApp.origin).href)).status(),
    ).toBe(404);
    const foreignImage = logo.replace(shopId, secondShopId);
    expect((await shopper.request.get(new URL(foreignImage, shopApp.origin).href)).status()).toBe(
      404,
    );
    await merchant.getByRole('link', { name: 'Brands', exact: true }).click();
    await merchant
      .getByRole('button', { name: 'Actions for Inline Smoke Brand', exact: true })
      .click();
    await merchant.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await merchant.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(
      merchant.getByRole('button', { name: 'Inline Smoke Brand', exact: true }),
    ).toHaveCount(0);
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
    expect(await previewBytes(merchant.getByRole('img', { name: 'Logo', exact: true }))).toEqual(
      logoBytes,
    );
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
    await merchant.getByRole('link', { name: 'Products', exact: true }).click();
    await configuredProduct.click();
    await merchant.locator('#product-status').click();
    await merchant.getByRole('option', { name: 'Active', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');

    const shopperEmail = `shopper-${randomUUID()}@example.test`;
    const shopperPassword = `Temporary-${randomUUID()}`;
    await shopper.getByRole('link', { name: 'My account' }).click();
    await shopper.getByRole('link', { name: 'Register', exact: true }).click();
    await shopper.locator('#name').fill('Shopper');
    await shopper.locator('#email').fill(shopperEmail);
    await secretFill(shopper.locator('#password'), shopperPassword);
    await shopper.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(shopper.getByText('Shopper', { exact: true })).toBeVisible();
    await shopper.getByRole('link', { name: 'Products', exact: true }).click();
    await expect(shopper.getByRole('link', { name: productName })).toBeVisible();
    await shopper.getByRole('link', { name: configuredProductName, exact: true }).click();
    await expect(
      shopper.getByRole('heading', { name: configuredProductName, exact: true }),
    ).toBeVisible();
    const configuredProductUrl = shopper.url();
    const cartPreview = (page: Page) => page.getByRole('dialog', { name: 'Cart', exact: true });
    const viewFullCart = (page: Page) =>
      cartPreview(page).getByRole('link', { name: 'View cart', exact: true }).click();
    const addSatin = async (page = shopper) => {
      await page.getByRole('radio', { name: 'Gloss', exact: true }).check();
      await page.getByRole('radio', { name: 'Satin', exact: true }).check();
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    };
    const expectedSatin = {
      name: configuredProductName,
      optionLabels: ['Satin'],
      unitPrice: '30.00',
      variantId: expect.any(String),
    };
    const singleSatin = {
      itemCount: 1,
      subtotal: '30.00',
      lines: [{ ...expectedSatin, quantity: 1, lineTotal: '30.00' }],
    };
    const waitForCart = (page: Page, operation = 'PublicCart') =>
      page.waitForResponse(
        (response) =>
          response.request().postData()?.includes(`"operationName":"${operation}"`) === true,
      );
    const accountAdd = waitForCart(shopper, 'AddCartLine');
    await addSatin();
    expect(await (await accountAdd).json()).toMatchObject({
      data: { addCartLine: { guestCartToken: null, cart: singleSatin } },
    });
    await cartPreview(shopper).getByRole('button', { name: 'Close cart', exact: true }).click();
    await expect(shopper.getByRole('button', { name: 'Cart, 1 item', exact: true })).toBeVisible();
    await shopper.getByRole('link', { name: 'My account' }).click();
    await shopper.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(shopper.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
    await shopper.goto(configuredProductUrl);
    await addSatin();
    await viewFullCart(shopper);
    const cartUrl = `${shopApp.origin}/s/${shopId}/cart`;
    await expect(shopper).toHaveURL(cartUrl);
    await expect(
      shopper.getByRole('link', { name: configuredProductName, exact: true }),
    ).toBeVisible();
    const guestToken = await shopper.evaluate(
      (id) => localStorage.getItem(`holita.cart.${id}`),
      shopId,
    );
    if (!guestToken) {
      throw new Error('The guest cart credential was not stored');
    }
    const guestReload = waitForCart(shopper);
    await shopper.reload();
    expect(await (await guestReload).json()).toMatchObject({ data: { cart: singleSatin } });
    const guestTab = await shopperContext.newPage();
    const tabCart = waitForCart(guestTab);
    await guestTab.goto(cartUrl);
    expect(await (await tabCart).json()).toMatchObject({ data: { cart: singleSatin } });
    await guestTab.close();

    const {
      rows: [shopScope],
    } = await coreDb.client.query<{ tenantId: string }>(
      'SELECT "tenantId" FROM "branch" WHERE "id" = $1',
      [shopId],
    );
    if (!shopScope) {
      throw new Error('Missing scope for the checkout fixture');
    }
    const guestCartId = async (token: string) => {
      const {
        rows: [cart],
      } = await commerceDb.client.query<{ id: string }>(
        'SELECT "id" FROM "cart" WHERE "tenantId" = $1 AND "branchId" = $2 AND "guestTokenHash" = $3',
        [shopScope.tenantId, shopId, hash('sha256', token, 'hex')],
      );
      if (!cart) {
        throw new Error('Missing scoped guest cart for checkout');
      }
      return cart.id;
    };
    const mergedCartId = await guestCartId(guestToken);
    const paymentLabel = 'Cash on delivery';
    const paymentInstructions = 'Pay when the parcel arrives.';
    const alternativePaymentLabel = 'Bank transfer';
    const shippingLabel = 'Home delivery';
    const saveMethod = async (operation: string, field: string): Promise<void> => {
      const saved = waitForCart(merchant, operation);
      const dialog = merchant.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      expect(await (await saved).json()).toMatchObject({
        data: { [field]: { id: expect.any(String) } },
      });
      await expect(dialog).toBeHidden();
    };
    const createPayment = async (label: string, instructions: string, sortOrder: string) => {
      await merchant.getByRole('button', { name: 'New payment method', exact: true }).click();
      await merchant.locator('#payment-method-label').fill(label);
      await merchant.locator('#payment-method-instructions').fill(instructions);
      await merchant.locator('#payment-method-sort-order').fill(sortOrder);
      await merchant.locator('#payment-method-enabled').click();
      await merchant.getByRole('option', { name: 'Enabled', exact: true }).click();
      return saveMethod('OperatorCreatePaymentMethod', 'createPaymentMethod');
    };
    await merchant.getByRole('link', { name: 'Payment methods', exact: true }).click();
    await createPayment(paymentLabel, paymentInstructions, '0');
    await createPayment(alternativePaymentLabel, 'Follow the bank transfer instructions.', '10');
    await merchant.getByRole('link', { name: 'Shipping methods', exact: true }).click();
    await merchant.getByRole('button', { name: 'New shipping method', exact: true }).click();
    await merchant.locator('#shipping-method-label').fill(shippingLabel);
    await merchant.locator('#shipping-method-fixed-fee').fill('6,50');
    await merchant.locator('#shipping-method-enabled').click();
    await merchant.getByRole('option', { name: 'Enabled', exact: true }).click();
    await saveMethod('OperatorCreateShippingMethod', 'createShippingMethod');
    const discountCode = 'SMOKE10';
    await merchant.getByRole('link', { name: 'Discounts', exact: true }).click();
    await merchant.getByRole('button', { name: 'New discount', exact: true }).click();
    await merchant.locator('#discount-code').fill(discountCode.toLowerCase());
    await merchant.locator('#discount-value').fill('10');
    await merchant.locator('#discount-enabled').click();
    await merchant.getByRole('option', { name: 'Enabled', exact: true }).click();
    await merchant.locator('#discount-usageLimit').fill('1');
    const createdDiscount = waitForCart(merchant, 'OperatorCreateDiscount');
    const savedDiscounts = waitForCart(merchant, 'OperatorDiscounts');
    await merchant.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    expect(await (await createdDiscount).json()).toMatchObject({
      data: { createDiscount: { id: expect.any(String) } },
    });
    expect(await (await savedDiscounts).json()).toMatchObject({
      data: {
        discounts: {
          items: [{ code: discountCode, enabled: true, usageLimit: 1, redeemedCount: 0 }],
        },
      },
    });
    const applyPromo = async (page: Page): Promise<unknown> => {
      await page.getByRole('textbox', { name: 'Promo code', exact: true }).fill(discountCode);
      const applied = waitForCart(page, 'ApplyCartDiscount');
      await page.getByRole('button', { name: 'Apply promo code', exact: true }).click();
      return (await applied).json();
    };
    const billingRecipient = {
      name: 'Billing Recipient',
      phone: '+359 32 555 0118',
      countryCode: 'BG',
      city: 'Plovdiv',
      postalCode: '4000',
      line1: '24 Billing Street',
      line2: 'Floor 2',
    };
    const guestShopperNote = 'Please ring the doorbell.\nLeave the parcel with reception.';
    const accountShopperNote = 'Please call on arrival.';
    const quoteCheckout = async (
      page: Page,
      subtotal: string,
      total: string,
      discount: { discountCode: string | null; discountAmount: string } = {
        discountCode: null,
        discountAmount: '0.00',
      },
      shippingFee = '6.50',
      separateBilling = false,
      shopperNote?: string,
    ) => {
      await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Shopper');
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill(shopperEmail);
      await page.getByRole('textbox', { name: 'Phone', exact: true }).fill('+359 2 555 0100');
      await page.locator('#countryCode').selectOption('BG');
      await page.getByRole('textbox', { name: 'City', exact: true }).fill('Sofia');
      await page.getByRole('textbox', { name: 'Postal code', exact: true }).fill('1000');
      await page
        .getByRole('textbox', { name: 'Address line 1', exact: true })
        .fill('12 Demo Street');
      await page.getByLabel('Delivery method', { exact: true }).selectOption({ index: 1 });
      await page
        .getByLabel('Payment method', { exact: true })
        .selectOption({ label: paymentLabel });
      if (separateBilling) {
        await page.getByRole('checkbox', { name: 'Use a different billing address' }).check();
        for (const [key, value] of Object.entries(billingRecipient)) {
          const field = page.locator(`#billing-${key}`);
          if (key === 'countryCode') {
            await field.selectOption(value);
          } else {
            await field.fill(value);
          }
        }
      }
      if (shopperNote) {
        await page.locator('#shopperNote').fill(shopperNote);
      }
      const quoted = waitForCart(page, 'QuoteCheckout');
      await page.getByRole('button', { name: 'Review total', exact: true }).click();
      const response = await quoted;
      expect(response.request().postDataJSON()).not.toHaveProperty('variables.input.shopperNote');
      if (separateBilling) {
        expect(response.request().postDataJSON()).toMatchObject({
          variables: { input: { billingAddress: billingRecipient } },
        });
      }
      expect(await response.json()).toMatchObject({
        data: {
          quoteCheckout: { subtotal, shippingFee, total, currency: 'EUR', ...discount },
        },
      });
    };
    const reviewCheckout = async (...args: Parameters<typeof quoteCheckout>) => {
      const [page] = args;
      const checkoutRead = waitForCart(page, 'Checkout');
      await page.getByRole('link', { name: 'Checkout', exact: true }).click();
      const checkoutResult: unknown = await (await checkoutRead).json();
      await quoteCheckout(...args);
      return checkoutResult;
    };
    expect(await reviewCheckout(shopper, '30.00', '36.50')).toMatchObject({
      data: {
        checkout: {
          paymentMethods: [{ label: paymentLabel }, { label: alternativePaymentLabel }],
        },
      },
    });

    const readWithGuestToken = async (branchId: string): Promise<unknown> => {
      const response = await shopper.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId, 'x-cart-token': guestToken },
        data: { query: '{cart{itemCount}}' },
      });
      return response.json();
    };
    const missingCart = {
      data: null,
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    };
    expect(await readWithGuestToken(secondShopId)).toMatchObject(missingCart);
    const otherEmail = 'other-order-customer@example.test';
    const otherCustomerId = randomUUID();
    const otherPhone = '+359 2 555 0175';
    await commerceDb.client.query(
      `INSERT INTO "customer" ("id", "tenantId", "branchId", "name", "email", "phone", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [otherCustomerId, shopScope.tenantId, shopId, 'Other Customer', otherEmail, otherPhone],
    );
    const signInAttempt = async (email: string, branchId = shopId): Promise<unknown> => {
      const response = await shopper.request.post(publicUrl, {
        headers: { 'x-branch-id': branchId },
        data: {
          query: `mutation Attempt($email: String!, $password: String!) {
            ...ShopperLogin
          }
          fragment ShopperLogin on Mutation {
            attempt: signInShopper(email: $email, password: $password) { shopper { id } }
          }`,
          variables: { email, password: 'invalid-password' },
        },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const missingShop = randomUUID();
    for (let attempt = 0; attempt < 4; attempt++) {
      expect(await signInAttempt(shopperEmail, missingShop)).toMatchObject({
        data: null,
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    }
    await shopper.goto(`${shopApp.origin}/s/${shopId}/sign-in`);
    await shopper.locator('#email').fill(shopperEmail);
    await secretFill(shopper.locator('#password'), shopperPassword);
    await shopper.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(shopper).toHaveURL(cartUrl);
    const rejected = await signInAttempt(shopperEmail);
    expect(rejected).toMatchObject({
      data: null,
      errors: [{ message: expect.any(String), extensions: { code: 'UNAUTHENTICATED' } }],
    });
    for (const email of ['missing-shopper@example.test', otherEmail]) {
      expect(await signInAttempt(email)).toEqual(rejected);
    }
    const limited = {
      data: null,
      errors: [{ message: 'Too many sign-in attempts', extensions: { code: 'TOO_MANY_REQUESTS' } }],
    };
    const readCatalogue = async (): Promise<unknown> => {
      const response = await shopper.request.post(publicUrl, {
        headers: { 'x-branch-id': shopId },
        data: { query: '{catalogue{total}}' },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    for (let batch = 0; batch < 20; batch++) {
      const [catalogue, ...rejectedAttempts] = await Promise.all([
        readCatalogue(),
        ...Array.from({ length: 6 }, () => signInAttempt(shopperEmail)),
      ]);
      expect(catalogue).toMatchObject({ data: { catalogue: { total: expect.any(Number) } } });
      // Earlier sign-in attempts can expire during the stress run.
      expect(rejectedAttempts).toContainEqual(limited);
      for (const attempt of rejectedAttempts) {
        expect([rejected, limited]).toContainEqual(attempt);
      }
    }
    expect(await signInAttempt(shopperEmail, secondShopId)).toEqual(rejected);
    await expect(shopper.getByRole('button', { name: 'Cart, 2 items', exact: true })).toBeVisible();
    const signedInReload = waitForCart(shopper);
    await shopper.reload();
    expect(await (await signedInReload).json()).toMatchObject({
      data: {
        cart: {
          itemCount: 2,
          subtotal: '60.00',
          lines: [{ ...expectedSatin, quantity: 2, lineTotal: '60.00' }],
        },
      },
    });
    expect(await readWithGuestToken(shopId)).toMatchObject(missingCart);
    await reviewCheckout(shopper, '60.00', '66.50');
    await shopper.getByRole('link', { name: 'Back to cart', exact: true }).click();

    await shopper.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('3');
    const updated = waitForCart(shopper, 'UpdateCartLine');
    await shopper.getByRole('button', { name: 'Update', exact: true }).click();
    expect(await (await updated).json()).toMatchObject({
      data: {
        updateCartLine: {
          itemCount: 3,
          subtotal: '90.00',
          lines: [{ ...expectedSatin, quantity: 3, lineTotal: '90.00' }],
        },
      },
    });
    const removed = waitForCart(shopper, 'RemoveCartLine');
    await shopper.getByRole('button', { name: 'Remove', exact: true }).click();
    expect(await (await removed).json()).toMatchObject({
      data: { removeCartLine: { itemCount: 0, subtotal: '0.00', lines: [] } },
    });

    await commerceDb.client.query(
      `UPDATE "productVariant" SET "quantity" = 1
       WHERE "tenantId" = $1 AND "branchId" = $2 AND "productId" = $3 AND "sku" = 'SMOKE-001'`,
      [shopScope.tenantId, shopId, productId],
    );
    const guestOrderContext = await browser.newContext();
    cleanup.push(() => guestOrderContext.close());
    const guestOrder = await guestOrderContext.newPage();
    await guestOrder.goto(productUrl);
    await guestOrder.getByRole('button', { name: 'EN', exact: true }).click();
    await guestOrder.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await viewFullCart(guestOrder);
    const orderCartToken = await guestOrder.evaluate(
      (id) => localStorage.getItem(`holita.cart.${id}`),
      shopId,
    );
    if (!orderCartToken) {
      throw new Error('Missing guest authorization for checkout');
    }
    const orderCartId = await guestCartId(orderCartToken);
    // Recreate the pending browser record left behind when sign-in merged the first guest cart.
    await guestOrder.evaluate(
      ({ id, attempt }) => {
        localStorage.setItem(`holita.checkout.${id}`, JSON.stringify(attempt));
      },
      { id: shopId, attempt: { cartId: mergedCartId, token: guestToken } },
    );
    const [missingOrder] = await Promise.all([
      waitForCart(guestOrder, 'GuestOrderConfirmation'),
      reviewCheckout(guestOrder, '25.50', '32.00'),
    ]);
    expect(await missingOrder.json()).toMatchObject({ data: { guestOrderConfirmation: null } });
    const placementRoute = '**/graphql';
    const isPlacement = (body: string | null) =>
      body?.includes('"operationName":"PlaceOrder"') === true;
    const interruptCheckout = async (page: Page) => {
      let placementCount = 0;
      let committedPlacement: unknown;
      await page.route(placementRoute, async (route) => {
        if (!isPlacement(route.request().postData())) {
          return route.continue();
        }
        placementCount += 1;
        if (placementCount === 2) {
          committedPlacement = await (await route.fetch()).json();
        }
        await route.abort();
      });
      return {
        place: async () => {
          const interrupted = page.waitForEvent('requestfailed', (request) =>
            isPlacement(request.postData()),
          );
          await page.getByRole('button', { name: 'Place order', exact: true }).click();
          await interrupted;
          return committedPlacement;
        },
        requestCount: () => placementCount,
      };
    };
    const interruptedGuestCheckout = await interruptCheckout(guestOrder);
    await interruptedGuestCheckout.place();
    const activeCheckout = waitForCart(guestOrder, 'Checkout');
    await guestOrder.reload();
    expect(await (await activeCheckout).json()).toMatchObject({
      data: { checkout: { cart: { itemCount: 1 } } },
    });
    await quoteCheckout(
      guestOrder,
      '25.50',
      '32.00',
      undefined,
      '6.50',
      false,
      `  ${guestShopperNote}  `,
    );
    expect(interruptedGuestCheckout.requestCount()).toBe(1);

    const committedPlacement = await interruptedGuestCheckout.place();
    expect(committedPlacement).toMatchObject({ data: { placeOrder: { id: expect.any(String) } } });
    const shoppingTab = await guestOrderContext.newPage();
    await shoppingTab.goto(configuredProductUrl);
    await shoppingTab.getByRole('button', { name: 'EN', exact: true }).click();
    await addSatin(shoppingTab);
    await expect(cartPreview(shoppingTab)).toBeVisible();
    await shoppingTab.close();
    const recoveredReceipt = waitForCart(guestOrder, 'OrderConfirmation').then((response) =>
      response.json(),
    );
    const [recovered] = await Promise.all([
      waitForCart(guestOrder, 'GuestOrderConfirmation'),
      guestOrder.reload(),
    ]);
    await expect(guestOrder).toHaveURL(/\/checkout\/confirmation\/[^/]+$/);
    const confirmationUrl = guestOrder.url();
    const orderId = new URL(confirmationUrl).pathname.split('/').at(-1);
    if (!orderId) {
      throw new Error('Missing order ID in the confirmation route');
    }
    const expectedOrder = {
      id: orderId,
      status: 'PLACED',
      paymentStatus: 'UNPAID',
      subtotal: '25.50',
      shippingFee: '6.50',
      total: '32.00',
      paymentInstructions,
      shopperNote: guestShopperNote,
    };
    expect(committedPlacement).toMatchObject({ data: { placeOrder: expectedOrder } });
    expect(await recovered.json()).toMatchObject({
      data: { guestOrderConfirmation: { id: orderId } },
    });
    expect(interruptedGuestCheckout.requestCount()).toBe(2);
    await guestOrder.unroute(placementRoute);
    const { rows: cartOrders } = await commerceDb.client.query(
      'SELECT "id" FROM "order" WHERE "tenantId" = $1 AND "branchId" = $2 AND "cartId" = $3',
      [shopScope.tenantId, shopId, orderCartId],
    );
    expect(cartOrders).toEqual([{ id: orderId }]);
    const {
      rows: [simpleVariant],
    } = await commerceDb.client.query<{ id: string; quantity: number }>(
      `SELECT "id", "quantity" FROM "productVariant"
       WHERE "tenantId" = $1 AND "branchId" = $2 AND "productId" = $3 AND "sku" = 'SMOKE-001'`,
      [shopScope.tenantId, shopId, productId],
    );
    if (!simpleVariant) {
      throw new Error('Missing tracked variant for the guest order');
    }
    expect(simpleVariant.quantity).toBe(0);
    expect(await recoveredReceipt).toMatchObject({
      data: { orderConfirmation: expectedOrder },
    });
    const receipt = waitForCart(guestOrder, 'OrderConfirmation').then((response) =>
      response.json(),
    );
    await guestOrder.reload();
    expect(await receipt).toMatchObject({
      data: { orderConfirmation: expectedOrder },
    });
    for (const [branchId, credential] of [
      [shopId, guestToken],
      [secondShopId, orderCartToken],
    ]) {
      const denied = await guestOrder.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId, 'x-cart-token': credential },
        data: {
          query: `query($orderId: ID!, $cartId: ID!) {
            orderConfirmation(orderId: $orderId) { id }
            guestOrderConfirmation(cartId: $cartId) { id }
          }`,
          variables: { orderId, cartId: orderCartId },
        },
      });
      expect(await denied.json()).toEqual({
        data: { orderConfirmation: null, guestOrderConfirmation: null },
      });
    }

    const {
      rows: [trackedVariant],
    } = await commerceDb.client.query<{ id: string }>(
      `UPDATE "productVariant" SET "inventoryTracked" = true, "quantity" = 5
       WHERE "tenantId" = $1 AND "branchId" = $2 AND "sku" = $3 RETURNING "id"`,
      [shopScope.tenantId, shopId, 'CONFIG-Satin'],
    );
    if (!trackedVariant) {
      throw new Error('Missing tracked variant for the refund fixture');
    }
    await shopper.goto(configuredProductUrl);
    await addSatin();
    await viewFullCart(shopper);
    const discountedCart = {
      discount: { code: discountCode, amount: '3.00', issue: null },
      discountedSubtotal: '27.00',
    };
    expect(await applyPromo(shopper)).toMatchObject({
      data: { applyCartDiscount: discountedCart },
    });
    const removedPromo = waitForCart(shopper, 'RemoveCartDiscount');
    await shopper.getByRole('button', { name: 'Remove promo code', exact: true }).click();
    expect(await (await removedPromo).json()).toMatchObject({
      data: { removeCartDiscount: { discount: null, discountedSubtotal: '30.00' } },
    });
    expect(await applyPromo(shopper)).toMatchObject({
      data: { applyCartDiscount: discountedCart },
    });
    const discountedQuote = { discountCode, discountAmount: '3.00' };
    const chargedTotal = '33.50';
    await reviewCheckout(shopper, '30.00', chargedTotal, discountedQuote, '6.50', true);
    const interruptedAccountCheckout = await interruptCheckout(shopper);
    const pendingAccountCart = () =>
      shopper.evaluate((id) => sessionStorage.getItem(`holita.shopper-checkout.${id}`), shopId);
    await interruptedAccountCheckout.place();
    const accountCartId = await pendingAccountCart();
    if (!accountCartId) {
      throw new Error('Missing pending checkout cart for the signed-in shopper');
    }
    const [uncommittedAccount, activeAccountCheckout] = await Promise.all([
      waitForCart(shopper, 'ShopperOrderConfirmation'),
      waitForCart(shopper, 'Checkout'),
      shopper.reload(),
    ]);
    expect(await uncommittedAccount.json()).toEqual({ data: { shopperOrderConfirmation: null } });
    expect(await activeAccountCheckout.json()).toMatchObject({
      data: { checkout: { cart: { itemCount: 1 } } },
    });
    await expect.poll(pendingAccountCart).toBeNull();
    await quoteCheckout(
      shopper,
      '30.00',
      chargedTotal,
      discountedQuote,
      '6.50',
      true,
      accountShopperNote,
    );

    const committedAccountPlacement = await interruptedAccountCheckout.place();
    const [recoveredAccount, accountReceipt] = await Promise.all([
      waitForCart(shopper, 'ShopperOrderConfirmation'),
      waitForCart(shopper, 'OrderConfirmation'),
      shopper.reload(),
    ]);
    await expect(shopper).toHaveURL(/\/checkout\/confirmation\/[^/]+$/);
    const accountOrderId = new URL(shopper.url()).pathname.split('/').at(-1);
    if (!accountOrderId) {
      throw new Error('Missing account order ID in the confirmation route');
    }
    const expectedAccountOrder = {
      id: accountOrderId,
      total: chargedTotal,
      shopperNote: accountShopperNote,
      ...discountedQuote,
    };
    expect(committedAccountPlacement).toMatchObject({ data: { placeOrder: expectedAccountOrder } });
    expect(await recoveredAccount.json()).toMatchObject({
      data: { shopperOrderConfirmation: { id: accountOrderId } },
    });
    expect(await accountReceipt.json()).toMatchObject({
      data: { orderConfirmation: expectedAccountOrder },
    });
    await expect(shopper.getByRole('heading', { name: 'Order placed', exact: true })).toBeVisible();
    await expect.poll(pendingAccountCart).toBeNull();
    expect(interruptedAccountCheckout.requestCount()).toBe(2);
    await shopper.unroute(placementRoute);

    const otherShopper = await shopperContext.newPage();
    await otherShopper.addInitScript(() => {
      sessionStorage.setItem('holita.storefront.language', 'en');
    });
    await otherShopper.goto(`${shopApp.origin}/s/${shopId}/register`);
    await otherShopper.locator('#name').fill('Unrelated shopper');
    await otherShopper.locator('#email').fill(`unrelated-${randomUUID()}@example.test`);
    await secretFill(otherShopper.locator('#password'), `Temporary-${randomUUID()}`);
    await otherShopper.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(otherShopper).toHaveURL(`${shopApp.origin}/s/${shopId}/account`);
    const otherToken = await otherShopper.evaluate(
      (id) => sessionStorage.getItem(`holita.shopper.${id}`),
      shopId,
    );
    await otherShopper.close();
    const ownerAuthorization = await recoveredAccount.request().headerValue('authorization');
    if (!otherToken || !ownerAuthorization) {
      throw new Error('Missing shopper authorization for the checkout isolation checks');
    }
    const missingAccountOrder = { data: { shopperOrderConfirmation: null } };
    const unauthorizedOrder = {
      ...missingAccountOrder,
      errors: [{ path: ['shopperOrderConfirmation'] }],
    };
    for (const [branchId, authorization, expected] of [
      [shopId, `Bearer ${otherToken}`, missingAccountOrder],
      [secondShopId, ownerAuthorization, unauthorizedOrder],
      [shopId, null, unauthorizedOrder],
    ] as const) {
      const denied = await shopper.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId, ...(authorization ? { authorization } : {}) },
        data: {
          query: 'query($cartId: ID!) { shopperOrderConfirmation(cartId: $cartId) { id } }',
          variables: { cartId: accountCartId },
        },
      });
      expect(await denied.json()).toMatchObject(expected);
    }
    await guestOrder.goto(cartUrl);
    expect(await applyPromo(guestOrder)).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'code', code: 'PROMO_EXHAUSTED' }],
          },
        },
      ],
    });
    const orderNumber = `H-${accountOrderId}`;
    await shopper.getByRole('link', { name: 'My account' }).click();
    const orders = waitForCart(shopper, 'ShopperOrders');
    await shopper.getByRole('link', { name: 'My orders', exact: true }).click();
    expect(await (await orders).json()).toMatchObject({
      data: { shopperOrders: { items: [{ id: accountOrderId, number: orderNumber }], total: 1 } },
    });
    const detail = waitForCart(shopper, 'ShopperOrder');
    await shopper.getByRole('link', { name: orderNumber, exact: true }).click();
    const accountOrderSnapshot = {
      id: accountOrderId,
      shopperNote: accountShopperNote,
      contact: { name: 'Shopper', email: shopperEmail, phone: '+359 2 555 0100' },
      shippingAddress: {
        line1: '12 Demo Street',
        city: 'Sofia',
        postalCode: '1000',
        countryCode: 'BG',
      },
      currency: 'EUR',
      subtotal: '30.00',
      shippingFee: '6.50',
      total: chargedTotal,
      lines: [
        {
          sku: 'CONFIG-Satin',
          label: `${configuredProductName} · Satin`,
          quantity: 1,
          unitPrice: '30.00',
          lineTotal: '30.00',
        },
      ],
      ...discountedQuote,
    };
    expect(await (await detail).json()).toMatchObject({
      data: { shopperOrder: accountOrderSnapshot },
    });
    const accountReceiptUrl = shopper.url();

    const invoiceNavigation = merchant
      .getByRole('navigation', { name: 'Navigation', exact: true })
      .getByRole('link', { name: 'Invoices', exact: true });
    await invoiceNavigation.click();
    const openIssuerSettings = async () => {
      await merchant.getByRole('button', { name: 'Page actions', exact: true }).click();
      await merchant.getByRole('menuitem', { name: 'Invoice settings', exact: true }).click();
    };
    const saveIssuerSettings = async (input: Record<string, string>) => {
      await openIssuerSettings();
      for (const [key, value] of Object.entries(input)) {
        await merchant.locator(`#invoice-${key}`).fill(value);
      }
      const saved = waitForCart(merchant, 'OperatorUpdateInvoiceIssuerSettings');
      await merchant.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
      expect(await (await saved).json()).toMatchObject({
        data: { updateInvoiceIssuerSettings: input },
      });
      await dismissSuccess(merchant, 'Invoice settings saved.');
    };
    const issuer = {
      issuerName: 'Demo Issuer',
      issuerCompanyId: '000000001',
      issuerAddress: '20 Invoice Street, Sofia',
      issuerRepresentative: 'Default Representative',
      issuerBankName: 'Demo Bank',
      issuerIban: 'BG00TEST00000000000000',
      issuerBic: 'TESTBGSF',
    };
    await saveIssuerSettings(issuer);
    await merchant.getByRole('link', { name: 'Orders', exact: true }).click();
    const operatorDiscountedOrder = waitForCart(merchant, 'OperatorOrder');
    await merchant.getByRole('link', { name: `Open order · ${orderNumber}` }).click();
    expect(await (await operatorDiscountedOrder).json()).toMatchObject({
      data: { order: { ...accountOrderSnapshot, billingAddress: billingRecipient } },
    });
    await merchant.getByRole('button', { name: 'Edit order', exact: true }).click();
    await merchant.locator('#manual-merchantNote').fill('Confirm delivery window');
    const storefrontEdit = waitForCart(merchant, 'OperatorUpdateManualOrder');
    const editedOrder = waitForCart(merchant, 'OperatorOrder');
    await merchant.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    expect(await (await storefrontEdit).json()).toMatchObject({
      data: { updateManualOrder: { id: accountOrderId } },
    });
    expect(await (await editedOrder).json()).toMatchObject({
      data: {
        order: {
          ...accountOrderSnapshot,
          billingAddress: billingRecipient,
          merchantNote: 'Confirm delivery window',
        },
      },
    });
    await dismissSuccess(merchant, 'Order saved.');
    const afterMerchantEdit = waitForCart(shopper, 'ShopperOrder');
    await shopper.reload();
    const publicAccountOrder: unknown = await (await afterMerchantEdit).json();
    expect(publicAccountOrder).toMatchObject({ data: { shopperOrder: accountOrderSnapshot } });
    expect(publicAccountOrder).not.toHaveProperty('data.shopperOrder.merchantNote');
    await expect(shopper.getByText('Confirm delivery window')).toHaveCount(0);
    await merchant.getByRole('button', { name: 'Page actions', exact: true }).click();
    await merchant.getByRole('menuitem', { name: 'Update status', exact: true }).click();
    await merchant.locator('#order-status').click();
    await merchant.getByRole('option', { name: 'Confirmed', exact: true }).click();
    const confirmed = waitForCart(merchant, 'OperatorUpdateOrderStatus');
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    expect(await (await confirmed).json()).toMatchObject({
      data: { updateOrderStatus: { id: accountOrderId } },
    });
    await merchant.waitForURL((url) => !url.pathname.endsWith('/fulfillment'));
    await dismissSuccess(merchant, 'Status saved.');
    await merchant.getByRole('button', { name: 'Page actions', exact: true }).click();
    await merchant.getByRole('menuitem', { name: 'Mark as paid', exact: true }).click();
    const paid = waitForCart(merchant, 'OperatorMarkOrderPaid');
    await merchant
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Mark as paid', exact: true })
      .click();
    expect(await (await paid).json()).toMatchObject({
      data: { markOrderPaid: { id: accountOrderId, paymentStatus: 'PAID' } },
    });
    await dismissSuccess(merchant, 'Order marked as paid.');

    await merchant.getByRole('button', { name: 'Page actions', exact: true }).click();
    await merchant.getByRole('menuitem', { name: 'Create invoice', exact: true }).click();
    const invoiceNumber = 'SMOKE-0001';
    await merchant.locator('#invoice-number').fill(invoiceNumber);
    const invoiceDetails = {
      taxEventDate: '2026-11-22',
      issueDate: '2026-11-23',
      dueDate: '2026-12-07',
      paymentMethod: 'Bank transfer',
      reason: 'Ceramic goods',
      note: 'Synthetic acceptance invoice',
      issuerRepresentative: 'Invoice Representative',
    };
    for (const [key, value] of Object.entries(invoiceDetails)) {
      const field = merchant.locator(`#invoice-${key}`);
      if (key.endsWith('Date')) {
        await field.press('ControlOrMeta+a');
        await field.press('Backspace');
        await field.pressSequentially(value);
        await field.press('Tab');
        await expect(field).toHaveValue(value);
      } else {
        await field.fill(value);
      }
    }
    await merchant.locator('#invoice-paymentTermDays').fill('14');
    await merchant.locator('[id="invoice-lineUnits.0"]').fill('pcs');
    const issuance = waitForCart(merchant, 'OperatorIssueOrderInvoice');
    await merchant
      .getByRole('dialog')
      .getByRole('button', { name: 'Create invoice', exact: true })
      .click();
    expect(await (await issuance).json()).toMatchObject({
      data: { issueOrderInvoice: { orderId: accountOrderId, number: invoiceNumber } },
    });
    await merchant.getByRole('link', { name: invoiceNumber, exact: true }).click();
    await merchant.waitForURL((url) => url.pathname.endsWith('/invoice'));
    const orderInvoiceUrl = merchant.url();
    await merchant.locator('#invoice-summary').waitFor();
    const reopenedInvoice = waitForCart(merchant, 'OperatorOrderInvoice');
    await merchant.reload();
    expect(await (await reopenedInvoice).json()).toMatchObject({
      data: {
        orderInvoice: {
          orderId: accountOrderId,
          number: invoiceNumber,
          ...issuer,
          ...invoiceDetails,
          paymentStatus: 'PAID',
          paymentTermDays: 14,
          recipientName: billingRecipient.name,
          recipientPhone: billingRecipient.phone,
          recipientAddress: '24 Billing Street\nFloor 2\n4000 Plovdiv\nBG',
          currency: 'EUR',
          subtotal: '30.00',
          discountAmount: discountedQuote.discountAmount,
          shippingFee: '6.50',
          total: chargedTotal,
          lines: [
            {
              sku: 'CONFIG-Satin',
              quantity: 1,
              unit: 'pcs',
              unitPrice: '30.00',
              lineTotal: '30.00',
            },
          ],
        },
      },
    });
    const downloadInvoicePdf = async (name: string, number = invoiceNumber) => {
      const download = merchant.waitForEvent('download');
      await merchant.getByRole('button', { name: 'Download PDF', exact: true }).click();
      const file = await download;
      expect(file.suggestedFilename()).toBe(`invoice-${number}.pdf`);
      const contents = await readFile(await file.path());
      expect(contents.subarray(0, 5).toString()).toBe('%PDF-');
      await file.saveAs(testInfo.outputPath(name));
    };
    await downloadInvoicePdf('invoice-before-order-change.pdf');
    await invoiceNavigation.click();
    const register = merchant.waitForResponse((response) => {
      const request = response.request().postData();
      return (
        request?.includes('"operationName":"OperatorInvoices"') === true &&
        request.includes(`"search":"${invoiceNumber}"`)
      );
    });
    await merchant
      .getByRole('searchbox', { name: 'Search by number or recipient' })
      .fill(invoiceNumber);
    expect(await (await register).json()).toMatchObject({
      data: {
        invoices: {
          items: [
            {
              orderId: accountOrderId,
              number: invoiceNumber,
              currency: 'EUR',
              total: chargedTotal,
            },
          ],
        },
      },
    });
    await merchant.getByRole('link', { name: invoiceNumber, exact: true }).click();
    await expect(merchant).toHaveURL(
      (url) =>
        url.pathname.endsWith('/invoices/' + accountOrderId) &&
        url.searchParams.get('search') === invoiceNumber,
    );
    await merchant.locator('#invoice-summary').waitFor();

    await invoiceNavigation.click();
    await saveIssuerSettings({ issuerName: 'New Default Issuer' });
    await merchant.getByRole('button', { name: 'Create invoice', exact: true }).click();
    const standaloneNumber = 'SMOKE-0002';
    await merchant.locator('#invoice-number').fill(standaloneNumber);
    await merchant.locator('#invoice-recipientName').fill('Standalone Recipient');
    await merchant.locator('#invoice-recipientAddress').fill('10 Example Street, Sofia');
    await merchant.locator('[id="invoice-lines.0.description"]').fill('Bowls');
    await merchant.locator('[id="invoice-lines.0.quantity"]').fill('2');
    await merchant.locator('[id="invoice-lines.0.unitPrice"]').fill('4.85');
    await merchant.getByRole('button', { name: 'Add line', exact: true }).click();
    await merchant.locator('[id="invoice-lines.1.description"]').fill('Wrapping');
    await merchant.locator('[id="invoice-lines.1.unitPrice"]').fill('0.30');
    const standaloneIssue = waitForCart(merchant, 'OperatorIssueStandaloneInvoice');
    await merchant
      .getByRole('dialog')
      .getByRole('button', { name: 'Create invoice', exact: true })
      .click();
    expect(await (await standaloneIssue).json()).toMatchObject({
      data: { issueStandaloneInvoice: { id: expect.any(String) } },
    });
    const standaloneRead = waitForCart(merchant, 'OperatorInvoiceById');
    await merchant.getByRole('link', { name: standaloneNumber, exact: true }).click();
    expect(await (await standaloneRead).json()).toMatchObject({
      data: {
        invoice: {
          orderId: null,
          number: standaloneNumber,
          issuerName: 'New Default Issuer',
          currency: 'EUR',
          total: '10.00',
          lines: [
            { description: 'Bowls', quantity: 2, unitPrice: '4.85', lineTotal: '9.70' },
            { description: 'Wrapping', quantity: 1, unitPrice: '0.30', lineTotal: '0.30' },
          ],
        },
      },
    });
    const standaloneId = new URL(merchant.url()).pathname.split('/').at(-1);
    await downloadInvoicePdf('standalone-invoice.pdf', standaloneNumber);
    await merchant.goto(orderInvoiceUrl);

    const reloadedOrder = waitForCart(shopper, 'ShopperOrder');
    await shopper.reload();
    expect(await (await reloadedOrder).json()).toMatchObject({
      data: {
        shopperOrder: {
          number: orderNumber,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          shippingFee: '6.50',
          total: chargedTotal,
          ...discountedQuote,
        },
      },
    });

    const paidRequest = (await paid).request();
    const { authorization, 'x-branch-id': branchId } = await paidRequest.allHeaders();
    if (!authorization || branchId !== shopId) {
      throw new Error('Missing scoped operator request');
    }
    const operatorRouter = async (
      query: string,
      variables: Record<string, unknown>,
      selectedShop = branchId,
    ): Promise<unknown> => {
      const response = await merchant.request.post(paidRequest.url(), {
        headers: { authorization, 'x-branch-id': selectedShop },
        data: { query, variables },
      });
      return response.json();
    };
    expect(
      await operatorRouter(
        'query($orderId:ID!,$id:ID!){orderInvoice(orderId:$orderId){id} invoice(id:$id){id} invoices(search:"SMOKE"){total} invoiceIssuerSettings{issuerName}}',
        { orderId: accountOrderId, id: standaloneId },
        secondShopId,
      ),
    ).toEqual({
      data: {
        orderInvoice: null,
        invoice: null,
        invoices: { total: 0 },
        invoiceIssuerSettings: { issuerName: null },
      },
    });
    const inventoryRead = 'query($id:ID!){inventoryVariant(id:$id){id quantity}}';
    expect(await operatorRouter(inventoryRead, trackedVariant)).toEqual({
      data: { inventoryVariant: { ...trackedVariant, quantity: 4 } },
    });
    const setOrderStatus = (
      id: string,
      status: 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED',
    ) =>
      operatorRouter(
        'mutation($id:ID!,$status:OrderStatus!){updateOrderStatus(id:$id,status:$status){id status}}',
        { id, status },
      );
    for (const status of ['PROCESSING', 'SHIPPED'] as const) {
      expect(await setOrderStatus(accountOrderId, status)).toEqual({
        data: { updateOrderStatus: { id: accountOrderId, status } },
      });
    }
    const updateInvoiceSourceContact = (contactName: string) =>
      commerceDb.client.query(
        `UPDATE "order" SET "contactName" = $4
       WHERE "tenantId" = $1 AND "branchId" = $2 AND "id" = $3`,
        [shopScope.tenantId, shopId, accountOrderId, contactName],
      );
    await updateInvoiceSourceContact('Changed shopper after invoicing');
    await downloadInvoicePdf('invoice-after-order-change.pdf');
    await updateInvoiceSourceContact('Shopper');

    const configuredProductId = new URL(configuredProductUrl).pathname.split('/').at(-1);
    if (!configuredProductId) {
      throw new Error('Missing configured product ID');
    }
    const readConfiguredProduct = () =>
      operatorRouter(
        `query($id:ID!){product(id:$id){name status brandId categoryId
          variants{id sku price inventoryTracked active optionValueIds}}}`,
        { id: configuredProductId },
      );
    const configuredRead = await readConfiguredProduct();
    if (
      typeof configuredRead !== 'object' ||
      configuredRead === null ||
      !('data' in configuredRead) ||
      typeof configuredRead.data !== 'object' ||
      configuredRead.data === null ||
      !('product' in configuredRead.data) ||
      typeof configuredRead.data.product !== 'object' ||
      configuredRead.data.product === null ||
      !('variants' in configuredRead.data.product) ||
      !Array.isArray(configuredRead.data.product.variants)
    ) {
      throw new Error('The operator product read did not return variants');
    }
    const { variants, ...productFields } = configuredRead.data.product;
    const savedVariants: readonly unknown[] = variants;
    const [glossVariant, satinVariant] = savedVariants;
    if (
      typeof glossVariant !== 'object' ||
      glossVariant === null ||
      typeof satinVariant !== 'object' ||
      satinVariant === null
    ) {
      throw new Error('The configured product requires both saved variants');
    }
    expect(savedVariants).toMatchObject([
      { sku: 'CONFIG-Gloss', optionValueIds: [gloss.id] },
      { id: trackedVariant.id, sku: 'CONFIG-Satin', optionValueIds: [satin.id] },
    ]);

    const saveConfiguredVariants = (variants: readonly object[]) =>
      operatorRouter(
        'mutation($id:ID!,$input:ProductInput!){updateProduct(id:$id,input:$input){id}}',
        {
          id: configuredProductId,
          input: { ...productFields, variants },
        },
      );
    for (const [draft, path, code] of [
      [[glossVariant], 'variants', 'VARIANT_HAS_OUTSTANDING_DEDUCTIONS'],
      [
        [
          { ...glossVariant, optionValueIds: [satin.id] },
          { ...satinVariant, optionValueIds: [gloss.id] },
        ],
        'variants0OptionValueIds',
        'VARIANT_COMBINATION_IMMUTABLE',
      ],
    ] as const) {
      expect(await saveConfiguredVariants(draft)).toMatchObject({
        errors: [
          {
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldErrors: [{ path, code }],
            },
          },
        ],
      });
    }
    expect(await readConfiguredProduct()).toEqual(configuredRead);
    expect(
      await operatorRouter('query($id:ID!){order(id:$id){lines{variantId sku}}}', {
        id: accountOrderId,
      }),
    ).toEqual({
      data: { order: { lines: [{ variantId: trackedVariant.id, sku: 'CONFIG-Satin' }] } },
    });

    expect(
      await saveConfiguredVariants([glossVariant, { ...satinVariant, active: false }]),
    ).toEqual({
      data: { updateProduct: { id: configuredProductId } },
    });
    expect(await publicProductsQuery(shopId, configuredProductId)).toMatchObject({
      data: {
        catalogueProduct: {
          variantSelection: {
            options: [{ name: 'Surface finish', values: [gloss] }],
            variants: [{ sku: 'CONFIG-Gloss', optionValueIds: [gloss.id] }],
          },
        },
      },
    });
    const inactiveVariantReceipt = waitForCart(shopper, 'ShopperOrder');
    await shopper.reload();
    expect(await (await inactiveVariantReceipt).json()).toMatchObject({
      data: { shopperOrder: { ...accountOrderSnapshot, status: 'SHIPPED' } },
    });

    await merchant.goto(orderInvoiceUrl);
    await merchant.getByRole('link', { name: 'Back to order', exact: true }).click();
    const openRefund = async () => {
      await merchant.getByRole('button', { name: 'Page actions', exact: true }).click();
      await merchant.getByRole('menuitem', { name: 'Record refund', exact: true }).click();
    };
    const submitRefund = async (): Promise<unknown> => {
      const response = waitForCart(merchant, 'OperatorRecordOrderRefund');
      await merchant
        .getByRole('dialog')
        .getByRole('button', { name: 'Record refund', exact: true })
        .click();
      return (await response).json();
    };
    await openRefund();
    await merchant.locator('#refund-amount').fill('12.00');
    await merchant.locator('#refund-reason').fill('Partial refund recorded externally');
    const partial = waitForCart(merchant, 'OperatorOrder').then((response) => response.json());
    expect(await submitRefund()).toMatchObject({
      data: { recordOrderRefund: { amount: '12.00', currency: 'EUR', restock: false } },
    });
    await merchant.waitForURL((url) => url.pathname.endsWith(accountOrderId));
    expect(await partial).toMatchObject({
      data: {
        orderRefundSummary: {
          status: 'PARTIAL',
          refundedAmount: '12.00',
          refundableAmount: '21.50',
        },
      },
    });
    const recordRefund = (input: { amount: string; restock?: boolean }) =>
      operatorRouter(
        'mutation($orderId:ID!,$input:RecordOrderRefundInput!){recordOrderRefund(orderId:$orderId,input:$input){id}}',
        { orderId: accountOrderId, input },
      );
    const refundExceedsBalance = {
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'amount', code: 'REFUND_EXCEEDS_BALANCE' }],
          },
        },
      ],
    };
    expect(await recordRefund({ amount: '21.51' })).toMatchObject(refundExceedsBalance);
    await openRefund();
    await merchant.locator('#refund-amount').fill('21.50');
    await merchant.locator('#refund-restock').check();
    const full = waitForCart(merchant, 'OperatorOrder').then((response) => response.json());
    expect(await submitRefund()).toMatchObject({
      data: { recordOrderRefund: { amount: '21.50', currency: 'EUR', restock: true } },
    });
    await merchant.waitForURL((url) => url.pathname.endsWith(accountOrderId));
    expect(await full).toMatchObject({
      data: {
        order: {
          id: accountOrderId,
          status: 'SHIPPED',
          paymentStatus: 'PAID',
          lines: [{ variantId: trackedVariant.id, sku: 'CONFIG-Satin' }],
        },
        orderRefundSummary: {
          status: 'FULL',
          refundedAmount: chargedTotal,
          refundableAmount: '0.00',
        },
      },
    });
    expect(await operatorRouter(inventoryRead, trackedVariant)).toEqual({
      data: { inventoryVariant: { ...trackedVariant, quantity: 5 } },
    });
    expect(await recordRefund({ amount: '21.50', restock: true })).toMatchObject(
      refundExceedsBalance,
    );
    expect(await operatorRouter(inventoryRead, trackedVariant)).toEqual({
      data: { inventoryVariant: { ...trackedVariant, quantity: 5 } },
    });
    expect(await saveConfiguredVariants([glossVariant, satinVariant])).toEqual({
      data: { updateProduct: { id: configuredProductId } },
    });

    for (let index = 1; index <= 20; index++) {
      const suffix = String(index);
      await commerceDb.client.query(
        `INSERT INTO "customer" ("id", "tenantId", "branchId", "name", "email", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          randomUUID(),
          shopScope.tenantId,
          shopId,
          `A Customer ${suffix}`,
          `page-${suffix}@example.test`,
        ],
      );
    }
    const customerListQuery =
      'query($search:String!){customers(offset:0,limit:10,search:$search){items{id} total}}';
    expect(await operatorRouter(customerListQuery, { search: otherEmail }, secondShopId)).toEqual({
      data: { customers: { items: [], total: 0 } },
    });

    const initialCustomers = waitForCart(merchant, 'OperatorCustomers');
    await merchant.getByRole('link', { name: 'Customers', exact: true }).click();
    expect((await initialCustomers).request().postDataJSON()).toMatchObject({
      variables: { offset: 0, limit: 20 },
    });
    await expect(merchant.locator('p-table tbody tr')).toHaveCount(20);
    await expect(merchant.getByRole('link', { name: 'Other Customer', exact: true })).toHaveCount(
      0,
    );
    const nextCustomers = waitForCart(merchant, 'OperatorCustomers');
    await merchant.getByRole('button', { name: /^next page$/iu }).click();
    expect((await nextCustomers).request().postDataJSON()).toMatchObject({
      variables: { offset: 20, limit: 20 },
    });
    await expect(merchant.getByRole('link', { name: 'Other Customer', exact: true })).toBeVisible();

    const customerSearch = merchant.getByRole('searchbox', { name: 'Search by name or email' });
    const matchedCustomers = waitForCart(merchant, 'OperatorCustomers');
    await customerSearch.fill('Other Customer');
    expect((await matchedCustomers).request().postDataJSON()).toMatchObject({
      variables: { offset: 0, limit: 20, search: 'Other Customer' },
    });
    expect(await (await matchedCustomers).json()).toMatchObject({
      data: { customers: { items: [{ name: 'Other Customer', email: otherEmail }], total: 1 } },
    });
    await customerSearch.fill(shopperEmail);
    await merchant
      .getByRole('row')
      .filter({ hasText: shopperEmail })
      .getByRole('link', { name: 'Shopper', exact: true })
      .click();
    await merchant.waitForURL((url) => /\/customers\/[0-9a-f-]+$/u.test(url.pathname));
    const customerUrl = merchant.url();
    const customerDialog = merchant.getByRole('dialog');
    const saveCustomer = async () => {
      await customerDialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(merchant).toHaveURL(customerUrl);
    };

    const customerName = 'Updated Shopper';
    const customerPhone = '+359 2 555 0199';
    await merchant.getByRole('button', { name: 'Edit contact', exact: true }).click();
    await customerDialog.getByRole('textbox', { name: /^Name\b/u }).fill(customerName);
    await customerDialog.getByRole('textbox', { name: 'Phone', exact: true }).fill(customerPhone);
    await saveCustomer();

    await merchant.getByRole('link', { name: 'Orders', exact: true }).click();
    await merchant.getByRole('button', { name: 'Create manual order', exact: true }).click();
    const selectCustomer = async (search: string, label: string) => {
      const picker = merchant.locator('#manual-customerId');
      await picker.fill('');
      const found = waitForCart(merchant, 'OperatorManualOrderCustomers');
      await picker.fill(search);
      const result = await found;
      expect(result.request().postDataJSON()).toMatchObject({
        variables: { search },
      });
      const [name, email] = label.split(' · ');
      expect(await result.json()).toMatchObject({
        data: {
          customers: { items: expect.arrayContaining([expect.objectContaining({ name, email })]) },
        },
      });
      const option = merchant.getByRole('option', {
        name: label,
        exact: true,
        includeHidden: true,
      });
      await option.click();
      await expect(option).toHaveCount(0);
    };
    const updatedCustomer = `${customerName} · ${shopperEmail}`;
    const otherCustomer = `Other Customer · ${otherEmail}`;
    const contactName = merchant.locator('[id="manual-contact.name"]');
    const contactPhone = merchant.locator('[id="manual-contact.phone"]');
    await selectCustomer(customerName, updatedCustomer);
    await expect(contactPhone).toHaveValue(customerPhone);
    await contactName.fill('Phone Shopper');
    await selectCustomer(otherEmail, otherCustomer);
    await expect(contactName).toHaveValue('Phone Shopper');
    await expect(merchant.locator('[id="manual-contact.email"]')).toHaveValue(otherEmail);
    await expect(contactPhone).toHaveValue(otherPhone);
    await selectCustomer(shopperEmail, updatedCustomer);
    await merchant.locator('[id="manual-shippingAddress.city"]').fill('Sofia');
    await merchant.locator('[id="manual-shippingAddress.postalCode"]').fill('1000');
    await merchant.locator('[id="manual-shippingAddress.line1"]').fill('12 Demo Street');
    await merchant.locator('#manual-lines').fill('CONFIG-Satin');
    await merchant.getByRole('option', { name: /CONFIG-Satin/ }).click();
    await merchant.locator('#manual-differentBillingAddress').check();
    for (const [key, value] of Object.entries(billingRecipient)) {
      await merchant.locator(`[id="manual-billingAddress.${key}"]`).fill(value);
    }
    await merchant.locator('#manual-shippingMethodId').click();
    await merchant.getByRole('option', { name: shippingLabel, exact: true }).click();
    await merchant.locator('#manual-paymentMethodId').click();
    await merchant.getByRole('option', { name: paymentLabel, exact: true }).click();
    await merchant.locator('#manual-merchantNote').fill('Phone order');
    const manualCreate = waitForCart(merchant, 'OperatorCreateManualOrder');
    await merchant
      .getByRole('dialog')
      .getByRole('button', { name: 'Create manual order', exact: true })
      .click();
    expect(await (await manualCreate).json()).toMatchObject({
      data: { createManualOrder: { id: expect.any(String) } },
    });
    const manualOrderDetail = waitForCart(merchant, 'OperatorOrder');
    await merchant.getByRole('link', { name: /Open order · .* · Phone Shopper/ }).click();
    await merchant.waitForURL(/\/orders\/[0-9a-f-]+$/u);
    const manualId = new URL(merchant.url()).pathname.split('/').at(-1);
    if (!manualId) {
      throw new Error('Missing manual order ID');
    }
    expect(await (await manualOrderDetail).json()).toMatchObject({
      data: { order: { id: manualId, billingAddress: billingRecipient } },
    });
    await merchant.getByRole('button', { name: 'Edit manual order', exact: true }).click();
    await merchant.locator('#manual-differentBillingAddress').uncheck();
    await merchant.locator('[id="manual-lines.0.quantity"]').fill('2');
    const manualUpdate = waitForCart(merchant, 'OperatorUpdateManualOrder');
    const manualUpdatedDetail = waitForCart(merchant, 'OperatorOrder');
    await merchant.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    expect(await (await manualUpdate).json()).toMatchObject({
      data: { updateManualOrder: { id: manualId } },
    });
    expect(await (await manualUpdatedDetail).json()).toMatchObject({
      data: { order: { id: manualId, billingAddress: null } },
    });

    await shopper.getByRole('link', { name: 'Back to orders', exact: true }).click();
    const phoneOrder = waitForCart(shopper, 'ShopperOrder');
    await shopper.getByRole('link', { name: `H-${manualId}`, exact: true }).click();
    expect(await (await phoneOrder).json()).toMatchObject({
      data: { shopperOrder: { id: manualId, shippingFee: '6.50', total: '66.50' } },
    });
    const persistedManual = waitForCart(shopper, 'ShopperOrder');
    await shopper.reload();
    expect(await (await persistedManual).json()).toMatchObject({
      data: {
        shopperOrder: {
          contact: { name: 'Phone Shopper', email: shopperEmail, phone: customerPhone },
          total: '66.50',
          lines: [{ sku: 'CONFIG-Satin', quantity: 2, unitPrice: '30.00' }],
        },
      },
    });
    expect(await operatorRouter(inventoryRead, trackedVariant)).toEqual({
      data: { inventoryVariant: { ...trackedVariant, quantity: 3 } },
    });

    const originalReceipt = waitForCart(shopper, 'ShopperOrder');
    await shopper.goto(accountReceiptUrl);
    await originalReceipt;

    await merchant.goto(customerUrl);
    const addressRecipient = 'Parcel Recipient';
    const newStreet = '28 Customer Street';
    const addressCity = 'Sofia';
    const addressPostalCode = '0123';
    await merchant.getByRole('link', { name: 'Add address', exact: true }).click();
    await customerDialog.getByRole('textbox', { name: /^Recipient\b/u }).fill(addressRecipient);
    await customerDialog.getByRole('textbox', { name: /^Street\b/u }).fill(newStreet);
    await customerDialog.getByRole('textbox', { name: /^City\b/u }).fill(addressCity);
    await customerDialog.getByRole('textbox', { name: /^Postal code\b/u }).fill(addressPostalCode);
    await customerDialog.getByRole('textbox', { name: /^Country code\b/u }).fill('bg');
    await saveCustomer();

    const editedStreet = '30 Customer Street';
    await merchant
      .getByRole('link', { name: `Edit address · ${addressRecipient}`, exact: true })
      .click();
    await customerDialog.getByRole('textbox', { name: /^Street\b/u }).fill(editedStreet);
    await saveCustomer();
    await expect(merchant.getByRole('cell', { name: editedStreet, exact: true })).toBeVisible();

    const [persistedCustomer, linkedOrders] = await Promise.all([
      waitForCart(merchant, 'OperatorCustomer').then<unknown>((response) => response.json()),
      waitForCart(merchant, 'OperatorCustomerOrders').then<unknown>((response) => response.json()),
      merchant.reload(),
    ]);
    expect(persistedCustomer).toMatchObject({
      data: {
        customer: {
          customer: { name: customerName, email: shopperEmail, phone: customerPhone },
          addresses: [
            {
              recipient: addressRecipient,
              line1: editedStreet,
              city: addressCity,
              postalCode: addressPostalCode,
              countryCode: 'BG',
            },
          ],
        },
      },
    });
    expect(linkedOrders).toMatchObject({
      data: { orders: { items: [{ id: manualId }, { id: accountOrderId }], total: 2 } },
    });
    await merchant.getByRole('link', { name: orderNumber, exact: true }).click();
    await merchant.waitForURL((url) => url.pathname.endsWith(`/orders/${accountOrderId}`));

    const persistedReceipt = waitForCart(shopper, 'ShopperOrder');
    await shopper.reload();
    expect(await (await persistedReceipt).json()).toMatchObject({
      data: { shopperOrder: accountOrderSnapshot },
    });

    await guestOrder.goto(cartUrl);
    await reviewCheckout(guestOrder, '30.00', '36.50');
    const updatedInstructions = 'Pay when the parcel arrives.\nHave the exact amount ready.';
    await merchant.getByRole('link', { name: 'Payment methods', exact: true }).click();
    await merchant.getByRole('button', { name: paymentLabel, exact: true }).click();
    await merchant.locator('#payment-method-instructions').fill(updatedInstructions);
    await saveMethod('OperatorUpdatePaymentMethod', 'updatePaymentMethod');
    await merchant.getByRole('link', { name: 'Shipping methods', exact: true }).click();
    await merchant.getByRole('button', { name: shippingLabel, exact: true }).click();
    await merchant.locator('#shipping-method-fixed-fee').fill('0');
    await saveMethod('OperatorUpdateShippingMethod', 'updateShippingMethod');

    const placeReviewedOrder = async (): Promise<unknown> => {
      const response = waitForCart(guestOrder, 'PlaceOrder');
      await guestOrder.getByRole('button', { name: 'Place order', exact: true }).click();
      return (await response).json();
    };
    expect(await placeReviewedOrder()).toMatchObject({
      errors: [{ extensions: { fieldErrors: [{ code: 'CHECKOUT_QUOTE_CHANGED' }] } }],
    });
    const paymentChoice = guestOrder.locator('#paymentMethodId');
    await paymentChoice.selectOption({ label: alternativePaymentLabel });
    const requoted = waitForCart(guestOrder, 'QuoteCheckout');
    await guestOrder.getByRole('button', { name: 'Review total', exact: true }).click();
    expect(await (await requoted).json()).toMatchObject({
      data: { quoteCheckout: { shippingFee: '0.00', total: '30.00' } },
    });

    await merchant.getByRole('link', { name: 'Payment methods', exact: true }).click();
    await merchant.getByRole('button', { name: alternativePaymentLabel, exact: true }).click();
    await merchant.locator('#payment-method-enabled').click();
    await merchant.getByRole('option', { name: 'Disabled', exact: true }).click();
    await saveMethod('OperatorUpdatePaymentMethod', 'updatePaymentMethod');
    expect(await placeReviewedOrder()).toMatchObject({
      errors: [
        { extensions: { fieldErrors: [{ path: 'paymentMethodId', code: 'INVALID_METHOD' }] } },
      ],
    });
    await guestOrder.getByRole('link', { name: 'Back to cart', exact: true }).click();
    expect(await reviewCheckout(guestOrder, '30.00', '30.00', undefined, '0.00')).toMatchObject({
      data: {
        checkout: {
          paymentMethods: [{ label: paymentLabel, instructions: updatedInstructions }],
          shippingMethods: [{ label: shippingLabel, fixedFee: '0.00' }],
        },
      },
    });
    const reloadedReceipt = waitForCart(guestOrder, 'OrderConfirmation');
    await guestOrder.goto(confirmationUrl);
    expect(await (await reloadedReceipt).json()).toMatchObject({
      data: { orderConfirmation: expectedOrder },
    });

    await merchant.getByRole('link', { name: 'Products', exact: true }).click();
    await merchant.getByRole('button', { name: productName, exact: true }).click();
    await merchant.locator('#product-variant-active-0').click();
    await merchant.getByRole('option', { name: 'Inactive', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    await shopper.goto(productUrl);
    await expect(shopper.getByRole('heading', { name: 'Product not found.' })).toBeVisible();
    expect((await shopper.request.get(new URL(angled, shopApp.origin).href)).status()).toBe(404);
    const simpleVariantId = { id: simpleVariant.id };
    expect(await operatorRouter(inventoryRead, simpleVariantId)).toEqual({
      data: { inventoryVariant: { ...simpleVariantId, quantity: 0 } },
    });
    expect(await setOrderStatus(accountOrderId, 'COMPLETED')).toEqual({
      data: { updateOrderStatus: { id: accountOrderId, status: 'COMPLETED' } },
    });
    const dateDashboardOrder = (daysFromNow: number) =>
      commerceDb.client.query(
        `UPDATE "order" SET "placedAt" = CURRENT_TIMESTAMP + $4::integer * INTERVAL '1 day'
         WHERE "tenantId" = $1 AND "branchId" = $2 AND "id" = $3`,
        [shopScope.tenantId, shopId, accountOrderId, daysFromNow],
      );
    await dateDashboardOrder(10);
    const defaultDashboard = waitForCart(merchant, 'OperatorShopDashboard');
    await merchant.getByRole('link', { name: 'Dashboard', exact: true }).click();
    expect(await (await defaultDashboard).json()).toMatchObject({
      data: { shopDashboard: { recentOrders: [{ id: manualId }, { id: orderId }] } },
    });
    await dateDashboardOrder(-10);
    for (const [days, period, orderCount, completedRevenue] of [
      ['7', 'DAYS_7', 2, '0.00'],
      ['14', 'DAYS_14', 3, chargedTotal],
    ] as const) {
      const dashboardRead = waitForCart(merchant, 'OperatorShopDashboard');
      await merchant.getByRole('button', { name: `${days} days`, exact: true }).click();
      expect(await (await dashboardRead).json()).toMatchObject({
        data: {
          shopDashboard: {
            period,
            orderCount,
            completedRevenue,
            outOfStockVariantCount: 2,
            recentOrders: expect.arrayContaining([
              expect.objectContaining({
                id: manualId,
                status: 'PLACED',
                number: `H-${manualId}`,
                currency: 'EUR',
                placedAt: expect.any(String),
                total: '66.50',
              }),
              expect.objectContaining({ id: accountOrderId }),
            ]),
          },
        },
      });
    }
    const linkedOrder = waitForCart(merchant, 'OperatorOrder');
    await merchant.getByRole('link', { name: `H-${manualId}`, exact: true }).click();
    expect(await (await linkedOrder).json()).toMatchObject({ data: { order: { id: manualId } } });

    const {
      rows: [orderMethods],
    } = await commerceDb.client.query<{ paymentMethodId: string; shippingMethodId: string }>(
      'SELECT "paymentMethodId", "shippingMethodId" FROM "order" WHERE "tenantId" = $1 AND "branchId" = $2 AND "id" = $3',
      [shopScope.tenantId, shopId, manualId],
    );
    if (!orderMethods?.paymentMethodId || !orderMethods.shippingMethodId) {
      throw new Error('Missing linked methods for the order filter fixture');
    }
    const filteredOrdersUrl = new URL('/en/orders', merchant.url());
    for (const [key, value] of Object.entries({
      status: 'PLACED,CONFIRMED',
      customerType: 'PROFILE',
      ...orderMethods,
    })) {
      filteredOrdersUrl.searchParams.set(key, value);
    }
    await merchant.goto(filteredOrdersUrl.href);
    await expect(
      merchant.getByRole('link', { name: /Open order · .* · Phone Shopper/ }),
    ).toBeVisible();
    const addDateFilter = async (operator: 'after' | 'before', date: string) => {
      await merchant.getByRole('button', { name: 'Add filter', exact: true }).click();
      const editor = merchant.getByRole('dialog', { name: 'Filter condition' });
      await editor.getByRole('combobox', { name: 'Column' }).click();
      await merchant.getByRole('option', { name: 'Order date', exact: true }).click();
      await editor.getByRole('combobox', { name: 'Condition' }).click();
      await merchant.getByRole('option', { name: operator, exact: true }).click();
      const dateInput = editor.locator('input[id$="-value"]');
      await dateInput.pressSequentially(date);
      await dateInput.press('Tab');
      const requested = waitForCart(merchant, 'OperatorOrders');
      await editor.getByRole('button', { name: 'Apply', exact: true }).click();
      await requested;
      await expect(editor).toBeHidden();
    };
    await addDateFilter('after', '2000-01-01');
    await addDateFilter('before', '2099-01-01');
    const remainingFilter = {
      statuses: ['PLACED', 'CONFIRMED'],
      customerTypes: ['PROFILE'],
      shippingMethodIds: [orderMethods.shippingMethodId],
      placedAtFrom: '2000-01-01T22:00:00.000Z',
      placedAtBefore: '2098-12-31T22:00:00.000Z',
    };
    const filteredOrders = waitForCart(merchant, 'OperatorOrders');
    await merchant.reload();
    const filteredResponse = await filteredOrders;
    expect(filteredResponse.request().postDataJSON()).toMatchObject({
      variables: {
        filter: { ...remainingFilter, paymentMethodIds: [orderMethods.paymentMethodId] },
      },
    });
    expect(await filteredResponse.json()).toMatchObject({
      data: { orders: { items: [{ id: manualId }], total: 1 } },
    });
    const removePayment = merchant.getByRole('button', { name: /Remove.*Payment method/ });
    if (!(await removePayment.isVisible())) {
      await merchant.getByRole('button', { name: /Filters/ }).click();
    }
    const removedPayment = waitForCart(merchant, 'OperatorOrders');
    await removePayment.click();
    const withoutPayment = await removedPayment;
    expect(withoutPayment.request().postDataJSON()).toMatchObject({
      variables: { filter: remainingFilter },
    });
    expect(withoutPayment.request().postDataJSON()).not.toHaveProperty(
      'variables.filter.paymentMethodIds',
    );
    expect(await withoutPayment.json()).toMatchObject({
      data: { orders: { items: [{ id: manualId }], total: 1 } },
    });
    const orderCustomerFilter = merchant.getByRole('combobox', { name: 'Customer account' });
    await orderCustomerFilter.fill(otherEmail);
    const selectedCustomerOrders = waitForCart(merchant, 'OperatorOrders');
    await merchant.getByRole('option', { name: otherCustomer, exact: true }).click();
    const forCustomer = await selectedCustomerOrders;
    expect(forCustomer.request().postDataJSON()).toMatchObject({
      variables: { customerId: otherCustomerId, filter: remainingFilter },
    });
    expect(await forCustomer.json()).toMatchObject({ data: { orders: { items: [], total: 0 } } });
    const afterCustomerClear = waitForCart(merchant, 'OperatorOrders');
    await merchant.getByRole('button', { name: 'Clear customer filter' }).click();
    const withoutCustomer = await afterCustomerClear;
    expect(withoutCustomer.request().postDataJSON()).toMatchObject({
      variables: { filter: remainingFilter },
    });
    expect(withoutCustomer.request().postDataJSON()).not.toHaveProperty('variables.customerId');
    expect(await withoutCustomer.json()).toMatchObject({
      data: { orders: { items: [{ id: manualId }], total: 1 } },
    });

    const shopPicker = merchant.locator('.app-topbar__branch').getByRole('button');
    const selectShop = async (name: string) => {
      await shopPicker.click();
      await merchant.getByRole('menuitem', { name, exact: true }).click();
    };
    await merchant.getByRole('link', { name: 'General Settings', exact: true }).click();
    const shopName = merchant.locator('#shop-settings-displayName');
    const secondShopDisplayName = 'Second shop saved public name';
    await selectShop('Second shop');
    await expect(shopPicker).toContainText('Second shop');
    await expect(shopName).toHaveValue('');
    await shopName.fill(secondShopDisplayName);
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Settings saved.');
    await selectShop('First shop');
    await expect(shopName).toHaveValue(contactSettings.displayName);

    const draftName = 'Unsaved synthetic shop name';
    await shopName.fill(draftName);
    await selectShop('Second shop');
    const discardChanges = merchant.getByRole('alertdialog');
    await discardChanges.getByRole('button', { name: 'Keep editing' }).click();
    await expect(shopPicker).toContainText('First shop');
    await expect(shopName).toHaveValue(draftName);
    await selectShop('Second shop');
    await discardChanges.getByRole('button', { name: 'Discard changes' }).click();
    await expect(shopPicker).toContainText('Second shop');
    await expect(shopName).toHaveValue(secondShopDisplayName);
    await selectShop('First shop');
    await expect(shopName).toHaveValue(contactSettings.displayName);
    await expect(discardChanges).toHaveCount(0);

    await merchant.getByRole('link', { name: 'Dashboard', exact: true }).click();
    const switchDashboardShop = async (name: string, id: string): Promise<unknown> => {
      await shopPicker.click();
      const read = merchant.waitForResponse((response) => {
        const request = response.request();
        return (
          request.headers()['x-branch-id'] === id &&
          request.postData()?.includes('"operationName":"OperatorShopDashboard"') === true
        );
      });
      await merchant.getByRole('menuitem', { name, exact: true }).click();
      return (await read).json();
    };
    expect(await switchDashboardShop('Second shop', secondShopId)).toMatchObject({
      data: {
        shopDashboard: {
          orderCount: 0,
          completedRevenue: '0.00',
          newCustomerCount: 0,
          outOfStockVariantCount: 0,
          recentOrders: [],
        },
      },
    });
    await switchDashboardShop('First shop', shopId);
    await merchant.getByRole('link', { name: 'Products', exact: true }).click();

    for (const status of ['CANCELLED', 'CANCELLED'] as const) {
      expect(await setOrderStatus(orderId, status)).toEqual({
        data: { updateOrderStatus: { id: orderId, status } },
      });
      expect(await operatorRouter(inventoryRead, simpleVariantId)).toEqual({
        data: { inventoryVariant: { ...simpleVariantId, quantity: 1 } },
      });
    }
    await merchant.getByRole('button', { name: productName, exact: true }).click();
    await merchant.locator('#product-variant-active-0').click();
    await merchant.getByRole('option', { name: 'Active', exact: true }).click();
    await merchant.locator('#product-status').click();
    await merchant.getByRole('option', { name: 'Archived', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    await shopper.goto(productUrl);
    await expect(shopper.getByRole('heading', { name: 'Product not found.' })).toBeVisible();
    expect((await shopper.request.get(new URL(angled, shopApp.origin).href)).status()).toBe(404);
    const archivedPreview = merchant.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === angled && response.request().method() === 'GET',
    );
    await merchant.getByRole('button', { name: productName, exact: true }).click();
    const archivedImage = await archivedPreview;
    expect(archivedImage.status()).toBe(200);
    expect(archivedImage.headers()['content-type']).toBe('image/png');

    await merchant.goto(customerUrl);
    await merchant.getByRole('button', { name: 'Edit contact', exact: true }).click();
    await customerDialog.getByRole('textbox', { name: 'Phone', exact: true }).fill('');
    await saveCustomer();
    await merchant.getByRole('link', { name: 'Orders', exact: true }).click();
    await merchant.getByRole('button', { name: 'Create manual order', exact: true }).click();
    await selectCustomer(otherEmail, otherCustomer);
    await selectCustomer(shopperEmail, updatedCustomer);
    await expect(contactPhone).toHaveValue('');
    const typedPhone = '+359 2 555 0150';
    await contactPhone.fill(typedPhone);
    await selectCustomer(otherEmail, otherCustomer);
    await expect(contactPhone).toHaveValue(typedPhone);

    const savedBranch = (page: Page) =>
      page.evaluate(() => {
        const saved: unknown = JSON.parse(localStorage.getItem('holita.admin.session') ?? 'null');
        return saved && typeof saved === 'object' && 'branchId' in saved
          ? saved.branchId
          : undefined;
      });
    expect(await savedBranch(merchant)).toBe(shopId);
    for (const [name, id] of [
      ['Second shop', secondShopId],
      ['First shop', shopId],
    ] as const) {
      const row = staff.getByRole('row').filter({ hasText: name });
      const suspended = waitForOperation(
        staff,
        `${backoffice.origin}/graphql`,
        'OperatorSetBranchStatus',
      );
      await row.getByRole('button', { name: 'Suspend', exact: true }).click();
      expect(await (await suspended).json()).toMatchObject({
        data: { setMerchantBranchStatus: { id, status: 'SUSPENDED' } },
      });
      await expect(row.getByRole('button', { name: 'Reactivate', exact: true })).toBeVisible();
    }

    const suspendedShopPage = await merchantContext.newPage();
    const adminEndpoint = `${admin.origin}/graphql`;
    const scopedRequests: string[] = [];
    suspendedShopPage.on('request', (request) => {
      const branch = request.headers()['x-branch-id'];
      if (request.url() === adminEndpoint && branch) {
        scopedRequests.push(branch);
      }
    });
    const discovery = suspendedShopPage.waitForResponse((response) => {
      const request = response.request();
      return (
        response.url() === adminEndpoint &&
        request.headers()['accept-language'] === 'en' &&
        request.postData()?.includes('"operationName":"AdminBranches"') === true
      );
    });
    await suspendedShopPage.goto(`${admin.origin}/en/dashboard`);
    expect(await (await discovery).json()).toEqual({ data: { branches: [] } });
    await expect.poll(() => savedBranch(suspendedShopPage)).toBeNull();
    expect(scopedRequests).toEqual([]);
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
