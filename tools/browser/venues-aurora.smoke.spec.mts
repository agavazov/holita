import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const captures = 'artifacts/aurora/venues';

test('Aurora Venues sorts across server pages and preserves URL filters and history', async ({
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
            name: `Sort venue ${String(index).padStart(2, '0')}`,
            city: 'Sofia',
            countryCode: 'BG',
            active: true,
          },
        },
      },
    });
    expect(await response.json()).toHaveProperty('data.createReferenceVenue.id');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `${app.url}/stores/${storeA}/reference/venues?search=Sort+venue&status=ACTIVE&pageSize=10&page=2`,
  );
  const name = page.getByRole('columnheader', { name: /^Name\b/ });
  const rows = page.getByRole('grid', { name: 'Venues' }).getByRole('link');
  await expect(rows).toHaveText(['Sort venue 00']);
  await page.getByRole('checkbox', { name: 'Select all rows', exact: true }).check();
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'ascending');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toHaveText('Sort venue 00');
  await expect(page.getByRole('button', { name: 'Delete selected' })).toHaveCount(0);
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows).toHaveText(['Sort venue 10']);
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(rows.first()).toHaveText('Sort venue 10');
  await expect(rows).toHaveCount(10);
  await page.reload();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(page).toHaveURL(/sort=name&order=desc/);
  await expect(page.getByRole('tab', { name: 'Active', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'none');
  await expect(page).not.toHaveURL(/sort=|order=/);
  await page.goBack();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
  await expect(rows.first()).toHaveText('Sort venue 10');
});

test('Aurora Venues shares quick and panel filters and reports referenced batch failures', async ({
  page,
  app,
}) => {
  const response = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: {
      query:
        'mutation{createReferenceVenue(input:{name:"Batch spare",city:"Sofia",countryCode:"BG",active:false}){id}}',
    },
  });
  expect(await response.json()).toHaveProperty('data.createReferenceVenue.id');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}/stores/${storeA}/reference/venues`);
  const quickSearch = page.getByRole('searchbox', { name: 'Search venues' });
  await quickSearch.fill('Glass');
  await expect(page).toHaveURL(/search=Glass/);
  await page.getByRole('button', { name: 'Filter venues' }).click();
  const panel = page.getByRole('dialog', { name: 'Venue filters' });
  const panelSearch = panel.getByRole('searchbox', { name: 'Search venues' });
  await expect(panelSearch).toHaveValue('Glass');
  await panelSearch.fill('Batch');
  await panel.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Inactive', exact: true }).click();
  await expect(page).toHaveURL(/search=Batch/);
  await expect(page).toHaveURL(/status=INACTIVE/);
  await panel.getByRole('button', { name: 'Close filters' }).click();
  await expect(quickSearch).toHaveValue('Batch');
  await expect(page.getByRole('grid').getByRole('link')).toHaveText(['Batch spare']);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Inactive', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Filter venues' }).click();
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await expect(panelSearch).toHaveValue('');
  await expect(page).not.toHaveURL(/search=|status=/);
  await panel.getByRole('button', { name: 'Close filters' }).click();
  await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
  await mkdir(captures, { recursive: true });
  await page.screenshot({
    path: `${captures}/list-desktop.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Filter venues' }).click();
  await page.screenshot({
    path: `${captures}/filters-desktop.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await panel.getByRole('button', { name: 'Close filters' }).click();
  for (const name of ['The Glasshouse', 'Batch spare']) {
    await page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name, exact: true }) })
      .getByRole('checkbox')
      .check();
  }
  await page.getByRole('button', { name: 'Delete selected' }).click();
  const deletion = page.getByRole('dialog');
  await deletion.getByRole('button', { name: 'Delete venues', exact: true }).click();
  await expect(deletion.getByRole('alert')).toContainText(
    'The Glasshouse: Venue is still referenced by another record.',
  );
  await expect(deletion.getByRole('button', { name: 'Delete venue', exact: true })).toBeEnabled();
  await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Batch spare', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'The Glasshouse', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${captures}/list-mobile.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Filter venues' }).click();
  await expect(panelSearch).toBeVisible();
  await page.screenshot({
    path: `${captures}/filters-mobile.png`,
    fullPage: true,
    animations: 'disabled',
  });
});

test('Aurora Venue editor keeps a desktop aside, stacks it on mobile and protects unsaved input', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}/stores/${storeA}/reference/venues/create`);
  await page.getByLabel('Name', { exact: true }).fill('Aurora review venue');
  await page.getByLabel('City', { exact: true }).fill('Sofia');
  await page.getByLabel('Address', { exact: true }).fill('12 Example Street');
  await page
    .getByLabel('Description', { exact: true })
    .fill('A flexible space for talks, workshops and community events.');
  await page.getByRole('spinbutton', { name: 'Capacity' }).fill('120');
  const aside = page.getByRole('complementary', { name: 'Venue settings' });
  await expect(aside).toHaveCSS('position', 'sticky');
  await expect(aside.getByText('Aurora review venue', { exact: true })).toBeVisible();
  await mkdir(captures, { recursive: true });
  await page.screenshot({
    path: `${captures}/form-desktop.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Aurora review venue');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(aside).toHaveCSS('position', 'static');
  const location = await page.getByRole('region', { name: 'Location', exact: true }).boundingBox();
  const mobileAside = await aside.boundingBox();
  if (!location || !mobileAside) throw new Error('Missing form sections.');
  expect(mobileAside.y).toBeGreaterThanOrEqual(location.y + location.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${captures}/form-mobile.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/stores/${storeA}/reference/venues`);
  expect(errors).toEqual([]);
});
