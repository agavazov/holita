import { expect, type Page, type Request } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';
const storeA = '10000000-0000-4000-8000-000000000001';
const eventId = '60000000-0000-4000-8000-000000000001';
const speakerId = '50000000-0000-4000-8000-000000000001';
const path = `/en/stores/${storeA}/reference/events/${eventId}`;
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
async function addSession(
  page: Page,
  url: string,
  title: string,
  speakers: string[] = [],
): Promise<string> {
  const result = await execute(
    page,
    url,
    'mutation($event:ID!,$input:CreateReferenceSessionInput!){createReferenceSession(eventId:$event,input:$input){id}}',
    {
      event: eventId,
      input: {
        title,
        startsAt: '2026-11-12T08:30:00Z',
        endsAt: '2026-11-12T09:00:00Z',
        summary: 'A practical session with a clear summary.',
        room: 'Main hall',
        speakerIds: speakers,
      },
    },
  );
  if (
    typeof result !== 'object' ||
    result === null ||
    !('data' in result) ||
    typeof result.data !== 'object' ||
    result.data === null ||
    !('createReferenceSession' in result.data)
  )
    throw new Error('Missing created Session.');
  const row: unknown = result.data.createReferenceSession;
  if (typeof row !== 'object' || row === null || !('id' in row) || typeof row.id !== 'string')
    throw new Error('Missing Session ID.');
  return row.id;
}
async function confirm(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
function program(page: Page) {
  return page.getByRole('list', { name: 'Event sessions', exact: true });
}
async function openProgram(page: Page, url: string): Promise<void> {
  await page.goto(url + path + '?tab=sessions&search=Sofia&keep=yes#main-content');
  await expect(page.getByRole('heading', { name: /^Sessions/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add session', exact: true })).toBeVisible();
}

test.use({ timezoneId: 'America/New_York' });
test('Session CRUD persists bounds, plain Summary, Speakers, null clearing, History and Event date protection', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openProgram(page, app.url);
  await page.getByRole('link', { name: 'Add session', exact: true }).click();
  await expect(page.locator('#session-startsAt')).toHaveValue('2026-11-12T10:00');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.locator('#session-title')).toBeFocused();
  await page.locator('#session-title').fill(' Opening keynote ');
  await page.locator('#session-summary').fill('<b>Plain text</b> and practical notes.');
  await page.locator('#session-room').fill(' Main hall ');
  await page.locator('#session-endsAt').fill('2026-11-12T20:00');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByText('Choose a time within the event.', { exact: true })).toBeVisible();
  await page.locator('#session-endsAt').fill('2026-11-12T11:00');
  await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Speakers', exact: true });
  await dialog.getByRole('option', { name: 'Alex Marin', exact: true }).click();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(eventId + '\\?'));
  await expect(
    program(page).getByRole('heading', { name: 'Opening keynote', exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get('keep')).toBe('yes');
  expect(new URL(page.url()).hash).toBe('#main-content');
  await page.reload();
  await expect(program(page)).toContainText('<b>Plain text</b>');
  expect(await program(page).locator('b').count()).toBe(0);
  const second = await addSession(page, app.gatewayUrl, 'Overlapping workshop', [speakerId]);
  await page.reload();
  await expect(program(page)).toContainText('Overlapping workshop');
  await page.getByRole('tab', { name: 'Event overview', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Speakers in the program', exact: true }),
  ).toContainText('Alex Marin');
  await expect(
    page
      .getByRole('region', { name: 'Speakers in the program', exact: true })
      .getByText('Alex Marin', { exact: true }),
  ).toHaveCount(1);
  await page.getByRole('link', { name: 'Edit event', exact: true }).click();
  await page.locator('#event-endsAt').fill('2026-11-12T10:30');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.locator('#event-endsAt-error')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await openProgram(page, app.url);
  await program(page)
    .getByRole('link', { name: 'Edit session: Opening keynote', exact: true })
    .click();
  await page.locator('#session-title').fill('Updated keynote');
  await page.locator('#session-summary').fill('');
  await page.locator('#session-room').fill('');
  await page.getByRole('button', { name: 'Clear Speakers', exact: true }).click();
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(program(page)).toContainText('Updated keynote');
  await page.reload();
  await expect(
    program(page).getByRole('listitem', { name: 'Updated keynote', exact: true }),
  ).not.toContainText('Main hall');
  await page
    .getByRole('button', { name: 'Delete session: Overlapping workshop', exact: true })
    .click();
  await confirm(page, 'Delete session');
  await expect(program(page)).not.toContainText('Overlapping workshop');
  expect(
    await execute(
      page,
      app.gatewayUrl,
      'query($event:ID!){referenceSessions(eventId:$event){title summary room speakerIds}}',
      { event: eventId },
    ),
  ).toMatchObject({
    data: {
      referenceSessions: [{ title: 'Updated keynote', summary: null, room: null, speakerIds: [] }],
    },
  });
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Session deleted Overlapping workshop', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Session updated Updated keynote', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Session created Opening keynote', exact: true }),
  ).toBeVisible();
  await execute(
    page,
    app.gatewayUrl,
    'query($event:ID!,$id:ID!){referenceSession(eventId:$event,id:$id){id}}',
    { event: eventId, id: second },
    true,
  );
  expect(errors).toEqual([]);
});

test('program drag/buttons, unsaved navigation, failed order retry and membership conflict keep the complete draft', async ({
  page,
  app,
}) => {
  const first = await addSession(page, app.gatewayUrl, 'Opening keynote'),
    second = await addSession(page, app.gatewayUrl, 'Workshop');
  await openProgram(page, app.url);
  const titles = () => program(page).getByRole('heading').allTextContents();
  await page
    .getByRole('button', { name: 'Drag Workshop', exact: true })
    .dragTo(program(page).getByRole('listitem', { name: 'Opening keynote', exact: true }));
  await expect.poll(titles).toEqual(['Workshop', 'Opening keynote']);
  await expect(page.getByRole('button', { name: 'Add session', exact: true })).toBeDisabled();
  await expect(program(page).getByRole('link')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Event overview', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page).toHaveURL(/tab=sessions/);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect.poll(titles).toEqual(['Opening keynote', 'Workshop']);
  await page.getByRole('button', { name: 'Move Workshop up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.order-notice')).toHaveText('Workshop moved to position 1.');
  let fail = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminReorderSessions') && fail) {
      fail = false;
      await route.fulfill({
        json: {
          errors: [
            {
              message: 'Temporary order failure',
              extensions: { code: 'SERVICE_UNAVAILABLE', requestId: 'order-retry' },
            },
          ],
        },
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'order-retry' })).toBeVisible();
  await expect.poll(titles).toEqual(['Workshop', 'Opening keynote']);
  await page.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(page.getByText('Session order saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect.poll(titles).toEqual(['Workshop', 'Opening keynote']);
  await page.getByRole('button', { name: 'Move Opening keynote up', exact: true }).click();
  await addSession(page, app.gatewayUrl, 'New member');
  await page.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'session list changed' })).toBeVisible();
  await expect.poll(titles).toEqual(['Opening keynote', 'Workshop']);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect.poll(titles).toEqual(['Workshop', 'Opening keynote', 'New member']);
  expect(
    await execute(
      page,
      app.gatewayUrl,
      'mutation($event:ID!,$ids:[ID!]!){reorderReferenceSessions(eventId:$event,ids:$ids){id}}',
      { event: eventId, ids: [first, second] },
      true,
    ),
  ).toHaveProperty('errors');
  await page.getByRole('button', { name: 'Move New member up', exact: true }).click();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Sessions reordered', exact: true })).toBeVisible();
});

test('Session Speaker picker hydrates inactive choices, rejects new inactive IDs, pages remotely and survives retry', async ({
  page,
  app,
}) => {
  const id = await addSession(page, app.gatewayUrl, 'Existing assignment', [speakerId]);
  await execute(
    page,
    app.gatewayUrl,
    'mutation($id:ID!){updateReferenceSpeaker(id:$id,input:{active:false}){id}}',
    { id: speakerId },
  );
  for (let i = 0; i < 22; i++)
    await execute(
      page,
      app.gatewayUrl,
      'mutation($name:String!){createReferenceSpeaker(input:{name:$name,active:true}){id}}',
      { name: `Remote ${String(i).padStart(2, '0')}` },
    );
  await page.goto(app.url + path + `/sessions/${id}/edit?keep=yes`);
  await expect(page.getByText('Alex Marin (Inactive)', { exact: true })).toBeVisible();
  await page.locator('#session-title').fill('Retained inactive');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(program(page)).toContainText('Alex Marin (Inactive)');
  await page.getByRole('link', { name: 'Add session', exact: true }).click();
  await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Speakers', exact: true });
  await dialog.getByRole('searchbox', { name: 'Search choices', exact: true }).fill('Remote');
  await expect(dialog.getByRole('option')).toHaveCount(20);
  await dialog.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(dialog.getByRole('option', { name: 'Remote 21', exact: true })).toBeVisible();
  await dialog.getByRole('option', { name: 'Remote 21', exact: true }).click();
  let fail = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminSpeakers') && fail) {
      fail = false;
      await route.fulfill({
        json: {
          errors: [{ message: 'Choices unavailable', extensions: { requestId: 'speaker-retry' } }],
        },
      });
    } else await route.continue();
  });
  await dialog.getByRole('searchbox', { name: 'Search choices', exact: true }).fill('Remote 00');
  await expect(dialog.getByRole('alert')).toContainText('speaker-retry');
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(dialog.getByRole('option', { name: 'Remote 00', exact: true })).toBeVisible();
  await dialog.getByRole('option', { name: 'Remote 00', exact: true }).click();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('holita-relation-picker')).toContainText('Remote 21');
  await expect(page.locator('holita-relation-picker')).toContainText('Remote 00');
  await execute(
    page,
    app.gatewayUrl,
    'mutation($event:ID!,$input:CreateReferenceSessionInput!){createReferenceSession(eventId:$event,input:$input){id}}',
    {
      event: eventId,
      input: {
        title: 'Rejected',
        startsAt: '2026-11-12T09:00:00Z',
        endsAt: '2026-11-12T09:30:00Z',
        speakerIds: [speakerId],
      },
    },
    true,
  );
});

for (const action of ['create', 'update', 'reorder'] as const) {
  test(`delayed Session ${action} captures parent/store and retires callbacks through A → B → A`, async ({
    page,
    app,
  }) => {
    const first = await addSession(page, app.gatewayUrl, 'Old keynote');
    await addSession(page, app.gatewayUrl, 'Old workshop');
    let release: () => void = () => {
      throw new Error('Missing write gate');
    };
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submitted: Request | undefined;
    let writes = 0;
    const name =
      action === 'create'
        ? 'AdminCreateSession'
        : action === 'update'
          ? 'AdminUpdateSession'
          : 'AdminReorderSessions';
    await page.route(app.gatewayUrl, async (route) => {
      if (operation(route.request(), name)) {
        submitted = route.request();
        writes++;
        const response = await route.fetch();
        await gate;
        await route.fulfill({ response });
      } else await route.continue();
    });
    try {
      await openProgram(page, app.url);
      if (action === 'reorder') {
        await page.getByRole('button', { name: 'Move Old workshop up', exact: true }).click();
        await page.getByRole('button', { name: 'Save order', exact: true }).dblclick();
      } else {
        if (action === 'create')
          await page.getByRole('link', { name: 'Add session', exact: true }).click();
        else
          await program(page)
            .getByRole('link', { name: 'Edit session: Old keynote', exact: true })
            .click();
        await page.locator('#session-title').fill('Captured write');
        if (action === 'create') await page.locator('#session-endsAt').fill('2026-11-12T11:00');
        await page.getByRole('button', { name: 'Save session', exact: true }).dblclick();
      }
      await expect.poll(() => Boolean(submitted)).toBe(true);
      expect(submitted?.headers()['x-store-id']).toBe(storeA);
      expect(submitted?.postDataJSON()).toMatchObject({ variables: { eventId } });
      await chooseStore(page, 'holita Plovdiv');
      await expect(page).toHaveURL(/reference\/events$/);
      await chooseStore(page, 'holita Sofia');
      await expect(page).toHaveURL(/reference\/events$/);
      const url = page.url();
      const settled = page.waitForResponse((response) => operation(response.request(), name));
      release();
      await settled;
      await expect(page).toHaveURL(url);
      expect(writes).toBe(1);
      await expect(page.getByText('Session saved.', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Session order saved.', { exact: true })).toHaveCount(0);
      if (action === 'update')
        expect(
          await execute(
            page,
            app.gatewayUrl,
            'query($event:ID!,$id:ID!){referenceSession(eventId:$event,id:$id){title}}',
            { event: eventId, id: first },
          ),
        ).toMatchObject({ data: { referenceSession: { title: 'Captured write' } } });
    } finally {
      release();
    }
  });
}

test('Session editor reads retire on Session ID changes, while Trash blocks children until Restore', async ({
  page,
  app,
}) => {
  const first = await addSession(page, app.gatewayUrl, 'First'),
    second = await addSession(page, app.gatewayUrl, 'Second');
  let release: () => void = () => {
    throw new Error('Missing read gate');
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = false;
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminSession') && !captured) {
      captured = true;
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.goto(app.url + path + `/sessions/${first}/edit`);
    await expect.poll(() => captured).toBe(true);
    await page.goto(app.url + path + `/sessions/${second}/edit`);
    await expect(page.locator('#session-title')).toHaveValue('Second');
    release();
    await expect(page.locator('#session-title')).toHaveValue('Second');
  } finally {
    release();
  }
  await execute(
    page,
    app.gatewayUrl,
    'mutation($ids:[ID!]!){trashReferenceEvents(ids:$ids){count}}',
    { ids: [eventId] },
  );
  const childCalls: string[] = [];
  page.on('request', (request) => {
    if (['AdminSessions', 'AdminSession', 'AdminSpeakers'].some((name) => operation(request, name)))
      childCalls.push(request.url());
  });
  await page.goto(app.url + path + '?tab=sessions');
  await expect(page.getByRole('tab', { name: 'Sessions', exact: true })).toBeDisabled();
  await expect(page.getByRole('list', { name: 'Event sessions' })).toHaveCount(0);
  await page.goto(app.url + path + `/sessions/${first}/edit`);
  await expect(page.getByRole('alert')).toContainText('Event not found');
  await expect(page.locator('form')).toHaveCount(0);
  expect(childCalls).toEqual([]);
  await execute(
    page,
    app.gatewayUrl,
    'mutation($ids:[ID!]!){restoreReferenceEvents(ids:$ids){count}}',
    { ids: [eventId] },
  );
  await openProgram(page, app.url);
  await expect(program(page)).toContainText('First');
  await expect(program(page)).toContainText('Second');
});

test('Sakai Session program/editor/Speaker overlay and summary match desktop/mobile light/dark without overflow', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await addSession(
    page,
    app.gatewayUrl,
    'Дълго заглавие на сесия за практическа работа и дискусии',
    [speakerId],
  );
  await addSession(page, app.gatewayUrl, 'Втора сесия с обсъждане на програмата', [speakerId]);
  for (const width of [1280, 390, 320])
    for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.goto(app.url + path.replace('/en/', '/bg/') + '?tab=sessions');
      await expect(page.getByRole('link', { name: 'Добави сесия', exact: true })).toBeVisible();
      const rootDark = await page
        .locator('html')
        .evaluate((element) => element.classList.contains('app-dark'));
      if (rootDark !== dark)
        await page
          .getByRole('button', {
            name: dark ? 'Включи тъмна тема' : 'Включи светла тема',
            exact: true,
          })
          .click();
      const capture = async (name: string) => {
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`${name}-${String(width)}-${dark ? 'dark' : 'light'}.png`),
          animations: 'disabled',
          fullPage: !name.includes('overlay') && !name.includes('dialog'),
        });
      };
      await capture('program');
      await page
        .getByRole('button', {
          name: 'Премести Втора сесия с обсъждане на програмата нагоре',
          exact: true,
        })
        .click();
      await capture('order-draft');
      await page.getByRole('button', { name: 'Откажи реда', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Добави сесия', exact: true })).toBeVisible();
      const deletion = page.getByRole('button', {
        name: 'Изтрий сесия: Дълго заглавие на сесия за практическа работа и дискусии',
        exact: true,
      });
      await deletion.click();
      await expect(page.getByRole('dialog', { name: 'Изтрий сесия', exact: true })).toBeVisible();
      await capture('delete-dialog');
      await page.keyboard.press('Escape');
      await expect(deletion).toBeFocused();
      await page.getByRole('link', { name: 'Добави сесия', exact: true }).click();
      await page.locator('#session-title').fill('Практическа сесия за общностите');
      await page.locator('#session-endsAt').fill('2026-11-12T11:00');
      await capture('editor');
      await page.getByRole('button', { name: 'Лектори', exact: true }).click();
      await expect(
        page
          .getByRole('dialog', { name: 'Лектори', exact: true })
          .getByRole('option', { name: 'Alex Marin', exact: true }),
      ).toBeVisible();
      await capture('speaker-overlay');
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: 'Към програмата', exact: true }).click();
      await page.getByRole('button', { name: 'Отхвърли промените', exact: true }).click();
      await page.getByRole('tab', { name: 'Преглед на събитие', exact: true }).click();
      await expect(
        page.getByRole('region', { name: 'Лектори в програмата', exact: true }),
      ).toContainText('Alex Marin');
      await capture('speaker-summary');
    }
  expect(errors).toEqual([]);
});

for (const destination of ['editor', 'parent'] as const) {
  test(`submitted Session write survives ${destination} navigation without obsolete invalidation or feedback`, async ({
    page,
    app,
  }) => {
    const first = await addSession(page, app.gatewayUrl, 'First'),
      second = await addSession(page, app.gatewayUrl, 'Second');
    let next = path + `/sessions/${second}/edit`;
    if (destination === 'parent') {
      const result = await execute(
        page,
        app.gatewayUrl,
        'mutation{createReferenceEvent(input:{title:"Other parent",code:"OTHER-PARENT",format:ONLINE,meetingUrl:"https://example.com",startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T16:00:00Z"}){id}}',
      );
      if (
        typeof result !== 'object' ||
        result === null ||
        !('data' in result) ||
        typeof result.data !== 'object' ||
        result.data === null ||
        !('createReferenceEvent' in result.data)
      )
        throw new Error('Missing parent.');
      const parent: unknown = result.data.createReferenceEvent;
      if (
        typeof parent !== 'object' ||
        parent === null ||
        !('id' in parent) ||
        typeof parent.id !== 'string'
      )
        throw new Error('Missing parent ID.');
      next = path.replace(eventId, parent.id) + '?tab=sessions';
    }
    let release: () => void = () => {
      throw new Error('Missing gate');
    };
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured = false;
    const name = destination === 'editor' ? 'AdminUpdateSession' : 'AdminReorderSessions';
    await page.route(app.gatewayUrl, async (route) => {
      if (operation(route.request(), name)) {
        captured = true;
        expect(route.request().postDataJSON()).toMatchObject({ variables: { eventId } });
        const response = await route.fetch();
        await gate;
        await route.fulfill({ response });
      } else await route.continue();
    });
    try {
      if (destination === 'editor') {
        await page.goto(app.url + path + `/sessions/${first}/edit`);
        await page.locator('#session-title').fill('Captured update');
        await page.getByRole('button', { name: 'Save session', exact: true }).click();
      } else {
        await openProgram(page, app.url);
        await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
        await page.getByRole('button', { name: 'Save order', exact: true }).click();
      }
      await expect.poll(() => captured).toBe(true);
      await page.evaluate((url) => {
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, app.url + next);
      if (destination === 'editor') {
        await expect(page.locator('#session-title')).toHaveValue('Second');
        await page.locator('#session-title').fill('New local draft');
      } else
        await expect(
          page.getByRole('heading', { name: 'Other parent', exact: true }),
        ).toBeVisible();
      const settled = page.waitForResponse((response) => operation(response.request(), name));
      release();
      await settled;
      await expect(page).toHaveURL(app.url + next);
      if (destination === 'editor')
        await expect(page.locator('#session-title')).toHaveValue('New local draft');
      else await expect(program(page)).not.toContainText('First');
      await expect(page.getByText('Session order saved.', { exact: true })).toHaveCount(0);
    } finally {
      release();
    }
  });
}

test.describe('disabled Session routes', () => {
  test.use({ referenceEnabled: false });
  test('blocks parent/program and direct Session editors without business requests', async ({
    page,
    app,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (
        ['AdminEvent', 'AdminSessions', 'AdminSession', 'AdminSpeakers'].some((name) =>
          operation(request, name),
        )
      )
        requests.push(request.url());
    });
    for (const suffix of [
      '?tab=sessions',
      '/sessions/new',
      '/sessions/70000000-0000-4000-8000-000000000001/edit',
    ]) {
      await page.goto(app.url + path + suffix);
      await expect(page.getByRole('alert')).toHaveText(
        'Reference is unavailable. Products remains available.',
      );
    }
    expect(requests).toEqual([]);
  });
});

test('submitted Session order refreshes History after leaving the program in the same Event scope', async ({
  page,
  app,
}) => {
  await addSession(page, app.gatewayUrl, 'First');
  await addSession(page, app.gatewayUrl, 'Second');
  let release: () => void = () => {
    throw new Error('Missing gate');
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = false;
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminReorderSessions')) {
      captured = true;
      await gate;
      const response = await route.fetch();
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await openProgram(page, app.url);
    await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
    await page.getByRole('button', { name: 'Save order', exact: true }).click();
    await expect.poll(() => captured).toBe(true);
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await expect(
      page.getByRole('cell', { name: 'Session created First', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sessions reordered', exact: true })).toHaveCount(
      0,
    );
    const settled = page.waitForResponse((response) =>
      operation(response.request(), 'AdminReorderSessions'),
    );
    release();
    await settled;
    await expect(page.getByRole('cell', { name: 'Sessions reordered', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/tab=history/);
    await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
    await expect
      .poll(() => program(page).getByRole('heading').allTextContents())
      .toEqual(['Second', 'First']);
  } finally {
    release();
  }
});
