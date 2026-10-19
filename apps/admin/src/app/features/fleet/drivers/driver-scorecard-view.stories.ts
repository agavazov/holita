import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleDrivers } from '../../../../storybook/samples/fleet-samples';

const meta: Meta = {
  title: 'Examples/Fleet/Driver scorecard',
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

const driver = sampleDrivers.find((driver) => driver.id === 'd01');
if (!driver) throw new Error('Missing scorecard sample driver d01.');
const name = driver.name;
const path = `drivers/${driver.id}/scorecard`;
const appReady = { timeout: 10_000 };

async function pageReady(canvasElement: HTMLElement, driverName = name) {
  const canvas = within(canvasElement);
  await waitFor(
    () => expect(canvas.getByRole('heading', { level: 1, name: driverName })).toBeVisible(),
    appReady,
  );
  return canvas;
}

export const Default: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    await expect(canvas.getByRole('figure', { name: 'Maneuvers by intensity' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: '30 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(canvas.getByText('Unknown intensity', { selector: 'li' })).toBeVisible();
  },
};

export const ChangePeriod: Story = {
  name: 'Change period',
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    const trips = () => canvas.getByRole('group', { name: 'Driving summary' }).textContent;
    const before = trips();
    await userEvent.click(canvas.getByRole('button', { name: '7 days' }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '7 days' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await expect(trips()).not.toBe(before);
    await userEvent.click(canvas.getByRole('button', { name: '90 days' }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: '90 days' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await userEvent.click(canvas.getByRole('link', { name: 'Back to drivers' }));
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name: 'Drivers' })).toBeVisible(),
      appReady,
    );
  },
};

export const FromRow: Story = {
  name: 'Open from a row',
  render: exampleAt('drivers'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    await userEvent.type(canvas.getByRole('searchbox'), name);
    const trigger = await canvas.findByRole('button', { name: `Actions for ${name}` });
    await userEvent.click(trigger);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Scorecard');
    await pageReady(canvasElement);
  },
};

export const FromDrawer: Story = {
  name: 'Open from the driver drawer',
  render: exampleAt(`drivers?drawer=${driver.id}`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
    await userEvent.click(
      within(body.getByRole('dialog', { name })).getByRole('button', { name: 'Scorecard' }),
    );
    await pageReady(canvasElement);
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
  },
};

export const NewDriver: Story = {
  name: 'Create without optional documents and open the scorecard',
  render: exampleAt('drivers?scenario=empty&drawer=new'),
  play: async ({ canvasElement }) => {
    const createdName = 'Avery Scorecard Driver';
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'New driver' })).toBeVisible(),
      appReady,
    );
    const drawer = within(body.getByRole('dialog', { name: 'New driver' }));
    await userEvent.type(drawer.getByRole('textbox', { name: /First name/ }), 'Avery');
    await userEvent.type(drawer.getByRole('textbox', { name: /Last name/ }), 'Scorecard Driver');
    await userEvent.click(drawer.getByRole('button', { name: 'Add driver' }));
    await waitFor(
      () => expect(body.getByRole('dialog', { name: createdName })).toBeVisible(),
      appReady,
    );
    const categories = within(body.getByRole('dialog', { name: createdName })).getByText(
      'License categories',
    );
    await expect(categories.parentElement).toHaveTextContent('—');
    await userEvent.click(
      within(body.getByRole('dialog', { name: createdName })).getByRole('button', {
        name: 'Scorecard',
      }),
    );
    const canvas = await pageReady(canvasElement, createdName);
    await expect(canvas.getByText('No trips in this period')).toBeVisible();
    await expect(canvas.getByText('with a driving score: 0 of 0')).toBeVisible();
    await expect(canvas.getByText(/Total maneuvers:\s*0/)).toBeVisible();
    await userEvent.click(canvas.getByRole('link', { name: 'Back to drivers' }));
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name: 'Drivers' })).toBeVisible(),
      appReady,
    );
    await userEvent.type(canvas.getByRole('searchbox'), createdName);
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: `Open ${createdName}` })).toBeVisible(),
    );
  },
};

export const EditedDriver: Story = {
  name: 'An edited driver keeps its name in the scorecard',
  render: exampleAt(`drivers?drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    const editedName = 'Avery Edited Driver';
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: `Edit ${name}` })).toBeVisible(),
      appReady,
    );
    const drawer = within(body.getByRole('dialog', { name: `Edit ${name}` }));
    const firstName = drawer.getByRole('textbox', { name: /First name/ });
    const lastName = drawer.getByRole('textbox', { name: /Last name/ });
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Avery');
    await userEvent.clear(lastName);
    await userEvent.type(lastName, 'Edited Driver');
    await userEvent.click(drawer.getByRole('button', { name: 'Save' }));
    await waitFor(
      () => expect(body.getByRole('dialog', { name: editedName })).toBeVisible(),
      appReady,
    );
    await userEvent.click(
      within(body.getByRole('dialog', { name: editedName })).getByRole('button', {
        name: 'Scorecard',
      }),
    );
    await pageReady(canvasElement, editedName);
  },
};

export const LowConfidence: Story = {
  name: 'Limited data',
  render: exampleAt(`${path}?scenario=low-confidence`),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText(/Limited data: fewer than five trips/)).toBeVisible(),
    );
    await expect(canvas.getByText('with a driving score: 3 of 3')).toBeVisible();
  },
};

export const Unscored: Story = {
  name: 'Trips without scores',
  render: exampleAt(`${path}?scenario=unscored`),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    await expect(canvas.getByText(/with a driving score: 0 of /)).toBeVisible();
    await expect(canvas.getByRole('figure', { name: 'Maneuvers by intensity' })).toBeVisible();
  },
};

export const ZeroScores: Story = {
  name: 'Reported zero scores',
  render: exampleAt(`${path}?scenario=zero-scores`),
};
export const Empty: Story = {
  render: exampleAt(`${path}?scenario=empty`),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    await expect(canvas.getByText('No trips in this period')).toBeVisible();
  },
};
export const NoTelemetry: Story = {
  name: 'No telemetry',
  render: exampleAt(`${path}?scenario=no-telemetry`),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    await expect(canvas.getByText('No telemetry yet')).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'Driving summary' })).toBeNull();
  },
};
export const Loading: Story = { render: exampleAt(`${path}?scenario=loading`) };
export const NotFound: Story = {
  name: 'Not found',
  render: exampleAt('drivers/no-such-driver/scorecard'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Driver not found')).toBeVisible(), appReady);
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt(`${path}?scenario=error`),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByText('Scorecard could not be loaded')).toBeVisible(),
      appReady,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await pageReady(canvasElement);
  },
};
export const Mobile: Story = {
  render: exampleAt(path),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = {
  render: exampleAt(path),
  globals: { theme: 'dark' },
};
