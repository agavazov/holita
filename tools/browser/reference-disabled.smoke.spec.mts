import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

test.use({ referenceEnabled: false });

const storeId = '10000000-0000-4000-8000-000000000001';
const eventId = '60000000-0000-4000-8000-000000000001';

for (const [label, routes] of [
  [
    'Event',
    [
      'events',
      'events/create',
      `events/${eventId}`,
      `events/${eventId}/edit`,
      `events/${eventId}?tab=history`,
      `events/${eventId}/sessions/create`,
    ],
  ],
  ['lookup', ['venues', 'speakers', 'tags']],
] as const) {
  test(`disabled Reference blocks ${label} routes and API calls`, async ({ page, app }) => {
    const referenceRequests: string[] = [];
    const moduleRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/src/features/reference/reference-workspace.tsx') {
        moduleRequests.push(request.url());
      }
      if (request.url() !== app.gatewayUrl || request.method() !== 'POST') return;
      const body: unknown = request.postDataJSON();
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        typeof body.operationName === 'string' &&
        body.operationName.includes('Reference')
      )
        referenceRequests.push(body.operationName);
    });
    for (const route of routes) {
      await page.goto(`${app.url}/stores/${storeId}/reference/${route}`);
      await expect(page.getByRole('alert')).toHaveText('Reference is disabled.');
      await expect(page.getByRole('menuitem', { name: 'Venues', exact: true })).toHaveCount(0);
    }
    expect(referenceRequests).toEqual([]);
    expect(moduleRequests).toEqual([]);
    const response = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeId },
      data: { query: '{ referenceVenues { total } }' },
    });
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
    });
  });
}

test('Products creation and mobile navigation work with Reference disabled', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/stores/${storeId}/products`);
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Events', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Product without Reference');
  await page.getByLabel('SKU', { exact: true }).fill('REFERENCE-DISABLED');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Product without Reference', exact: true }),
  ).toBeVisible();

  await page.goto(`${app.url}/stores/${storeId}/reference/venues`);
  await expect(page.getByRole('alert')).toHaveText('Reference is disabled.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const navigation = page.getByRole('dialog', { name: 'Navigation' });
  await expect(navigation.getByRole('menuitem')).toHaveCount(1);
  await navigation.getByRole('menuitem', { name: 'Products', exact: true }).click();
  await expect(navigation).toBeHidden();
  await expect(
    page.getByRole('link', { name: 'Product without Reference', exact: true }),
  ).toBeVisible();
});
