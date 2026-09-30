import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './fixture.mjs';

const storeA = '10000000-0000-4000-8000-000000000001';
const eventId = '60000000-0000-4000-8000-000000000001';
const captures = 'artifacts/aurora/lookups';

for (const entity of ['Speaker', 'Tag']) {
  const singular = entity.toLowerCase();
  const plural = `${singular}s`;
  test(`Aurora ${entity} list shares filters, sorts server pages and preserves referenced batch failures`, async ({
    page,
    app,
  }) => {
    for (let index = 0; index < 11; index++) {
      const response = await page.request.post(app.gatewayUrl, {
        headers: { 'x-store-id': storeA },
        data: {
          query: `mutation($input:CreateReference${entity}Input!){createReference${entity}(input:$input){id}}`,
          variables: {
            input: {
              name: `Order ${String(index).padStart(2, '0')}`,
              active: false,
              ...(entity === 'Tag' ? { color: '#315ed0' } : { email: 'person@example.com' }),
            },
          },
        },
      });
      expect(await response.json()).toHaveProperty(`data.createReference${entity}.id`);
    }
    const linked = entity === 'Speaker' ? 'Alex Marin' : 'Community';
    const relation = await page.request.post(app.gatewayUrl, {
      headers: { 'x-store-id': storeA },
      data: {
        query:
          entity === 'Speaker'
            ? `mutation{createReferenceSession(eventId:"${eventId}",input:{title:"Linked session",startsAt:"2026-11-12T09:00:00Z",endsAt:"2026-11-12T10:00:00Z",speakerIds:["50000000-0000-4000-8000-000000000001"]}){id}}`
            : `mutation{updateReferenceEvent(id:"${eventId}",input:{tagIds:["40000000-0000-4000-8000-000000000001"]}){id}}`,
      },
    });
    expect(await relation.json()).toHaveProperty(
      `data.${entity === 'Speaker' ? 'createReferenceSession' : 'updateReferenceEvent'}.id`,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `${app.url}/stores/${storeA}/reference/${plural}?search=Order&status=INACTIVE&pageSize=10&page=2`,
    );
    const rows = page.getByRole('grid', { name: `${entity}s` }).getByRole('link');
    await expect(rows).toHaveText(['Order 00']);
    await page.getByRole('checkbox', { name: 'Select all rows', exact: true }).check();
    const name = page.getByRole('columnheader', { name: /^Name\b/ });
    await name.click();
    await expect(rows.first()).toHaveText('Order 00');
    await expect(rows).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Delete selected' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(rows).toHaveText(['Order 10']);
    await page.reload();
    await expect(rows).toHaveText(['Order 10']);
    await expect(name).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: `Filter ${plural}` }).click();
    const panel = page.getByRole('dialog', { name: `${entity} filters` });
    const search = panel.getByRole('searchbox', { name: `Search ${plural}` });
    await expect(search).toHaveValue('Order');
    await search.fill('Order 00');
    await expect(page).toHaveURL(/search=Order\+00/);
    await panel.getByRole('button', { name: 'Close filters' }).click();
    await expect(rows).toHaveText(['Order 00']);
    await page.getByRole('button', { name: `Filter ${plural}` }).click();
    await panel.getByRole('button', { name: 'Clear filters' }).click();
    await panel.getByRole('button', { name: 'Close filters' }).click();
    await expect(page.getByRole('searchbox', { name: `Search ${plural}` })).toHaveValue('');
    await expect(page).not.toHaveURL(/search=|status=|page=2/);
    await expect(page.getByRole('link', { name: linked, exact: true })).toBeVisible();
    await mkdir(captures, { recursive: true });
    await page.screenshot({
      path: `${captures}/${plural}-desktop.png`,
      fullPage: true,
      animations: 'disabled',
    });
    for (const label of [linked, 'Order 00']) {
      await page
        .getByRole('row')
        .filter({ has: page.getByRole('link', { name: label, exact: true }) })
        .getByRole('checkbox')
        .check();
    }
    await page.getByRole('button', { name: 'Delete selected' }).click();
    const deletion = page.getByRole('dialog');
    await deletion.getByRole('button', { name: `Delete ${plural}`, exact: true }).click();
    await expect(deletion.getByRole('alert')).toContainText(
      `${linked}: ${entity} is still referenced by another record.`,
    );
    await expect(
      deletion.getByRole('button', { name: `Delete ${singular}`, exact: true }),
    ).toBeEnabled();
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Order 00', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: linked, exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${captures}/${plural}-mobile.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: `Filter ${plural}` }).click();
    await expect(search).toBeVisible();
    await page.screenshot({
      path: `${captures}/${plural}-filters-mobile.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });

  test(`Aurora ${entity} editor keeps its responsive aside and protects unsaved input`, async ({
    page,
    app,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${app.url}/stores/${storeA}/reference/${plural}/create`);
    await page
      .getByLabel('Name', { exact: true })
      .fill(entity === 'Speaker' ? 'Morgan Ellis' : 'Community workshops');
    if (entity === 'Speaker') {
      await page.getByLabel('Email', { exact: true }).fill('morgan@example.com');
      await page
        .getByLabel('Short biography', { exact: true })
        .fill('A speaker sharing practical ideas for local communities.');
    } else {
      await page.getByLabel('Choose tag color', { exact: true }).fill('#13876e');
      await expect(page.getByLabel('Color', { exact: true })).toHaveValue('#13876e');
    }
    const aside = page.getByRole('complementary', { name: `${entity} settings` });
    await expect(aside).toHaveCSS('position', 'sticky');
    await mkdir(captures, { recursive: true });
    await page.screenshot({
      path: `${captures}/${singular}-form-desktop.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(aside).toHaveCSS('position', 'static');
    const details = await page
      .getByRole('region', { name: `${entity} details`, exact: true })
      .boundingBox();
    const mobileAside = await aside.boundingBox();
    if (!details || !mobileAside) throw new Error('Missing form sections');
    expect(mobileAside.y).toBeGreaterThanOrEqual(details.y + details.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `${captures}/${singular}-form-mobile.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveURL(`${app.url}/stores/${storeA}/reference/${plural}`);
    expect(errors).toEqual([]);
  });
}
