import { expect } from '@playwright/test';
import { test } from './fixture.mjs';
import { test as prototypeTest } from './prototype-fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';

test('Bulgarian Products validates, saves and deletes while shell menus and dirty confirmation use the URL language', async ({
  page,
  app,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}/bg/stores/${storeA}/products`);
  await expect(
    page.getByRole('heading', { name: 'Продукти', level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Лектори', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('products-bg-desktop.png'),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Тема', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Тъмна', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-holita-color-scheme', 'dark');
  await page.getByRole('button', { name: 'Профил', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Предпочитания', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Това е примерен профил.');
  await page.getByRole('button', { name: 'Затвори', exact: true }).click();
  await page.getByRole('button', { name: 'Известия', exact: true }).click();
  const notifications = page.getByRole('dialog', { name: 'Примерни известия' });
  await expect(notifications).toContainText('Добре дошъл в работното си пространство в holita.');
  await notifications.getByRole('button', { name: 'Отбележи всички като прочетени' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Търси', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Търси в работното пространство' });
  await search.getByRole('textbox').fill('Продукти');
  await expect(search.getByRole('button', { name: /Продукти Работно пространство/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Създай продукт', exact: true }).click();
  await page.getByRole('button', { name: 'Запази продукта' }).click();
  await expect(page.getByText('Въведи име на продукта.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Име', { exact: true })).toBeFocused();
  await page.getByLabel('Име', { exact: true }).fill('Продукт за преглед');
  await page.getByLabel('SKU', { exact: true }).fill('NOTE-001');
  await page.getByRole('button', { name: 'Запази продукта' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'SKU' })).toContainText('already exists');
  await page.getByRole('button', { name: 'Език', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await page.getByRole('button', { name: 'Продължи редакцията' }).click();
  await expect(page).toHaveURL(`${app.url}/bg/stores/${storeA}/products/create`);
  await expect(page.getByLabel('Име', { exact: true })).toHaveValue('Продукт за преглед');
  await page.getByLabel('SKU', { exact: true }).fill('BG-REVIEW-001');
  await page.getByRole('combobox', { name: 'Статус', exact: true }).click();
  await page.getByRole('option', { name: 'Активен', exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath('product-bg-desktop.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('product-bg-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Запази продукта' }).click();
  await expect(page.getByText('Продуктът е запазен.', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Продукт за преглед' })).toContainText(
    'Активен',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Действия за Продукт за преглед', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Изтрий', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Да се изтрие ли продуктът?');
  await page.getByRole('button', { name: 'Изтрий продукта', exact: true }).click();
  await expect(page.getByText('Продуктът е изтрит.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Продукт за преглед', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('locale URLs, history, navigation and Accept-Language work through the real gateway', async ({
  page,
  app,
}, testInfo) => {
  const requests: { operation: string; language: string | undefined; store: string | undefined }[] =
    [];
  page.on('request', (request) => {
    if (request.url() === app.gatewayUrl && request.method() === 'POST') {
      const body: unknown = request.postDataJSON();
      if (
        typeof body === 'object' &&
        body !== null &&
        'operationName' in body &&
        typeof body.operationName === 'string'
      )
        requests.push({
          operation: body.operationName,
          language: request.headers()['accept-language'],
          store: request.headers()['x-store-id'],
        });
    }
  });
  const path = `/stores/${storeA}/products`;
  const query = '?status=ACTIVE#rows';
  await page.goto(`${app.url}${path}${query}`);
  await expect(page).toHaveURL(`${app.url}/bg${path}${query}`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toHaveAttribute(
    'href',
    `/bg${path}/20000000-0000-4000-8000-000000000001/edit`,
  );
  expect(
    requests
      .filter(
        (request) => request.operation === 'ListStores' || request.operation === 'ListProducts',
      )
      .every((request) => request.language === 'bg'),
  ).toBe(true);
  await page.getByRole('button', { name: 'Език', exact: true }).click();
  await expect(page.getByRole('menuitemradio')).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath('language-desktop.png'),
    animations: 'disabled',
  });
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await expect(page).toHaveURL(`${app.url}/en${path}${query}`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goBack();
  await expect(page).toHaveURL(`${app.url}/bg${path}${query}`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await page.goForward();
  await expect(page).toHaveURL(`${app.url}/en${path}${query}`);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sofia notebook', exact: true })).toHaveAttribute(
    'href',
    `/en${path}/20000000-0000-4000-8000-000000000001/edit`,
  );
  expect(
    requests.some(
      (request) =>
        request.operation === 'ListProducts' &&
        request.language === 'en' &&
        request.store === storeA,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Sofia notebook', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Sofia notebook');
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'href',
    '/en/',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en${path}`);
  await page.getByRole('combobox', { name: 'Store', exact: true }).press('ArrowDown');
  await page.getByRole('option', { name: 'holita Plovdiv', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/stores/${storeB}/products`);
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toHaveText(
    'holita Plovdiv',
  );
  await page.getByRole('menuitem', { name: 'Venues', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/stores/${storeB}/reference/venues`);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/`);
});

prototypeTest(
  'Prototype confirms dirty language navigation and keeps the locale through Reset on mobile',
  async ({ page, app }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const path = `/stores/${storeA}/reference/tags/40000000-0000-4000-8000-000000000001/edit`;
    await page.goto(`${app.url}/en${path}?source=bookmark#form`);
    const name = page.getByLabel('Name', { exact: true });
    await expect(name).toHaveValue('Conference');
    await name.fill('Unsaved translated route');
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page.getByRole('menuitemradio', { name: /Български/ }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page).toHaveURL(`${app.url}/en${path}?source=bookmark#form`);
    await expect(name).toHaveValue('Unsaved translated route');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page.getByRole('menuitemradio', { name: /Български/ }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveURL(`${app.url}/bg${path}?source=bookmark#form`);
    await expect(page.getByLabel('Име', { exact: true })).toHaveValue('Conference');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
    await page.getByRole('button', { name: 'Език', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath('language-mobile.png'),
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await page.getByLabel('Име', { exact: true }).fill('Disposable Bulgarian draft');
    await page.getByRole('button', { name: 'Възстанови демо данните' }).click();
    await page.getByRole('button', { name: 'Възстанови данните', exact: true }).click();
    await expect(page).toHaveURL(`${app.url}/bg/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
    await expect(page.getByRole('heading', { name: 'Избери магазин', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  },
);

test('Bulgarian Reference saves exact API values and shows localized overview, History and Session validation', async ({
  page,
  app,
}, testInfo) => {
  const eventId = '60000000-0000-4000-8000-000000000001';
  const path = `/bg/stores/${storeA}/reference/events/${eventId}`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${app.url}${path}/edit`);
  await expect(page.getByRole('heading', { name: 'Редактирай събитие', level: 1 })).toBeVisible();
  await page.getByLabel('Заглавие', { exact: true }).fill('Събитие за преглед');
  await page.getByLabel('Бюджет (EUR)', { exact: true }).fill('12345.67');
  const saved = page.waitForRequest(
    (request) =>
      request.url() === app.gatewayUrl &&
      request.postData()?.includes('UpdateReferenceEvent') === true,
  );
  await page.getByRole('button', { name: 'Запази събитието', exact: true }).click();
  const request = await saved;
  expect(request.headers()['accept-language']).toBe('bg');
  expect(request.postDataJSON()).toMatchObject({ variables: { input: { budget: '12345.67' } } });
  await expect(page.getByText('Събитието е запазено.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${app.url}${path}`);
  await expect(page.getByText(/12\s345,67 EUR/)).toBeVisible();
  await page.getByRole('tab', { name: 'История', exact: true }).click();
  const history = page.getByRole('table', { name: 'Запазени промени по събитието' });
  await expect(history).toContainText('Събитието е обновено');
  await history.getByRole('button', { name: 'Разгъни реда' }).first().click();
  await expect(history).toContainText('Бюджет (EUR)');
  await expect(history).toContainText('След:');
  await page.screenshot({
    path: testInfo.outputPath('reference-bg-history-desktop.png'),
    animations: 'disabled',
  });
  await page.getByRole('tab', { name: 'Сесии', exact: true }).click();
  await page.getByRole('button', { name: 'Добави сесия', exact: true }).click();
  await page.getByRole('button', { name: 'Запази сесията', exact: true }).click();
  await expect(page.getByText('Въведи заглавие до 200 знака.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Заглавие', { exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('reference-bg-session-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

prototypeTest(
  'Bulgarian catalog, MUI controls, Gallery feedback and Reset preserve local behavior',
  async ({ page, app }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${app.url}/bg/stores/${storeA}/ui-catalog?tab=forms`);
    await expect(page.getByRole('heading', { name: 'UI каталог', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Запази примера', exact: true }).click();
    await expect(page.getByText('Въведи име.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Отвори', exact: true }).click();
    await page.getByRole('option', { name: 'Сезонно', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Изчисти', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Списъци и менюта', exact: true }).click();
    const grid = page.getByRole('grid', { name: 'Примери в каталога' });
    await grid.getByRole('checkbox').first().check();
    await expect(page.getByText('5 избрани на тази страница', { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('catalog-bg-desktop.png'),
      animations: 'disabled',
    });
    await page.goto(
      `${app.url}/bg/stores/${storeA}/reference/events/60000000-0000-4000-8000-000000000001/edit`,
    );
    await page.getByRole('tab', { name: 'Съдържание и изображения', exact: true }).click();
    await page.getByLabel('Избери изображение за галерията', { exact: true }).setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('invalid image'),
    });
    await expect(
      page.getByText('Избери JPEG, PNG или WebP изображение до 5 MiB.', { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath('gallery-bg-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Възстанови демо данните', exact: true }).click();
    const reset = page.getByRole('dialog');
    await expect(reset).toContainText('Възстанови началните демо данни');
    await reset.getByRole('button', { name: 'Възстанови данните', exact: true }).click();
    await expect(page).toHaveURL(`${app.url}/bg/`);
    await expect(page.getByRole('heading', { name: 'Избери магазин', exact: true })).toBeVisible();
  },
);

for (const count of [1, 2]) {
  prototypeTest(
    `Bulgarian bulk publish confirms and reports ${String(count)} selected events`,
    async ({ page, app }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${app.url}/bg/stores/${storeA}/reference/events`);
      const grid = page.getByRole('grid', { name: 'Събития', exact: true });
      for (let index = 1; index <= count; index++) {
        await grid.getByRole('row').nth(index).getByRole('checkbox').check();
      }
      await page.getByRole('button', { name: 'Публикувай избраните', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Да се изпълни ли „Публикувай“ за избраните събития?');
      await expect(dialog).toContainText(
        count === 1
          ? 'Това се прилага за 1 избрано събитие.'
          : 'Това се прилага за 2 избрани събития.',
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: testInfo.outputPath('bulk-publish-bg-mobile.png'),
        animations: 'disabled',
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const submitted = page.waitForRequest((request) => {
        if (request.method() !== 'POST') return false;
        const body: unknown = request.postDataJSON();
        return (
          typeof body === 'object' &&
          body !== null &&
          'operationName' in body &&
          body.operationName === 'SetReferenceEventsStatus'
        );
      });
      await dialog.getByRole('button', { name: 'Публикувай', exact: true }).click();
      const request = await submitted;
      expect(request.headers()['accept-language']).toBe('bg');
      expect(request.postDataJSON()).toMatchObject({ variables: { status: 'PUBLISHED' } });
      await expect(
        page.getByText(
          count === 1
            ? 'Действието „Публикувай“ е изпълнено за 1 събитие.'
            : 'Действието „Публикувай“ е изпълнено за 2 събития.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(grid.getByRole('row').nth(1)).toContainText('Публикувано');
    },
  );
}
