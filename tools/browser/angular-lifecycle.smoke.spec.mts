import { expect, type Page, type Request } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';
const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const eventId = '60000000-0000-4000-8000-000000000001';
const foreignId = '60000000-0000-4000-8000-000000000101';
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
  fails = false,
): Promise<unknown> {
  const response = await page.request.post(url, {
    headers: { 'x-store-id': storeA },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  if (fails) expect(result).toHaveProperty('errors');
  else expect(result).not.toHaveProperty('errors');
  return result;
}
async function confirm(page: Page, label: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: label, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function selectSeed(page: Page): Promise<void> {
  await page
    .getByRole('checkbox', { name: 'Select event Sofia Creative Forum', exact: true })
    .check();
}
async function snapshot(
  page: Page,
  testInfo: { outputPath: (name: string) => string },
  name: string,
): Promise<void> {
  await expect(page.getByRole('combobox', { name: /^(Store|Магазин)$/ })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath(name + '.png'),
    fullPage: !name.includes('dialog'),
  });
}

test('atomic lifecycle persists status, reserved Code and children through Trash/Restore with read-only History', async ({
  page,
  app,
}) => {
  await execute(
    page,
    app.gatewayUrl,
    'mutation($id:ID!){createReferenceSession(eventId:$id,input:{title:"Retained session",startsAt:"2026-11-12T08:30:00Z",endsAt:"2026-11-12T09:00:00Z"}){id}}',
    { id: eventId },
  );
  await page.goto(app.url + path);
  await selectSeed(page);
  await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
  await confirm(page, 'Publish');
  await expect(page.locator('tbody tr').filter({ hasText: 'Sofia Creative Forum' })).toContainText(
    'Published',
  );
  await selectSeed(page);
  await page.getByRole('button', { name: 'Trash selected', exact: true }).click();
  await confirm(page, 'Move to Trash');
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await expect(page).toHaveURL(/view=trash/);
  await page.reload();
  await expect(page.locator('tbody tr').filter({ hasText: 'Sofia Creative Forum' })).toContainText(
    'Published',
  );
  await page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('read-only');
  await expect(page.getByRole('link', { name: 'Edit event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Event overview', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'History', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.getByRole('cell', { name: 'Moved to Trash', exact: true })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Session created Retained session', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change details Event updated', exact: true }).click();
  await expect(page.locator('.history-changes')).toContainText('Published');
  await expect(page.locator('.history-changes')).toContainText('Draft');
  await execute(
    page,
    app.gatewayUrl,
    'mutation{createReferenceEvent(input:{title:"Duplicate code",code:"SOFIA-FORUM",format:ONLINE,meetingUrl:"https://example.com",startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T09:00:00Z"}){id}}',
    undefined,
    true,
  );
  await execute(
    page,
    app.gatewayUrl,
    'query($id:ID!){referenceSessions(eventId:$id){title}}',
    { id: eventId },
    true,
  );
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await confirm(page, 'Restore');
  await expect(page.getByRole('link', { name: 'Edit event', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Event restored', exact: true })).toBeVisible();
  expect(
    await execute(
      page,
      app.gatewayUrl,
      'query($id:ID!){referenceEvent(id:$id){status code deletedAt} referenceSessions(eventId:$id){title}}',
      { id: eventId },
    ),
  ).toMatchObject({
    data: {
      referenceEvent: { status: 'PUBLISHED', code: 'SOFIA-FORUM', deletedAt: null },
      referenceSessions: [{ title: 'Retained session' }],
    },
  });
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await confirm(page, 'Archive');
  await page.reload();
  await page.getByRole('tab', { name: 'Event overview', exact: true }).click();
  await expect(page.locator('dd').filter({ hasText: /^Archived$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Back to events', exact: true }).click();
  await expect(page).toHaveURL(app.url + path + '?view=trash');
  await page.getByRole('button', { name: 'Active events', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sofia Creative Forum', exact: true })).toBeVisible();
});

test('ineligible UI selection fails atomically, retains selection and retries; foreign and missing IDs cannot partially publish', async ({
  page,
  app,
}) => {
  await execute(
    page,
    app.gatewayUrl,
    'mutation{createReferenceEvent(input:{title:"Atomic companion",code:"ATOMIC-COMPANION",format:ONLINE,meetingUrl:"https://example.com",startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T09:00:00Z"}){id}}',
  );
  await page.goto(app.url + path);
  await expect(page.getByRole('link', { name: 'Atomic companion', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Select events on this page', exact: true }).check();
  // Change eligibility after selection, using the same dedicated fixture database.
  await execute(page, app.gatewayUrl, 'mutation($id:ID!){trashReferenceEvents(ids:[$id]){count}}', {
    id: eventId,
  });
  await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish', exact: true });
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('selection changed');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toBeFocused();
  await expect(
    page.getByRole('checkbox', { name: 'Select event Sofia Creative Forum', exact: true }),
  ).toBeChecked();
  expect(
    await execute(
      page,
      app.gatewayUrl,
      'query($id:ID!){referenceEvent(id:$id,includeDeleted:true){status} referenceEventHistory(eventId:$id){items{operation}}}',
      { id: eventId },
    ),
  ).toMatchObject({
    data: {
      referenceEvent: { status: 'DRAFT' },
      referenceEventHistory: { items: [{ operation: 'TRASHED' }] },
    },
  });
  expect(
    await execute(
      page,
      app.gatewayUrl,
      'query{referenceEvents(filter:{search:"ATOMIC-COMPANION"}){items{status}}}',
    ),
  ).toMatchObject({ data: { referenceEvents: { items: [{ status: 'DRAFT' }] } } });
  await execute(
    page,
    app.gatewayUrl,
    'mutation($id:ID!){restoreReferenceEvents(ids:[$id]){count}}',
    { id: eventId },
  );
  for (const other of [foreignId, '60000000-0000-4000-8000-000000000099']) {
    await execute(
      page,
      app.gatewayUrl,
      'mutation($ids:[ID!]!){setReferenceEventsStatus(ids:$ids,status:PUBLISHED){count}}',
      { ids: [eventId, other] },
      true,
    );
    expect(
      await execute(page, app.gatewayUrl, 'query($id:ID!){referenceEvent(id:$id){status}}', {
        id: eventId,
      }),
    ).toMatchObject({ data: { referenceEvent: { status: 'DRAFT' } } });
  }
  await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
  await confirm(page, 'Publish');
  await expect(page.locator('tbody')).toContainText('Published');
  await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toHaveCount(0);
  await selectSeed(page);
  await page.getByRole('columnheader', { name: 'Title', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole('checkbox', { name: 'Select event Sofia Creative Forum', exact: true }),
  ).not.toBeChecked();
});

test('History has no invented seed rows, pages recorded changes, strips HTML excerpts and recovers failed reads', async ({
  page,
  app,
}) => {
  await page.goto(app.url + path + `/${eventId}?tab=history`);
  await expect(page.getByRole('cell', { name: 'No recorded changes.', exact: true })).toBeVisible();
  const writes = Array.from(
    { length: 22 },
    (_, i) =>
      `e${String(i)}:updateReferenceEvent(id:"${eventId}",input:{title:"History event ${String(i)}",descriptionHtml:"<p>Excerpt ${String(i)} <strong>bold</strong></p>"}){id}`,
  ).join('\n');
  await execute(page, app.gatewayUrl, 'mutation{' + writes + '}');
  let fail = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (fail && operation(route.request(), 'AdminEventHistory')) {
      fail = false;
      await route.fulfill({
        json: {
          errors: [{ message: 'History unavailable', extensions: { requestId: 'history-retry' } }],
        },
      });
    } else await route.continue();
  });
  await page
    .getByRole('region', { name: 'History', exact: true })
    .getByRole('button', { name: 'Refresh', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('history-retry');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await page
    .getByRole('button', { name: 'Change details Event updated', exact: true })
    .first()
    .click();
  await expect(page.locator('.history-changes')).toContainText('Excerpt 21 bold');
  await expect(page.locator('.history-changes strong')).toHaveCount(0);
  await expect(page.locator('.history-changes')).not.toContainText('<p>');
  await expect(page.locator('tbody')).toContainText('Anonymous');
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.history-changes')).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.locator('tbody tr')).toHaveCount(20);
});

for (const destination of ['store', 'query'] as const) {
  test(`delayed bulk ${destination} navigation suppresses duplicate writes and obsolete completion`, async ({
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
    let calls = 0;
    await page.route(app.gatewayUrl, async (route) => {
      if (operation(route.request(), 'AdminSetEventsStatus')) {
        calls++;
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
      await page.goto(app.url + path);
      await selectSeed(page);
      await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Publish', exact: true })
        .getByRole('button', { name: 'Publish', exact: true })
        .dblclick();
      await held;
      await expect(
        page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }),
      ).toBeDisabled();
      // Native history navigation remains available while the modal locks its own controls.
      const next =
        destination === 'store' ? `/en/stores/${storeB}/reference/events` : path + '?sort=title';
      await page.evaluate((url) => {
        history.pushState({}, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, next);
      if (destination === 'store') {
        await expect(
          page.getByRole('link', { name: 'Plovdiv Culture Exchange', exact: true }),
        ).toBeVisible();
        await chooseStore(page, 'holita Sofia');
      }
      await expect(
        page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      release();
      await done;
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Publish selected', exact: true })).toHaveCount(
        0,
      );
      expect(calls).toBe(1);
      expect(
        await execute(page, app.gatewayUrl, 'query($id:ID!){referenceEvent(id:$id){status}}', {
          id: eventId,
        }),
      ).toMatchObject({ data: { referenceEvent: { status: 'PUBLISHED' } } });
    } finally {
      release();
    }
  });
}

test('Sakai lifecycle dialogs and expanded History fit Bulgarian desktop and narrow mobile in light/dark', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await execute(
    page,
    app.gatewayUrl,
    'mutation($id:ID!){updateReferenceEvent(id:$id,input:{descriptionHtml:"<p>Преди <strong>текст</strong></p>"}){id} setReferenceEventsStatus(ids:[$id],status:PUBLISHED){count}}',
    { id: eventId },
  );
  const bgPath = path.replace('/en/', '/bg/');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const dark of [false, true]) {
      await page.goto(app.url + bgPath);
      await expect(
        page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }),
      ).toBeVisible();
      if (((await page.locator('html').getAttribute('class')) ?? '').includes('app-dark') !== dark)
        await page
          .locator('.layout-topbar button')
          .filter({ has: page.locator('svg[data-p-icon="sun"],svg[data-p-icon="moon"]') })
          .click();
      await expect(page.locator('tbody svg[data-p-icon="eye"]')).toBeVisible();
      await expect(page.locator('tbody svg[data-p-icon="trash"]')).toBeVisible();
      await page
        .getByRole('checkbox', { name: 'Избери събитие Sofia Creative Forum', exact: true })
        .check();
      await snapshot(
        page,
        testInfo,
        `lifecycle-selection-${String(width)}-${dark ? 'dark' : 'light'}`,
      );
      await page.getByRole('button', { name: 'Премести избраните в кошчето', exact: true }).click();
      await expect(
        page.getByRole('dialog', { name: 'Премести в кошчето', exact: true }),
      ).toBeVisible();
      await snapshot(
        page,
        testInfo,
        `lifecycle-dialog-${String(width)}-${dark ? 'dark' : 'light'}`,
      );
      await expect(
        page.getByRole('dialog').getByRole('button', { name: 'Отказ', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('dialog').getByRole('button', { name: 'Отказ', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'Премести избраните в кошчето', exact: true }),
      ).toBeFocused();
      await page.goto(app.url + bgPath + `/${eventId}?tab=history`);
      await expect(page.getByRole('cell', { name: 'Обновено събитие', exact: true })).toHaveCount(
        2,
      );
      await page
        .getByRole('button', { name: 'Детайли на промяната Обновено събитие', exact: true })
        .last()
        .click();
      await expect(page.locator('.history-changes')).toContainText('Преди текст');
      await snapshot(
        page,
        testInfo,
        `lifecycle-history-${String(width)}-${dark ? 'dark' : 'light'}`,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }
  await execute(page, app.gatewayUrl, 'mutation($id:ID!){trashReferenceEvents(ids:[$id]){count}}', {
    id: eventId,
  });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const dark of [false, true]) {
      await page.goto(app.url + bgPath + `/${eventId}?view=trash`);
      await expect(page.getByRole('alert')).toContainText('само за четене');
      if (((await page.locator('html').getAttribute('class')) ?? '').includes('app-dark') !== dark)
        await page
          .locator('.layout-topbar button')
          .filter({ has: page.locator('svg[data-p-icon="sun"],svg[data-p-icon="moon"]') })
          .click();
      await snapshot(page, testInfo, `lifecycle-trash-${String(width)}-${dark ? 'dark' : 'light'}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('atomic Trash corrects an emptied last page; Restore selected keeps status and row Restore remains available', async ({
  page,
  app,
}) => {
  const creates = Array.from(
    { length: 11 },
    (_, i) =>
      `e${String(i)}:createReferenceEvent(input:{title:"Paged lifecycle ${String(i).padStart(2, '0')}",code:"PAGED-LIFECYCLE-${String(i)}",format:ONLINE,meetingUrl:"https://example.com",status:PUBLISHED,startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T09:00:00Z"}){id}`,
  ).join('\n');
  await execute(page, app.gatewayUrl, 'mutation{' + creates + '}');
  await page.goto(
    app.url + path + '?search=Paged&pageSize=10&sort=title&page=2&keep=yes#main-content',
  );
  await expect(page.getByRole('link', { name: 'Paged lifecycle 10', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Move to Trash Paged lifecycle 10', exact: true }).click();
  await confirm(page, 'Move to Trash');
  await expect(page).toHaveURL(
    app.url + path + '?search=Paged&pageSize=10&sort=title&keep=yes#main-content',
  );
  await expect(page.getByRole('link', { name: 'Paged lifecycle 00', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Select event Paged lifecycle 10', exact: true })
    .check();
  await page.getByRole('button', { name: 'Restore selected', exact: true }).click();
  await confirm(page, 'Restore');
  await expect(page.getByRole('link', { name: 'Paged lifecycle 10', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Active events', exact: true }).click();
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  const row = page.locator('tbody tr').filter({ hasText: 'Paged lifecycle 10' });
  await expect(row).toContainText('Published');
  await page.getByRole('button', { name: 'Move to Trash Paged lifecycle 10', exact: true }).click();
  await confirm(page, 'Move to Trash');
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Paged lifecycle 10', exact: true }).click();
  await confirm(page, 'Restore');
  await expect(page.getByRole('link', { name: 'Paged lifecycle 10', exact: true })).toHaveCount(0);
});
