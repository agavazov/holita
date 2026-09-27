import { expect, type Page, type Request } from '@playwright/test';
import { test } from './fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';

async function switchStore(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Store', exact: true }).press('ArrowDown');
  await page.getByTitle(name, { exact: true }).click();
}
async function fillVenue(page: Page, name: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('tab', { name: 'Location', exact: true }).click();
  await page.getByLabel('City', { exact: true }).fill('Sofia');
  await page.getByRole('tab', { name: 'General', exact: true }).click();
}
function operation(request: Request, name: string) {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

test('Venue CRUD works through the real gateway and persists across reloads', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}/stores/${storeA}/reference/venues`);
  await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('venues-list.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create venue', exact: true }).click();
  await page.getByRole('button', { name: 'Save venue' }).click();
  await expect(page.getByText('Enter a venue name.')).toBeVisible();
  await fillVenue(page, 'Smoke Sofia venue');
  await page.getByRole('spinbutton', { name: /^Capacity/ }).fill('120');
  await page.screenshot({ path: testInfo.outputPath('venue-form.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save venue' }).click();
  await page.getByRole('link', { name: 'Smoke Sofia venue', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Smoke Sofia edited');
  await page.getByRole('switch', { name: /^Active/ }).click();
  await page.getByRole('tab', { name: 'Location', exact: true }).click();
  await page.getByLabel(/^Address/).fill('12 Example Street');
  await page.getByRole('button', { name: 'Save venue' }).click();
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'Smoke Sofia edited' })).toContainText(
    'Inactive',
  );
  await switchStore(page, 'holita Plovdiv');
  await expect(page.getByRole('link', { name: 'Riverside Hall', exact: true })).toBeVisible();
  await expect(page.getByText('Smoke Sofia edited')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create venue', exact: true }).click();
  await fillVenue(page, 'Smoke Plovdiv venue');
  await page.getByRole('button', { name: 'Save venue' }).click();
  await page.getByRole('button', { name: 'Delete Smoke Plovdiv venue', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Smoke Plovdiv venue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Smoke Plovdiv venue', exact: true }).click();
  await page.getByRole('button', { name: 'Delete venue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Smoke Plovdiv venue', exact: true })).toHaveCount(0);
  await switchStore(page, 'holita Sofia');
  await page.getByRole('link', { name: 'Smoke Sofia edited', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Smoke Sofia edited');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('venue-mobile.png'), fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('tab', { name: 'Location', exact: true }).click();
  await expect(page.getByLabel(/^Address/)).toHaveValue('12 Example Street');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Smoke Sofia edited', exact: true }).click();
  await page.getByRole('button', { name: 'Delete venue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Smoke Sofia edited', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a delayed venue response cannot replace the newly selected store', async ({ page, app }) => {
  let release: () => void = () => {
    throw new Error('Delay not initialized.');
  };
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed: () => void = () => {
    throw new Error('Observer not initialized.');
  };
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  let delayNext = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (
      delayNext &&
      operation(route.request(), 'ListReferenceVenues') &&
      route.request().headers()['x-store-id'] === storeA
    ) {
      delayNext = false;
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/reference/venues`);
    await started;
    await switchStore(page, 'holita Plovdiv');
    await expect(page.getByRole('link', { name: 'Riverside Hall', exact: true })).toBeVisible();
    const completed = page.waitForResponse(
      (response) =>
        operation(response.request(), 'ListReferenceVenues') &&
        response.request().headers()['x-store-id'] === storeA,
    );
    release();
    await completed;
    await expect(page.getByText('The Glasshouse')).toHaveCount(0);
    await switchStore(page, 'holita Sofia');
    await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
    await expect(page.getByText('Riverside Hall')).toHaveCount(0);
  } finally {
    release();
  }
});

test('a pending mutation stays in its initiating store and leaves the new draft intact', async ({
  page,
  app,
}) => {
  let release: () => void = () => {
    throw new Error('Delay not initialized.');
  };
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed: () => void = () => {
    throw new Error('Observer not initialized.');
  };
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  const mutationStores: (string | undefined)[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'CreateReferenceVenue')) {
      mutationStores.push(route.request().headers()['x-store-id']);
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/reference/venues/create`);
    await fillVenue(page, 'Pending Sofia venue');
    await page.getByRole('button', { name: 'Save venue' }).dblclick();
    await started;
    await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
    await switchStore(page, 'holita Plovdiv');
    await page.getByRole('button', { name: 'Create venue', exact: true }).click();
    await fillVenue(page, 'Unsaved Plovdiv draft');
    const completed = page.waitForResponse((response) =>
      operation(response.request(), 'CreateReferenceVenue'),
    );
    release();
    await completed;
    await expect(page).toHaveURL(`${app.url}/stores/${storeB}/reference/venues/create`);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved Plovdiv draft');
    await expect(page.getByText('Venue saved.')).toHaveCount(0);
    expect(mutationStores).toEqual([storeA]);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByText('Pending Sofia venue')).toHaveCount(0);
    await switchStore(page, 'holita Sofia');
    await expect(
      page.getByRole('link', { name: 'Pending Sofia venue', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test('history navigation isolates editors in the same store during a pending create', async ({
  page,
  app,
}) => {
  let release: () => void = () => {
    throw new Error('Delay not initialized.');
  };
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed: () => void = () => {
    throw new Error('Observer not initialized.');
  };
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'CreateReferenceVenue')) {
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/reference/venues`);
    await page.getByRole('link', { name: 'The Glasshouse', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('The Glasshouse');
    const editUrl = page.url();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Create venue', exact: true }).click();
    await fillVenue(page, 'Pending same-store venue');
    await page.getByRole('button', { name: 'Save venue' }).click();
    await started;
    await page.evaluate(() => {
      window.history.go(-2);
    });
    await expect(page).toHaveURL(editUrl);
    await expect(page.getByLabel('Name', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('The Glasshouse');
    await page.getByLabel('Name', { exact: true }).fill('Independent unsaved edit');
    const completed = page.waitForResponse((response) =>
      operation(response.request(), 'CreateReferenceVenue'),
    );
    release();
    await completed;
    await expect(page).toHaveURL(editUrl);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Independent unsaved edit');
    await expect(page.getByText('Venue saved.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Pending same-store venue', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});
