import { expect, type Page, type Request } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const eventId = '60000000-0000-4000-8000-000000000001';
const speakersPath = `/en/stores/${storeA}/reference/speakers`;
const tagsPath = `/en/stores/${storeA}/reference/tags`;

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
  gatewayUrl: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const response = await page.request.post(gatewayUrl, {
    headers: { 'x-store-id': storeA },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  expect(result).not.toHaveProperty('errors');
  return result;
}

function resultId(result: unknown, field: string): string {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('data' in result) ||
    typeof result.data !== 'object' ||
    result.data === null ||
    !(field in result.data)
  )
    throw new Error('Missing mutation data.');
  const record: unknown = Reflect.get(result.data, field);
  if (
    typeof record !== 'object' ||
    record === null ||
    !('id' in record) ||
    typeof record.id !== 'string'
  )
    throw new Error('Missing mutation ID.');
  return record.id;
}

test.describe('disabled lookup routes', () => {
  test.use({ referenceEnabled: false });
  test('disabled Reference blocks all lookup routes without business requests and keeps Products usable', async ({
    page,
    app,
  }) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.url() !== app.gatewayUrl || request.method() !== 'POST') return;
      const body: unknown = request.postDataJSON();
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        typeof body.operationName === 'string' &&
        /^Admin(?:Speaker|Tag)/.test(body.operationName)
      )
        calls.push(body.operationName);
    });
    for (const path of [speakersPath, tagsPath]) {
      for (const suffix of ['', '/new', '/50000000-0000-4000-8000-000000000001/edit']) {
        await page.goto(app.url + path + suffix);
        await expect(page.getByRole('alert')).toHaveText(
          'Reference is unavailable. Products remains available.',
        );
        await expect(page.locator('holita-admin-navigation a[href*="/reference/"]')).toHaveCount(0);
      }
    }
    expect(calls).toEqual([]);
    await page.locator('aside').getByRole('link', { name: 'Products', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toBeVisible();
  });
});

test('Speaker CRUD validates email, clears nullable fields, preserves false and list context, and persists through reload', async ({
  page,
  app,
}) => {
  await page.goto(app.url + speakersPath + '?search=Browser&pageSize=10&keep=yes#main-content');
  await page.getByRole('link', { name: 'Create speaker', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  const biography = page.getByRole('textbox', { name: 'Short biography', exact: true });
  const save = page.getByRole('button', { name: 'Save speaker', exact: true });
  await save.click();
  await expect(name).toBeFocused();
  await name.fill(' Browser speaker ');
  await email.fill('invalid');
  await save.click();
  await expect(email).toBeFocused();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await email.fill(' speaker@example.com ');
  await biography.fill(' Biography ');
  await save.click();
  await expect(page).toHaveURL(
    app.url + speakersPath + '?search=Browser&pageSize=10&keep=yes#main-content',
  );
  await page.getByRole('link', { name: 'Browser speaker', exact: true }).click();
  await expect(email).toHaveValue('speaker@example.com');
  await expect(biography).toHaveValue('Biography');
  await email.fill('');
  await biography.fill(' ');
  await page.getByRole('switch', { name: 'Active', exact: true }).uncheck();
  await save.click();
  await expect(page).toHaveURL(
    app.url + speakersPath + '?search=Browser&pageSize=10&keep=yes#main-content',
  );
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'Browser speaker' })).toContainText(
    'Inactive',
  );
  await page.getByRole('link', { name: 'Browser speaker', exact: true }).click();
  await expect(email).toHaveValue('');
  await expect(biography).toHaveValue('');
  await expect(page.getByRole('switch', { name: 'Active', exact: true })).not.toBeChecked();
  const result = await execute(
    page,
    app.gatewayUrl,
    '{referenceSpeakers(search:"Browser"){items{name email shortBio active}}}',
  );
  expect(result).toMatchObject({
    data: {
      referenceSpeakers: {
        items: [{ name: 'Browser speaker', email: null, shortBio: null, active: false }],
      },
    },
  });
  await page.getByRole('link', { name: 'Back to speakers', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Browser speaker', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete speakers', exact: true })
    .click();
  await expect(page.getByText('Deleted speakers: 1.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Browser speaker', exact: true })).toHaveCount(0);
});

test('Tag CRUD validates HEX, previews and normalizes color, focuses a duplicate name error, and persists updates', async ({
  page,
  app,
}) => {
  await page.goto(app.url + tagsPath + '/new');
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  const color = page.getByRole('textbox', { name: 'Color', exact: true });
  const save = page.getByRole('button', { name: 'Save tag', exact: true });
  await name.fill('Community');
  await color.fill('#abc');
  await save.click();
  await expect(color).toBeFocused();
  await expect(page.locator('#tag-color-error')).toContainText('six-digit HEX color');
  await color.fill(' #ABCDEF ');
  const preview = page.getByRole('group', { name: 'Color preview', exact: true });
  await expect(preview).toContainText('#abcdef');
  await expect(preview.locator('.color-swatch')).toHaveCSS(
    'background-color',
    'rgb(171, 205, 239)',
  );
  await save.click();
  await expect(page.locator('#tag-name-error')).toContainText(
    'Name is already used in this store.',
  );
  await expect(name).toBeFocused();
  await expect(color).toHaveValue(' #ABCDEF ');
  await name.fill('Browser tag');
  await save.click();
  await page.getByRole('link', { name: 'Browser tag', exact: true }).click();
  await expect(color).toHaveValue('#abcdef');
  await color.fill('#123456');
  await page.getByRole('switch', { name: 'Active', exact: true }).uncheck();
  await save.click();
  await expect(page).toHaveURL(app.url + tagsPath);
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'Browser tag' })).toContainText('#123456');
  await expect(page.getByRole('row').filter({ hasText: 'Browser tag' })).toContainText('Inactive');
  const result = await execute(
    page,
    app.gatewayUrl,
    '{referenceTags(search:"Browser"){items{name color active}}}',
  );
  expect(result).toMatchObject({
    data: { referenceTags: { items: [{ name: 'Browser tag', color: '#123456', active: false }] } },
  });
  await page.getByRole('button', { name: 'Delete Browser tag', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete tags', exact: true })
    .click();
  await expect(page.getByText('Deleted tags: 1.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Browser tag', exact: true })).toHaveCount(0);
});

for (const resource of ['speakers', 'tags']) {
  const speaker = resource === 'speakers';
  const entity = speaker ? 'Speaker' : 'Tag';
  const path = speaker ? speakersPath : tagsPath;
  test(`${entity} server sorting, stable ties, URL filters and history preserve nullable email or color order`, async ({
    page,
    app,
  }) => {
    const ids: string[] = [];
    for (const [name, value, active] of [
      ['Sort Alpha', speaker ? 'a@example.com' : '#111111', true],
      ['Sort Beta', speaker ? 'a@example.com' : '#111111', true],
      ['Sort Last', speaker ? null : '#ffffff', false],
    ] as const) {
      const input = speaker ? { name, email: value, active } : { name, color: value, active };
      const result = await execute(
        page,
        app.gatewayUrl,
        `mutation($input:CreateReference${entity}Input!){createReference${entity}(input:$input){id}}`,
        { input },
      );
      ids.push(resultId(result, `createReference${entity}`));
    }
    await page.goto(
      app.url +
        path +
        `?search=Sort&pageSize=10&sort=${speaker ? 'email' : 'color'}&order=asc&keep=yes#main-content`,
    );
    const ties = ids.slice(0, 2).sort().reverse();
    await expect(page.locator('tbody .content-link')).toHaveCount(3);
    expect(
      await page
        .locator('tbody .content-link')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')?.split('/').at(-2))),
    ).toEqual([...ties, ids[2]]);
    await page
      .getByRole('columnheader', { name: speaker ? 'Email' : 'Color', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`sort=${speaker ? 'email' : 'color'}&order=desc`));
    if (speaker) await expect(page.locator('tbody .content-link').last()).toHaveText('Sort Last');
    else await expect(page.locator('tbody .content-link').first()).toHaveText('Sort Last');
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    await page.getByRole('option', { name: 'Inactive', exact: true }).click();
    await expect(page.locator('tbody .content-link')).toHaveCount(1);
    await expect(page.locator('tbody .content-link')).toHaveText('Sort Last');
    await page.goBack();
    await expect(page.locator('tbody .content-link')).toHaveCount(3);
    await page.getByRole('searchbox', { name: `Search ${resource}`, exact: true }).fill('Missing');
    await expect(
      page.getByText(`No ${resource} match these filters.`, { exact: true }),
    ).toBeVisible();
  });

  test(`${entity} deletion preserves successes and retries a referenced row retained through Event Trash`, async ({
    page,
    app,
  }) => {
    const referencedId = speaker
      ? '50000000-0000-4000-8000-000000000001'
      : '40000000-0000-4000-8000-000000000001';
    const referencedName = speaker ? 'Alex Marin' : 'Community';
    let sessionId: string | undefined;
    if (speaker) {
      const result = await execute(
        page,
        app.gatewayUrl,
        'mutation($eventId:ID!,$input:CreateReferenceSessionInput!){createReferenceSession(eventId:$eventId,input:$input){id}}',
        {
          eventId,
          input: {
            title: 'Referenced speaker',
            startsAt: '2026-11-12T09:00:00Z',
            endsAt: '2026-11-12T10:00:00Z',
            speakerIds: [referencedId],
          },
        },
      );
      sessionId = resultId(result, 'createReferenceSession');
    } else
      await execute(
        page,
        app.gatewayUrl,
        'mutation($id:ID!,$input:UpdateReferenceEventInput!){updateReferenceEvent(id:$id,input:$input){id}}',
        { id: eventId, input: { tagIds: [referencedId] } },
      );
    await execute(
      page,
      app.gatewayUrl,
      'mutation($ids:[ID!]!){trashReferenceEvents(ids:$ids){count}}',
      { ids: [eventId] },
    );
    await execute(
      page,
      app.gatewayUrl,
      `mutation($input:CreateReference${entity}Input!){createReference${entity}(input:$input){id}}`,
      { input: speaker ? { name: 'Free row' } : { name: 'Free row', color: '#123456' } },
    );
    const writes: unknown[] = [];
    page.on('request', (request) => {
      if (request.url() === app.gatewayUrl && operation(request, `AdminDelete${entity}`))
        writes.push(request.postDataJSON());
    });
    await page.goto(app.url + path + '?sort=name&order=asc');
    await page.getByRole('checkbox', { name: `Select ${referencedName}`, exact: true }).check();
    await page.getByRole('checkbox', { name: 'Select Free row', exact: true }).check();
    await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: `Delete ${resource}`, exact: true }).click();
    await expect(
      page.getByText(`Deleted ${resource}: 1. Failed ${resource}: 1.`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Free row', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', { name: `Select ${referencedName}`, exact: true }),
    ).toBeChecked();
    await expect(page.getByRole('alert').filter({ hasText: 'still referenced' })).toContainText(
      /[0-9a-f-]{36}/,
    );
    expect(writes).toHaveLength(2);
    await execute(
      page,
      app.gatewayUrl,
      'mutation($ids:[ID!]!){restoreReferenceEvents(ids:$ids){count}}',
      { ids: [eventId] },
    );
    if (speaker)
      await execute(
        page,
        app.gatewayUrl,
        'mutation($eventId:ID!,$id:ID!){deleteReferenceSession(eventId:$eventId,id:$id){id}}',
        { eventId, id: sessionId },
      );
    else
      await execute(
        page,
        app.gatewayUrl,
        'mutation($id:ID!,$input:UpdateReferenceEventInput!){updateReferenceEvent(id:$id,input:$input){id}}',
        { id: eventId, input: { tagIds: [] } },
      );
    await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
    await dialog.getByRole('button', { name: `Delete ${resource}`, exact: true }).click();
    await expect(page.getByText(`Deleted ${resource}: 1.`, { exact: true })).toBeVisible();
    expect(writes).toHaveLength(3);
    expect(writes[2]).toMatchObject({ variables: { id: referencedId } });
    await page.reload();
    await expect(page.getByRole('link', { name: referencedName, exact: true })).toHaveCount(0);
  });
}

{
  const path = speakersPath;
  const studio = '50000000-0000-4000-8000-000000000001';
  test('Speaker delayed reads stay scoped through A → B → A and a language change', async ({
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
    let delayed = false;
    await page.route(app.gatewayUrl, async (route) => {
      if (
        !delayed &&
        operation(route.request(), 'AdminSpeakers') &&
        route.request().headers()['x-store-id'] === storeA
      ) {
        delayed = true;
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
      await expect(page).toHaveURL(app.url + path.replace(storeA, storeB));
      await expect(page.getByRole('link', { name: 'Mira Koleva', exact: true })).toBeVisible();
      release();
      await done;
      await expect(page.getByRole('link', { name: 'Alex Marin', exact: true })).toHaveCount(0);
      await chooseStore(page, 'holita Sofia');
      await expect(page.getByRole('link', { name: 'Alex Marin', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Български', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Лектори', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Alex Marin', exact: true })).toBeVisible();
    } finally {
      release();
    }
  });

  test('Speaker submitted write settles in its captured store without changing the new same-store editor', async ({
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
      if (operation(route.request(), 'AdminUpdateSpeaker')) {
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
      await page.goto(app.url + path + `/${studio}/edit`);
      const name = page.getByRole('textbox', { name: 'Name', exact: true });
      await expect(name).toHaveValue('Alex Marin');
      await name.fill('Captured Sofia write');
      await page.getByRole('button', { name: 'Save speaker', exact: true }).click();
      await held;
      await chooseStore(page, 'holita Plovdiv');
      await expect(page.getByRole('link', { name: 'Mira Koleva', exact: true })).toBeVisible();
      await chooseStore(page, 'holita Sofia');
      await page.getByRole('link', { name: 'Create speaker', exact: true }).click();
      await name.fill('Current unsaved draft');
      release();
      await done;
      await expect(page).toHaveURL(app.url + path + '/new');
      await expect(name).toHaveValue('Current unsaved draft');
      await expect(page.getByRole('alert')).toHaveCount(0);
      const response = await page.request.post(app.gatewayUrl, {
        headers: { 'x-store-id': storeA },
        data: {
          query: 'query($id:ID!){referenceSpeaker(id:$id){name}}',
          variables: { id: studio },
        },
      });
      const result: unknown = await response.json();
      expect(result).toMatchObject({
        data: { referenceSpeaker: { name: 'Captured Sofia write' } },
      });
    } finally {
      release();
    }
  });

  test('dirty Speaker forms guard store, same-store history and language navigation', async ({
    page,
    app,
  }) => {
    await page.goto(app.url + path);
    await page.getByRole('link', { name: 'Create speaker', exact: true }).click();
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('Unsaved Speaker');
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
    await expect(name).toHaveValue('Unsaved Speaker');
    await page.getByRole('link', { name: 'Български', exact: true }).click();
    await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveURL(app.url + path.replace('/en/', '/bg/') + '/new');
    await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue('');
  });

  test('Bulgarian Speakers list and editor fit narrow mobile viewports in light and dark themes', async ({
    page,
    app,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      for (const form of [false, true]) {
        await page.goto(app.url + path.replace('/en/', '/bg/') + (form ? '/new' : ''));
        await expect(
          page.getByRole('heading', { name: form ? 'Създай лектор' : 'Лектори', exact: true }),
        ).toBeVisible();
        if (!form)
          await expect(page.getByRole('link', { name: 'Alex Marin', exact: true })).toBeVisible();
        for (const dark of [false, true]) {
          if (
            (await page
              .locator('html')
              .evaluate((element) => element.classList.contains('app-dark'))) !== dark
          ) {
            await page.locator('.layout-topbar-actions button').click();
          }
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(
              `speakers-${form ? 'form' : 'list'}-${String(width)}-${dark ? 'dark' : 'light'}.png`,
            ),
            fullPage: true,
            animations: 'disabled',
          });
        }
      }
    }
    await page.getByRole('button', { name: 'Отвори или затвори навигацията', exact: true }).click();
    const navigation = page.locator('.p-drawer');
    await expect(navigation.getByRole('link', { name: 'Лектори', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.keyboard.press('Escape');
    await expect(navigation).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

{
  const path = tagsPath;
  const studio = '40000000-0000-4000-8000-000000000001';
  test('Tag delayed reads stay scoped through A → B → A and a language change', async ({
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
    let delayed = false;
    await page.route(app.gatewayUrl, async (route) => {
      if (
        !delayed &&
        operation(route.request(), 'AdminTags') &&
        route.request().headers()['x-store-id'] === storeA
      ) {
        delayed = true;
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
      await expect(page).toHaveURL(app.url + path.replace(storeA, storeB));
      await expect(page.getByRole('link', { name: 'Culture', exact: true })).toBeVisible();
      release();
      await done;
      await expect(page.getByRole('link', { name: 'Community', exact: true })).toHaveCount(0);
      await chooseStore(page, 'holita Sofia');
      await expect(page.getByRole('link', { name: 'Community', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Български', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Етикети', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Community', exact: true })).toBeVisible();
    } finally {
      release();
    }
  });

  test('Tag submitted write settles in its captured store without changing the new same-store editor', async ({
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
      if (operation(route.request(), 'AdminUpdateTag')) {
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
      await page.goto(app.url + path + `/${studio}/edit`);
      const name = page.getByRole('textbox', { name: 'Name', exact: true });
      await expect(name).toHaveValue('Community');
      await name.fill('Captured Sofia write');
      await page.getByRole('button', { name: 'Save tag', exact: true }).click();
      await held;
      await chooseStore(page, 'holita Plovdiv');
      await expect(page.getByRole('link', { name: 'Culture', exact: true })).toBeVisible();
      await chooseStore(page, 'holita Sofia');
      await page.getByRole('link', { name: 'Create tag', exact: true }).click();
      await name.fill('Current unsaved draft');
      release();
      await done;
      await expect(page).toHaveURL(app.url + path + '/new');
      await expect(name).toHaveValue('Current unsaved draft');
      await expect(page.getByRole('alert')).toHaveCount(0);
      const response = await page.request.post(app.gatewayUrl, {
        headers: { 'x-store-id': storeA },
        data: { query: 'query($id:ID!){referenceTag(id:$id){name}}', variables: { id: studio } },
      });
      const result: unknown = await response.json();
      expect(result).toMatchObject({ data: { referenceTag: { name: 'Captured Sofia write' } } });
    } finally {
      release();
    }
  });

  test('dirty Tag forms guard store, same-store history and language navigation', async ({
    page,
    app,
  }) => {
    await page.goto(app.url + path);
    await page.getByRole('link', { name: 'Create tag', exact: true }).click();
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('Unsaved Tag');
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
    await expect(name).toHaveValue('Unsaved Tag');
    await page.getByRole('link', { name: 'Български', exact: true }).click();
    await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveURL(app.url + path.replace('/en/', '/bg/') + '/new');
    await expect(page.getByRole('textbox', { name: 'Име', exact: true })).toHaveValue('');
  });

  test('Bulgarian Tags list and editor fit narrow mobile viewports in light and dark themes', async ({
    page,
    app,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      for (const form of [false, true]) {
        await page.goto(app.url + path.replace('/en/', '/bg/') + (form ? '/new' : ''));
        await expect(
          page.getByRole('heading', { name: form ? 'Създай етикет' : 'Етикети', exact: true }),
        ).toBeVisible();
        if (!form)
          await expect(page.getByRole('link', { name: 'Community', exact: true })).toBeVisible();
        for (const dark of [false, true]) {
          if (
            (await page
              .locator('html')
              .evaluate((element) => element.classList.contains('app-dark'))) !== dark
          ) {
            await page.locator('.layout-topbar-actions button').click();
          }
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(
              `tags-${form ? 'form' : 'list'}-${String(width)}-${dark ? 'dark' : 'light'}.png`,
            ),
            fullPage: true,
            animations: 'disabled',
          });
        }
      }
    }
    await page.getByRole('button', { name: 'Отвори или затвори навигацията', exact: true }).click();
    const navigation = page.locator('.p-drawer');
    await expect(navigation.getByRole('link', { name: 'Етикети', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.keyboard.press('Escape');
    await expect(navigation).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
