import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { chooseMenuItem, test } from './angular-fixture.mjs';

interface FleetApp {
  readonly gatewayUrl: string;
  readonly demoSession: { readonly token: string };
  readonly branchA: { readonly id: string };
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
      'x-branch-id': app.branchA.id,
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

test.describe('Fleet adopted screens', () => {
  test('persists Driver documents and explicit clears and deletes the unassigned driver', async ({
    page,
    app,
  }) => {
    const fleet = `/en/${app.branchA.id}/fleet`;
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

  test('creates Maintenance, records a zero-cost receipt and the next task while keeping service odometer separate', async ({
    page,
    app,
  }) => {
    const fleet = `/en/${app.branchA.id}/fleet`;
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
    await expect(receipt.locator('dd').filter({ hasText: /^€0\.00$/ })).toBeVisible();
    const taskId = string(new URL(page.url()).pathname.split('/').at(-1));
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
});
