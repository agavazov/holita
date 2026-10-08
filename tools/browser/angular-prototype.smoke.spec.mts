import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Kind, parse, print } from 'graphql';
import { expect, type Page } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';
import { workspaceRoot } from '../graphql/contracts.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const storageKey = 'holita.admin.prototype.data';
test.use({ dataSource: 'mock', referenceEnabled: false });

async function operationDocument(name: string, feature: string): Promise<string> {
  const source = parse(
    await readFile(
      join(workspaceRoot, 'apps/admin/src/app/features', feature, 'operations.graphql'),
      'utf8',
    ),
  );
  const operation = source.definitions.find(
    (definition) =>
      definition.kind === Kind.OPERATION_DEFINITION && definition.name?.value === name,
  );
  if (!operation) throw new Error('Missing operation ' + name);
  return print({
    kind: Kind.DOCUMENT,
    definitions: [
      operation,
      ...source.definitions.filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION),
    ],
  });
}
async function submit(page: Page, query: string, variables: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ query, variables, storeA }) => {
      const response = await fetch('/__prototype/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-store-id': storeA },
        body: JSON.stringify({ query, variables }),
      });
      const body: unknown = await response.json();
      return body;
    },
    { query, variables, storeA },
  );
}

for (const resource of ['products', 'venues', 'speakers', 'tags'] as const) {
  test(`backend-free ${resource} CRUD persists through reload and isolates A → B → A`, async ({
    page,
    app,
  }) => {
    const path = `/en/stores/${storeA}/${resource === 'products' ? '' : 'reference/'}${resource}`;
    const singular = resource.slice(0, -1);
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/graphql')) requests.push(request.url());
    });
    await page.goto(app.url + path + '?search=Prototype');
    await expect(page.getByRole('banner').getByText('Prototype', { exact: true })).toBeVisible();
    await expect(
      page.locator('aside').getByRole('link', { name: 'Events', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: `Create ${singular}`, exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Prototype created');
    if (resource === 'products')
      await page.getByRole('textbox', { name: 'SKU', exact: true }).fill('PROTOTYPE');
    if (resource === 'venues') {
      await page.getByRole('textbox', { name: 'City', exact: true }).fill('Sofia');
      await page.getByRole('textbox', { name: 'Country', exact: true }).fill('bg');
      await page.getByRole('spinbutton', { name: 'Capacity', exact: true }).fill('50');
    }
    if (resource === 'speakers')
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill('prototype@example.com');
    if (resource === 'tags')
      await page.getByRole('textbox', { name: 'Color', exact: true }).fill('#ABCDEF');
    await page.getByRole('button', { name: `Save ${singular}`, exact: true }).click();
    await page.getByRole('link', { name: 'Prototype created', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Prototype edited');
    if (resource === 'venues')
      await page.getByRole('spinbutton', { name: 'Capacity', exact: true }).fill('');
    if (resource === 'speakers')
      await page.getByRole('textbox', { name: 'Email', exact: true }).fill('');
    await page.getByRole('button', { name: `Save ${singular}`, exact: true }).click();
    await expect(page).toHaveURL(app.url + path + '?search=Prototype');
    await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toBeVisible();
    await chooseStore(page, 'holita Plovdiv');
    await expect(page).toHaveURL(app.url + path.replace(storeA, storeB));
    await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toHaveCount(0);
    await chooseStore(page, 'holita Sofia');
    await expect(page).toHaveURL(app.url + path);
    await page
      .getByRole('searchbox', { name: `Search ${resource}`, exact: true })
      .fill('Prototype edited');
    await expect(page).toHaveURL(app.url + path + '?search=Prototype%20edited');
    await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Prototype edited', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: `Delete ${resource}`, exact: true })
      .click();
    await expect(page.getByRole('link', { name: 'Prototype edited', exact: true })).toHaveCount(0);
    expect(requests.length).toBeGreaterThan(5);
    expect(requests.every((url) => url === app.url + '/__prototype/graphql')).toBe(true);
  });
}

test('accepts only exact Angular documents, rejects missing scope and blocks real Gateway requests', async ({
  page,
  app,
  context,
}) => {
  let forwarded = 0;
  const blockedEndpoints = [app.gatewayUrl, app.url + '/graphql'];
  await context.route(
    (url) => blockedEndpoints.includes(url.href),
    async (route) => {
      forwarded++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': app.url },
        body: JSON.stringify({ data: { stores: [] } }),
      });
    },
  );
  await page.goto(app.url + '/en');
  await expect(page.getByRole('link', { name: 'holita Sofia', exact: true })).toBeVisible();
  const tags = await operationDocument('AdminTags', 'reference/tags');
  expect(await submit(page, tags, { offset: 0, limit: 1 })).toMatchObject({
    data: { referenceTags: { total: 24, items: [{ name: expect.any(String) }] } },
  });
  for (const query of [
    'query AdminTags { referenceTags { total } }',
    'query ListReferenceTags { referenceTags { total } }',
    'query AdminEvents { referenceEvents { total } }',
    'invalid',
  ])
    expect(await submit(page, query)).toMatchObject({
      errors: [{ message: 'This operation is unavailable in Prototype.' }],
    });
  const missing = await page.evaluate(async (query) => {
    const response = await fetch('/__prototype/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { offset: 0, limit: 1 } }),
    });
    const body: unknown = await response.json();
    return body;
  }, tags);
  expect(missing).toMatchObject({ errors: [{ message: 'Use a valid UUID.' }] });
  const unsupportedMethod = await page.evaluate(async () => {
    const response = await fetch(
      '/__prototype/graphql?query=' +
        encodeURIComponent('query AdminTags { referenceTags { total } }'),
    );
    const body: unknown = await response.json();
    return body;
  });
  expect(unsupportedMethod).toMatchObject({
    errors: [{ message: 'This operation is unavailable in Prototype.' }],
  });
  for (const endpoint of blockedEndpoints) {
    const blocked = await page.evaluate(async (url) => {
      try {
        await fetch(url, { method: 'POST', body: '{}' });
        return false;
      } catch {
        return true;
      }
    }, endpoint);
    expect(blocked).toBe(true);
  }
  expect(forwarded).toBe(0);
  await page.goto(`${app.url}/en/stores/${storeA}/reference/events`);
  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conference forum', exact: true })).toBeVisible();
});

test('reports storage failures for startup, mutations and Reset, then permits retry', async ({
  page,
  app,
}) => {
  await page.addInitScript((key) => {
    const setLocalItem = Storage.prototype.setItem.bind(window.localStorage);
    const setSessionItem = Storage.prototype.setItem.bind(window.sessionStorage);
    Storage.prototype.setItem = function (name, value) {
      if (name === key && sessionStorage.getItem('deny-prototype') === 'yes')
        throw new Error('Storage full');
      if (this === window.sessionStorage) setSessionItem(name, value);
      else setLocalItem(name, value);
    };
  }, storageKey);
  await page.goto(`${app.url}/en/stores/${storeA}/reference/tags?search=Unsaved`);
  await expect(page.getByRole('link', { name: 'Create tag', exact: true })).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem('deny-prototype', 'yes');
  });
  await page.getByRole('link', { name: 'Create tag', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Unsaved tag');
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('could not be reset');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Unsaved tag');
  await page.evaluate(() => {
    sessionStorage.removeItem('deny-prototype');
  });
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Unsaved tag', exact: true })).toBeVisible();
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    sessionStorage.setItem('deny-prototype', 'yes');
  }, storageKey);
  await page.reload();
  await expect(page.locator('holita-root')).toContainText('Prototype could not start');
  await page.evaluate(() => {
    sessionStorage.removeItem('deny-prototype');
  });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Create tag', exact: true })).toBeVisible();
});

test('confirmed Reset discards drafts and all stores while retaining Bulgarian and appearance', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/bg/stores/${storeA}/reference/tags/new`);
  await page.getByRole('textbox', { name: 'Име', exact: true }).fill('Незапазен чернови запис');
  await page.getByRole('button', { name: 'Включи тъмна тема', exact: true }).click();
  await page.getByRole('button', { name: 'Нулирай демо данните', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отказ', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue(
    'Незапазен чернови запис',
  );
  await page.getByRole('button', { name: 'Нулирай демо данните', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Нулирай', exact: true }).click();
  await expect(page).toHaveURL(app.url + '/bg');
  await expect(page.getByRole('link', { name: 'holita Sofia', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/app-dark/);
});

for (const width of [1280, 390, 320])
  test(`Sakai Prototype screens and Reset fit light and dark at ${String(width)}px`, async ({
    page,
    app,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const folder = join(workspaceRoot, '.references/review/phase-14');
    await mkdir(folder, { recursive: true });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const dark of [false, true]) {
      for (const resource of ['products', 'venues', 'speakers', 'tags']) {
        const path = `/bg/stores/${storeA}/${resource === 'products' ? '' : 'reference/'}${resource}`;
        await page.goto(app.url + path);
        await expect(page.locator('tbody tr').first().getByRole('link')).toBeVisible();
        const isDark = await page
          .locator('html')
          .evaluate((element) => element.classList.contains('app-dark'));
        if (isDark !== dark)
          await page
            .getByRole('button', {
              name: dark ? 'Включи тъмна тема' : 'Включи светла тема',
              exact: true,
            })
            .click();
        await expect(page.locator('tbody tr').first().getByRole('link')).toBeVisible();
        await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        const capture = `${String(width)}-${dark ? 'dark' : 'light'}`;
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: join(folder, `${resource}-${capture}.png`),
          fullPage: true,
          animations: 'disabled',
        });
        if (resource === 'tags') {
          await page.getByRole('button', { name: 'Нулирай демо данните', exact: true }).click();
          await expect(page.getByRole('dialog')).toBeVisible();
          await page.screenshot({
            path: join(folder, `reset-${capture}.png`),
            fullPage: true,
            animations: 'disabled',
          });
          await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Отказ', exact: true })
            .click();
        }
        await page.goto(app.url + path + '/new');
        await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: join(folder, `${resource}-editor-${capture}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
    expect(errors).toEqual([]);
  });

test('Reset waits for a delayed write from a retired store and prevents a late record revival', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/en/stores/${storeA}/reference/tags/new`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Retired submitted tag');
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        body.operationName === 'AdminCreateTag'
      ) {
        document.documentElement.dataset['heldWrite'] = 'yes';
        await new Promise<void>((resolve) => {
          window.addEventListener(
            'holita-test-release',
            () => {
              resolve();
            },
            { once: true },
          );
        });
      }
      return response;
    };
  });
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-held-write', 'yes');
  await chooseStore(page, 'holita Plovdiv');
  await expect(page).toHaveURL(/000000000002\/reference\/tags$/);
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Waiting for submitted changes');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event('holita-test-release')));
  await expect(page).toHaveURL(app.url + '/en');
  await expect(page.getByRole('link', { name: 'holita Sofia', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'holita Sofia', exact: true }).click();
  await page.locator('aside').getByRole('link', { name: 'Tags', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Search tags', exact: true })
    .fill('Retired submitted tag');
  await expect(page.getByText('No tags match these filters.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retired submitted tag', exact: true })).toHaveCount(
    0,
  );
});
