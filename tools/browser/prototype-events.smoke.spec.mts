import { expect, type Page } from '@playwright/test';
import { test } from './prototype-fixture.mjs';

test.use({ timezoneId: 'America/New_York' });
const storeA = '10000000-0000-4000-8000-000000000001',
  storeB = '10000000-0000-4000-8000-000000000002';
const eventId = '60000000-0000-4000-8000-000000000001',
  list = `/stores/${storeA}/reference/events`,
  event = `${list}/${eventId}`;
async function choose(page: Page, label: string | RegExp, option: string) {
  await page
    .getByRole('combobox', { name: label, exact: typeof label === 'string' })
    .press('ArrowDown');
  await page.getByRole('option', { name: option, exact: true }).click();
}
test('a pending Prototype Event write keeps its captured store and leaves a new-store editor intact', async ({
  page,
  app,
}) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (typeof init?.body === 'string') {
        const body: unknown = JSON.parse(init.body);
        if (
          typeof body === 'object' &&
          body !== null &&
          'operationName' in body &&
          body.operationName === 'CreateReferenceEvent'
        ) {
          document.documentElement.dataset.holitaPendingStore =
            new Headers(init.headers).get('x-store-id') ?? '';
          await new Promise<void>((resolve) => {
            window.addEventListener(
              'holita-release-event',
              () => {
                resolve();
              },
              { once: true },
            );
          });
        }
      }
      return original(input, init);
    };
  });
  try {
    await page.goto(`${app.url}${list}/create`);
    await page.getByLabel('Title', { exact: true }).fill('Pending prototype forum');
    await page.getByLabel('Code', { exact: true }).fill('PENDING-PROTOTYPE');
    await choose(page, 'Format', 'Online');
    await page.getByRole('tab', { name: 'Schedule & location', exact: true }).click();
    for (const [label, value] of [
      ['Starts at', '2026-11-12T10:00'],
      ['Ends at', '2026-11-12T17:00'],
    ] as const) {
      await page.getByLabel(label, { exact: true }).fill(value);
      await page.getByLabel(label, { exact: true }).press('Tab');
    }
    await page.getByLabel('Meeting URL', { exact: true }).fill('https://example.com/forum');
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-holita-pending-store', storeA);
    await page.evaluate((store) => {
      window.history.pushState({}, '', `/stores/${store}/reference/events/create`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, storeB);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
    const response = page.waitForResponse((response) => {
      if (!response.url().endsWith('/__prototype/graphql')) return false;
      const body: unknown = response.request().postDataJSON();
      return (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        body.operationName === 'CreateReferenceEvent'
      );
    });
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-event')));
    await response;
    await expect(page).toHaveURL(`${app.url}/stores/${storeB}/reference/events/create`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
    await expect(page.getByText('Event saved.', { exact: true })).toHaveCount(0);
    await page.goto(`${app.url}${list}`);
    await expect(
      page.getByRole('link', { name: 'Pending prototype forum', exact: true }),
    ).toBeVisible();
    await page.goto(`${app.url}/stores/${storeB}/reference/events`);
    await expect(
      page.getByRole('link', { name: 'Pending prototype forum', exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event('holita-release-event')));
  }
});
test('Prototype Event forms persist all sections and relations without a backend', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [],
    operations: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(app.url)) external.push(request.url());
    if (request.url().includes('/__prototype/graphql')) operations.push(request.postData() ?? '');
  });
  await page.goto(`${app.url}${list}`);
  await expect(page.getByRole('menuitem', { name: 'Events', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Prototype design forum');
  await page.getByLabel('Code', { exact: true }).fill('PROTOTYPE-DESIGN');
  await choose(page, 'Format', 'Hybrid');
  await page.getByRole('textbox', { name: /^Budget/ }).fill('1234.50');
  await page.getByRole('spinbutton', { name: /^Capacity/ }).fill('180');
  await page.getByRole('switch', { name: /^Featured/ }).click();
  await page.getByRole('tab', { name: 'Schedule & location', exact: true }).click();
  for (const [label, value] of [
    ['Starts at', '2026-11-12T10:00'],
    ['Ends at', '2026-11-12T17:00'],
    ['Registration opens', '2026-10-01'],
    ['Registration closes', '2026-11-12'],
  ] as const) {
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel(label, { exact: true }).press('Tab');
  }
  await choose(page, 'Venue', 'Conference center');
  await choose(page, /^Tags/, 'Conference');
  await page.getByLabel('Meeting URL', { exact: true }).fill('https://example.com/forum');
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill('A prototype for the full platform.');
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .fill('Program and practical discussions');
  await expect(
    page.getByText('Save the event before adding images.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(/reference\/events\/[0-9a-f-]+\/edit$/);
  const editorUrl = page.url();
  await page.reload();
  await expect(page.getByLabel('Code', { exact: true })).toHaveAttribute('readonly');
  await expect(page.getByRole('textbox', { name: /^Budget/ })).toHaveValue('1234.50');
  await page.getByRole('tab', { name: 'Schedule & location', exact: true }).click();
  await expect(page.getByLabel('Starts at', { exact: true })).toHaveValue('2026-11-12T10:00');
  await expect(page.getByRole('combobox', { name: 'Venue', exact: true })).toHaveValue(
    'Conference center',
  );
  await expect(page.locator('.MuiChip-root').filter({ hasText: 'Conference' })).toBeVisible();
  await page.getByRole('tab', { name: 'Content & media', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toContainText(
    'Program and practical discussions',
  );
  await page.screenshot({
    path: testInfo.outputPath('event-editor-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('event-editor-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await choose(page, 'Format', 'Online');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByText('A prototype for the full platform.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Event gallery', exact: true })).toBeVisible();
  await page.goto(editorUrl);
  await page.getByRole('tab', { name: 'Schedule & location', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Venue', exact: true })).toHaveCount(0);
  await page.goto(`${app.url}/stores/${storeB}/reference/events`);
  await expect(page.getByRole('link', { name: 'Prototype design forum', exact: true })).toHaveCount(
    0,
  );
  expect(operations.some((operation) => operation.includes('ListReferenceEventMedia'))).toBe(true);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test('Prototype Sessions persist speakers, schedule validation, draft cancel and explicit program order', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}${event}?tab=sessions`);
  const titles = () =>
    page.getByRole('list', { name: 'Event sessions' }).getByRole('heading').allTextContents();
  await expect
    .poll(titles)
    .toEqual(['Welcome and introductions', 'Practical workshop', 'Questions and next steps']);
  await page.getByRole('button', { name: 'Add session', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Prototype keynote');
  await page.getByLabel('Ends at', { exact: true }).fill('2026-11-10T20:00');
  await page.getByLabel('Ends at', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByText('Choose a time within the event.')).toBeVisible();
  await page.getByLabel('Ends at', { exact: true }).fill('2026-11-10T11:00');
  await page.getByLabel('Ends at', { exact: true }).press('Tab');
  await choose(page, /^Speakers/, 'Elena Petrova');
  await page.getByLabel('Title', { exact: true }).click();
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(
    page.getByRole('listitem', { name: 'Prototype keynote', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Move Prototype keynote up', exact: true }).click();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect
    .poll(titles)
    .toEqual([
      'Welcome and introductions',
      'Practical workshop',
      'Questions and next steps',
      'Prototype keynote',
    ]);
  await page.getByRole('button', { name: 'Move Prototype keynote up', exact: true }).click();
  await page.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(page.getByText('Session order saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect
    .poll(titles)
    .toEqual([
      'Welcome and introductions',
      'Practical workshop',
      'Prototype keynote',
      'Questions and next steps',
    ]);
  await page.screenshot({
    path: testInfo.outputPath('sessions-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Actions for Prototype keynote', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Edited keynote');
  await page.screenshot({
    path: testInfo.outputPath('session-editor-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByRole('listitem', { name: 'Edited keynote', exact: true })).toContainText(
    'Elena Petrova',
  );
  await page.getByRole('button', { name: 'Actions for Edited keynote', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await expect(page.getByRole('listitem', { name: 'Edited keynote', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  for (const name of [
    'Session created',
    'Session updated',
    'Session deleted',
    'Sessions reordered',
  ])
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('Prototype bulk status, Trash, restore and History retain the program across reload and reset', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${app.url}${list}`);
  const row = () => page.getByRole('row').filter({ hasText: 'Conference forum' });
  await row().getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Archive selected', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(row()).toContainText('Archived');
  await row().getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Trash selected', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await expect(page.getByRole('link', { name: 'Conference forum', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Trash', exact: true }).click();
  await page.reload();
  await page.getByRole('link', { name: 'Conference forum', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sessions', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByText('Moved to trash', { exact: true })).toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: 'Event updated' })
    .getByRole('button', { name: 'Expand row' })
    .click();
  await expect(page.getByText('After: ARCHIVED', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('history-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Restore event', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit event', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  await expect(
    page.getByRole('listitem', { name: 'Practical workshop', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('button', { name: 'Reset data', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/`);
  await page.goto(`${app.url}${event}?tab=history`);
  await expect(page.getByText('Event created', { exact: true })).toBeVisible();
  await expect(page.getByText('Event updated', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
