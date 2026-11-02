import { expect } from '@playwright/test';
import { chooseBranch, chooseLanguage, test } from './angular-fixture.mjs';
import { enterKarmaDateTime } from './karma-date-time.mjs';

test.use({ demoSignedIn: false });

test('opens Karma trucks, trips, diagnostics and filtered eData through Gateway independently of Branch and recovers from a Karma outage', async ({
  page,
  app,
}) => {
  test.setTimeout(300000);
  const settingsUrl = `${app.url}/en/karma-client/cars/41/configuration`;
  await page.goto(settingsUrl);
  await expect(page.getByRole('heading', { name: 'Demo sign in', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Tenant', exact: true }).click();
  await page.getByRole('option', { name: app.demoSession.tenant.name, exact: true }).click();
  await expect(page.getByTestId('demo-login')).toBeDisabled();
  await page.getByRole('combobox', { name: 'Branch', exact: true }).click();
  await page.getByRole('option', { name: app.branchA.name, exact: true }).click();
  await page.getByTestId('demo-login').click();
  await expect(page).toHaveURL(settingsUrl);
  await expect(page.getByRole('heading', { name: 'Device settings', exact: true })).toBeVisible();
  await expect(
    page.locator('holita-admin-topbar').getByRole('button', {
      name: `Branch: ${app.branchA.name}`,
      exact: true,
    }),
  ).toBeVisible();

  const karmaRequests: { operation: string; headers: Record<string, string> }[] = [];
  page.on('request', (request) => {
    const operation = /"operationName":"(AdminKarma[A-Za-z]+)"/.exec(request.postData() ?? '')?.[1];
    if (request.url() === app.gatewayUrl && operation) {
      karmaRequests.push({ operation, headers: request.headers() });
    }
  });
  const listReads = () =>
    karmaRequests.filter(({ operation }) => operation === 'AdminKarmaCars').length;
  await page.goto(`${app.url}/en/karma-client/cars`);
  await expect(page.getByRole('heading', { name: 'Trucks', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'KARMA TEST 41', exact: true })).toBeVisible();
  expect(listReads()).toBe(1);
  // Karma data does not depend on the Branch: switching neither navigates nor refetches.
  await chooseBranch(page, app.branchB.name);
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars`);
  expect(listReads()).toBe(1);
  // The same bounded report contract also supplies the connected truck Overview below.
  const dailyReport = async (day: string) => {
    const response = await page.request.post(app.gatewayUrl, {
      headers: { authorization: `Bearer ${app.demoSession.token}` },
      data: {
        query: `query($input:KarmaDailyReportInput!){karmaDailyReport(input:$input){
          state retrieval reason loadedTrips pageRequests fromUtc toUtcExclusive
          tripCount{value availability} totalDistance{value availability unit}
          maxSpeed{value availability}
        }}`,
        variables: { input: { carId: '41', day } },
      },
    });
    const body: unknown = await response.json();
    return body;
  };
  await expect(dailyReport('2026-01-01')).resolves.toMatchObject({
    data: {
      karmaDailyReport: {
        state: 'PARTIAL',
        retrieval: 'COMPLETE',
        reason: 'OPEN_TRIPS',
        loadedTrips: 120,
        pageRequests: 3,
        tripCount: { value: 120, availability: 'COMPLETE' },
        totalDistance: { value: 0, availability: 'PARTIAL', unit: 'SOURCE_DISTANCE_UNCONFIRMED' },
      },
    },
  });
  await expect(dailyReport('2026-01-02')).resolves.toMatchObject({
    data: {
      karmaDailyReport: {
        state: 'EMPTY',
        retrieval: 'COMPLETE',
        tripCount: { value: 0, availability: 'COMPLETE' },
        totalDistance: { value: 0, availability: 'COMPLETE' },
        maxSpeed: { value: null, availability: 'UNAVAILABLE' },
      },
    },
  });
  app.karma.setFailed(true);
  await expect(dailyReport('2026-01-02')).resolves.toMatchObject({
    data: {
      karmaDailyReport: {
        state: 'UNAVAILABLE',
        retrieval: 'UNAVAILABLE',
        tripCount: { value: null, availability: 'UNAVAILABLE' },
        totalDistance: { value: null, availability: 'UNAVAILABLE' },
      },
    },
  });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Karma is unavailable. Try again.' }),
  ).toBeVisible();
  app.karma.setFailed(false);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const listUrl = `${app.url}/en/karma-client/cars?q=KARMA&size=25&project=12`;
  const truckContext = '?listQ=KARMA&listSize=25&listProject=12';
  await page.goto(listUrl);
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41${truckContext}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'KARMA TEST 41', exact: true }),
  ).toBeVisible();
  const truckNavigation = page.getByRole('navigation', { name: 'Truck sections', exact: true });
  await expect(truckNavigation.getByRole('link')).toHaveCount(3);
  await expect(
    truckNavigation.getByRole('link', { name: 'Overview', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  const report = page.locator('holita-daily-report');
  const dayInput = report.getByLabel('Source-local day', { exact: true });
  const distance = report.locator('holita-kpi-tile').filter({ hasText: 'Total distance' });
  const count = report.locator('holita-kpi-tile').filter({ hasText: 'Trip count' });
  const maximum = report.locator('holita-kpi-tile').filter({ hasText: 'Maximum trip speed' });
  await expect(dayInput).toHaveValue(app.karma.reportDay);
  await expect(distance.locator('.kpi-tile__value')).toHaveText(/^21\s*source distance units$/);
  await dayInput.fill(app.karma.reportDay);
  await report.getByRole('button', { name: 'Apply day', exact: true }).click();
  const selectedDayUrl = `${app.url}/en/karma-client/cars/41${truckContext}&day=${app.karma.reportDay}`;
  await expect(page).toHaveURL(selectedDayUrl);
  await expect(count.locator('.kpi-tile__value')).toHaveText(/^2\s*trips$/);
  await expect(maximum.locator('.kpi-tile__value')).toHaveText(/^51\s*source speed units$/);
  await expect(report.getByRole('heading', { name: /^Loaded trips/ })).toBeVisible();
  await expect(report.locator('holita-table-panel tbody tr')).toHaveCount(2);
  await expect(
    report.getByRole('region', { name: 'Last reported position', exact: true }),
  ).toContainText('independent of the selected historical report day');
  await expect(report.locator('holita-source-context')).toContainText('Karma API');
  await expect(report.locator('holita-source-context')).toContainText('Not assessed');
  await expect(report.getByText('Example data', { exact: true })).toHaveCount(0);
  const tripTrigger = report.getByRole('button', { name: /^View trip 4000000121 ·/ });
  await tripTrigger.click();
  await expect(page).toHaveURL(`${selectedDayUrl}#trip-4000000121`);
  const tripDrawer = page.getByRole('dialog', { name: 'Trip ID 4000000121', exact: true });
  await expect(tripDrawer).toBeVisible();
  await expect(page.locator('holita-map-preview')).toHaveCount(1);
  await expect(tripDrawer.getByRole('button', { name: 'Map', exact: true })).toBeEnabled();
  await tripDrawer.getByRole('button', { name: 'Street View', exact: true }).click();
  await expect(
    tripDrawer.getByRole('button', { name: 'Street View', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await tripDrawer
    .locator('holita-trip-details')
    .getByText('Source fields', { exact: true })
    .click();
  const tripSource = tripDrawer.locator('holita-trip-details details.trip-details__source');
  await expect(tripSource).toHaveJSProperty('open', true);
  await expect(tripSource).toContainText(`${app.karma.reportDay} 08:00:00`);
  await expect(tripSource).toContainText('4000000121');
  await tripDrawer.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(tripDrawer).toHaveCount(0);
  await expect(page).toHaveURL(selectedDayUrl);
  await expect(tripTrigger).toBeFocused();
  await expect(dayInput).toHaveValue(app.karma.reportDay);
  await truckNavigation.getByRole('link', { name: 'Trips', exact: true }).click();
  await expect(page).toHaveURL(
    `${app.url}/en/karma-client/cars/41/trips${truckContext}&day=${app.karma.reportDay}`,
  );
  await truckNavigation.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page).toHaveURL(selectedDayUrl);
  await expect(dayInput).toHaveValue(app.karma.reportDay);
  await expect(distance.locator('.kpi-tile__value')).toHaveText(/^21\s*source distance units$/);

  await dayInput.fill('2026-01-02');
  await report.getByRole('button', { name: 'Apply day', exact: true }).click();
  await expect(count.locator('.kpi-tile__value')).toHaveText(/^0\s*trips$/);
  await expect(distance.locator('.kpi-tile__value')).toHaveText(/^0\s*source distance units$/);
  await expect(maximum.locator('.kpi-tile__value')).toHaveText('—');
  await expect(report.getByText('No loaded trips', { exact: true })).toBeVisible();

  await dayInput.fill('2026-01-01');
  await report.getByRole('button', { name: 'Apply day', exact: true }).click();
  await expect(count.locator('.kpi-tile__value')).toHaveText(/^120\s*trips$/);
  await expect(distance).toContainText('Loaded subset');
  await expect(report.getByText('Partially available report', { exact: true })).toBeVisible();
  app.karma.setFailed(true);
  await dayInput.fill(app.karma.reportDay);
  await report.getByRole('button', { name: 'Apply day', exact: true }).click();
  await expect(report.getByText('Report unavailable', { exact: true })).toBeVisible();
  await expect(report.locator('holita-source-context')).toContainText('Karma API');
  await expect(report.getByText('Example data', { exact: true })).toHaveCount(0);
  await expect(report.getByRole('button', { name: /^View trip 4000000121 ·/ })).toHaveCount(0);
  app.karma.setFailed(false);
  await report.getByRole('button', { name: 'Yesterday', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41${truckContext}`);
  await expect(dayInput).toHaveValue(app.karma.reportDay);
  await expect(distance.locator('.kpi-tile__value')).toHaveText(/^21\s*source distance units$/);
  const summary = page.getByRole('region', { name: 'Truck summary', exact: true });
  await expect(summary).toContainText('Fixture project');
  await expect(summary).toContainText('Europe/Sofia');
  await page.getByRole('link', { name: 'Location', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41/location${truckContext}`);
  await page.locator('holita-location-page summary').click();
  // Upstream markup is shown as text, never rendered.
  await expect(
    page.locator('holita-location-page dd').filter({ hasText: '<b>Fixture plain text</b>' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to trucks', exact: true }).click();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByLabel('Search by registration', { exact: true })).toHaveValue('KARMA');
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Breadcrumb', exact: true })
    .getByRole('link', { name: 'Trucks', exact: true })
    .click();
  await expect(page).toHaveURL(listUrl);
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  const more = truckNavigation.getByRole('button', { name: 'More', exact: true });
  await more.focus();
  await more.press('Enter');
  await expect(page.getByRole('menu', { name: 'More', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole('link', { name: 'eData', exact: true }).click();
  await expect(
    truckNavigation.getByRole('button', { name: 'More: eData', exact: true }),
  ).toBeVisible();
  const rows = page.locator('holita-edata-page section tbody tr');
  await expect(rows).toHaveCount(50);
  // The fixture filters on UTC message times, so shifted bounds would miss message 3000000001.
  await enterKarmaDateTime(page, 'From (UTC)', '2026-01-01', '00:00:00');
  await enterKarmaDateTime(page, 'To (UTC)', '2026-01-01', '00:00:00');
  await page.getByLabel('Parameter IDs', { exact: true }).fill('99999');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'View message 3000000001', exact: true }),
  ).toBeVisible();
  // Cross the desktop breakpoint while the navigation mask is still fading out.
  // Stretch only that animation so the regression does not depend on machine speed.
  await page.addStyleTag({
    content: '.p-drawer-mask.p-overlay-mask-leave-active { animation-duration: 2s; }',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  const drawer = page.locator('.app-nav-drawer');
  await drawer.getByRole('link', { name: 'Trucks', exact: true }).click();
  await expect(page.locator('.p-drawer-mask.p-overlay-mask-leave-active')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#desktop-navigation')).toBeVisible();
  await expect(page.locator('.p-drawer-mask')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/p-overflow-hidden/);
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41`);
  expect(karmaRequests.length).toBeGreaterThan(0);
  expect(
    karmaRequests.every(
      ({ headers }) =>
        !('x-branch-id' in headers) &&
        headers['authorization']?.startsWith(`Bearer holita-demo.${app.demoSession.tenant.id}.`),
    ),
  ).toBe(true);

  await truckNavigation.getByRole('button', { name: 'More', exact: true }).click();
  await page
    .getByRole('menu', { name: 'More', exact: true })
    .getByRole('link', { name: 'Diagnostics', exact: true })
    .click();
  await expect(page).toHaveURL(`${app.url}/en/karma-client/cars/41/diagnostics`);
  const diagnostics = page.locator('holita-karma-diagnostics-page');
  await expect(
    diagnostics.getByRole('heading', { name: 'Reported faults', exact: true }),
  ).toBeVisible();
  await diagnostics
    .locator('details > summary')
    .filter({ hasText: 'Technical details' })
    .last()
    .click();
  await diagnostics.getByLabel('From message ID', { exact: true }).fill('7177124308');
  await diagnostics.getByLabel('To message ID', { exact: true }).fill('7177124308');
  await diagnostics.getByRole('button', { name: 'Read history', exact: true }).click();
  await expect(diagnostics).toContainText('SCR/AdBlue control system problem');
  await expect(diagnostics).toContainText('Fault related to engine power');
  await diagnostics
    .getByRole('button', { name: 'View fault: SCR/AdBlue control system problem', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('What to do next');
  await page.getByRole('dialog').getByText('Technical details', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('21000010F30701000004DF0B01');
  await expect(page.getByRole('dialog')).toContainText('2026-10-28');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  app.karma.setFailed(true);
  await diagnostics.getByRole('button', { name: 'Read history', exact: true }).click();
  await expect(diagnostics.locator('holita-table-panel').getByRole('alert')).toBeVisible();
  app.karma.setFailed(false);
  await diagnostics.getByRole('button', { name: 'Read history', exact: true }).click();
  await expect(diagnostics).toContainText('SCR/AdBlue control system problem');

  const administrationReads = karmaRequests.length;
  const usersUrl = `${app.url}/en/karma-client/administration/users?q=fixture-001&size=25#account`;
  const rolesUrl = `${app.url}/en/karma-client/administration/roles`;
  await page.goto(`${app.url}/en/karma-client/users?q=fixture-001&size=25#account`);
  await expect(page).toHaveURL(usersUrl);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Administration', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Users', exact: true })).toBeVisible();
  await expect(page.locator('holita-users-page')).toContainText('fixture-001');
  expect(karmaRequests.slice(administrationReads).map(({ operation }) => operation)).toEqual([
    'AdminKarmaUsers',
  ]);
  const administration = page.getByRole('navigation', {
    name: 'Karma administration',
    exact: true,
  });
  await expect(administration.getByRole('link', { name: 'Users', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await administration.getByRole('link', { name: 'Roles', exact: true }).click();
  await expect(page).toHaveURL(rolesUrl);
  await expect(page.getByRole('heading', { level: 2, name: 'Roles', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Viewer', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(usersUrl);
  await page.goForward();
  await expect(page).toHaveURL(rolesUrl);
  await page.reload();
  await expect(administration.getByRole('link', { name: 'Roles', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await chooseLanguage(page, 'Български');
  await expect(page).toHaveURL(rolesUrl.replace('/en/', '/bg/'));
  await expect(page.getByRole('heading', { level: 2, name: 'Роли', exact: true })).toBeVisible();
  await chooseLanguage(page, 'English');
  await page.getByRole('link', { name: 'Trucks', exact: true }).click();
  await page.getByRole('link', { name: 'KARMA TEST 41', exact: true }).click();
  await truckNavigation.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('link', { name: 'Device settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Device settings', exact: true })).toBeVisible();
  await chooseBranch(page, app.branchA.name);
  await expect(page).toHaveURL(settingsUrl);
  const settings = page.locator('holita-device-management-page');
  await expect(settings).toContainText('000123456789012');
  await expect(page.getByRole('button', { name: 'Link device', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage device link', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('combobox', { name: 'Fleet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Registered device', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Add parameter', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Read configuration', exact: true })).toBeEnabled();

  // Legacy query hints cannot replace the active Branch or the truck's Karma device.
  await page.goto(
    `${settingsUrl}?branchId=${app.branchB.id}&deviceId=00000000-0000-4000-8000-000000000042`,
  );
  await expect(settings).toContainText('000123456789012');
  await expect(
    page.locator('holita-admin-topbar').getByRole('button', {
      name: `Branch: ${app.branchA.name}`,
      exact: true,
    }),
  ).toBeVisible();
  const acceptedRead = page.waitForResponse(
    (response) =>
      response
        .request()
        .postData()
        ?.includes('"operationName":"AdminRequestDeviceConfigurationRead"') === true,
  );
  await page.getByRole('button', { name: 'Read configuration', exact: true }).click();
  const read = await acceptedRead;
  expect(read.request().headers()['x-branch-id']).toBe(app.branchA.id);
  const submitted: unknown = read.request().postDataJSON();
  expect(submitted).toHaveProperty('variables', {
    input: {
      karmaCarId: '41',
      expectedKarmaDeviceId: '000123456789012',
    },
  });
  expect(await read.json()).toMatchObject({
    data: {
      requestFleetDeviceConfigurationRead: {
        branchId: app.branchA.id,
        karmaCarId: '41',
        karmaDeviceId: '000123456789012',
        kind: 'READ_CONFIGURATION',
      },
    },
  });
  await page.reload();
  await expect(
    page.getByRole('status').getByText('Read configuration', { exact: true }),
  ).toBeVisible();
  await expect(settings).toContainText('000123456789012');
  await expect(page.getByRole('combobox', { name: 'Registered device', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Read configuration', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Read parameters', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Read rules', exact: true })).toBeDisabled();
});
