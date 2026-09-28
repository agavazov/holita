import { expect, type Page, type Request } from '@playwright/test';
import { test } from './fixture.mjs';

// Event inputs must remain in Sofia even when the browser uses another timezone.
test.use({ timezoneId: 'America/New_York' });

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
async function choose(page: Page, label: string | RegExp, text: string) {
  await page
    .getByRole('combobox', { name: label, exact: typeof label === 'string' })
    .press('ArrowDown');
  if (label === 'Store') await page.getByRole('option', { name: text, exact: true }).click();
  else await page.locator('.ant-select-item-option-content').getByText(text, { exact: true }).click();
}
async function onlineEvent(page: Page, title: string, code: string) {
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Code', { exact: true }).fill(code);
  await choose(page, 'Format', 'Online');
  await page.getByRole('tab', { name: 'Schedule & location' }).click();
  for (const [label, value] of [
    ['Starts at', '2026-11-12 10:00'],
    ['Ends at', '2026-11-12 17:00'],
  ] as const) {
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel(label, { exact: true }).press('Tab');
  }
  await page.getByLabel('Meeting URL', { exact: true }).fill('https://example.com/forum');
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

test('Event create/edit persists all sections and remote relations, with dirty navigation and narrow layout', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}/stores/${storeA}/reference/events`);
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await onlineEvent(page, 'Browser forum', 'BROWSER-FORUM');
  await page.getByLabel(/^Registration opens/).fill('2026-10-01');
  await page.getByLabel(/^Registration opens/).press('Tab');
  await page.getByLabel(/^Registration closes/).fill('2026-11-12');
  await page.getByLabel(/^Registration closes/).press('Tab');
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await choose(page, 'Format', 'Hybrid');
  await page.getByRole('spinbutton', { name: /^Budget/ }).fill('12345.67');
  await page.getByRole('spinbutton', { name: /^Capacity/ }).fill('180');
  await page.getByRole('switch', { name: /^Featured/ }).click();
  await page.getByRole('tab', { name: 'Schedule & location' }).click();
  await choose(page, 'Venue', 'The Glasshouse');
  await choose(page, /^Tags/, 'Workshop');
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await page.getByLabel(/^Summary/).fill('A real persisted demonstration.');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(/reference\/events\/[0-9a-f-]+\/edit$/);
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await expect(page.getByLabel('Code', { exact: true })).toHaveAttribute('readonly');
  await expect(page.getByRole('spinbutton', { name: /^Budget/ })).toHaveValue('12345.67');
  await page.getByRole('tab', { name: 'Schedule & location' }).click();
  await expect(page.getByLabel('Starts at', { exact: true })).toHaveValue('2026-11-12 10:00');
  await expect(
    page.locator('.ant-select-selection-item').filter({ hasText: 'The Glasshouse' }),
  ).toBeVisible();
  await expect(
    page.locator('.ant-select-selection-item').filter({ hasText: 'Workshop' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('event-schedule.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await choose(page, 'Format', 'Online');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByRole('tab', { name: 'Schedule & location' }).click();
  await expect(page.getByRole('combobox', { name: 'Venue', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Meeting URL', { exact: true })).toHaveValue(
    'https://example.com/forum',
  );
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await expect(page.getByLabel(/^Summary/)).toHaveValue('A real persisted demonstration.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('event-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Unsaved browser draft');
  await page.goBack();
  await expect(page.getByText('Discard unsaved changes?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved browser draft');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('button', { name: 'Move Browser forum to trash', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await expect(page.getByRole('link', { name: 'Browser forum', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Speaker and Tag forms create, edit, validate and delete through the gateway', async ({
  page,
  app,
}) => {
  await page.goto(`${app.url}/stores/${storeA}/reference/speakers`);
  await page.getByRole('button', { name: 'Create speaker', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Browser speaker');
  await page.getByLabel(/^Email/).fill('speaker@example.com');
  await page.getByLabel(/^Short biography/).fill('A sample biography.');
  await page.getByRole('button', { name: 'Save speaker', exact: true }).click();
  await page.getByRole('link', { name: 'Browser speaker', exact: true }).click();
  await page.getByRole('switch', { name: /^Active/ }).click();
  await page.getByLabel(/^Email/).clear();
  await page.getByRole('button', { name: 'Save speaker', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Browser speaker' })).toContainText(
    'Inactive',
  );
  await page.getByRole('button', { name: 'Delete Browser speaker', exact: true }).click();
  await page.getByRole('button', { name: 'Delete speaker', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Browser speaker', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Tags', exact: true }).click();
  await page.getByRole('button', { name: 'Create tag', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Community');
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await expect(page.locator('.ant-form-item-explain-error')).toHaveText(
    'Name is already used in this store.',
  );
  await page.getByLabel('Name', { exact: true }).fill('Browser tag');
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await page.getByRole('link', { name: 'Browser tag', exact: true }).click();
  await page.getByRole('switch', { name: /^Active/ }).click();
  await page.getByRole('button', { name: 'Save tag', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Browser tag' })).toContainText('Inactive');
  await page.getByRole('button', { name: 'Delete Browser tag', exact: true }).click();
  await page.getByRole('button', { name: 'Delete tag', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Browser tag', exact: true })).toHaveCount(0);
});

test('a pending Event create retains its original store and cannot redirect a new draft', async ({
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
  const mutationStores: (string | undefined)[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'CreateReferenceEvent')) {
      mutationStores.push(route.request().headers()['x-store-id']);
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(`${app.url}/stores/${storeA}/reference/events/create`);
    await onlineEvent(page, 'Pending Sofia forum', 'PENDING-FORUM');
    await page.getByRole('button', { name: 'Save event', exact: true }).dblclick();
    await started;
    await choose(page, 'Store', 'holita Plovdiv');
    await page.getByRole('button', { name: 'Create event', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Independent Plovdiv draft');
    const completed = page.waitForResponse((response) =>
      operation(response.request(), 'CreateReferenceEvent'),
    );
    release();
    await completed;
    await expect(page).toHaveURL(`${app.url}/stores/${storeB}/reference/events/create`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Independent Plovdiv draft',
    );
    await expect(page.getByText('Event saved.')).toHaveCount(0);
    expect(mutationStores).toEqual([storeA]);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await choose(page, 'Store', 'holita Sofia');
    await expect(
      page.getByRole('link', { name: 'Pending Sofia forum', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test('Event filters, columns and overview preserve the list address through edit and reload', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const list = `${app.url}/stores/${storeA}/reference/events`;
  await page.goto(list);
  await page.getByRole('searchbox', { name: 'Search events' }).fill('SOFIA-FORUM');
  await page.getByRole('searchbox', { name: 'Search events' }).press('Enter');
  await choose(page, 'Filter status', 'Draft');
  await expect(page).toHaveURL(/status=DRAFT/);
  await page.getByRole('button', { name: 'More filters', exact: true }).click();
  await choose(page, 'Format', 'In person');
  await choose(page, 'Venue', 'The Glasshouse');
  await choose(page, 'Featured', 'Not featured');
  await page.getByRole('spinbutton', { name: 'Minimum capacity' }).fill('100');
  await page.getByRole('spinbutton', { name: 'Maximum capacity' }).fill('200');
  await page.getByPlaceholder('Start date', { exact: true }).fill('2026-11-12');
  await page.getByPlaceholder('Start date', { exact: true }).press('Tab');
  await page.getByPlaceholder('End date', { exact: true }).fill('2026-11-12');
  await page.getByPlaceholder('End date', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
  await choose(page, 'Sort events by', 'Budget');
  await expect(page).toHaveURL(/sort=budget/);
  await page.getByRole('button', { name: 'Ascending', exact: true }).click();
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Budget', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Capacity', exact: true }).check();
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  const address = page.url();
  expect(new URL(address).searchParams.get('sort')).toBe('budget');
  expect(new URL(address).searchParams.get('order')).toBe('desc');
  expect(new URL(address).searchParams.get('from')).toBe('2026-11-12');
  expect(new URL(address).searchParams.get('to')).toBe('2026-11-12');
  await page.reload();
  await expect(page.getByRole('columnheader', { name: /Budget/ })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('event-list-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByText('The Glasshouse', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('12,500.00 EUR', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('event-overview-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await page.getByLabel(/^Summary/).fill('Updated from the event overview.');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByText('Updated from the event overview.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Updated from the event overview.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('event-overview-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Back to events', exact: true }).click();
  await expect(page).toHaveURL(address);
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('event-list-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset filters', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /Budget/ })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: 'Back to events', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Sofia Creative Forum' })).toContainText(
    'Published',
  );
  await choose(page, 'Store', 'holita Plovdiv');
  await expect(page).toHaveURL(`${app.url}/stores/${storeB}/reference/events`);
  await expect(page.getByRole('columnheader', { name: /Budget/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});
