import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleDrivers } from '../../../../storybook/samples/fleet-samples';

/**
 * The Drivers example inside the shell, with sample data. It shows the mixed drawer: a driver
 * opens read-only (contacts, documents with expiry flags, last 30 days) and Edit switches the
 * same drawer to the form; Cancel or a save returns to the record.
 */
const meta: Meta = {
  title: 'Examples/Fleet/Drivers',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [driver] = sampleDrivers;
if (!driver) throw new Error('The sample drivers are empty.');
const appReady = { timeout: 10_000 };

async function drawerReady(canvasElement: HTMLElement, name: string) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
  return body;
}

export const Default: Story = {
  render: exampleAt('drivers'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    await expect(canvas.getAllByText('Expired').length).toBeGreaterThan(0);
  },
};

/** A row opens the driver read-only; Edit is in the drawer footer. */
export const View: Story = {
  render: exampleAt(`drivers?drawer=${driver.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, driver.name);
    await expect(body.getByRole('button', { name: 'Edit' })).toBeVisible();
  },
};

/** Edit switches the same drawer to the form; Cancel returns to the record. */
export const ViewThenEdit: Story = {
  name: 'View then edit',
  render: exampleAt(`drivers?drawer=${driver.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, driver.name);
    await userEvent.click(body.getByRole('button', { name: 'Edit' }));
    await waitFor(() =>
      expect(body.getByRole('textbox', { name: /Full name/ })).toHaveValue(driver.name),
    );
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.getByRole('button', { name: 'Edit' })).toBeVisible());
  },
};

/** The row's Edit action opens the form directly. */
export const Edit: Story = {
  render: exampleAt(`drivers?drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement, `Edit ${driver.name}`);
  },
};

export const Create: Story = {
  render: exampleAt('drivers?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'New driver');
    await userEvent.click(body.getByRole('button', { name: 'Add driver' }));
    await waitFor(() => expect(body.getByRole('textbox', { name: /Full name/ })).toHaveFocus());
  },
};

export const SaveError: Story = {
  name: 'Save error',
  render: exampleAt(`drivers?scenario=save-error&drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${driver.name}`);
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be saved/), {
      timeout: 3_000,
    });
  },
};

export const Loading: Story = { render: exampleAt('drivers?scenario=loading') };
export const Empty: Story = { render: exampleAt('drivers?scenario=empty') };
export const ErrorState: Story = { name: 'Error', render: exampleAt('drivers?scenario=error') };

export const Mobile: Story = {
  render: exampleAt('drivers'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt(`drivers?drawer=${driver.id}`),
  globals: { theme: 'dark' },
};
