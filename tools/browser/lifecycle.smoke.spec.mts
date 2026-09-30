import { expect, type Request } from '@playwright/test';
import { test } from './fixture.mjs';
const storeA = '10000000-0000-4000-8000-000000000001',
  storeB = '10000000-0000-4000-8000-000000000002';
const eventId = '60000000-0000-4000-8000-000000000001';
function operation(request: Request, name: string) {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

test('bulk actions, Trash and history survive reload and preserve the event program on restore', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const setup = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: {
      query:
        'mutation($eventId:ID!){createReferenceSession(eventId:$eventId,input:{title:"Opening conversations",startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T09:00:00Z"}){id}}',
      variables: { eventId },
    },
  });
  const setupBody: unknown = await setup.json();
  expect(setupBody).not.toHaveProperty('errors');
  const list = `${app.url}/stores/${storeA}/reference/events`;
  await page.goto(list);
  const row = () => page.getByRole('row').filter({ hasText: 'Sofia Creative Forum' });
  await row().getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(row()).toContainText('Published');
  await expect(page.getByText('Publish completed for 1 event.')).toBeVisible();
  await row().getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Trash selected', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('tab', { name: 'Trash', exact: true }).click();
  await expect(page).toHaveURL(`${list}?view=trash`);
  await page.reload();
  await expect(row()).toContainText('Published');
  await page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sessions', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByText('Moved to trash', { exact: true })).toBeVisible();
  const historyRow = page.getByRole('row').filter({ hasText: 'Event updated' });
  await historyRow.getByRole('button', { name: 'Expand row' }).click();
  await expect(page.getByText('After: PUBLISHED', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('event-history.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Restore event', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit event', exact: true })).toBeVisible();
  await expect(page.getByText('Event restored', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Opening conversations', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(list);
  await row().getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Archive selected', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(row()).toContainText('Archived');
  await row().getByRole('checkbox').check();
  await page.getByRole('columnheader', { name: /Start \(Sofia\)/ }).click();
  await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toHaveCount(0);
  // Restore is available directly from the Trash list as well.
  await row().getByRole('button', { name: 'Actions for Sofia Creative Forum' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Trash', exact: true }).click();
  await row().getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Restore selected', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toHaveCount(
    0,
  );
  await page.goto(`${list}/${eventId}?tab=history`);
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a delayed bulk completion cannot notify or change a newly selected store', async ({
  page,
  app,
}) => {
  let release = () => {},
    observed = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  const stores: (string | undefined)[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    if (!operation(route.request(), 'SetReferenceEventsStatus')) return route.continue();
    stores.push(route.request().headers()['x-store-id']);
    const response = await route.fetch();
    observed();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/reference/events`);
    await page
      .getByRole('row')
      .filter({ hasText: 'Sofia Creative Forum' })
      .getByRole('checkbox')
      .check();
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).dblclick();
    await started;
    await page.evaluate((store) => {
      window.history.pushState({}, '', `/stores/${store}/reference/events`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, storeB);
    await expect(page).toHaveURL(`${app.url}/stores/${storeB}/reference/events`);
    const completed = page.waitForResponse((response) =>
      operation(response.request(), 'SetReferenceEventsStatus'),
    );
    release();
    await completed;
    await expect(page.getByText('Publish completed for 1 event.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toHaveCount(
      0,
    );
    expect(stores).toEqual([storeA]);
  } finally {
    release();
  }
});
