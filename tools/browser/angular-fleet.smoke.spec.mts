import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import {
  chooseBranch,
  chooseLanguage,
  chooseMenuItem,
  setDarkTheme,
  test,
} from './angular-fixture.mjs';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const fleet = `/en/${branchA}/fleet`;
interface FleetApp {
  readonly gatewayUrl: string;
  readonly demoSession: { readonly token: string };
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error('Missing GraphQL object.');
  }
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Missing GraphQL string.');
  }
  return value;
}
async function graphql(
  page: Page,
  app: FleetApp,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await page.request.post(app.gatewayUrl, {
    headers: {
      authorization: `Bearer ${app.demoSession.token}`,
      'x-branch-id': branchA,
      'accept-language': 'en',
      'x-request-id': randomUUID(),
    },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  expect(object(body)['errors']).toBeUndefined();
  return object(object(body)['data']);
}
async function createVehicle(page: Page, app: FleetApp, plate: string): Promise<string> {
  const data = await graphql(
    page,
    app,
    'mutation BrowserVehicle($input: CreateFleetVehicleInput!) { vehicle: createFleetVehicle(input: $input) { id } }',
    { input: { licensePlate: plate, make: 'Volvo', notes: 'Seeded through the real Gateway.' } },
  );
  return string(object(data['vehicle'])['id']);
}
async function businessDate(page: Page, app: FleetApp): Promise<string> {
  return string(
    object(
      (await graphql(page, app, 'query BrowserBusinessDate { fleetDataClock { businessDate } }'))[
        'fleetDataClock'
      ],
    )['businessDate'],
  );
}
async function selectOption(page: Page, label: string, option: string): Promise<void> {
  const control = page.getByRole('combobox', { name: label, exact: true });
  await control.click();
  const id = await control.getAttribute('aria-controls');
  if (!id) {
    throw new Error('Missing controlled listbox for ' + label);
  }
  await page
    .getByRole('listbox')
    .and(page.locator('[id="' + id + '"]'))
    .getByRole('option', { name: option, exact: true })
    .click();
  await expect(control).toHaveAttribute('aria-expanded', 'false');
}
function kpi(page: Page, label: string): Locator {
  return page
    .locator('holita-kpi-tile')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('.kpi-tile__value .app-num');
}

test.describe('Fleet adopted screens', () => {
  test('retries Overview through the real Gateway, preserves empty telemetry and works in Bulgarian and both themes', async ({
    page,
    app,
  }) => {
    let failOverview = true;
    await page.route(app.gatewayUrl, async (route) => {
      const request = route.request();
      const body: unknown = request.method() === 'POST' ? request.postDataJSON() : null;
      if (failOverview && isObject(body) && body['operationName'] === 'AdminFleetOverview') {
        failOverview = false;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });
    await page.goto(app.url + fleet + '/overview');
    await expect(page.getByText('The overview could not be loaded', { exact: true })).toBeVisible();
    expect(failOverview).toBe(false);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(kpi(page, 'Moving now')).toHaveText('0');
    await expect(kpi(page, 'Distance today')).toHaveText('0');
    await expect(
      page.getByText('Nothing needs attention right now.', { exact: true }),
    ).toBeVisible();
    const chart = page.getByRole('figure', { name: 'Fleet distance per day, last 14 days' });
    await expect(chart).toBeVisible();
    await expect(chart.locator('tbody tr')).toHaveCount(0);
    await setDarkTheme(page, true);
    await expect(kpi(page, 'Critical alerts')).toHaveText('0');
    await chooseLanguage(page, 'Български');
    await expect(page).toHaveURL(app.url + fleet.replace('/en/', '/bg/') + '/overview');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Преглед', exact: true }),
    ).toBeVisible();
    await setDarkTheme(page, false);
    await chooseLanguage(page, 'English');
    await page.getByRole('link', { name: 'Distance today', exact: true }).click();
    await expect(page).toHaveURL(app.url + fleet + '/trips');
    await expect(page.getByText('No trips yet', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Open trip / })).toHaveCount(0);
  });

  test('persists Group create/edit/clear/delete, keeps a cancelled draft and isolates A → B → A', async ({
    page,
    app,
  }) => {
    const path = fleet + '/settings/groups';
    await page.goto(app.url + path);
    await page
      .locator('holita-page-header')
      .getByRole('button', { name: 'New group', exact: true })
      .click();
    const create = page.getByRole('dialog', { name: 'New group', exact: true });
    await create.getByRole('button', { name: 'Create group', exact: true }).click();
    await expect(create.getByRole('textbox', { name: /^Name/ })).toBeFocused();
    await create.getByRole('textbox', { name: /^Name/ }).fill('Night shift');
    await create
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('Night line\nDispatch confirmed.');
    await selectOption(page, 'Colour', 'Colour 3');
    await create.getByRole('button', { name: 'Create group', exact: true }).click();
    await expect(create).toBeHidden();
    await page.getByRole('button', { name: 'Edit Night shift', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Night shift', exact: true });
    await expect(edit.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
      'Night line\nDispatch confirmed.',
    );
    await expect(edit.getByRole('combobox', { name: 'Colour', exact: true })).toContainText(
      'Colour 3',
    );
    await edit.getByRole('textbox', { name: /^Name/ }).fill('Night route');
    await edit.getByRole('textbox', { name: 'Description', exact: true }).fill('');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await page.reload();
    await page.getByRole('button', { name: 'Edit Night route', exact: true }).click();
    const renamed = page.getByRole('dialog', { name: 'Edit Night route', exact: true });
    await expect(renamed.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
      '',
    );
    await renamed
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('Unsaved group draft');
    await renamed.getByRole('button', { name: 'Cancel', exact: true }).click();
    const discard = page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true });
    await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(renamed.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
      'Unsaved group draft',
    );
    await renamed.getByRole('button', { name: 'Cancel', exact: true }).click();
    await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(renamed).toBeHidden();
    await chooseBranch(page, 'Sandbox');
    await expect(page.getByRole('button', { name: 'Edit Night route', exact: true })).toHaveCount(
      0,
    );
    await chooseBranch(page, 'Discordia');
    await page.getByRole('button', { name: 'Actions for Night route', exact: true }).click();
    await chooseMenuItem(page, 'Delete');
    const confirmation = page.getByRole('alertdialog', { name: 'Delete groups?', exact: true });
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Groups deleted: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Edit Night route', exact: true })).toHaveCount(
      0,
    );
    const data = await graphql(page, app, 'query BrowserGroups { fleetVehicleGroups { total } }');
    expect(object(data['fleetVehicleGroups'])['total']).toBe(0);
  });

  test('persists Driver documents and explicit clears, uses a real no-telemetry scorecard and deletes the unassigned driver', async ({
    page,
    app,
  }) => {
    const today = await businessDate(page, app);
    const expiry = new Date(today + 'T00:00:00.000Z');
    expiry.setUTCDate(expiry.getUTCDate() + 30);
    await page.goto(app.url + fleet + '/drivers');
    await page
      .locator('holita-page-header')
      .getByRole('button', { name: 'New driver', exact: true })
      .click();
    const create = page.getByRole('dialog', { name: 'New driver', exact: true });
    await create.getByRole('textbox', { name: /^First name/ }).fill('Elena');
    await create.getByRole('textbox', { name: /^Last name/ }).fill('Fleet');
    await create.getByRole('textbox', { name: 'Employee number', exact: true }).fill('E-BROWSER');
    await create.getByRole('textbox', { name: 'Phone', exact: true }).fill('+359 888 123 456');
    await create
      .getByRole('textbox', { name: 'Driving license number', exact: true })
      .fill('285001234');
    const licenseExpiry = create.getByLabel('Driving license valid until', { exact: true });
    await licenseExpiry.pressSequentially(expiry.toISOString().slice(0, 10));
    // Finish the modal calendar interaction before typing in another form field.
    await licenseExpiry.press('Escape');
    await expect(licenseExpiry).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.p-datepicker-panel')).toBeHidden();
    const notes = create.getByRole('textbox', { name: 'Notes', exact: true });
    await notes.fill('First line\nSecond line');
    await expect(notes).toHaveValue('First line\nSecond line');
    await expect(licenseExpiry).toHaveValue(expiry.toISOString().slice(0, 10));
    await create.getByRole('button', { name: 'Add driver', exact: true }).click();
    await expect(create).toBeHidden();
    await expect(page.getByText('Expires in 30 d', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open Elena Fleet', exact: true }).click();
    const view = page.getByRole('dialog', { name: 'Elena Fleet', exact: true });
    await expect(view.getByText('E-BROWSER', { exact: true })).toBeVisible();
    await expect(view.getByText('First line\nSecond line', { exact: true })).toBeVisible();
    const driverId = string(new URL(page.url()).pathname.split('/').at(-1));
    await view.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Elena Fleet', exact: true });
    await expect(edit.getByRole('textbox', { name: 'Phone', exact: true })).toHaveValue(
      '+359 888 123 456',
    );
    await edit.getByRole('textbox', { name: 'Phone', exact: true }).fill('');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await page.reload();
    const stored = await graphql(
      page,
      app,
      'query BrowserDriver($id: ID!) { fleetDriver(id:$id) { phone employeeNumber licenseExpiresOn notes } }',
      { id: driverId },
    );
    expect(object(stored['fleetDriver'])).toEqual({
      phone: null,
      employeeNumber: 'E-BROWSER',
      licenseExpiresOn: expiry.toISOString().slice(0, 10),
      notes: 'First line\nSecond line',
    });
    await page.getByRole('button', { name: 'Open Elena Fleet', exact: true }).click();
    await view.getByRole('button', { name: 'Scorecard', exact: true }).click();
    await expect(page).toHaveURL(app.url + fleet + '/drivers/' + driverId + '/scorecard');
    await expect(page.getByText('No telemetry yet', { exact: true })).toBeVisible();
    await page
      .getByRole('group', { name: 'Scorecard period', exact: true })
      .getByRole('button', { name: '90 days', exact: true })
      .click();
    await expect(page).toHaveURL(/\/scorecard\?days=90$/);
    await expect(page.getByRole('button', { name: '90 days', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await chooseLanguage(page, 'Български');
    await expect(page.getByText('Все още няма телеметрични данни', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/bg\/.*\/scorecard\?days=90$/);
    await chooseLanguage(page, 'English');
    await page.getByRole('link', { name: 'Back to drivers', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for Elena Fleet', exact: true }).click();
    await chooseMenuItem(page, 'Delete');
    await page
      .getByRole('alertdialog', { name: 'Delete drivers?', exact: true })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByText('Drivers deleted: 1.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Open Elena Fleet', exact: true })).toHaveCount(
      0,
    );
  });

  test('keeps the profile tab around the shared editor and persists a zero manual odometer without inventing telemetry', async ({
    page,
    app,
  }) => {
    const vehicleId = await createVehicle(page, app, 'PROFILE-01');
    await page.goto(app.url + fleet + '/vehicles?search=PROFILE');
    await page.getByRole('button', { name: 'Actions for PROFILE-01', exact: true }).click();
    await chooseMenuItem(page, 'Open profile');
    const profile = app.url + fleet + '/vehicles/' + vehicleId;
    await expect(page).toHaveURL(profile + '/overview?search=PROFILE');
    await expect(kpi(page, 'Odometer')).toHaveText('—');
    await expect(kpi(page, 'Distance, 14 days')).toHaveText('—');
    await page.getByRole('tab', { name: 'Alerts', exact: true }).click();
    await expect(page).toHaveURL(profile + '/alerts?search=PROFILE');
    await expect(page.getByText('No alerts', { exact: true })).toBeVisible();
    await page
      .locator('holita-page-header')
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    const edit = page.getByRole('dialog', { name: 'Edit PROFILE-01', exact: true });
    await edit
      .getByRole('textbox', { name: 'Notes', exact: true })
      .fill('Saved from the real profile.');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await expect(page).toHaveURL(profile + '/alerts?search=PROFILE');
    await page.getByRole('button', { name: 'Record odometer', exact: true }).click();
    const reading = page.getByRole('dialog', { name: 'Record odometer · PROFILE-01', exact: true });
    await expect(reading.getByText('No previous odometer reading.', { exact: true })).toBeVisible();
    await reading.getByRole('spinbutton', { name: /^Odometer, km/ }).fill('0');
    await reading.getByRole('button', { name: 'Record reading', exact: true }).click();
    await expect(reading).toBeHidden();
    await expect(page.getByText('Odometer reading recorded.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(profile + '/alerts?search=PROFILE');
    await expect(kpi(page, 'Odometer')).toHaveText('0');
    const stored = await graphql(
      page,
      app,
      'query BrowserProfile($id:ID!) { fleetVehicle(id:$id) { notes state { odometerKm odometerSource lastReportedAt activity } } fleetDataClock { asOf } }',
      { id: vehicleId },
    );
    expect(object(stored['fleetVehicle'])).toEqual({
      notes: 'Saved from the real profile.',
      state: {
        odometerKm: 0,
        odometerSource: 'MANUAL',
        lastReportedAt: null,
        activity: 'NO_DEVICE',
      },
    });
    expect(object(stored['fleetDataClock'])['asOf']).toBeNull();
    await page.reload();
    await expect(kpi(page, 'Odometer')).toHaveText('0');
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await expect(
      page.getByRole('figure', { name: 'Distance per day, last 14 days' }).locator('tbody tr'),
    ).toHaveCount(0);
    await page
      .locator('holita-page-header')
      .getByRole('link', { name: 'Vehicles', exact: true })
      .click();
    await expect(page).toHaveURL(app.url + fleet + '/vehicles?search=PROFILE');
    await expect(page.getByRole('button', { name: 'Edit PROFILE-01', exact: true })).toBeVisible();
    await page.goto(app.url + `/en/${branchB}/fleet/vehicles/${vehicleId}/overview`);
    await expect(page.getByText('Vehicle not found', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record odometer', exact: true })).toHaveCount(0);
  });

  test('creates Maintenance, records a zero-cost receipt and the next task while keeping service odometer separate', async ({
    page,
    app,
  }) => {
    const vehicleId = await createVehicle(page, app, 'SERVICE-01');
    const today = await businessDate(page, app);
    await page.goto(app.url + fleet + '/maintenance');
    await page
      .locator('holita-page-header')
      .getByRole('button', { name: 'New service task', exact: true })
      .click();
    const create = page.getByRole('dialog', { name: 'New service task', exact: true });
    await selectOption(page, 'Service type', 'Oil change');
    await create.getByRole('textbox', { name: 'Task title', exact: true }).fill('Warranty oil');
    await selectOption(page, 'Vehicle', 'SERVICE-01');
    await create.getByRole('spinbutton', { name: 'Due at odometer, km', exact: true }).fill('1000');
    await create.getByRole('textbox', { name: 'Workshop', exact: true }).fill('Scheduled workshop');
    await create
      .getByRole('textbox', { name: 'Notes', exact: true })
      .fill('Scheduled through the real admin.');
    await create.getByRole('button', { name: 'Plan task', exact: true }).click();
    await expect(create).toBeHidden();
    const edit = page.getByRole('button', { name: 'Edit Warranty oil on SERVICE-01', exact: true });
    await expect(edit).toBeVisible();
    await page
      .getByRole('row')
      .filter({ has: edit })
      .getByRole('button', { name: 'Actions for Warranty oil on SERVICE-01', exact: true })
      .click();
    await chooseMenuItem(page, 'Complete service');
    const completion = page.getByRole('dialog', { name: 'Complete Warranty oil', exact: true });
    await completion.getByRole('combobox', { name: /^Completion date/ }).fill(today);
    await completion
      .getByRole('spinbutton', { name: 'Completion odometer, km', exact: true })
      .fill('100');
    await completion
      .getByRole('spinbutton', { name: 'Actual cost, EUR', exact: true })
      .fill('0.00');
    await completion
      .getByRole('textbox', { name: 'Workshop', exact: true })
      .fill('Warranty workshop');
    await completion
      .getByRole('textbox', { name: 'Replaced parts', exact: true })
      .fill('Oil filter');
    await completion
      .getByRole('textbox', { name: 'Service notes', exact: true })
      .fill('Warranty claim accepted.');
    await completion
      .getByRole('spinbutton', { name: 'Next due odometer, km', exact: true })
      .fill('2000');
    await completion
      .getByRole('spinbutton', { name: 'Next due odometer, km', exact: true })
      .press('Tab');
    await completion
      .getByRole('textbox', { name: 'Next task title', exact: true })
      .fill('Next oil');
    await completion.getByRole('button', { name: 'Complete and plan next', exact: true }).click();
    await expect(completion).toBeHidden();
    await expect(
      page.getByText('Warranty oil was completed and the next service was planned.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Edit Next oil on SERVICE-01', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'View completed Warranty oil on SERVICE-01', exact: true })
      .click();
    const receipt = page.getByRole('dialog', { name: 'Completed Warranty oil', exact: true });
    await expect(receipt.getByText('Warranty workshop', { exact: true })).toBeVisible();
    await expect(receipt.getByText('Oil filter', { exact: true })).toBeVisible();
    await expect(receipt.getByText('Warranty claim accepted.', { exact: true })).toBeVisible();
    await expect(receipt.locator('dd').filter({ hasText: /^€0\.00$/ })).toBeVisible();
    const taskId = string(new URL(page.url()).pathname.split('/').at(-1));
    await page.reload();
    await expect(receipt.getByText('Warranty workshop', { exact: true })).toBeVisible();
    await expect(
      receipt.getByRole('button', { name: 'Complete service', exact: true }),
    ).toHaveCount(0);
    const stored = await graphql(
      page,
      app,
      'query BrowserService($id:ID!,$vehicleId:ID!) { fleetServiceTask(id:$id) { status completedOn completedOdometerKm costCents workshop replacedParts notes } fleetServiceTasks(filter:{vehicleIds:[$vehicleId],statuses:[PLANNED]}) { items { title dueOdometerKm } total } fleetVehicle(id:$vehicleId) { state { odometerKm } } }',
      { id: taskId, vehicleId },
    );
    expect(object(stored['fleetServiceTask'])).toEqual({
      status: 'DONE',
      completedOn: today,
      completedOdometerKm: 100,
      costCents: 0,
      workshop: 'Warranty workshop',
      replacedParts: 'Oil filter',
      notes: 'Warranty claim accepted.',
    });
    expect(object(stored['fleetServiceTasks'])).toEqual({
      items: [{ title: 'Next oil', dueOdometerKm: 2000 }],
      total: 1,
    });
    expect(object(object(stored['fleetVehicle'])['state'])['odometerKm']).toBeNull();
  });

  test('keeps Trips and Alerts empty and scopes missing record drawers without creating demo rows', async ({
    page,
    app,
  }) => {
    const missing = '90000000-0000-4000-8000-000000000099';
    await page.goto(app.url + fleet + '/trips?search=unseen');
    await expect(kpi(page, 'Trips')).toHaveText('0');
    await expect(kpi(page, 'Average score')).toHaveText('—');
    await expect(page.getByRole('button', { name: /^Open trip / })).toHaveCount(0);
    await page.goto(app.url + fleet + '/trips/' + missing + '?search=unseen');
    const trip = page.getByRole('dialog', { name: 'Trip', exact: true });
    await expect(trip.getByText('Record not found', { exact: true })).toBeVisible();
    await trip.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(page).toHaveURL(app.url + fleet + '/trips?search=unseen');
    await page.goto(app.url + fleet + '/alerts');
    await expect(page.getByText('No matching records', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.getByText('No alerts', { exact: true })).toBeVisible();
    await expect(kpi(page, 'Open')).toHaveText('0');
    await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toHaveCount(0);
    await page.goto(app.url + fleet + '/alerts/' + missing);
    const alert = page.getByRole('dialog', { name: 'Alert', exact: true });
    await expect(alert.getByText('Record not found', { exact: true })).toBeVisible();
    await alert.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(page).toHaveURL(app.url + fleet + '/alerts');
    const stored = await graphql(
      page,
      app,
      'query BrowserEmptyTelemetry { fleetTrips { total } fleetEvents { total } fleetDataClock { asOf } }',
    );
    expect(stored).toEqual({
      fleetTrips: { total: 0 },
      fleetEvents: { total: 0 },
      fleetDataClock: { asOf: null },
    });
  });
});
