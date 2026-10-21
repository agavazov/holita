import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test } from './angular-fixture.mjs';

const branchId = '10000000-0000-4000-8000-000000000001';
const writePrefix = '30,1,19,0,19,301,0,1,1,02';

async function createDevicePath(
  request: APIRequestContext,
  gatewayUrl: string,
  token: string,
  imei: string,
): Promise<string> {
  const created = await request.post(gatewayUrl, {
    headers: { authorization: `Bearer ${token}`, 'x-branch-id': branchId },
    data: {
      query: 'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id}}',
      variables: { input: { imei } },
    },
  });
  expect(created.ok()).toBe(true);
  const body: unknown = await created.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    typeof body.data !== 'object' ||
    body.data === null ||
    !('createFleetDevice' in body.data) ||
    typeof body.data.createFleetDevice !== 'object' ||
    body.data.createFleetDevice === null ||
    !('id' in body.data.createFleetDevice) ||
    typeof body.data.createFleetDevice.id !== 'string'
  ) {
    throw new Error('Missing created device');
  }
  return `/en/${branchId}/fleet/devices/${body.data.createFleetDevice.id}/configuration`;
}

async function selectTarget(page: Page): Promise<void> {
  const target = page.getByRole('combobox', { name: 'Karma truck', exact: true });
  await expect(target).not.toHaveAttribute('aria-disabled', 'true');
  await target.click();
  await page.getByRole('option', { name: /KARMA TEST 41/ }).click();
}

async function expectDefinition(page: Page, hex: string): Promise<void> {
  const summary = page.getByText('Readback details and raw definitions', { exact: true });
  await summary.click();
  await expect(page.getByText(hex, { exact: true })).toBeVisible();
  await summary.click();
}

test.use({ deviceOperations: true });

test('device configuration read continues after navigation and a browser refresh', async ({
  page,
  app,
  request,
}) => {
  const path = await createDevicePath(
    request,
    app.gatewayUrl,
    app.demoSession.token,
    '000000000000861',
  );
  await page.goto(app.url + path);
  await expect(
    page.getByRole('heading', { name: 'Device configuration', exact: true }),
  ).toBeVisible();
  await selectTarget(page);
  await page
    .getByRole('checkbox', {
      name: 'Read from this selected Karma truck for the Fleet device shown above.',
    })
    .check();
  await page.getByRole('button', { name: 'Read selected device settings', exact: true }).click();
  await expect(
    page.getByText(
      'An operation is already in progress. The server continues its saved background task.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto(app.url + `/en/${branchId}/fleet/devices`);
  await page.goto(app.url + path);
  await page.reload();
  await expect(
    page.getByText(
      'An operation is already in progress. The server continues its saved background task.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect.poll(() => app.karma.configurationCommands.length, { timeout: 20000 }).toBe(1);
  app.karma.completeConfigurationRead();
  await expect(page.getByText('Configuration confirmed', { exact: true })).toBeVisible({
    // A ten-second schedule can miss the nextCheckAt boundary; include the UI polling delay.
    timeout: 35000,
  });
  await expect(page.locator('tbody tr').filter({ hasText: '662' })).toContainText('30');
  await expect(page.locator('tbody tr').filter({ hasText: '153' })).toContainText('0');
  await page.reload();
  await expect(page.getByText('Configuration confirmed', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  expect(app.karma.configurationCommands).toHaveLength(1);
});

test.describe('device configuration writes', () => {
  test.use({ deviceConfigurationWrites: true });

  test('adds a parameter and updates an unknown interval through persisted background verification', async ({
    page,
    app,
    request,
  }) => {
    // Each write crosses profile/baseline/verification scheduler phases; use their real cadence.
    test.setTimeout(240000);
    const known = '0296' + '00'.repeat(18) + '001E';
    const unknown = 'FDE8' + 'AB'.repeat(18) + '001E';
    const updatedUnknown = unknown.slice(0, 40) + '002D';
    const writes = () =>
      app.karma.configurationCommands.filter((command) => command.startsWith(writePrefix));
    app.karma.setConfigurationDefinitions([known, unknown]);
    app.karma.setConfigurationAutomaticResponses(true);
    const path = await createDevicePath(
      request,
      app.gatewayUrl,
      app.demoSession.token,
      '000000000000862',
    );
    await page.goto(app.url + path);
    await selectTarget(page);
    await page
      .getByRole('checkbox', {
        name: 'Read from this selected Karma truck for the Fleet device shown above.',
      })
      .check();
    await page.getByRole('button', { name: 'Read selected device settings', exact: true }).click();
    await expect(page.getByText('Configuration confirmed', { exact: true })).toBeVisible({
      timeout: 35000,
    });
    await expectDefinition(page, unknown);
    expect(writes()).toHaveLength(0);

    const editor = page.getByRole('region', { name: 'Change eData parameters', exact: true });
    await editor.getByRole('combobox', { name: /Catalog parameter/ }).click();
    await page
      .getByRole('option', { name: /781 · Battery Voltage \(Starlink\) · Monitor 9\.56 fixture/ })
      .click();
    await editor.getByRole('spinbutton', { name: /New reporting interval/ }).fill('0');
    await editor.getByRole('checkbox', { name: /Send this exact change/ }).check();
    await editor.getByRole('button', { name: 'Save background change', exact: true }).click();
    await expect(
      editor.getByText('Confirm the special meaning of interval zero.', { exact: true }),
    ).toBeVisible();
    await expect(
      editor.getByRole('checkbox', { name: /I intend to use the special zero interval/ }),
    ).toBeFocused();
    expect(writes()).toHaveLength(0);
    await editor
      .getByRole('checkbox', { name: /I intend to use the special zero interval/ })
      .check();

    await page.getByRole('link', { name: 'Back to devices', exact: true }).click();
    const discard = page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true });
    await expect(discard).toBeVisible();
    await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(discard).toBeHidden();
    await expect(page).toHaveURL(app.url + path);
    await expect(editor.getByRole('spinbutton', { name: /New reporting interval/ })).toHaveValue(
      '0',
    );

    app.karma.setConfigurationReadsHeld(true);
    await editor.getByRole('button', { name: 'Save background change', exact: true }).click();
    await expect(
      page.getByText(
        'The parameter change was saved. The server will check, send and verify it in the background.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to devices', exact: true }).click();
    await expect(page).toHaveURL(app.url + `/en/${branchId}/fleet/devices`);
    await page.goto(app.url + path);
    await page.reload();
    const addition = page
      .locator('article.device-configuration-operation')
      .filter({ has: page.getByText('Add parameter', { exact: true }) });
    await expect(addition).toBeVisible();
    await expect(
      page.getByText(
        'An operation is already in progress. The server continues its saved background task.',
        { exact: true },
      ),
    ).toBeVisible();
    await expectDefinition(page, unknown);
    expect(writes()).toHaveLength(0);
    app.karma.setConfigurationReadsHeld(false);
    await expect(addition.getByText('Configuration confirmed', { exact: true })).toBeVisible({
      timeout: 90000,
    });
    await expect(page.locator('tbody tr')).toHaveCount(3);
    const added = page
      .locator('tbody tr')
      .filter({ has: page.getByRole('button', { name: 'Edit interval 781', exact: true }) });
    await expect(added.locator('td').nth(1)).toHaveText('0');
    await expectDefinition(page, unknown);
    expect(writes()).toHaveLength(1);

    await selectTarget(page);
    await page.getByRole('button', { name: 'Edit interval 65000', exact: true }).click();
    const interval = editor.getByRole('spinbutton', { name: /New reporting interval/ });
    await expect(interval).toHaveValue('30');
    await interval.fill('45');
    await editor.getByText('Technical change details', { exact: true }).click();
    await expect(editor.getByText(unknown, { exact: true })).toBeVisible();
    await editor.getByRole('checkbox', { name: /Send this exact change/ }).check();
    app.karma.setConfigurationWriteUncertain(true);
    await editor.getByRole('button', { name: 'Save background change', exact: true }).click();
    const update = page
      .locator('article.device-configuration-operation')
      .filter({ has: page.getByText('Update interval', { exact: true }) });
    await expect(update.getByText('Configuration confirmed', { exact: true })).toBeVisible({
      timeout: 90000,
    });
    await expect(
      update.getByText(
        'The write response was uncertain. A subsequent complete readback verified the intended configuration.',
        { exact: true },
      ),
    ).toBeVisible();
    expect(writes()).toEqual([
      expect.stringMatching(/^30,1,19,0,19,301,0,1,1,02030D/),
      writePrefix + updatedUnknown,
    ]);
    await expect(
      page
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: 'Edit interval 65000', exact: true }) })
        .locator('td')
        .nth(1),
    ).toHaveText('45');
    await expectDefinition(page, updatedUnknown);
    await expectDefinition(page, known);
    await page.reload();
    await expect(update.getByText('Configuration confirmed', { exact: true })).toBeVisible();
    await expectDefinition(page, updatedUnknown);
    expect(writes()).toHaveLength(2);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(app.url + path.replace('/en/', '/bg/'));
    const mobileAction = page.getByRole('button', { name: 'Промени интервала 65000', exact: true });
    await expect(mobileAction).toBeVisible();
    const actionBounds = await mobileAction.boundingBox();
    const intervalBounds = await page
      .getByRole('row')
      .filter({ has: mobileAction })
      .getByRole('cell')
      .nth(1)
      .boundingBox();
    if (!actionBounds || !intervalBounds) {
      throw new Error('Missing Bulgarian mobile parameter controls.');
    }
    expect(intervalBounds.x).toBeGreaterThanOrEqual(0);
    expect(intervalBounds.x + intervalBounds.width).toBeLessThanOrEqual(actionBounds.x);
    expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    expect(writes()).toHaveLength(2);
  });
});
