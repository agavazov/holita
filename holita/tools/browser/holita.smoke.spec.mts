import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
      if (commerceOrigin && request.url && /^\/media\/(brands|products)\//.test(request.url)) {
        const authorization = request.headers.authorization;
        const upstream = await fetch(new URL(request.url, commerceOrigin), {
          headers: authorization ? { authorization } : {},
        });
        response.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
          'cache-control': upstream.headers.get('cache-control') ?? 'no-store',
          'x-content-type-options': upstream.headers.get('x-content-type-options') ?? 'nosniff',
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
  await page.locator('#option-show-in-filters').click();
  await page.getByRole('option', { name: 'Shown', exact: true }).click();
  const addValue = page.getByRole('button', { name: 'Add value', exact: true });
  await addValue.click();
  await page.locator('#option-value-0').fill('Matt');
  await addValue.click();
  await page.locator('#option-value-1').fill('Gloss');
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
}) => {
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
    await expect(staff.getByRole('heading', { name: merchantName, exact: true })).toBeVisible();
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
    await dismissSuccess(merchant, 'Brand saved.');
    await expect(merchant.getByRole('button', { name: 'Smoke Brand', exact: true })).toBeVisible();
    await merchant.getByRole('link', { name: 'Categories', exact: true }).click();
    await addCategory(merchant, 'Kitchen');
    await addCategory(merchant, 'Home');
    await addCategory(merchant, 'Cookware', 'Kitchen');
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
    const badges = merchant.locator('#product-badges');
    await badges.press('Space');
    await expect(merchant.getByRole('option', { name: badgeName, exact: true })).toBeVisible();
    await badges.press('ArrowDown');
    await badges.press('Enter');
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
    for (const [index, label, price] of [
      [0, 'Gloss', '24.00'],
      [1, 'Satin', '30.00'],
    ] as const) {
      if (index) {
        await merchant.getByRole('button', { name: 'Add variant', exact: true }).click();
      }
      await merchant.locator(`#product-variant-values-${String(index)}`).click();
      await merchant.getByRole('option', { name: `Surface finish: ${label}`, exact: true }).click();
      await merchant.getByRole('heading', { name: 'Create product', exact: true }).click();
      await merchant.locator(`#product-variant-sku-${String(index)}`).fill(`CONFIG-${label}`);
      await merchant.locator(`#product-variant-price-${String(index)}`).fill(price);
    }
    await merchant.locator('#product-variant-tracking-0').click();
    await merchant.getByRole('option', { name: 'Tracked', exact: true }).click();
    await merchant.locator('#product-status').click();
    await merchant.getByRole('option', { name: 'Active', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    const shopperContext = await browser.newContext();
    cleanup.push(() => shopperContext.close());
    const shopper = await shopperContext.newPage();
    await shopper.goto(`${shopApp.origin}/s/${shopId}`);
    await shopper.getByRole('button', { name: 'EN', exact: true }).click();
    const productLink = shopper.getByRole('link', { name: productName, exact: true });
    const productCard = shopper.locator('.catalogue-card').filter({ has: productLink });
    await expect(productCard.getByText('Smoke Brand', { exact: true })).toBeVisible();
    await expect(productCard.getByText(badgeName, { exact: true })).toBeVisible();
    await expect(productCard.getByText('In stock', { exact: true })).toBeVisible();
    const untrackedCard = shopper.locator('.catalogue-card').filter({
      has: shopper.getByRole('link', { name: configuredProductName, exact: true }),
    });
    await expect(untrackedCard.getByText('In stock', { exact: true })).toBeVisible();
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
    const publicProductsQuery = async (branchId = shopId): Promise<unknown> => {
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
          variables: { id: productId },
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
    await merchant.getByRole('button', { name: 'Move photo 2 up', exact: true }).press('Enter');
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Product saved.');
    await shopper.reload();
    await expect(description).toHaveText(descriptionBg);
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
    expect((await shopper.request.get(new URL(front, shopApp.origin).href)).status()).toBe(404);

    await merchant.getByRole('link', { name: 'Badges', exact: true }).click();
    await merchant.getByRole('button', { name: badgeName, exact: true }).click();
    await merchant.locator('#badge-active').click();
    await merchant.getByRole('option', { name: 'Inactive', exact: true }).click();
    await merchant.getByRole('button', { name: 'Save', exact: true }).click();
    await dismissSuccess(merchant, 'Badge saved.');
    await shopper.goto(`${shopApp.origin}/s/${shopId}`);
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
    await shopper.goto(`${shopApp.origin}/s/${secondShopId}`);
    await expect(shopper.getByRole('link', { name: 'Second shop', exact: true })).toBeVisible();
    const foreignProductImage = angled.replace(shopId, secondShopId);
    expect(
      (await shopper.request.get(new URL(foreignProductImage, shopApp.origin).href)).status(),
    ).toBe(404);
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
    const addSatin = async (page = shopper) => {
      await page.getByRole('radio', { name: 'Gloss', exact: true }).check();
      await page.getByRole('radio', { name: 'Satin', exact: true }).check();
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Cart, 1 item', exact: true })).toBeVisible();
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
    await shopper.getByRole('link', { name: 'My account' }).click();
    await shopper.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(shopper.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
    await shopper.goto(configuredProductUrl);
    await addSatin();
    await shopper.getByRole('link', { name: 'Cart, 1 item', exact: true }).click();
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
    const reviewCheckout = async (
      page: Page,
      subtotal: string,
      total: string,
      discount: { discountCode: string | null; discountAmount: string } = {
        discountCode: null,
        discountAmount: '0.00',
      },
      shippingFee = '6.50',
    ) => {
      const checkoutRead = waitForCart(page, 'Checkout');
      await page.getByRole('link', { name: 'Checkout', exact: true }).click();
      const checkoutResult: unknown = await (await checkoutRead).json();
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
      const quoted = waitForCart(page, 'QuoteCheckout');
      await page.getByRole('button', { name: 'Review total', exact: true }).click();
      expect(await (await quoted).json()).toMatchObject({
        data: {
          quoteCheckout: { subtotal, shippingFee, total, currency: 'BGN', ...discount },
        },
      });
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
    await shopper.goto(`${shopApp.origin}/s/${shopId}/sign-in`);
    await shopper.locator('#email').fill(shopperEmail);
    await secretFill(shopper.locator('#password'), shopperPassword);
    await shopper.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(shopper).toHaveURL(cartUrl);
    await expect(shopper.getByRole('link', { name: 'Cart, 2 items', exact: true })).toBeVisible();
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
    await guestOrder.getByRole('link', { name: 'Cart, 1 item', exact: true }).click();
    const orderCartToken = await guestOrder.evaluate(
      (id) => localStorage.getItem(`holita.cart.${id}`),
      shopId,
    );
    if (!orderCartToken) {
      throw new Error('Missing guest authorization for checkout');
    }
    await reviewCheckout(guestOrder, '25.50', '32.00');
    const placed = waitForCart(guestOrder, 'PlaceOrder');
    await guestOrder.getByRole('button', { name: 'Place order', exact: true }).click();
    await guestOrder.waitForURL(`${shopApp.origin}/s/${shopId}/checkout/confirmation/*`);
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
    };
    expect(await (await placed).json()).toMatchObject({ data: { placeOrder: expectedOrder } });
    const receipt = waitForCart(guestOrder, 'OrderConfirmation');
    await guestOrder.reload();
    expect(await (await receipt).json()).toMatchObject({
      data: { orderConfirmation: expectedOrder },
    });
    await guestOrder.goto(configuredProductUrl);
    await addSatin(guestOrder);
    const priorReceipt = waitForCart(guestOrder, 'OrderConfirmation');
    await guestOrder.goto(confirmationUrl);
    expect(await (await priorReceipt).json()).toMatchObject({
      data: { orderConfirmation: expectedOrder },
    });
    for (const [branchId, credential] of [
      [shopId, guestToken],
      [secondShopId, orderCartToken],
    ]) {
      const denied = await guestOrder.request.post(`${shopApp.origin}/graphql`, {
        headers: { 'x-branch-id': branchId, 'x-cart-token': credential },
        data: {
          query: 'query($id:ID!){orderConfirmation(orderId:$id){id}}',
          variables: { id: orderId },
        },
      });
      expect(await denied.json()).toEqual({ data: { orderConfirmation: null } });
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
    await shopper.getByRole('link', { name: 'Cart, 1 item', exact: true }).click();
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
    await reviewCheckout(shopper, '30.00', chargedTotal, discountedQuote);
    const placedDiscounted = waitForCart(shopper, 'PlaceOrder');
    await shopper.getByRole('button', { name: 'Place order', exact: true }).click();
    await shopper.waitForURL(`${shopApp.origin}/s/${shopId}/checkout/confirmation/*`);
    const accountOrderId = new URL(shopper.url()).pathname.split('/').at(-1);
    if (!accountOrderId) {
      throw new Error('Missing account order ID in the confirmation route');
    }
    expect(await (await placedDiscounted).json()).toMatchObject({
      data: { placeOrder: { id: accountOrderId, total: chargedTotal, ...discountedQuote } },
    });
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
      contact: { name: 'Shopper', email: shopperEmail, phone: '+359 2 555 0100' },
      shippingAddress: {
        line1: '12 Demo Street',
        city: 'Sofia',
        postalCode: '1000',
        countryCode: 'BG',
      },
      currency: 'BGN',
      subtotal: '30.00',
      shippingFee: '6.50',
      total: chargedTotal,
      ...discountedQuote,
    };
    expect(await (await detail).json()).toMatchObject({
      data: { shopperOrder: accountOrderSnapshot },
    });
    const accountReceiptUrl = shopper.url();

    await merchant.getByRole('link', { name: 'Orders', exact: true }).click();
    const operatorDiscountedOrder = waitForCart(merchant, 'OperatorOrder');
    await merchant.getByRole('link', { name: `Open order · ${orderNumber}` }).click();
    expect(await (await operatorDiscountedOrder).json()).toMatchObject({
      data: { order: { id: accountOrderId, total: chargedTotal, ...discountedQuote } },
    });
    await merchant.getByRole('button', { name: 'Update status', exact: true }).click();
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
    await merchant.locator('#invoice-issuerName').fill('Demo Issuer');
    await merchant.locator('#invoice-issuerCompanyId').fill('000000001');
    await merchant.locator('#invoice-issuerAddress').fill('20 Invoice Street, Sofia');
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
    await merchant.locator('#invoice-summary').waitFor();
    const reopenedInvoice = waitForCart(merchant, 'OperatorOrderInvoice');
    await merchant.reload();
    expect(await (await reopenedInvoice).json()).toMatchObject({
      data: {
        orderInvoice: {
          orderId: accountOrderId,
          number: invoiceNumber,
          subtotal: '30.00',
          discountAmount: discountedQuote.discountAmount,
          shippingFee: '6.50',
          total: chargedTotal,
          lines: [{ sku: 'CONFIG-Satin', quantity: 1, unitPrice: '30.00', lineTotal: '30.00' }],
        },
      },
    });

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
    const refundRouter = async (
      query: string,
      variables: Record<string, unknown>,
    ): Promise<unknown> => {
      const response = await merchant.request.post(paidRequest.url(), {
        headers: { authorization, 'x-branch-id': branchId },
        data: { query, variables },
      });
      return response.json();
    };
    const inventoryRead = 'query($id:ID!){inventoryVariant(id:$id){id quantity}}';
    expect(await refundRouter(inventoryRead, trackedVariant)).toEqual({
      data: { inventoryVariant: { ...trackedVariant, quantity: 4 } },
    });

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
      data: { recordOrderRefund: { amount: '12.00', currency: 'BGN', restock: false } },
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
    expect(
      await refundRouter(
        'mutation($orderId:ID!,$input:RecordOrderRefundInput!){recordOrderRefund(orderId:$orderId,input:$input){id}}',
        { orderId: accountOrderId, input: { amount: '21.51' } },
      ),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'amount', code: 'REFUND_EXCEEDS_BALANCE' }],
          },
        },
      ],
    });
    await openRefund();
    await merchant.locator('#refund-amount').fill('21.50');
    await merchant.locator('#refund-restock').check();
    const full = waitForCart(merchant, 'OperatorOrder').then((response) => response.json());
    expect(await submitRefund()).toMatchObject({
      data: { recordOrderRefund: { amount: '21.50', currency: 'BGN', restock: true } },
    });
    await merchant.waitForURL((url) => url.pathname.endsWith(accountOrderId));
    expect(await full).toMatchObject({
      data: {
        order: { id: accountOrderId, status: 'CANCELLED', paymentStatus: 'PAID' },
        orderRefundSummary: {
          status: 'FULL',
          refundedAmount: chargedTotal,
          refundableAmount: '0.00',
        },
      },
    });
    expect(await refundRouter(inventoryRead, trackedVariant)).toEqual({
      data: { inventoryVariant: { ...trackedVariant, quantity: 5 } },
    });

    await merchant.getByRole('link', { name: 'Back to orders', exact: true }).click();
    const otherEmail = 'other-order-customer@example.test';
    await commerceDb.client.query(
      `INSERT INTO "customer" ("id", "tenantId", "branchId", "name", "email", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [randomUUID(), shopScope.tenantId, shopId, 'Other Customer', otherEmail],
    );
    await merchant.getByRole('button', { name: 'Create manual order', exact: true }).click();
    const selectCustomer = async (label: string) => {
      await merchant.locator('#manual-customerId').click();
      await merchant.getByRole('option', { name: label, exact: true }).click();
    };
    const originalCustomer = `Shopper · ${shopperEmail}`;
    const contactName = merchant.locator('[id="manual-contact.name"]');
    const contactPhone = merchant.locator('[id="manual-contact.phone"]');
    await selectCustomer(originalCustomer);
    await expect(contactPhone).toHaveValue('+359 2 555 0100');
    await contactName.fill('Phone Shopper');
    await selectCustomer(`Other Customer · ${otherEmail}`);
    await expect(contactName).toHaveValue('Phone Shopper');
    await expect(merchant.locator('[id="manual-contact.email"]')).toHaveValue(otherEmail);
    await expect(contactPhone).toHaveValue('');
    await selectCustomer(originalCustomer);
    await merchant.locator('[id="manual-shippingAddress.city"]').fill('Sofia');
    await merchant.locator('[id="manual-shippingAddress.postalCode"]').fill('1000');
    await merchant.locator('[id="manual-shippingAddress.line1"]').fill('12 Demo Street');
    await merchant.locator('#manual-lines').fill(configuredProductName);
    await merchant.getByRole('option', { name: /CONFIG-Satin/ }).click();
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
    await merchant.getByRole('link', { name: /Open order · .* · Phone Shopper/ }).click();
    await merchant.waitForURL(/\/orders\/[0-9a-f-]+$/u);
    const manualId = new URL(merchant.url()).pathname.split('/').at(-1);
    if (!manualId) {
      throw new Error('Missing manual order ID');
    }
    await merchant.getByRole('button', { name: 'Edit manual order', exact: true }).click();
    await merchant.locator('[id="manual-lines.0.quantity"]').fill('2');
    const manualUpdate = waitForCart(merchant, 'OperatorUpdateManualOrder');
    await merchant.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    expect(await (await manualUpdate).json()).toMatchObject({
      data: { updateManualOrder: { id: manualId } },
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
          total: '66.50',
          lines: [{ sku: 'CONFIG-Satin', quantity: 2, unitPrice: '30.00' }],
        },
      },
    });
    expect(await refundRouter(inventoryRead, trackedVariant)).toEqual({
      data: { inventoryVariant: { ...trackedVariant, quantity: 3 } },
    });

    const originalReceipt = waitForCart(shopper, 'ShopperOrder');
    await shopper.goto(accountReceiptUrl);
    await originalReceipt;

    await merchant.getByRole('link', { name: 'Customers', exact: true }).click();
    await merchant
      .getByRole('row')
      .filter({ hasText: shopperEmail })
      .getByRole('link', { name: 'Shopper', exact: true })
      .click();
    await merchant.waitForURL(/\/customers\/[0-9a-f-]+$/u);
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
    await expect(guestOrder.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Shopper',
    );
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
    await expect(paymentChoice).toHaveValue('');
    await expect(
      guestOrder.getByRole('button', { name: 'Review total', exact: true }),
    ).toBeVisible();

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
