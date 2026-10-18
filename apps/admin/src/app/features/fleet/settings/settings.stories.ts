import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleGroups } from '../../../../storybook/samples/fleet-samples';

/**
 * The settings examples: a short list of vehicle groups (no search or paging; groups with
 * vehicles cannot be deleted) with a small drawer form, and the General page form whose save bar
 * appears while there are changes.
 */
const meta: Meta = {
  title: 'Examples/Settings',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [group] = sampleGroups;
if (!group) throw new Error('The sample groups are empty.');
const appReady = { timeout: 10_000 };

export const VehicleGroups: Story = {
  name: 'Vehicle groups',
  render: exampleAt('settings/groups'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
  },
};

export const EditGroup: Story = {
  name: 'Edit group',
  render: exampleAt(`settings/groups?drawer=${group.id}`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: `Edit ${group.name}` })).toBeVisible(),
      appReady,
    );
  },
};

export const GroupsEmpty: Story = {
  name: 'Vehicle groups empty',
  render: exampleAt('settings/groups?scenario=empty'),
};

export const General: Story = {
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('textbox', { name: /Branch name/ })).toBeVisible(),
      appReady,
    );
    await expect(canvas.queryByRole('region', { name: 'You have unsaved changes.' })).toBeNull();
  },
};

/** A change shows the save bar; saving stores the values and shows a confirmation. */
export const GeneralUnsaved: Story = {
  name: 'General with changes',
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('textbox', { name: /Branch name/ })).toBeVisible(),
      appReady,
    );
    await userEvent.type(canvas.getByRole('textbox', { name: /Branch name/ }), ' North');
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'You have unsaved changes.' })).toBeVisible(),
    );
  },
};

export const GeneralSaved: Story = {
  name: 'General saved',
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('textbox', { name: /Branch name/ })).toBeVisible(),
      appReady,
    );
    await userEvent.click(canvas.getByRole('switch', { name: 'Daily summary' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(canvas.getByText('Settings saved.')).toBeVisible(), {
      timeout: 3_000,
    });
  },
};

export const GeneralMobile: Story = {
  name: 'General mobile',
  render: exampleAt('settings/general'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const GeneralDark: Story = {
  name: 'General dark',
  render: exampleAt('settings/general'),
  globals: { theme: 'dark' },
};
