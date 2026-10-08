import { expect } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';
import {
  prototypeOperation,
  prototypeStore,
  prototypeEvent,
  confirmPrototype,
} from './angular-prototype-fixture.mjs';

test.use({ dataSource: 'mock', referenceEnabled: false, timezoneId: 'America/New_York' });
const path = `/en/stores/${prototypeStore}/reference/events`;

test('backend-free Event editor, relations, exact EUR, rich text, reload, Sessions and History', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/graphql')) requests.push(request.url());
  });
  await page.goto(app.url + path + '?search=Prototype');
  await page.getByRole('link', { name: 'Create event', exact: true }).click();
  await page.locator('#event-title').fill('Prototype forum');
  await page.locator('#event-code').fill('PROTOTYPE-FORUM');
  await page.locator('#event-startsAt').fill('2026-11-12T10:00');
  await page.locator('#event-endsAt').fill('2026-11-12T18:00');
  await page.getByRole('textbox', { name: 'Budget (EUR)', exact: true }).fill('9999999999.99');
  await page.getByRole('textbox', { name: 'Capacity', exact: true }).fill('180');
  await page.getByRole('button', { name: 'Venue', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Venue', exact: true })
    .getByRole('option', { name: 'Conference center', exact: true })
    .click();
  await page.getByRole('button', { name: 'Tags', exact: true }).click();
  const tags = page.getByRole('dialog', { name: 'Tags', exact: true });
  await tags.getByRole('option', { name: 'Conference', exact: true }).click();
  await tags.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Rich description');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(/reference\/events\/[0-9a-f-]+\/edit\?/);
  const eventId = new URL(page.url()).pathname.split('/').at(-2);
  if (!eventId) throw new Error('Missing Event URL.');
  await page.goto(app.url + path + '/' + eventId + '?search=Prototype');
  await expect(page.getByRole('heading', { name: 'Prototype forum', exact: true })).toBeVisible();
  expect(await prototypeOperation(page, 'AdminEvent', { id: eventId })).toMatchObject({
    data: {
      referenceEvent: {
        budget: '9999999999.99',
        capacity: 180,
        startsAt: '2026-11-12T08:00:00.000Z',
        venue: { name: 'Conference center' },
        tags: [{ name: 'Conference' }],
        descriptionHtml: '<p>Rich description</p>',
      },
    },
  });
  await page.reload();
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  await page.getByRole('link', { name: 'Add session', exact: true }).click();
  await page.locator('#session-title').fill('Prototype keynote');
  await page.locator('#session-summary').fill('<b>Plain summary</b>');
  await page.locator('#session-room').fill('Main hall');
  await page.locator('#session-endsAt').fill('2026-11-12T11:00');
  await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  const speakers = page.getByRole('dialog', { name: 'Speakers', exact: true });
  await speakers.getByRole('option', { name: 'Elena Petrova', exact: true }).click();
  await speakers.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  const program = page.getByRole('list', { name: 'Event sessions', exact: true });
  await expect(program).toContainText('Prototype keynote');
  await expect(program).toContainText('<b>Plain summary</b>');
  expect(await program.locator('b').count()).toBe(0);
  await program.getByRole('link', { name: 'Edit session: Prototype keynote', exact: true }).click();
  await page.locator('#session-title').fill('Updated keynote');
  await page.locator('#session-room').fill('');
  await page.locator('#session-summary').fill('');
  await page.getByRole('button', { name: 'Clear Speakers', exact: true }).click();
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(program).toContainText('Updated keynote');
  await page.reload();
  await expect(program).toContainText('Updated keynote');
  expect(await prototypeOperation(page, 'AdminSessions', { eventId })).toMatchObject({
    data: {
      referenceSessions: [{ title: 'Updated keynote', room: null, summary: null, speakerIds: [] }],
    },
  });
  await page.getByRole('button', { name: 'Delete session: Updated keynote', exact: true }).click();
  await confirmPrototype(page, 'Delete session');
  await expect(
    program.getByRole('link', { name: 'Edit session: Updated keynote', exact: true }),
  ).toHaveCount(0);
  await expect(program).toContainText('No sessions yet.');
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Session deleted Updated keynote', exact: true }),
  ).toBeVisible();
  await chooseStore(page, 'holita Plovdiv');
  await expect(page).toHaveURL(/000000000002\/reference\/events$/);
  await expect(page.getByRole('link', { name: 'Prototype forum', exact: true })).toHaveCount(0);
  await chooseStore(page, 'holita Sofia');
  await page
    .getByRole('searchbox', { name: 'Search title or code', exact: true })
    .fill('Prototype forum');
  await expect(page.getByRole('link', { name: 'Prototype forum', exact: true })).toBeVisible();
  expect(requests.length).toBeGreaterThan(10);
  expect(requests.every((url) => url === app.url + '/__prototype/graphql')).toBe(true);
  expect(errors).toEqual([]);
});

test('atomic lifecycle rollback, Trash read-only children, restore, complete Session orders and paged History', async ({
  page,
  app,
}) => {
  await page.goto(app.url + path + '/' + prototypeEvent + '?tab=sessions');
  await expect(
    page.getByRole('list', { name: 'Event sessions', exact: true }).getByRole('listitem'),
  ).toHaveCount(3);
  const original = await prototypeOperation(page, 'AdminEvent', { id: prototypeEvent });
  expect(
    await prototypeOperation(page, 'AdminSetEventsStatus', {
      ids: [prototypeEvent, '60000000-0000-4000-8000-000000000101'],
      status: 'DRAFT',
    }),
  ).toHaveProperty('errors');
  expect(await prototypeOperation(page, 'AdminEvent', { id: prototypeEvent })).toEqual(original);
  await page.getByRole('button', { name: 'Move Practical workshop up', exact: true }).click();
  await page.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Event sessions', exact: true }).getByRole('listitem').first(),
  ).toHaveAttribute('aria-label', 'Practical workshop');
  expect(
    await prototypeOperation(page, 'AdminReorderSessions', {
      eventId: prototypeEvent,
      ids: ['70000000-0000-4000-8000-000000000001'],
    }),
  ).toHaveProperty('errors');
  await page.getByRole('tab', { name: 'Event overview', exact: true }).click();
  await page.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await confirmPrototype(page, 'Move to Trash');
  await expect(page.getByRole('tab', { name: 'Sessions', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(
    await prototypeOperation(page, 'AdminCreateSession', {
      eventId: prototypeEvent,
      input: { title: 'Denied', startsAt: '2026-11-10T10:00:00Z', endsAt: '2026-11-10T11:00:00Z' },
    }),
  ).toHaveProperty('errors');
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await confirmPrototype(page, 'Restore');
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Event sessions', exact: true }).getByRole('listitem').first(),
  ).toHaveAttribute('aria-label', 'Practical workshop');
  for (let index = 0; index < 22; index++)
    expect(
      await prototypeOperation(page, 'AdminUpdateEvent', {
        id: prototypeEvent,
        input: {
          title: 'History ' + String(index),
          descriptionHtml: '<p>Safe <strong>excerpt</strong></p>',
        },
      }),
    ).not.toHaveProperty('errors');
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await page
    .getByRole('button', { name: 'Change details Event updated', exact: true })
    .first()
    .click();
  await expect(page.locator('.history-changes')).not.toContainText('<p>');
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(6);
  expect(
    await prototypeOperation(page, 'AdminEventHistory', {
      eventId: prototypeEvent,
      offset: 20,
      limit: 20,
    }),
  ).toMatchObject({ data: { referenceEventHistory: { total: 26 } } });
});

test('delayed submitted Event action belongs to its retired store and Reset drains it', async ({
  page,
  app,
}) => {
  await page.goto(app.url + path + '/' + prototypeEvent);
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        body.operationName === 'AdminSetEventsStatus'
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
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Archive', exact: true })
    .getByRole('button', { name: 'Archive', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-held-write', 'yes');
  // The submitted action's modal locks pointer controls; native history can retire its route.
  await page.evaluate(() => {
    history.pushState({}, '', '/en/stores/10000000-0000-4000-8000-000000000002/reference/events');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Waiting for submitted changes');
  const reboot = page.waitForEvent('load');
  await page.evaluate(() => window.dispatchEvent(new Event('holita-test-release')));
  await reboot;
  await expect(page).toHaveURL(app.url + '/en');
  expect(await prototypeOperation(page, 'AdminEvent', { id: prototypeEvent })).toMatchObject({
    data: { referenceEvent: { status: 'PUBLISHED' } },
  });
});

test('delayed Event and Session reads cannot hydrate another store or parent across A → B → A', async ({
  page,
  app,
}) => {
  await page.goto(app.url + path);
  await expect(page.getByRole('link', { name: 'Conference forum', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    let held = false;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (
        !held &&
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        body.operationName === 'AdminEvent'
      ) {
        held = true;
        document.documentElement.dataset['heldRead'] = 'yes';
        await new Promise<void>((resolve) => {
          window.addEventListener(
            'holita-release-read',
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
  await page.getByRole('link', { name: 'View Conference forum', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-held-read', 'yes');
  await chooseStore(page, 'holita Plovdiv');
  await chooseStore(page, 'holita Sofia');
  await page.getByRole('link', { name: 'View Workshop forum', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Workshop forum', exact: true, level: 1 }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('holita-release-read')));
  await expect(
    page.getByRole('heading', { name: 'Workshop forum', exact: true, level: 1 }),
  ).toBeVisible();
  expect(
    await prototypeOperation(page, 'AdminUpdateSession', {
      eventId: '60000000-0000-4000-8000-000000000002',
      id: '70000000-0000-4000-8000-000000000004',
      input: { title: 'Retired program' },
    }),
  ).not.toHaveProperty('errors');
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    let held = false;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (
        !held &&
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        body.operationName === 'AdminSessions'
      ) {
        held = true;
        document.documentElement.dataset['heldSessions'] = 'yes';
        await new Promise<void>((resolve) => {
          window.addEventListener(
            'holita-release-sessions',
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
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-held-sessions', 'yes');
  await chooseStore(page, 'holita Plovdiv');
  await page.getByRole('link', { name: 'View Conference forum', exact: true }).click();
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  const program = page.getByRole('list', { name: 'Event sessions', exact: true });
  await expect(program).toContainText('Elena Petrova');
  await page.evaluate(() => window.dispatchEvent(new Event('holita-release-sessions')));
  await expect(page).toHaveURL(/000000000101\?tab=sessions$/);
  await expect(program.getByRole('listitem')).toHaveCount(3);
  await expect(program).not.toContainText('Retired program');
});
