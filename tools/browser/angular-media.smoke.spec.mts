import { expect, type Page, type Request } from '@playwright/test';
import { chooseStore, test } from './angular-fixture.mjs';
const store = '10000000-0000-4000-8000-000000000001';
const eventId = '60000000-0000-4000-8000-000000000001';
const path = `/en/stores/${store}/reference/events/${eventId}`;
const bytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAIElEQVQ4jWMwjLtAFcQwapDhaBgZjqajuNEsEkd+OgAAcGAOn5aBl0EAAAAASUVORK5CYII=',
  'base64',
);
function operation(request: Request, name: string): boolean {
  const body: unknown = request.postDataJSON();
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function gallery(page: Page) {
  return page.getByRole('region', { name: 'Event gallery', exact: true });
}
function image(page: Page, name: string) {
  return gallery(page).getByRole('article', { name: `Image ${name}`, exact: true });
}
async function editor(page: Page, url: string) {
  await page.goto(url + path + '/edit?keep=yes#main-content');
  await expect(gallery(page)).toBeVisible();
  await expect(gallery(page).getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
}
async function upload(page: Page, name: string) {
  await gallery(page)
    .locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: bytes });
  await expect(image(page, name)).toBeVisible();
  await expect(gallery(page).getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
}
test('gallery saves bytes, alt null clearing, cover/order/removal and History independently from dirty Event fields', async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await editor(page, app.url);
  await page.locator('#event-title').fill('My unsaved Event title');
  await upload(page, 'first.png');
  await upload(page, 'second.png');
  await expect(page.locator('#event-title')).toHaveValue('My unsaved Event title');
  await expect(image(page, 'first.png').getByText('Cover', { exact: true })).toBeVisible();
  await image(page, 'second.png').getByRole('button', { name: 'Alt text', exact: true }).click();
  const alt = page.getByRole('dialog', { name: 'Alt text', exact: true });
  await alt
    .getByRole('textbox', { name: 'Alt text', exact: true })
    .fill(' A blue conference hall ');
  await alt.getByRole('button', { name: 'Save alt text', exact: true }).click();
  await expect(alt).toHaveCount(0);
  await image(page, 'second.png').getByRole('button', { name: 'Set cover', exact: true }).click();
  await expect(image(page, 'second.png').getByText('Cover', { exact: true })).toBeVisible();
  await gallery(page).getByRole('button', { name: 'Move second.png earlier', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeDisabled();
  await gallery(page).getByRole('button', { name: 'Save image order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeEnabled();
  await expect(gallery(page).getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  const trigger = image(page, 'second.png').getByRole('button', {
    name: 'Preview second.png',
    exact: true,
  });
  await trigger.click();
  await expect(
    page
      .getByRole('dialog', { name: 'second.png', exact: true })
      .getByRole('img', { name: 'A blue conference hall', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'first.png', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await image(page, 'second.png').getByRole('button', { name: 'Alt text', exact: true }).click();
  await alt.getByRole('textbox', { name: 'Alt text', exact: true }).fill(' ');
  await alt.getByRole('button', { name: 'Save alt text', exact: true }).click();
  await expect(alt).toHaveCount(0);
  await expect(
    image(page, 'second.png').getByRole('img', { name: 'second.png', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(eventId + '\\?'));
  await expect(gallery(page).getByRole('article')).toHaveCount(2);
  await page.reload();
  await expect(gallery(page).getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  const saved = image(page, 'second.png').getByRole('img');
  await expect
    .poll(() =>
      saved.evaluate(
        (element) => element instanceof HTMLImageElement && element.naturalWidth === 24,
      ),
    )
    .toBe(true);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Gallery reordered', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit event', exact: true }).click();
  const removal = image(page, 'second.png').getByRole('button', { name: 'Remove', exact: true });
  await removal.click();
  const dialog = page.getByRole('dialog', { name: 'Remove image', exact: true });
  await page.keyboard.press('Escape');
  await expect(removal).toBeFocused();
  await removal.click();
  await dialog.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(image(page, 'second.png')).toHaveCount(0);
  await expect(image(page, 'first.png').getByText('Cover', { exact: true })).toBeVisible();
  await page.reload();
  await expect(gallery(page).getByRole('article')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('gallery drag/dirty guard and atomic order conflict retain the complete draft and reload current membership', async ({
  page,
  app,
}) => {
  await editor(page, app.url);
  await upload(page, 'first.png');
  await upload(page, 'second.png');
  await gallery(page)
    .getByRole('button', { name: 'Drag second.png', exact: true })
    .dragTo(image(page, 'first.png'));
  await expect(
    gallery(page).getByRole('button', { name: 'Save image order', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(gallery(page).getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  let fail = true;
  await page.route(app.gatewayUrl, async (route) => {
    if (fail && operation(route.request(), 'AdminReorderMedia')) {
      fail = false;
      await route.fulfill({ json: { errors: [{ message: 'Order retry requested' }] } });
    } else await route.continue();
  });
  await gallery(page).getByRole('button', { name: 'Save image order', exact: true }).click();
  await expect(
    gallery(page).getByRole('alert').filter({ hasText: 'Order retry requested' }),
  ).toBeVisible();
  await expect(gallery(page).getByRole('article').first()).toHaveAttribute(
    'aria-label',
    'Image second.png',
  );
  await gallery(page).getByRole('button', { name: 'Save image order', exact: true }).click();
  await expect(
    gallery(page).getByRole('button', { name: 'Save image order', exact: true }),
  ).toHaveCount(0);
  await gallery(page).getByRole('button', { name: 'Move first.png earlier', exact: true }).click();
  const removed = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': store },
    data: {
      query: 'query($event: ID!){referenceEventMedia(eventId:$event){id originalName}}',
      variables: { event: eventId },
    },
  });
  const body: unknown = await removed.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    typeof body.data !== 'object' ||
    body.data === null ||
    !('referenceEventMedia' in body.data) ||
    !Array.isArray(body.data.referenceEventMedia)
  )
    throw new Error('Missing gallery');
  const row: unknown = body.data.referenceEventMedia.find(
    (candidate: unknown) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'originalName' in candidate &&
      candidate.originalName === 'second.png',
  );
  if (typeof row !== 'object' || row === null || !('id' in row) || typeof row.id !== 'string')
    throw new Error('Missing image');
  const deleted = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': store },
    data: {
      query: 'mutation($event: ID!,$id: ID!){deleteReferenceEventMedia(eventId:$event,id:$id)}',
      variables: { event: eventId, id: row.id },
    },
  });
  expect(await deleted.json()).not.toHaveProperty('errors');
  await gallery(page).getByRole('button', { name: 'Save image order', exact: true }).click();
  await expect(
    gallery(page).getByRole('alert').filter({ hasText: 'gallery changed' }),
  ).toBeVisible();
  await expect(gallery(page).getByRole('article')).toHaveCount(2);
  await gallery(page).getByRole('button', { name: 'Cancel image order', exact: true }).click();
  await expect(gallery(page).getByRole('article')).toHaveCount(1);
});
test('rejects invalid files and decoder failures, retries and blocks an eleventh saved image', async ({
  page,
  app,
}) => {
  await editor(page, app.url);
  const input = gallery(page).locator('input[type=file]');
  for (const file of [
    { name: 'bad.gif', mimeType: 'image/gif', buffer: bytes },
    { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]) {
    await input.setInputFiles(file);
    await expect(gallery(page).getByRole('alert')).toContainText('at most 5 MiB');
  }
  await input.setInputFiles({
    name: 'bad.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(gallery(page).getByRole('alert')).toContainText('upload was rejected');
  await expect(gallery(page).getByRole('article')).toHaveCount(0);
  for (let i = 0; i < 10; i++) {
    await input.setInputFiles({ name: `${String(i)}.png`, mimeType: 'image/png', buffer: bytes });
    await expect(image(page, `${String(i)}.png`)).toBeVisible();
    if (i < 9)
      await expect(
        gallery(page).getByRole('button', { name: 'Add image', exact: true }),
      ).toBeEnabled();
  }
  await expect(
    gallery(page).getByRole('button', { name: 'Add image', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(gallery(page).getByRole('article')).toHaveCount(10);
});
for (const destination of ['cancel', 'store', 'event'] as const) {
  test(`unfinished upload ${destination} cancels bytes or late intent without finalization`, async ({
    page,
    app,
  }) => {
    await editor(page, app.url);
    let release: () => void = () => {
      throw new Error('Missing upload gate');
    };
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured = false,
      finalized = 0;
    page.on('request', (request) => {
      if (request.url() === app.gatewayUrl && operation(request, 'AdminFinalizeUpload'))
        finalized++;
    });
    await page.route('**/media/uploads/*', async (route) => {
      captured = true;
      await gate;
      await route.abort().catch(() => undefined);
    });
    try {
      await gallery(page)
        .locator('input[type=file]')
        .setInputFiles({ name: 'cancelled.png', mimeType: 'image/png', buffer: bytes });
      await expect.poll(() => captured).toBe(true);
      if (destination === 'cancel')
        await gallery(page).getByRole('button', { name: 'Cancel upload', exact: true }).click();
      else if (destination === 'store') await chooseStore(page, 'holita Plovdiv');
      else await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      release();
      if (destination === 'cancel') {
        await expect(
          gallery(page).getByRole('button', { name: 'Add image', exact: true }),
        ).toBeEnabled();
        await expect(gallery(page).getByRole('article')).toHaveCount(0);
      } else if (destination === 'store') await expect(page).toHaveURL(/reference\/events$/);
      else await expect(page).toHaveURL(/reference\/events\?/);
      expect(finalized).toBe(0);
    } finally {
      release();
    }
  });
}
test('submitted finalization retains store/Event and cannot affect a new A editor after A → B → A', async ({
  page,
  app,
}) => {
  await editor(page, app.url);
  let release: () => void = () => {
    throw new Error('Missing finalization gate');
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const captured: Request[] = [];
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminFinalizeUpload')) {
      captured.push(route.request());
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await gallery(page)
      .locator('input[type=file]')
      .setInputFiles({ name: 'late.png', mimeType: 'image/png', buffer: bytes });
    await expect.poll(() => captured.length === 1).toBe(true);
    await expect(
      gallery(page).getByRole('button', { name: 'Cancel upload', exact: true }),
    ).toBeDisabled();
    await chooseStore(page, 'holita Plovdiv');
    await chooseStore(page, 'holita Sofia');
    await page.getByRole('link', { name: 'Sofia Creative Forum', exact: true }).click();
    await expect(gallery(page)).toBeVisible();
    await page.locator('#event-title').fill('New A editor draft');
    const settled = page.waitForResponse((response) =>
      operation(response.request(), 'AdminFinalizeUpload'),
    );
    release();
    await settled;
    await expect(page.locator('#event-title')).toHaveValue('New A editor draft');
    await expect(page).toHaveURL(app.url + path + '/edit');
    await expect(gallery(page)).not.toContainText('Image saved.');
    expect(captured[0]?.headers()['x-store-id']).toBe(store);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await page.goto(app.url + path);
    await expect(image(page, 'late.png')).toBeVisible();
  } finally {
    release();
  }
});
test('submitted finalization settles in its original Event while another Event editor keeps its draft', async ({
  page,
  app,
}) => {
  const created = await page.request.post(app.gatewayUrl, {
    headers: { 'x-store-id': store },
    data: {
      query:
        'mutation{createReferenceEvent(input:{title:"Other gallery Event",code:"OTHER-GALLERY",format:ONLINE,meetingUrl:"https://example.com/meet",startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T16:00:00Z"}){id}}',
    },
  });
  expect(await created.json()).not.toHaveProperty('errors');
  await editor(page, app.url);
  let release: () => void = () => {
    throw new Error('Missing finalization gate');
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submitted = false;
  await page.route(app.gatewayUrl, async (route) => {
    if (operation(route.request(), 'AdminFinalizeUpload')) {
      const response = await route.fetch();
      submitted = true;
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await gallery(page)
      .locator('input[type=file]')
      .setInputFiles({ name: 'original-event.png', mimeType: 'image/png', buffer: bytes });
    await expect.poll(() => submitted).toBe(true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('link', { name: 'Other gallery Event', exact: true }).click();
    await expect(gallery(page)).toBeVisible();
    await page.locator('#event-title').fill('Other Event draft');
    const settled = page.waitForResponse((response) =>
      operation(response.request(), 'AdminFinalizeUpload'),
    );
    release();
    await settled;
    await expect(page.locator('#event-title')).toHaveValue('Other Event draft');
    await expect(gallery(page).getByRole('article')).toHaveCount(0);
    await expect(gallery(page)).not.toContainText('Image saved.');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await page.goto(app.url + path);
    await expect(image(page, 'original-event.png')).toBeVisible();
  } finally {
    release();
  }
});
test('expired/broken preview refresh, keyboard focus and Event Trash/Restore retain saved images', async ({
  page,
  app,
}) => {
  await editor(page, app.url);
  await upload(page, 'saved.png');
  await page.route('**/media/files/**', (route) =>
    route.fulfill({ status: 403, body: 'Expired link' }),
  );
  await page.reload();
  await expect(gallery(page)).toContainText('Image unavailable.');
  await page.unroute('**/media/files/**');
  await gallery(page).getByRole('button', { name: 'Refresh images', exact: true }).click();
  await expect(image(page, 'saved.png').getByRole('img')).toBeVisible();
  await page.goto(app.url + path);
  await page.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Move to Trash', exact: true })
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click();
  await expect(gallery(page)).toHaveCount(0);
  let trashReads = 0;
  const observe = (request: Request) => {
    if (request.url() === app.gatewayUrl && operation(request, 'AdminMedia')) trashReads++;
  };
  page.on('request', observe);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
  expect(trashReads).toBe(0);
  page.off('request', observe);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Restore', exact: true })
    .getByRole('button', { name: 'Restore', exact: true })
    .click();
  await expect(image(page, 'saved.png')).toBeVisible();
});
test('Sakai Gallery, order/alt/delete dialogs and preview fit desktop/mobile light/dark', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await editor(page, app.url);
  await upload(page, 'Дълго име на снимка за събитие.png');
  await upload(page, 'Второ изображение.png');
  for (const width of [1280, 390, 320])
    for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.goto(app.url + path.replace('/en/', '/bg/') + '/edit');
      const region = page.getByRole('region', { name: 'Галерия на събитието', exact: true });
      await expect(region.getByRole('article')).toHaveCount(2);
      if (
        (await page
          .locator('html')
          .evaluate((element) => element.classList.contains('app-dark'))) !== dark
      )
        await page
          .getByRole('button', {
            name: dark ? 'Включи тъмна тема' : 'Включи светла тема',
            exact: true,
          })
          .click();
      const capture = async (state: string, overlay = false) => {
        await page.evaluate(() => document.fonts.ready);
        if (!overlay)
          await page.evaluate(() => {
            window.scrollTo(0, 0);
          });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`${state}-${String(width)}-${dark ? 'dark' : 'light'}.png`),
          animations: 'disabled',
          fullPage: !overlay,
        });
      };
      await capture('gallery');
      let releaseUpload: () => void = () => {
        throw new Error('Missing visual upload gate');
      };
      const uploadGate = new Promise<void>((resolve) => {
        releaseUpload = resolve;
      });
      await page.route('**/media/uploads/*', async (route) => {
        await uploadGate;
        await route.abort().catch(() => undefined);
      });
      try {
        await region
          .locator('input[type=file]')
          .setInputFiles({ name: 'Текущо качване.png', mimeType: 'image/png', buffer: bytes });
        await expect(
          region.getByRole('progressbar', { name: 'Прогрес на качването', exact: true }),
        ).toBeVisible();
        await capture('upload-progress');
        await region.getByRole('button', { name: 'Откажи качването', exact: true }).click();
      } finally {
        releaseUpload();
      }
      await page.unroute('**/media/uploads/*');
      await region
        .getByRole('button', { name: 'Премести Второ изображение.png по-рано', exact: true })
        .click();
      await capture('order-draft');
      await region
        .getByRole('button', { name: 'Откажи реда на изображенията', exact: true })
        .click();
      await expect(
        region.getByRole('button', { name: 'Добави изображение', exact: true }),
      ).toBeEnabled();
      const first = region.getByRole('article').first();
      await first.getByRole('button', { name: 'Алтернативен текст', exact: true }).click();
      await capture('alt-dialog', true);
      await page.keyboard.press('Escape');
      await first.getByRole('button', { name: 'Премахни', exact: true }).click();
      await capture('delete-dialog', true);
      await page.keyboard.press('Escape');
      await first.getByRole('button', { name: /^Преглед на/ }).click();
      await capture('preview', true);
      await page.keyboard.press('Escape');
    }
  expect(errors).toEqual([]);
});

test.describe('disabled Gallery routes', () => {
  test.use({ referenceEnabled: false });
  test('blocks saved editor/overview and new Event without Media operations', async ({
    page,
    app,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (
        request.url() === app.gatewayUrl &&
        [
          'AdminMedia',
          'AdminUploadIntent',
          'AdminFinalizeUpload',
          'AdminUpdateMedia',
          'AdminDeleteMedia',
          'AdminMediaCover',
          'AdminReorderMedia',
        ].some((name) => operation(request, name))
      )
        requests.push(request.url());
    });
    for (const suffix of ['', '/edit']) {
      await page.goto(app.url + path + suffix);
      await expect(page.getByRole('alert')).toHaveText(
        'Reference is unavailable. Products remains available.',
      );
      await expect(gallery(page)).toHaveCount(0);
    }
    await page.goto(app.url + path.replace(eventId, 'new'));
    await expect(page.getByRole('alert')).toHaveText(
      'Reference is unavailable. Products remains available.',
    );
    expect(requests).toEqual([]);
  });
});
