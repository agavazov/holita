import { expect, type Request } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const glasshouse = '30000000-0000-4000-8000-000000000001';
const studio = '30000000-0000-4000-8000-000000000002';
const path = `/en/stores/${storeA}/reference/venues`;
function operation(request: Request, name: string): boolean {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

test('a delayed Reference module mounts only the latest store after navigation is replaced', async ({
  page,
  app,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = () => {};
  const held = new Promise<void>((resolve) => {
    captured = resolve;
  });
  const scopes: string[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && operation(request, 'AdminVenues')) {
      scopes.push(request.headers()['x-store-id'] ?? 'missing');
    }
  });
  await page.route('**/chunk-*.js', async (route) => {
    const response = await route.fetch();
    if ((await response.text()).includes('holita-reference-workspace')) {
      captured();
      await gate;
    }
    await route.fulfill({ response });
  });
  try {
    await page.goto(`${app.url}/en/stores/${storeA}/products`);
    await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
    await page.locator('aside').getByRole('link', { name: 'Venues', exact: true }).click();
    await held;
    expect(scopes).toEqual([]);
    await chooseStore(page, 'holita Plovdiv');
    await expect(page.getByRole('link', { name: 'Plovdiv notebook', exact: true })).toBeVisible();
    await page.locator('aside').getByRole('link', { name: 'Venues', exact: true }).click();
    release();
    await expect(page).toHaveURL(app.url + path.replace(storeA, storeB));
    await expect(page.getByRole('link', { name: 'Riverside Hall', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toHaveCount(0);
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes.every((scope) => scope === storeB)).toBe(true);
  } finally {
    release();
  }
});

test('real Venue create, edit and nullable updates preserve the list context and persist through reload', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(app.url + path + '?search=Editor&pageSize=10&keep=yes#main-content');
  await page.getByRole('link', { name: 'Create venue', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  const city = page.getByRole('textbox', { name: 'City', exact: true });
  const country = page.getByRole('textbox', { name: 'Country', exact: true });
  const capacity = page.getByRole('spinbutton', { name: 'Capacity', exact: true });
  const save = page.getByRole('button', { name: 'Save venue', exact: true });
  await save.click();
  await expect(name).toBeFocused();
  await name.fill(' Editor created ');
  await city.fill(' Sofia ');
  await country.fill('BGR');
  await capacity.fill('0');
  await save.click();
  await expect(country).toBeFocused();
  await expect(page.getByText('Use a two-letter country code.', { exact: true })).toBeVisible();
  await country.fill(' bg ');
  await save.click();
  await expect(capacity).toBeFocused();
  await capacity.fill('120');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill(' Description ');
  await page.getByRole('textbox', { name: 'Address', exact: true }).fill(' 12 Example Street ');
  await save.click();
  await expect(page).toHaveURL(app.url + path + '?search=Editor&pageSize=10&keep=yes#main-content');
  await expect(page.getByRole('alert')).toContainText('Venue saved.');
  await page.getByRole('link', { name: 'Editor created', exact: true }).click();
  await expect(name).toHaveValue('Editor created');
  await expect(country).toHaveValue('BG');
  await expect(capacity).toHaveValue('120');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('');
  await page.getByRole('textbox', { name: 'Address', exact: true }).fill(' ');
  await capacity.fill('');
  await page.getByRole('switch', { name: 'Active', exact: true }).uncheck();
  await name.fill('Editor edited');
  await save.click();
  await expect(page.getByRole('row').filter({ hasText: 'Editor edited' })).toContainText(
    'Inactive',
  );
  await page.reload();
  await page.getByRole('link', { name: 'Editor edited', exact: true }).click();
  await expect(capacity).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Address', exact: true })).toHaveValue('');
  await expect(page.getByRole('switch', { name: 'Active', exact: true })).not.toBeChecked();
  const response = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: {
      query:
        '{referenceVenues(search:"Editor"){items{name description address capacity countryCode active}}}',
    },
  });
  const result: unknown = await response.json();
  expect(result).toMatchObject({
    data: {
      referenceVenues: {
        items: [
          {
            name: 'Editor edited',
            description: null,
            address: null,
            capacity: null,
            countryCode: 'BG',
            active: false,
          },
        ],
      },
    },
  });
  expect(errors).toEqual([]);
});

test('real filters, URL history, nullable capacity sorting and stable ID ties use server results', async ({
  page,
  app,
}) => {
  const seeded: { id: string; name: string }[] = [];
  for (const [name, capacity, active] of [
    ['Sort Alpha', 10, true],
    ['Sort Beta', 10, true],
    ['Sort Null', null, false],
  ] as const) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: {
        query:
          'mutation($input:CreateReferenceVenueInput!){createReferenceVenue(input:$input){id name}}',
        variables: { input: { name, city: 'Sofia', countryCode: 'BG', capacity, active } },
      },
    });
    const result: unknown = await response.json();
    if (typeof result !== 'object' || result === null || !('data' in result))
      throw new Error('Missing seed response.');
    const data: unknown = result.data;
    if (typeof data !== 'object' || data === null || !('createReferenceVenue' in data))
      throw new Error('Missing Venue.');
    const venue: unknown = data.createReferenceVenue;
    if (
      typeof venue !== 'object' ||
      venue === null ||
      !('id' in venue) ||
      typeof venue.id !== 'string' ||
      !('name' in venue) ||
      typeof venue.name !== 'string'
    )
      throw new Error('Invalid seed Venue.');
    seeded.push({ id: venue.id, name: venue.name });
  }
  await page.goto(app.url + path + '?search=Sort&sort=capacity&order=asc');
  const rows = page.locator('tbody .content-link');
  const tied = seeded
    .slice(0, 2)
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((venue) => venue.name);
  await expect(rows).toHaveText([...tied, 'Sort Null']);
  await page.getByRole('columnheader', { name: 'Capacity', exact: true }).click();
  await expect(page).toHaveURL(app.url + path + '?search=Sort&sort=capacity&order=desc');
  await expect(rows).toHaveText([...tied, 'Sort Null']);
  await page.getByRole('combobox', { name: 'Status', exact: true }).click();
  await page.getByRole('option', { name: 'Inactive', exact: true }).click();
  await expect(rows).toHaveText(['Sort Null']);
  await expect(page).toHaveURL(/active=false/);
  await page.goBack();
  await expect(rows).toHaveText([...tied, 'Sort Null']);
  await page
    .getByRole('searchbox', { name: 'Search venues', exact: true })
    .fill('No matching venue');
  await expect(page.getByText('No venues match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
});

test('referenced batch deletion preserves successes, identifies failed rows and retries only failures', async ({
  page,
  app,
}) => {
  const writes: unknown[] = [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && operation(request, 'AdminDeleteVenue')) {
      const body: unknown = request.postDataJSON();
      writes.push(body);
    }
  });
  await page.goto(app.url + path + '?sort=name&order=asc');
  await page.getByRole('checkbox', { name: 'Select all venues on this page', exact: true }).check();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete venues?', exact: true });
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete venues', exact: true }).click();
  await expect(
    page.getByText('Deleted venues: 1. Failed venues: 1.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Studio 12', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: 'Select The Glasshouse', exact: true }),
  ).toBeChecked();
  await expect(page.getByRole('alert').filter({ hasText: 'still referenced' })).toContainText(
    /[0-9a-f-]{36}/,
  );
  expect(writes).toMatchObject([{ variables: { id: studio } }, { variables: { id: glasshouse } }]);
  const response = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: {
      query:
        'mutation{updateReferenceEvent(id:"60000000-0000-4000-8000-000000000001",input:{format:ONLINE,meetingUrl:"https://example.com/meeting",venueId:null}){id}}',
    },
  });
  const result: unknown = await response.json();
  expect(result).toHaveProperty('data.updateReferenceEvent.id');
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete venues', exact: true }).click();
  await expect(page.getByText('Deleted venues: 1.', { exact: true })).toBeVisible();
  expect(writes).toMatchObject([
    { variables: { id: studio } },
    { variables: { id: glasshouse } },
    { variables: { id: glasshouse } },
  ]);
  await page.reload();
  await expect(page.getByText('No venues in this store.', { exact: true })).toBeVisible();
});

test('deleting an emptied last page corrects pagination while preserving unrelated URL context', async ({
  page,
  app,
}) => {
  for (let index = 0; index < 11; index++) {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: {
        query:
          'mutation($input:CreateReferenceVenueInput!){createReferenceVenue(input:$input){id}}',
        variables: {
          input: {
            name: 'Delete page ' + String(index).padStart(2, '0'),
            city: 'Sofia',
            countryCode: 'BG',
          },
        },
      },
    });
    const result: unknown = await response.json();
    expect(result).toHaveProperty('data.createReferenceVenue.id');
  }
  await page.goto(
    app.url +
      path +
      '?search=Delete%20page&page=2&pageSize=10&sort=name&order=asc&keep=yes#main-content',
  );
  await page.getByRole('button', { name: 'Delete Delete page 10', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete venues', exact: true })
    .click();
  await expect(page).toHaveURL(
    app.url + path + '?search=Delete%20page&pageSize=10&sort=name&order=asc&keep=yes#main-content',
  );
  await expect(page.locator('tbody .content-link')).toHaveCount(10);
  await expect(page.getByText('Deleted venues: 1.', { exact: true })).toBeVisible();
});

test('delayed reads stay scoped through A → B → A and a language change', async ({ page, app }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = () => {};
  const held = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let delivered = () => {};
  const done = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  let delayed = false;
  await page.route(app.gatewayUrl, async (route) => {
    if (
      !delayed &&
      operation(route.request(), 'AdminVenues') &&
      route.request().headers()['x-store-id'] === storeA
    ) {
      delayed = true;
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
      delivered();
    } else await route.continue();
  });
  try {
    await page.goto(app.url + path);
    await held;
    await chooseStore(page, 'holita Plovdiv');
    await expect(page).toHaveURL(app.url + path.replace(storeA, storeB));
    await expect(page.getByRole('link', { name: 'Riverside Hall', exact: true })).toBeVisible();
    release();
    await done;
    await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toHaveCount(0);
    await chooseStore(page, 'holita Sofia');
    await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Български', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Места', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
  } finally {
    release();
  }
});

test('a submitted write settles in its captured store without changing the new same-store editor', async ({
  page,
  app,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = () => {};
  const held = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let delivered = () => {};
  const done = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminUpdateVenue')) {
      expect(route.request().headers()['x-store-id']).toBe(storeA);
      expect(route.request().headers()['accept-language']).toBe('en');
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
      delivered();
    } else await route.continue();
  });
  try {
    await page.goto(app.url + path + `/${studio}/edit`);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await expect(name).toHaveValue('Studio 12');
    await name.fill('Captured Sofia write');
    await page.getByRole('button', { name: 'Save venue', exact: true }).click();
    await held;
    await chooseStore(page, 'holita Plovdiv');
    await expect(page.getByRole('link', { name: 'Riverside Hall', exact: true })).toBeVisible();
    await chooseStore(page, 'holita Sofia');
    await page.getByRole('link', { name: 'Create venue', exact: true }).click();
    await name.fill('Current unsaved draft');
    release();
    await done;
    await expect(page).toHaveURL(app.url + path + '/new');
    await expect(name).toHaveValue('Current unsaved draft');
    await expect(page.getByRole('alert')).toHaveCount(0);
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: { query: 'query($id:ID!){referenceVenue(id:$id){name}}', variables: { id: studio } },
    });
    const result: unknown = await response.json();
    expect(result).toMatchObject({ data: { referenceVenue: { name: 'Captured Sofia write' } } });
  } finally {
    release();
  }
});

test('store navigation stops unsent deletions while the submitted delete retains its captured scope', async ({
  page,
  app,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = () => {};
  const held = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let delivered = () => {};
  const done = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  const writes: unknown[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminDeleteVenue')) {
      expect(route.request().headers()['x-store-id']).toBe(storeA);
      writes.push(route.request().postDataJSON());
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
      delivered();
    } else await route.continue();
  });
  try {
    await page.goto(app.url + path + '?sort=name&order=asc');
    await page
      .getByRole('checkbox', { name: 'Select all venues on this page', exact: true })
      .check();
    await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete venues', exact: true })
      .click();
    await held;
    await chooseStore(page, 'holita Plovdiv');
    await expect(page.getByRole('link', { name: 'Riverside Hall', exact: true })).toBeVisible();
    release();
    await done;
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(writes).toMatchObject([{ variables: { id: studio } }]);
    await chooseStore(page, 'holita Sofia');
    await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Studio 12', exact: true })).toHaveCount(0);
  } finally {
    release();
  }
});

test('dirty Venue forms guard store, same-store history and language navigation', async ({
  page,
  app,
}) => {
  await page.goto(app.url + path);
  await page.getByRole('link', { name: 'Create venue', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('Unsaved Venue');
  const dialog = page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true });
  await chooseStore(page, 'holita Plovdiv');
  await expect(dialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toContainText(
    'holita Sofia',
  );
  const back = page.goBack();
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await back;
  await expect(name).toHaveValue('Unsaved Venue');
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(app.url + path.replace('/en/', '/bg/') + '/new');
  await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue('');
});

test('Bulgarian Venues list and editor fit narrow mobile viewports in light and dark themes', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const form of [false, true]) {
      await page.goto(app.url + path.replace('/en/', '/bg/') + (form ? '/new' : ''));
      await expect(
        page.getByRole('heading', { name: form ? 'Създай място' : 'Места', exact: true }),
      ).toBeVisible();
      if (!form)
        await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
      for (const dark of [false, true]) {
        if (
          (await page
            .locator('html')
            .evaluate((element) => element.classList.contains('app-dark'))) !== dark
        ) {
          await page.locator('.layout-topbar-actions button').click();
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(
            `venues-${form ? 'form' : 'list'}-${String(width)}-${dark ? 'dark' : 'light'}.png`,
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  }
  await page.getByRole('button', { name: 'Отвори или затвори навигацията', exact: true }).click();
  const navigation = page.locator('.p-drawer');
  await expect(navigation.getByRole('link', { name: 'Места', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.keyboard.press('Escape');
  await expect(navigation).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('disabled Reference', () => {
  test.use({ referenceEnabled: false });
  test('a backend-disabled request exposes diagnostics and leaves Products usable when the UI flag is enabled', async ({
    page,
    app,
  }) => {
    await page.route(app.url + '/config.json', async (route) => {
      await route.fulfill({ json: { graphqlUrl: app.gatewayUrl, referenceEnabled: true } });
    });
    await page.goto(app.url + path);
    await expect(page.getByRole('alert')).toContainText('Reference is disabled');
    await expect(page.getByRole('alert')).toContainText(/[0-9a-f-]{36}/);
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await page.locator('aside').getByRole('link', { name: 'Products', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  });
  test('direct Venue routes issue no business requests and Products works on desktop and mobile', async ({
    page,
    app,
  }) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.url() !== app.gatewayUrl || request.method() !== 'POST') return;
      const body: unknown = request.postDataJSON();
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        typeof body.operationName === 'string' &&
        body.operationName.includes('Venue')
      )
        calls.push(body.operationName);
    });
    for (const suffix of ['', '/new', `/${studio}/edit`]) {
      await page.goto(app.url + path + suffix);
      await expect(page.getByRole('alert')).toHaveText(
        'Reference is unavailable. Products remains available.',
      );
      await expect(page.getByRole('link', { name: 'Venues', exact: true })).toHaveCount(0);
    }
    expect(calls).toEqual([]);
    await page.goto(`${app.url}/en/stores/${storeA}/products/new`);
    await page
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill('Product without Reference');
    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill('NO_REFERENCE');
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Product without Reference', exact: true }),
    ).toBeVisible();
    await page.goto(app.url + path);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
    const navigation = page.locator('.p-drawer');
    await expect(navigation.getByRole('link', { name: 'Venues', exact: true })).toHaveCount(0);
    await navigation.getByRole('link', { name: 'Products', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Product without Reference', exact: true }),
    ).toBeVisible();
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: { query: '{referenceVenues{total}}' },
    });
    const result: unknown = await response.json();
    expect(result).toMatchObject({ errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] });
  });
});
