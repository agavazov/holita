import { expect, type Page, type Request } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';
const storeA = '10000000-0000-4000-8000-000000000001';
const eventId = '60000000-0000-4000-8000-000000000001';
const venueId = '30000000-0000-4000-8000-000000000001';
const tagId = '40000000-0000-4000-8000-000000000001';
const path = `/en/stores/${storeA}/reference/events`;
function operation(request: Request, name: string): boolean {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
async function execute(
  page: Page,
  url: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const response = await page.request.post(url, {
    headers: { 'x-store-id': storeA },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  expect(result).not.toHaveProperty('errors');
  return result;
}
async function select(page: Page, name: string, value: string): Promise<void> {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}
async function paste(page: Page, html: string): Promise<void> {
  await page.locator('#event-descriptionHtml').evaluate((element, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/html', value);
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    );
  }, html);
}
async function capture(
  page: Page,
  testInfo: { outputPath: (name: string) => string },
  name: string,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath(name + '.png'),
    fullPage: !name.includes('lookup'),
  });
}

test.describe('disabled Event routes', () => {
  test.use({ referenceEnabled: false });
  test('blocks Event list/create/edit/overview without Event or relation requests', async ({
    page,
    app,
  }) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      if (
        request.url() === app.gatewayUrl &&
        request.method() === 'POST' &&
        ['AdminEvents', 'AdminEvent', 'AdminVenues', 'AdminTags'].some((name) =>
          operation(request, name),
        )
      )
        calls.push(request.url());
    });
    for (const suffix of ['', '/new', `/${eventId}/edit`, `/${eventId}`]) {
      await page.goto(app.url + path + suffix);
      await expect(page.getByRole('alert')).toHaveText(
        'Reference is unavailable. Products remains available.',
      );
    }
    expect(calls).toEqual([]);
  });
});

test('Event CRUD saves every field, exact EUR, rich paste and links, inactive relations, reload and explicit clearing', async ({
  page,
  app,
}, testInfo) => {
  await page.goto(app.url + path + '?search=Browser&pageSize=10&keep=yes#main-content');
  await page.getByRole('link', { name: 'Create event', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  const save = page.getByRole('button', { name: 'Save event', exact: true });
  await save.click();
  await expect(title).toBeFocused();
  await title.fill(' Browser event ');
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill('BROWSER-ONE');
  await select(page, 'Format', 'Hybrid');
  await page.getByRole('textbox', { name: 'Capacity', exact: true }).fill('180');
  await page.getByRole('textbox', { name: 'Budget (EUR)', exact: true }).fill('9999999999.99');
  await page.locator('#event-startsAt').fill('2026-11-12T10:00');
  await page.locator('#event-endsAt').fill('2026-11-12T18:00');
  await page.locator('#event-registrationOpensOn').fill('2026-11-01');
  await page.locator('#event-registrationClosesOn').fill('2026-11-11');
  await page.getByRole('button', { name: 'Venue', exact: true }).click();
  let popup = page.getByRole('dialog', { name: 'Venue', exact: true });
  await popup.getByRole('option', { name: 'The Glasshouse', exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Meeting URL', exact: true })
    .fill('https://example.com/meet');
  await page.getByRole('button', { name: 'Tags', exact: true }).click();
  popup = page.getByRole('dialog', { name: 'Tags', exact: true });
  await popup.getByRole('option', { name: 'Community', exact: true }).click();
  await popup.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Summary', exact: true }).fill('Plain summary');
  await page.getByRole('switch', { name: 'Featured', exact: true }).check();
  await select(page, 'Status', 'Published');
  const description = page.getByRole('textbox', { name: 'Description', exact: true });
  await description.focus();
  await paste(
    page,
    '<h2 style="color:red">Welcome</h2><p><b>Bold</b> <i>Italic</i><img src=x onerror=alert(1)><script>alert(1)</script> <a href="javascript:alert(1)">bad</a> <a href="https://user:pass@example.com">private</a><a href="https://example.com/info">Read</a></p><ul><li>One</li></ul><ol><li>Two</li></ol>',
  );
  await expect(description.locator('h2')).toHaveText('Welcome');
  await expect(
    description.locator('script,img,[style],a[href^="javascript"],a[href*="user:pass"]'),
  ).toHaveCount(0);
  await capture(page, testInfo, 'event-editor-desktop');
  await save.click();
  await expect(page).toHaveURL(
    new RegExp(
      '/reference/events/[0-9a-f-]+/edit\\?search=Browser&pageSize=10&keep=yes#main-content$',
    ),
  );
  const created = page.url().match(/events\/([^/]+)\/edit/);
  if (!created?.[1]) throw new Error('Missing created Event ID.');
  const id = created[1];
  await expect(title).toHaveValue('Browser event');
  await expect(page.locator('#event-code')).toHaveAttribute('readonly', '');
  const result = await execute(
    page,
    app.gatewayUrl,
    'query($id:ID!){referenceEvent(id:$id){title code status format capacity budget featured startsAt endsAt registrationOpensOn registrationClosesOn venueId meetingUrl tagIds summary descriptionHtml}}',
    { id },
  );
  expect(result).toMatchObject({
    data: {
      referenceEvent: {
        title: 'Browser event',
        code: 'BROWSER-ONE',
        status: 'PUBLISHED',
        format: 'HYBRID',
        capacity: 180,
        budget: '9999999999.99',
        featured: true,
        startsAt: '2026-11-12T08:00:00.000Z',
        endsAt: '2026-11-12T16:00:00.000Z',
        registrationOpensOn: '2026-11-01',
        registrationClosesOn: '2026-11-11',
        venueId,
        meetingUrl: 'https://example.com/meet',
        tagIds: [tagId],
        summary: 'Plain summary',
      },
    },
  });
  await execute(
    page,
    app.gatewayUrl,
    'mutation($venue:ID!,$tag:ID!){updateReferenceVenue(id:$venue,input:{active:false}){id} updateReferenceTag(id:$tag,input:{active:false}){id}}',
    { venue: venueId, tag: tagId },
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Venue', exact: true })).toContainText(
    'The Glasshouse (Inactive)',
  );
  await expect(page.getByRole('button', { name: 'Tags', exact: true })).toContainText(
    'Community (Inactive)',
  );
  await save.click();
  await expect(page).toHaveURL(
    app.url + path + `/${id}?search=Browser&pageSize=10&keep=yes#main-content`,
  );
  await expect(page.getByRole('heading', { name: 'Browser event', exact: true })).toBeVisible();
  await expect(page.getByText('12/11/2026, 10:00 +02:00', { exact: true })).toBeVisible();
  await expect(page.getByText('01/11/2026', { exact: true })).toBeVisible();
  await expect(page.locator('.event-description h2')).toHaveText('Welcome');
  await expect(page.locator('.event-description a[href="https://example.com/info"]')).toHaveText(
    'Read',
  );
  await capture(page, testInfo, 'event-overview-desktop');
  await page.getByRole('link', { name: 'Edit event', exact: true }).click();
  await expect(title).toHaveValue('Browser event');
  await select(page, 'Format', 'Online');
  await page.getByRole('textbox', { name: 'Budget (EUR)', exact: true }).fill('');
  await page.getByRole('textbox', { name: 'Capacity', exact: true }).fill('');
  await page.getByRole('textbox', { name: 'Summary', exact: true }).fill('');
  await page.locator('#event-registrationOpensOn').fill('');
  await page.locator('#event-registrationClosesOn').fill('');
  await page.getByRole('button', { name: 'Clear Tags', exact: true }).click();
  await description.fill('');
  await page.getByRole('switch', { name: 'Featured', exact: true }).uncheck();
  await save.click();
  await expect(page).toHaveURL(
    app.url + path + `/${id}?search=Browser&pageSize=10&keep=yes#main-content`,
  );
  expect(
    await execute(
      page,
      app.gatewayUrl,
      'query($id:ID!){referenceEvent(id:$id){capacity budget summary descriptionHtml featured venueId tagIds registrationOpensOn registrationClosesOn}}',
      { id },
    ),
  ).toMatchObject({
    data: {
      referenceEvent: {
        capacity: null,
        budget: null,
        summary: null,
        descriptionHtml: null,
        featured: false,
        venueId: null,
        tagIds: [],
        registrationOpensOn: null,
        registrationClosesOn: null,
      },
    },
  });
  await page.getByRole('link', { name: 'Back to events', exact: true }).click();
  await expect(page).toHaveURL(
    app.url + path + '?search=Browser&pageSize=10&keep=yes#main-content',
  );
  await expect(page.getByRole('link', { name: 'Browser event', exact: true })).toBeVisible();
});

test('remote Venue choices search and page without losing focus, hydrate inactive selections and retry failures', async ({
  page,
  app,
}, testInfo) => {
  const mutations = Array.from(
    { length: 23 },
    (_, index) =>
      `v${String(index)}:createReferenceVenue(input:{name:"Remote Venue ${String(index).padStart(2, '0')}",city:"Sofia",countryCode:"BG"}){id}`,
  ).join('\n');
  await execute(page, app.gatewayUrl, 'mutation{' + mutations + '}');
  await page.goto(app.url + path + `/${eventId}/edit`);
  await page.getByRole('button', { name: 'Venue', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Venue', exact: true });
  const search = popup.getByRole('searchbox', { name: 'Search choices', exact: true });
  await expect(search).toBeFocused();
  await search.fill('Remote Venue');
  await expect(popup.getByRole('option')).toHaveCount(20);
  await capture(page, testInfo, 'event-lookup-desktop');
  await popup.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(popup.getByRole('option')).toHaveCount(3);
  await popup.getByRole('option', { name: 'Remote Venue 20', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Venue', exact: true })).toContainText(
    'Remote Venue 20',
  );
  await page.getByRole('button', { name: 'Venue', exact: true }).click();
  let fail = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (fail && operation(route.request(), 'AdminVenues')) {
      fail = false;
      await route.fulfill({
        json: {
          errors: [{ message: 'Lookup unavailable', extensions: { requestId: 'lookup-retry' } }],
        },
      });
    } else await route.continue();
  });
  await search.fill('Remote Venue 22');
  await expect(popup.getByRole('alert')).toContainText('lookup-retry');
  await popup.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(popup.getByRole('option', { name: 'Remote Venue 22', exact: true })).toBeVisible();
  await popup.getByRole('option', { name: 'Remote Venue 22', exact: true }).click();
});

test('Event list keeps server filters, inclusive ranges, Back/Forward, sorting and per-store columns', async ({
  page,
  app,
}) => {
  const mutations = Array.from(
    { length: 24 },
    (_, i) =>
      `e${String(i)}:createReferenceEvent(input:{title:"List Event ${String(i).padStart(2, '0')}",code:"LIST-${String(i)}",format:ONLINE,meetingUrl:"https://example.com",status:${i % 2 ? 'PUBLISHED' : 'DRAFT'},capacity:${String(i + 1)},budget:"${String(i)}.10",featured:${i % 2 ? 'true' : 'false'},startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T09:00:00Z"}){id}`,
  ).join('\n');
  await execute(page, app.gatewayUrl, 'mutation{' + mutations + '}');
  await page.goto(app.url + path + '?search=List&pageSize=10&sort=title');
  await expect(page.getByRole('link', { name: 'List Event 00', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'List Event 10', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('link', { name: 'List Event 10', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: 'List Event 00', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('link', { name: 'List Event 10', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More filters', exact: true }).click();
  await page.locator('#event-filter-min').fill('20');
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByRole('link', { name: 'List Event 19', exact: true })).toBeVisible();
  const applied = page.url();
  await page.locator('#event-filter-max').fill('10');
  await expect(page.getByRole('alert')).toContainText('previous filters remain applied');
  expect(page.url()).toBe(applied);
  await page.locator('#event-filter-max').fill('22');
  await expect(page).toHaveURL(/max=22/);
  await page.locator('#event-filter-from').fill('2026-11-12');
  await page.locator('#event-filter-to').fill('2026-11-12');
  await expect(page.getByRole('link', { name: 'List Event 21', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Featured', exact: true }).click();
  await page.getByRole('option', { name: 'Yes', exact: true }).click();
  await expect(page.getByRole('link', { name: 'List Event 20', exact: true })).toHaveCount(0);
  await select(page, 'Sort events by', 'Budget (EUR)');
  await page.getByRole('button', { name: 'Ascending', exact: true }).click();
  await expect(page).toHaveURL(/sort=budget/);
  await expect(page).toHaveURL(/order=desc/);
  await expect(page.locator('tbody tr').first()).toContainText('List Event 21');
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Budget (EUR)', exact: true }).check();
  await expect(
    page.getByRole('columnheader', { name: 'Budget (EUR)', exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('columnheader', { name: 'Budget (EUR)', exact: false }),
  ).toBeVisible();
  await chooseStore(page, 'holita Plovdiv');
  await expect(page.getByRole('columnheader', { name: 'Budget (EUR)', exact: false })).toHaveCount(
    0,
  );
  await chooseStore(page, 'holita Sofia');
  await expect(
    page.getByRole('columnheader', { name: 'Budget (EUR)', exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters and columns', exact: true }).click();
  await expect(page).toHaveURL(app.url + path);
  await expect(page.getByRole('columnheader', { name: 'Budget (EUR)', exact: false })).toHaveCount(
    0,
  );
});

test('Event validation rejects Sofia gaps, budget rounding and oversized HTML; rich formatting, links and clearing stay editable', async ({
  page,
  app,
}) => {
  await page.goto(app.url + path + `/${eventId}/edit`);
  const save = page.getByRole('button', { name: 'Save event', exact: true });
  const description = page.getByRole('textbox', { name: 'Description', exact: true });
  await expect(page.locator('#event-title')).toHaveValue('Sofia Creative Forum');
  let writes = 0;
  page.on('request', (request) => {
    if (operation(request, 'AdminUpdateEvent')) writes++;
  });
  await page.getByRole('textbox', { name: 'Budget (EUR)', exact: true }).fill('1e2');
  await page.getByRole('button', { name: 'General', exact: true }).click();
  await save.click();
  await expect(page.locator('#event-budget')).toBeFocused();
  await page.locator('#event-budget').fill('123.45');
  await page.locator('#event-startsAt').fill('2026-03-29T03:30');
  await page.getByRole('button', { name: 'Schedule and location', exact: true }).click();
  await save.click();
  await expect(page.locator('#event-startsAt')).toBeFocused();
  await expect(page.locator('#event-startsAt-error')).toContainText('does not exist');
  await page.locator('#event-startsAt').fill('2026-11-12T10:00');
  await description.fill('я'.repeat(51201));
  await save.click();
  await expect(description).toBeFocused();
  await expect(page.locator('#event-descriptionHtml-error')).toContainText('100 KiB');
  expect(writes).toBe(0);
  await description.fill('Formatted text');
  await description.press('Control+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(description.locator('strong')).toHaveText('Formatted text');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(description.locator('strong')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(description.locator('strong')).toHaveText('Formatted text');
  await description.focus();
  await description.press('Control+a');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Link', exact: true });
  const url = dialog.getByRole('textbox', { name: 'Link address', exact: true });
  await url.fill('https://user:pass@example.com');
  await dialog.getByRole('button', { name: 'Apply link', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('without credentials');
  await url.fill('https://example.com/docs');
  await dialog.getByRole('button', { name: 'Apply link', exact: true }).click();
  await expect(description.locator('a')).toHaveAttribute('href', 'https://example.com/docs');
  await save.click();
  await expect(page).toHaveURL(app.url + path + `/${eventId}`);
  await expect(page.locator('.event-description strong')).toHaveText('Formatted text');
  await page.reload();
  await expect(page.locator('.event-description a')).toHaveAttribute(
    'href',
    'https://example.com/docs',
  );
});

test('delayed Event reads are rejected during A → B → A and language changes', async ({
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
  let first = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (
      first &&
      operation(route.request(), 'AdminEvents') &&
      route.request().headers()['x-store-id'] === storeA
    ) {
      first = false;
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
    await expect(
      page.getByRole('link', { name: 'Plovdiv Culture Exchange', exact: true }),
    ).toBeVisible();
    release();
    await done;
    await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toHaveCount(
      0,
    );
    await chooseStore(page, 'holita Sofia');
    await expect(
      page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Български', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Събития', exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test('submitted Event writes retain scope, lock rich text and cannot change a new editor after A → B → A', async ({
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
    if (operation(route.request(), 'AdminUpdateEvent')) {
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
    await page.goto(app.url + path + `/${eventId}/edit`);
    const title = page.getByRole('textbox', { name: 'Title', exact: true });
    await expect(title).toHaveValue('Sofia Creative Forum');
    await title.fill('Captured Sofia event');
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await held;
    await expect(page.locator('#event-descriptionHtml')).toHaveAttribute(
      'contenteditable',
      'false',
    );
    await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled();
    await chooseStore(page, 'holita Plovdiv');
    await expect(
      page.getByRole('link', { name: 'Plovdiv Culture Exchange', exact: true }),
    ).toBeVisible();
    await chooseStore(page, 'holita Sofia');
    await page.getByRole('link', { name: 'Create event', exact: true }).click();
    await title.fill('Current Event draft');
    release();
    await done;
    await expect(page).toHaveURL(app.url + path + '/new');
    await expect(title).toHaveValue('Current Event draft');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(
      await execute(page, app.gatewayUrl, 'query($id:ID!){referenceEvent(id:$id){title}}', {
        id: eventId,
      }),
    ).toMatchObject({ data: { referenceEvent: { title: 'Captured Sofia event' } } });
  } finally {
    release();
  }
});

test('dirty Event forms protect store, Back and language navigation', async ({ page, app }) => {
  await page.goto(app.url + path);
  await page.getByRole('link', { name: 'Create event', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  await title.fill('Unsaved Event');
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
  await expect(title).toHaveValue('Unsaved Event');
  await page.getByRole('link', { name: 'Български', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(app.url + path.replace('/en/', '/bg/') + '/new');
  await expect(page.getByRole('textbox', { name: 'Заглавие', exact: true })).toHaveValue('');
});

test('Sakai Event list, all editor sections, overview and lookup fit BG desktop and narrow mobile in both themes', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await execute(
    page,
    app.gatewayUrl,
    'mutation($id:ID!){updateReferenceEvent(id:$id,input:{descriptionHtml:"<h2>Програма</h2><p>Текст със <strong>съдържание</strong> и <a href=\\"https://example.com\\">връзка</a>.</p>",summary:"Събитие в София",tagIds:["40000000-0000-4000-8000-000000000001"]}){id}}',
    { id: eventId },
  );
  const bgPath = path.replace('/en/', '/bg/');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const dark of [false, true]) {
      for (const [suffix, label] of [
        ['', 'list'],
        [`/${eventId}/edit`, 'editor'],
        [`/${eventId}`, 'overview'],
      ] as const) {
        await page.goto(app.url + bgPath + suffix);
        await expect(
          page.getByRole('heading', {
            name:
              label === 'list'
                ? 'Събития'
                : label === 'editor'
                  ? 'Редактиране на събитие'
                  : 'Sofia Creative Forum',
            exact: true,
          }),
        ).toBeVisible();
        if (
          ((await page.locator('html').getAttribute('class')) ?? '').includes('app-dark') !== dark
        )
          await page
            .locator('.layout-topbar button')
            .filter({ has: page.locator('svg[data-p-icon="sun"],svg[data-p-icon="moon"]') })
            .click();
        if (label === 'list') {
          await expect(
            page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }),
          ).toBeVisible();
          await expect(page.getByRole('button', { name: 'Обнови', exact: true })).toBeEnabled();
          await expect(page.locator('.p-datatable-mask')).toHaveCount(0);
        }
        if (label === 'editor') {
          await expect(page.locator('#event-title')).toHaveValue('Sofia Creative Forum');
          await expect(page.getByRole('button', { name: 'Място', exact: true })).toContainText(
            'The Glasshouse',
          );
          await expect(page.getByRole('button', { name: 'Етикети', exact: true })).toContainText(
            'Community',
          );
        }
        await capture(
          page,
          testInfo,
          `events-${label}-${String(width)}-${dark ? 'dark' : 'light'}`,
        );
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
        if (label === 'editor') {
          await page.getByRole('button', { name: 'Място', exact: true }).click();
          const popup = page.getByRole('dialog', { name: 'Място', exact: true });
          await expect(
            popup.getByRole('searchbox', { name: 'Търсене на опции', exact: true }),
          ).toBeFocused();
          await capture(
            page,
            testInfo,
            `events-lookup-${String(width)}-${dark ? 'dark' : 'light'}`,
          );
          await page.keyboard.press('Escape');
        }
      }
    }
  }
  expect(errors).toEqual([]);
});
